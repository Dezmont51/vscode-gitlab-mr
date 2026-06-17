const vscode = require('vscode');
const workflows = require('./workflows');

const CONFIG_NAMESPACE = 'gitlab-mr';

function activate(context) {
    const openMR = vscode.commands.registerCommand('extension.openMR', () => workflows.openMR(context.extensionUri));
    const viewMR = vscode.commands.registerCommand('extension.viewMR', workflows.viewMR);
    const checkoutMR = vscode.commands.registerCommand('extension.checkoutMR', workflows.checkoutMR);
    const editMR = vscode.commands.registerCommand('extension.editMR', workflows.editMR);
    const openMRStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    const updateStatusBarButton = () => {
        const showStatusBarButton = vscode.workspace.getConfiguration(CONFIG_NAMESPACE).get('showStatusBarButton', true);

        if (showStatusBarButton) {
            openMRStatusBarItem.show();
        } else {
            openMRStatusBarItem.hide();
        }
    };

    openMRStatusBarItem.command = 'extension.openMR';
    openMRStatusBarItem.text = '$(git-pull-request) MR';
    openMRStatusBarItem.tooltip = 'Create GitLab MR';
    updateStatusBarButton();

    context.subscriptions.push(openMR);
    context.subscriptions.push(viewMR);
    context.subscriptions.push(checkoutMR);
    context.subscriptions.push(editMR);
    context.subscriptions.push(openMRStatusBarItem);
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration(`${CONFIG_NAMESPACE}.showStatusBarButton`)) {
            updateStatusBarButton();
        }
    }));
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
