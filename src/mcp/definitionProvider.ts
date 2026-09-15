import * as vscode from 'vscode';
import * as l10n from '@vscode/l10n';
import { MCP_ENDPOINT } from './mcpInfo';

export const MCP_SERVER_PROVIDER_ID = 'y3-helper.mcp-servers';

export class McpDefinitionProvider implements vscode.McpServerDefinitionProvider, vscode.Disposable {
    private readonly changeEmitter = new vscode.EventEmitter<void>();

    readonly onDidChangeMcpServerDefinitions = this.changeEmitter.event;

    constructor(private readonly isServerRunning: () => boolean) { }

    register(): vscode.Disposable {
        return vscode.lm.registerMcpServerDefinitionProvider(MCP_SERVER_PROVIDER_ID, this);
    }

    provideMcpServerDefinitions(): vscode.McpServerDefinition[] {
        if (!this.isServerRunning()) {
            return [];
        }
        return [new vscode.McpHttpServerDefinition(l10n.t('Y3开发助手'), vscode.Uri.parse(MCP_ENDPOINT))];
    }

    refresh(): void {
        this.changeEmitter.fire();
    }

    dispose(): void {
        this.changeEmitter.dispose();
    }
}
