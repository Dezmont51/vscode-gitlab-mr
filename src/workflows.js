const vscode = require('vscode');
const open = require('opn');
const url = require('url');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

// Helper function to get webview options
const getWebviewOptions = extensionUri => {
    return {
        // Enable javascript in the webview
        enableScripts: true,
        // And restrict the webview to only loading content from our extension's `src/templates` directory.
        // and `dist` or other relevant directories if you have assets there.
        localResourceRoots: [
            vscode.Uri.joinPath(extensionUri, 'src', 'templates'),
            vscode.Uri.joinPath(extensionUri, 'dist') // Example: if you bundle JS/CSS to dist
        ]
    };
};

const gitActions = require('./git');
const gitlabActions = require('./gitlab');
const gitUtils = require('./git-utils');

const message = msg => `Gitlab MR: ${msg}`;
const ERROR_STATUS = message('Unable to create MR.');
const STATUS_TIMEOUT = 10000;
const WIP_STRING = 'WIP:';
const CONFIG_NAMESPACE = 'gitlab-mr';

const showErrorMessage = msg => {
    vscode.window.showErrorMessage(message(msg));
    vscode.window.setStatusBarMessage(ERROR_STATUS, STATUS_TIMEOUT);
};

const showAccessTokenErrorMessage = gitlabApiUrl => {
    const tokenUrl = `${gitlabApiUrl}/profile/personal_access_tokens`;
    const errorMsg = gitlabApiUrl === 'https://gitlab.com' ?
        'gitlab-mr.accessToken preference not set.' :
        `gitlab-mr.accessTokens["${gitlabApiUrl}"] preference not set.`;

    const generateTokenLabel = 'Generate Access Token';

    return vscode.window.showErrorMessage(message(errorMsg), generateTokenLabel).then(selected => {
        switch (selected) {
            case generateTokenLabel:
                open(tokenUrl);
                break;
        }
    });
};

const selectWorkspaceFolder = async () => {
    if (vscode.workspace.workspaceFolders.length > 1) {
        const selected = await vscode.window.showQuickPick(vscode.workspace.workspaceFolders.map(folder => ({
            label: folder.name,
            folder
        })), {
            placeHolder: 'Select workspace folder',
            ignoreFocusOut: true
        });

        if (selected) {
            return selected.folder;
        }
    } else {
        return vscode.workspace.workspaceFolders[0];
    }
};

const buildGitlabContext = async workspaceFolderPath => {
    const preferences = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
    const targetRemote = preferences.get('targetRemote', 'origin');

    // Access tokens
    const gitlabComAccessToken = preferences.get('accessToken');
    const gitlabCeAccessTokens = preferences.get('accessTokens') || {};

    // Set git context
    const git = buildGitContext(workspaceFolderPath);

    const { repoId, repoHost } = await git.parseRemotes(targetRemote);
    const gitlabHosts = gitUtils.parseGitlabHosts(gitlabCeAccessTokens);
    const repoWebProtocol = gitUtils.parseRepoProtocol(repoHost, gitlabHosts);

    const gitlabApiUrl = url.format({
        host: repoHost,
        protocol: repoWebProtocol
    });
    const isGitlabCom = repoHost === 'gitlab.com';
    const accessToken = isGitlabCom ? gitlabComAccessToken : gitlabCeAccessTokens[gitlabApiUrl];

    // Token not set for repo host
    if (!accessToken) {
        return showAccessTokenErrorMessage(gitlabApiUrl);
    }

    // Build Gitlab context
    return gitlabActions({
        url: gitlabApiUrl,
        token: accessToken,
        repoId,
        repoHost,
        repoWebProtocol
    });
};

const buildGitContext = workspaceFolderPath => gitActions(workspaceFolderPath);

// 引入必要的 VSCode 模块
const { ViewColumn } = require('vscode');

