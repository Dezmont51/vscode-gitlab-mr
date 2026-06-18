const vscode = require('vscode');
const workflows = require('./workflows');

const CONFIG_NAMESPACE = 'gitlab-mr';
const STATUS_BAR_REFRESH_INTERVAL = 60000;
const STATUS_BAR_DEBOUNCE_DELAY = 250;

function activate(context) {
    const openMR = vscode.commands.registerCommand('extension.openMR', () => workflows.openMR(context.extensionUri));
    const openStatusBarMR = vscode.commands.registerCommand('extension.openStatusBarMR', async () => {
        await workflows.openCurrentMR(context.extensionUri);
        updateStatusBarButton();
    });
    const viewMR = vscode.commands.registerCommand('extension.viewMR', workflows.viewMR);
    const checkoutMR = vscode.commands.registerCommand('extension.checkoutMR', workflows.checkoutMR);
    const editMR = vscode.commands.registerCommand('extension.editMR', workflows.editMR);
    const openMRStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    let statusBarUpdateVersion = 0;
    let statusBarUpdateTimeout;
    let lastActiveWorkspaceFolderPath;

    const getActiveWorkspaceFolderPath = () => {
        const activeEditor = vscode.window.activeTextEditor;

        if (!activeEditor) {
            return undefined;
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
        return workspaceFolder && workspaceFolder.uri.fsPath;
    };

    const updateStatusBarButton = async () => {
        const updateVersion = ++statusBarUpdateVersion;
        const showStatusBarButton = vscode.workspace.getConfiguration(CONFIG_NAMESPACE).get('showStatusBarButton', true);

        if (!showStatusBarButton) {
            openMRStatusBarItem.hide();
            return;
        }

        openMRStatusBarItem.show();
        openMRStatusBarItem.text = '$(git-pull-request) MR';
        openMRStatusBarItem.tooltip = 'Create GitLab MR';

        const status = await workflows.getCurrentMRStatus({ silent: true });

        if (updateVersion !== statusBarUpdateVersion) {
            return;
        }

        if (status.state === 'found') {
            openMRStatusBarItem.text = `$(git-pull-request) MR !${status.mr.iid}`;
            openMRStatusBarItem.tooltip = `Open existing GitLab MR for ${status.branch} > ${status.targetBranch}`;
        }
    };

    const scheduleStatusBarButtonUpdate = () => {
        if (statusBarUpdateTimeout) {
            globalThis.clearTimeout(statusBarUpdateTimeout);
        }

        statusBarUpdateTimeout = globalThis.setTimeout(() => {
            statusBarUpdateTimeout = undefined;
            updateStatusBarButton();
        }, STATUS_BAR_DEBOUNCE_DELAY);
    };

    const updateStatusBarButtonForActiveEditor = () => {
        const activeWorkspaceFolderPath = getActiveWorkspaceFolderPath();

        if (activeWorkspaceFolderPath === lastActiveWorkspaceFolderPath) {
            return;
        }

        lastActiveWorkspaceFolderPath = activeWorkspaceFolderPath;
        scheduleStatusBarButtonUpdate();
    };

    openMRStatusBarItem.command = 'extension.openStatusBarMR';
    lastActiveWorkspaceFolderPath = getActiveWorkspaceFolderPath();
    updateStatusBarButton();

    context.subscriptions.push(openMR);
    context.subscriptions.push(openStatusBarMR);
    context.subscriptions.push(viewMR);
    context.subscriptions.push(checkoutMR);
    context.subscriptions.push(editMR);
    context.subscriptions.push(openMRStatusBarItem);
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration(`${CONFIG_NAMESPACE}.showStatusBarButton`)) {
            scheduleStatusBarButtonUpdate();
        }
    }));
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateStatusBarButtonForActiveEditor));
    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => {
        lastActiveWorkspaceFolderPath = getActiveWorkspaceFolderPath();
        scheduleStatusBarButtonUpdate();
    }));
    const statusBarRefreshTimer = globalThis.setInterval(updateStatusBarButton, STATUS_BAR_REFRESH_INTERVAL);
    context.subscriptions.push({ dispose: () => globalThis.clearInterval(statusBarRefreshTimer) });
    context.subscriptions.push({ dispose: () => statusBarUpdateTimeout && globalThis.clearTimeout(statusBarUpdateTimeout) });
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
