import * as vscode from 'vscode';

/**
 * 读取 CodeMaker 相关的 VSCode 配置项
 */
export function getCodeMakerConfig() {
    const config = vscode.workspace.getConfiguration('Y3Maker');
    return {
        apiKey: config.get<string>('CodeChatApiKey', ''),
        apiBaseUrl: config.get<string>('CodeChatApiBaseUrl', ''),
        model: config.get<string>('CodeChatModel', ''),
        wireApi: config.get<string>('CodeChatWireApi', 'chat-completions'),
    };
}