// 添加一个新的函数来显示自定义表单
// IMPORTANT: This function now needs extensionUri to be passed from where it's called (e.g., from extension.js)
const showCreateMRForm = async extensionUri => {
    if (!extensionUri || !extensionUri.fsPath) { // Added a check for fsPath for safety
        vscode.window.showErrorMessage('Extension URI is not available or invalid. Cannot show MR form.');
        return;
    }
    // 获取当前工作区文件夹
    const workspaceFolder = await selectWorkspaceFolder();
    if (!workspaceFolder) {
        return;
    }

    const workspaceFolderPath = workspaceFolder.uri.fsPath;
    const git = buildGitContext(workspaceFolderPath);
    const preferences = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
    const targetRemote = preferences.get('targetRemote', 'origin');
    
    // 获取所有远程分支名称
    const branchSummary = await git.listBranches(targetRemote);
    const branches = Object.keys(branchSummary.branches).map(branch => branchSummary.branches[branch].name);

    // 获取前分支名称
    const currentBranch = await git.getCurrentBranch();

    // 获取上次使用的目标分支
    const lastTargetBranch = preferences.get('targetBranch', 'master');

    // 获取最后一次提交消息
    const lastCommitMessage = await git.lastCommitMessage();

    // 获取删除源分支的配置
    const removeSourceBranch = preferences.get('removeSourceBranch', false);

    // 获取上次使用的受让人
    const lastAssignees = preferences.get('lastAssignees', []);

    // 获取存储的标签
    const storedLabels = preferences.get('projectLabels', []);

    const panel = vscode.window.createWebviewPanel(
        'createMR', // 视图型
        '创建 Merge Request', // 标题
        ViewColumn.One, // 显示在编辑器的哪个面板
        getWebviewOptions(extensionUri) // Pass the options here
    );
    
    // 设置 Webview 的 HTML 内容，并传递分支列表、当前分支、最后一次提交信息、默认 assignees 和 labels
    panel.webview.html = getWebviewContent(panel.webview, extensionUri, branches, currentBranch, lastTargetBranch, lastCommitMessage, removeSourceBranch, lastAssignees, storedLabels);

    // 处理来自 Webview 的消息
    panel.webview.onDidReceiveMessage(async message => {
        switch (message.command) {
            case 'submit':
                const { branch, targetBranch, mrTitle, description, deleteSourceBranch, squashCommits, assigneeIds, labels } = message;
                await openMR(branch, targetBranch, mrTitle, description, deleteSourceBranch, squashCommits, assigneeIds, labels);
                panel.dispose();
                break;
            case 'fetchAssignees':
                await handleFetchAssignees(message.query, panel);
                break;
            case 'refreshLabels':
                await handleRefreshLabels(panel);
                break;
            case 'cancel':
                panel.dispose();
                break;
        }
    });
};

// 添加处理 fetchAssignees 消息的函数
const handleFetchAssignees = async (query, panel) => {
    const workspaceFolder = await selectWorkspaceFolder();
    if (!workspaceFolder) {
        return;
    }

    const workspaceFolderPath = workspaceFolder.uri.fsPath;
    const gitlab = await buildGitlabContext(workspaceFolderPath);

    try {
        const users = await gitlab.searchUsers(query);
        panel.webview.postMessage({ command: 'provideAssignees', assignees: users });
    } catch (error) {
        panel.webview.postMessage({ command: 'provideAssignees', assignees: [] });
    }
};

// 添加处理 refreshLabels 消息的函数
const handleRefreshLabels = async panel => {
    const workspaceFolder = await selectWorkspaceFolder();
    if (!workspaceFolder) {
        return;
    }

    const workspaceFolderPath = workspaceFolder.uri.fsPath;
    const gitlab = await buildGitlabContext(workspaceFolderPath);

    try {
        const labels = await gitlab.listLabels();
        // 存储完整的标签对象到配置（包含颜色信息）
        await vscode.workspace.getConfiguration('gitlab-mr').update('projectLabels', labels, vscode.ConfigurationTarget.Workspace);
        panel.webview.postMessage({ command: 'provideLabels', labels });
    } catch (error) {
        console.error('Error fetching labels:', error);
        panel.webview.postMessage({ command: 'provideLabels', labels: [] });
    }
};

