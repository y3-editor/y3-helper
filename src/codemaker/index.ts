import * as vscode from 'vscode';
import { CodeMakerWebviewProvider } from './webviewProvider';
import { CodeMakerApiServer } from './apiServer';
import { initOpenFilesHandler } from './handlers/openFilesHandler';
import { initWorkspaceTracker } from './handlers/workspaceTracker';
import SkillsHandler from './skillsHandler';

let webviewProvider: CodeMakerWebviewProvider | undefined;
let apiServer: CodeMakerApiServer | undefined;

/**
 * 初始化 CodeMaker 模块
 */
export function initCodeMaker(context: vscode.ExtensionContext) {
    const extensionUri = context.extensionUri;

    // 创建 WebviewViewProvider
    webviewProvider = new CodeMakerWebviewProvider(extensionUri);

    // 注册到 codemaker.webview 视图（已在 package.json 中声明于 secondarySidebar 容器）
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            CodeMakerWebviewProvider.viewType,
            webviewProvider,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    // 创建 API Server 管理器
    const globalStoragePath = context.globalStorageUri.fsPath;
    apiServer = new CodeMakerApiServer(extensionUri, globalStoragePath);

    // 启动 API Server（完成后再自动展开面板，避免 iframe 在 Server 就绪前加载）
    startApiServer(context);

    // 注册打开命令
    context.subscriptions.push(
        vscode.commands.registerCommand('y3-helper.codemaker.open', () => {
            vscode.commands.executeCommand('codemaker.webview.focus');
        })
    );

    // 监听配置变化 → 重发 INIT_DATA，刷新前端配置（API Key、Base URL、Model 等）
    // 注：API Server 不需要重启，因为前端请求体中会携带最新的 api_key 和 base_url
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (
                e.affectsConfiguration('Y3Maker.CodeChatApiKey') ||
                e.affectsConfiguration('Y3Maker.CodeChatApiBaseUrl') ||
                e.affectsConfiguration('Y3Maker.CodeChatModel') ||
                e.affectsConfiguration('Y3Maker.CodeChatWireApi')
            ) {
                // 向 webview 重新发送 INIT_DATA，刷新前端配置
                if (webviewProvider) {
                    webviewProvider.refreshInitData();
                }
            }
        })
    );

    // 初始化 workspaceTracker 和 openFilesHandler（与源码版一致：在 extension activate 时初始化）
    initOpenFilesHandler(context);
    initWorkspaceTracker();

    // 初始化 SkillsHandler（异步，不阻塞扩展激活）
    const skillsHandler = SkillsHandler.getInstance();
    skillsHandler.initialize(context).catch(err => {
        console.error('[Y3Maker] SkillsHandler initialization failed:', err);
    });

}

async function startApiServer(context: vscode.ExtensionContext) {
    if (!apiServer) { return; }

    try {
        const port = await apiServer.start();
        if (webviewProvider) {
            webviewProvider.setApiServerPort(port);
        }
        console.log(`[Y3Maker] API Server started on port ${port}`);

        // API Server 就绪后，仅首次自动展开面板（后续交给 VS Code 布局恢复）
        const everOpened = context.globalState.get<boolean>('codemaker.everOpened', false);
        if (!everOpened) {
            vscode.commands.executeCommand('codemaker.webview.focus');
            context.globalState.update('codemaker.everOpened', true);
        }
    } catch (err) {
        console.error('[Y3Maker] Failed to start API Server:', err);
        vscode.window.showErrorMessage(`Y3Maker API Server 启动失败: ${err}`);
    }
}

export function stopCodeMaker() {
    if (apiServer) {
        apiServer.stop();
        apiServer = undefined;
    }

    // 清理 SkillsHandler
    const skillsHandler = SkillsHandler.getInstance();
    skillsHandler.dispose();
}

export { webviewProvider, apiServer };