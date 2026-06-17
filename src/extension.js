const vscode = require('vscode');
const workflows = require('./workflows');

const CONFIG_NAMESPACE = 'gitlab-mr';
const STATUS_BAR_REFRESH_INTERVAL = 60000;

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

    openMRStatusBarItem.command = 'extension.openStatusBarMR';
    updateStatusBarButton();

    context.subscriptions.push(openMR);
    context.subscriptions.push(openStatusBarMR);
    context.subscriptions.push(viewMR);
    context.subscriptions.push(checkoutMR);
    context.subscriptions.push(editMR);
    context.subscriptions.push(openMRStatusBarItem);
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration(`${CONFIG_NAMESPACE}.showStatusBarButton`)) {
            updateStatusBarButton();
        }
    }));
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateStatusBarButton));
    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(updateStatusBarButton));
    const statusBarRefreshTimer = globalThis.setInterval(updateStatusBarButton, STATUS_BAR_REFRESH_INTERVAL);
    context.subscriptions.push({ dispose: () => globalThis.clearInterval(statusBarRefreshTimer) });
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