// 修改获取 Webview 内容的函数，添加分支的下拉菜单和预填充MR标题
const getWebviewContent = (webview, extensionUri, branches, currentBranch, lastTargetBranch, lastCommitMessage, removeSourceBranch, lastAssignees = [], storedLabels = []) => {
    const templatePath = path.join(__dirname, 'templates', 'createMrPage.ejs');
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'templates', 'createMrPage.css'));
    const template = fs.readFileSync(templatePath, 'utf-8');
    
    // Detect current VS Code theme
    const currentTheme = vscode.window.activeColorTheme;
    let vscodeTheme = 'vscode-light'; // Default to light
    if (currentTheme.kind === vscode.ColorThemeKind.Dark) {
        vscodeTheme = 'vscode-dark';
    } else if (currentTheme.kind === vscode.ColorThemeKind.HighContrast) {
        // For High Contrast, VS Code themes often have specific -hc variants or rely on general high contrast support
        // We can add a general class and potentially a specific one if needed
        vscodeTheme = 'vscode-high-contrast'; 
        // You could also check if it's High Contrast Light or Dark if specific styles are needed:
        // const editorBackground = new vscode.ThemeColor('editor.background').toString();
        // if (editorBackground.toLowerCase().includes('light') ) { vscodeTheme += ' vscode-high-contrast-light';} 
        // else {vscodeTheme += ' vscode-high-contrast-dark';}
    }

    const data = {
        webview, // Pass webview object for cspSource in EJS
        styleUri,
        vscodeTheme, // Pass the theme class to EJS
        branches,
        currentBranch,
        lastTargetBranch,
        lastCommitMessage,
        removeSourceBranch,
        lastAssignees,
        storedLabels
    };
    return ejs.render(template, data);
};

// 修改 openMR 函数以处理 new parameters: assigneeIds 和 labels
const openMR = async (branch, targetBranch, mrTitle, description, deleteSourceBranch, squashCommits, assigneeIds, labels) => {
    const preferences = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);

    const targetRemote = preferences.get('targetRemote', 'origin');
    const autoCommitChanges = preferences.get('autoCommitChanges', false);
    const autoOpenMr = preferences.get('autoOpenMr', false);
    const openToEdit = preferences.get('openToEdit', false);
    
    // Pick workspace
    const workspaceFolder = await selectWorkspaceFolder();
    if (!workspaceFolder) {
        return;
    }

    const workspaceFolderPath = workspaceFolder.uri.fsPath;

    // Set git context
    const git = buildGitContext(workspaceFolderPath);

    const gitlab = await buildGitlabContext(workspaceFolderPath);

    // Validate branch name
    if (branch === '') {
        return showErrorMessage('Branch name must be provided.');
    }

    if (branch.indexOf(' ') > -1) {
        return showErrorMessage('Branch name must not contain spaces.');
    }

    const { onMaster, cleanBranch } = await git.checkStatus(branch);

    if (branch === targetBranch) {
        return showErrorMessage(`Target branch name cannot be same with origin branch (${targetBranch}).`);
    }

    const buildStatus = vscode.window.setStatusBarMessage(message(`Building MR to ${targetBranch} from ${branch}...`));
    
    // If the branch is not clean, and autoCommitChanges is false,
    // prompt user if they want to commit changes.
    // Otherwise, commit changes.
    const commitChanges = !cleanBranch && !autoCommitChanges ? (
        await vscode.window.showQuickPick([
            { label: 'Yes', value: true },
            { label: 'No', value: false }
        ], {
            placeHolder: 'Commit current changes?',
            ignoreFocusOut: true
        })
            .then(selection => selection && selection.value)
    ) : true;

    if (commitChanges === undefined) {
        return;
    }

    // Build up chain of git commands to run
    let gitPromises;
    if (!onMaster) {
        if (cleanBranch || !commitChanges) {
            gitPromises = git.createBranch(branch)
                .then(() => git.pushBranch(targetRemote, branch));
        } else {
            gitPromises = git.createBranch(branch)
                .then(() => git.addFiles('./*'))
                .then(() => git.commitFiles(mrTitle))
                .then(() => git.pushBranch(targetRemote, branch));
        }
    } else {
        if (cleanBranch || !commitChanges) {
            gitPromises = git.pushBranch(targetRemote, branch);
        } else {
            gitPromises = git.addFiles('./*')
                .then(() => git.commitFiles(mrTitle))
                .then(() => git.pushBranch(targetRemote, branch));
        }
    }

    await gitPromises
        .catch(err => {
            buildStatus.dispose();
            throw err;
        });

    return gitlab.openMr(branch, targetBranch, mrTitle, description, deleteSourceBranch, squashCommits, assigneeIds, labels)
        .then(mr => {
            // 更新配置中的 targetBranch
            preferences.update('targetBranch', targetBranch, vscode.ConfigurationTarget.Workspace);

            const successMessage = message(`MR !${mr.iid} 创建成功。`);
            const successButton = '打开 MR';

            buildStatus.dispose();
            vscode.window.setStatusBarMessage(successMessage, STATUS_TIMEOUT);

            const mrWebUrl = `${mr.web_url}${openToEdit ? '/edit' : ''}`;

            if (autoOpenMr) {
                vscode.env.openExternal(vscode.Uri.parse(mrWebUrl));
                return vscode.window.showInformationMessage(successMessage);
            }

            return vscode.window.showInformationMessage(successMessage, successButton).then(selected => {
                switch (selected) {
                    case successButton: {
                        vscode.env.openExternal(vscode.Uri.parse(mrWebUrl));
                        break;
                    }
                }
            });
        })
        .catch(err => {
            // showErrorMessage(err.message);
            buildStatus.dispose();

            let mrUrl = gitlab.buildMrUrl(branch, targetBranch);

            let createButton = 'Create on Gitlab';

            if (err.statusCode === 409) {
                // 重复创建
                createButton = 'Open exist MR on Gitlab';
                // 从错误消息中提取 MR ID
                const mrId = err.message.match(/!(\d+)/)[1];
                mrUrl = gitlab.buildExistMrUrl(mrId);

            }
            vscode.window.setStatusBarMessage(ERROR_STATUS, STATUS_TIMEOUT);
            vscode.window.showErrorMessage(err.message, createButton).then(selected => {
                switch (selected) {
                    case createButton:
                        vscode.env.openExternal(vscode.Uri.parse(mrUrl));
                        break;
                }
            });
        });
};

const listMRs = async workspaceFolderPath => {
    const preferences = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);

    const targetBranch = preferences.get('targetBranch', 'master');

    const gitlab = await buildGitlabContext(workspaceFolderPath);
    const mrs = await gitlab.listMrs();

    const mrList = mrs.map(mr => {
        const label = `MR !${mr.iid}: ${mr.title}`;
        const detail = mr.description;
        let description = `${mr.source_branch}`;

        if (mr.target_branch !== targetBranch) {
            description += ` > ${mr.target_branch}`;
        }

        return {
            mr,
            label,
            detail,
            description
        };
    });

    const selected = await vscode.window.showQuickPick(mrList, {
        matchOnDescription: true,
        placeHolder: 'Select MR',
        ignoreFocusOut: true
    });

    if (selected) {
        return selected.mr;
    }
};

const viewMR = async () => {
    const workspaceFolder = await selectWorkspaceFolder();
    if (!workspaceFolder) {
        return;
    }

    const mr = await listMRs(workspaceFolder.uri.fsPath);
    if (!mr) {
        return;
    }

    vscode.env.openExternal(vscode.Uri.parse(mr.web_url));
};

const checkoutMR = async () => {
    const preferences = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
    const targetRemote = preferences.get('targetRemote', 'master');

    const workspaceFolder  = await selectWorkspaceFolder();
    if (!workspaceFolder) {
        return;
    }

    const workspaceFolderPath = workspaceFolder.uri.fsPath;

    const mr = await listMRs(workspaceFolderPath);
    if (!mr) {
        return;
    }

    const git = buildGitContext(workspaceFolderPath);

    const checkoutStatus = vscode.window.setStatusBarMessage(message(`Checking out MR !${mr.iid}...`));

    return git.listBranches()
        .then(async branches => {
            const branchName = mr.source_branch;
            const targetBranch = branches.branches[branchName];

            if (targetBranch) {
                // Switch to existing branch
                return git.checkoutBranch([branchName]);
            }

            // Fetch and switch to remote branch
            await git.fetchRemote(targetRemote, branchName);
            return git.checkoutBranch(['-b', branchName, `${targetRemote}/${branchName}`]);
        })
        .then(() => {
            checkoutStatus.dispose();
            vscode.window.setStatusBarMessage(message(`Switched to MR !${mr.iid}.`), STATUS_TIMEOUT);
        })
        .catch(err => {
            checkoutStatus.dispose();
            showErrorMessage(err.message);
        });
};

const searchUsers = async gitlab => {
    const search = await vscode.window.showInputBox({
        placeHolder: 'Search for user...',
        ignoreFocusOut: true
    });

    if (search) {
        const users = await gitlab.searchUsers(search);

        if (users) {
            const userOptions = users.map(user => ({
                label: `${user.name} (${user.username})`,
                user
            }));

            const otherOptions = [
                { label: 'Search again...', searchAgain: true }
            ];

            const selection = await vscode.window.showQuickPick([
                ...userOptions,
                ...otherOptions
            ], {
                placeHolder: 'Select a user...'
            });

            if (selection.searchAgain) {
                return searchUsers(gitlab);
            }

            return selection;
        }
    }
};

const editMR = async () => {
    const workspaceFolder = await selectWorkspaceFolder();
    if (!workspaceFolder) {
        return;
    }

    const workspaceFolderPath = workspaceFolder.uri.fsPath;
    const mr = await listMRs(workspaceFolderPath);
    if (!mr) {
        return;
    }

    const gitlab = await buildGitlabContext(workspaceFolderPath);

    const editCommands = {
        editTitle: 'Edit title',
        setWip: mr.work_in_progress ? 'Remove WIP' : 'Set as WIP',
        editAssignee: mr.assignee ? `Edit assignee (${mr.assignee.username})`: 'Set assignee',
        removeAssignee: `Remove assignee ${mr.assignee ? `(${mr.assignee.username})` : ''}`,
        addApprovers: 'Add approvers'
    };

    const selected = await vscode.window.showQuickPick(Object.values(editCommands), {
        placeHolder: 'Select an action...',
        ignoreFocusOut: true
    });

    const showGitlabError = e => {
        showErrorMessage(e.error.error || e.error.message);
    };

    switch (selected) {
        case editCommands.editTitle:
            const title = await vscode.window.showInputBox({
                value: mr.title
            });

            if (title) {
                return gitlab.editMr(mr.iid, {
                    title
                })
                    .then(() => vscode.window.showInformationMessage(message(`MR !${mr.iid} title updated.`)))
                    .catch(showGitlabError);
            }
            break;

        case editCommands.setWip:
            return gitlab.editMr(mr.iid, {
                title: mr.work_in_progress ? mr.title.split(WIP_STRING)[1].trim() : `${WIP_STRING} ${mr.title}`
            })
                .then(updatedMr => vscode.window.showInformationMessage(message(`MR !${mr.iid} WIP ${updatedMr.work_in_progress ? 'added' : 'removed'}.`)))
                .catch(showGitlabError);

        case editCommands.editAssignee:
            const assignee = await searchUsers(gitlab);
            if (assignee) {
                return gitlab.editMr(mr.iid, {
                    assignee_id: assignee.user.id
                })
                    .then(() => vscode.window.showInformationMessage(message(`MR !${mr.iid} assignee set to ${assignee.user.username}`)))
                    .catch(showGitlabError);
            }
            break;

        case editCommands.removeAssignee:
            return gitlab.editMr(mr.iid, {
                assignee_id: null
            })
                .then(() => vscode.window.showInformationMessage(message(`MR !${mr.iid} assignee removed.`)))
                .catch(showGitlabError);

        case editCommands.addApprovers:
            const approvals = await gitlab.getApprovals(mr.iid);
            const approver = await searchUsers(gitlab);
            if (approver) {
                return gitlab.editApprovers(mr.iid, {
                    approver_ids: [
                        ...approvals.approvers.map(app => app.user.id),
                        approver.user.id
                    ],
                    approver_group_ids: [
                        ...approvals.approver_groups.map(app => app.group.id)
                    ]
                })
                    .then(() => vscode.window.showInformationMessage(message(`MR !${mr.iid} approver added.`)))
                    .catch(showGitlabError);
            }
            break;

        default:
            break;
    }
};

module.exports = {
    listMRs: () => listMRs().catch(e => showErrorMessage(e.message)),
    viewMR: () => viewMR().catch(e => showErrorMessage(e.message)),
    checkoutMR: () => checkoutMR().catch(e => showErrorMessage(e.message)),
    // The caller (e.g., in extension.js) needs to pass context.extensionUri
    // Example: vscode.commands.registerCommand('extension.openMR', () => commands.openMR(context.extensionUri));
    openMR: showCreateMRForm, 
    editMR: () => editMR().catch(e => showErrorMessage(e.message))
};
