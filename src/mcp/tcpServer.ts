import * as vscode from 'vscode';
import * as http from 'http';
import * as crypto from 'crypto';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import * as tools from '../tools';
import { GameSessionManager } from './gameSessionManager';
import { define } from '../customDefine';
import type { UINode } from '../customDefine/ui';
import * as envImport from '../env';

const MCP_HTTP_PORT = 8766;
const UI_PACKAGE_KEY = '\u754c\u9762';
const UI_CANVAS_KEY = '\u753b\u677f';

interface MCPSession {
    id: string;
    createdAt: number;
    server: McpServer;
    transport: StreamableHTTPServerTransport;
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function hasMethod(message: unknown): message is { method: string } {
    return !!message
        && typeof message === 'object'
        && typeof (message as { method?: unknown }).method === 'string';
}

export class TCPServer extends vscode.Disposable {
    private httpServer?: http.Server;
    private readonly sessionManager: GameSessionManager;
    private readonly mcpSessions = new Map<string, MCPSession>();

    private readonly UI_TYPE_NAMES: Record<number, string> = {
        1: 'Button',
        3: 'TextLabel',
        4: 'Image',
        5: 'Progress',
        7: 'Layout',
        10: 'ScrollView',
        18: 'Buff',
        27: 'Chat_Box',
        38: 'Sequence_Animation',
    };

    constructor() {
        super(() => this.dispose());
        this.sessionManager = new GameSessionManager();
    }

    async start(): Promise<boolean> {
        return await this.startHTTPServer();
    }

    private getHeaderValue(value: string | string[] | undefined): string | undefined {
        if (Array.isArray(value)) {
            return value[0];
        }
        return value;
    }

    private isAllowedOrigin(origin: string | undefined): boolean {
        if (!origin) {
            return true;
        }

        if (origin.startsWith('vscode-webview://') || origin.startsWith('vscode-file://')) {
            return true;
        }

        try {
            const parsed = new URL(origin);
            return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname);
        } catch {
            return false;
        }
    }

    private setCommonHeaders(res: http.ServerResponse, origin?: string): void {
        if (origin) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Vary', 'Origin');
        }
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID');
        res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id, MCP-Protocol-Version');
    }

    private writeJsonResponse(res: http.ServerResponse, statusCode: number, body: unknown): void {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(statusCode);
        res.end(JSON.stringify(body));
    }

    private writeJsonRpcError(
        res: http.ServerResponse,
        statusCode: number,
        code: number,
        message: string
    ): void {
        this.writeJsonResponse(res, statusCode, {
            jsonrpc: '2.0',
            id: null,
            error: { code, message }
        });
    }

    private async startHTTPServer(): Promise<boolean> {
        this.httpServer = http.createServer((req, res) => {
            void this.handleHTTPRequest(req, res);
        });

        return await new Promise<boolean>((resolve, reject) => {
            this.httpServer!.listen(MCP_HTTP_PORT, '127.0.0.1', () => {
                tools.log.info(`[MCP] Streamable HTTP server listening on http://127.0.0.1:${MCP_HTTP_PORT}/mcp`);
                resolve(true);
            });
            this.httpServer!.on('error', (error: NodeJS.ErrnoException) => {
                if (error.code === 'EADDRINUSE') {
                    tools.log.warn(`[MCP] Port ${MCP_HTTP_PORT} is already in use`);
                    resolve(false);
                } else {
                    reject(error);
                }
            });
        });
    }

    private async handleHTTPRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const origin = this.getHeaderValue(req.headers.origin);
        if (!this.isAllowedOrigin(origin)) {
            this.writeJsonResponse(res, 403, { error: 'Forbidden origin' });
            return;
        }

        this.setCommonHeaders(res, origin);

        if (req.method === 'OPTIONS') {
            res.setHeader('Content-Length', '0');
            res.writeHead(204);
            res.end();
            return;
        }

        const url = req.url || '/';

        try {
            if (url === '/mcp' || url.startsWith('/mcp?')) {
                switch (req.method) {
                    case 'POST':
                        await this.handleMCPPost(req, res);
                        return;
                    case 'GET':
                    case 'DELETE':
                        await this.handleSessionRequest(req, res);
                        return;
                    default:
                        this.writeJsonResponse(res, 405, { error: 'Method not allowed' });
                        return;
                }
            }

            if (url === '/health') {
                this.writeJsonResponse(res, 200, {
                    status: 'ok',
                    transport: 'streamable-http',
                    port: MCP_HTTP_PORT,
                    activeSessions: this.mcpSessions.size
                });
                return;
            }

            this.writeJsonResponse(res, 404, { error: 'Not found' });
        } catch (error) {
            tools.log.error('[MCP] HTTP request error:', error);
            if (!res.headersSent) {
                this.writeJsonResponse(res, 500, { error: 'Internal server error' });
            }
        }
    }

    private async handleMCPPost(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const body = await this.readBody(req);
        let parsedBody: unknown;

        try {
            parsedBody = JSON.parse(body);
        } catch (error) {
            tools.log.error('[MCP] Failed to parse request body:', error);
            this.writeJsonRpcError(res, 400, -32700, 'Parse error');
            return;
        }

        if (hasMethod(parsedBody)) {
            tools.log.info(`[MCP] Received ${parsedBody.method}`);
        }

        const sessionId = this.getHeaderValue(req.headers['mcp-session-id']);
        if (sessionId) {
            const session = this.mcpSessions.get(sessionId);
            if (!session) {
                this.writeJsonRpcError(res, 404, -32001, 'Session not found');
                return;
            }

            await session.transport.handleRequest(req, res, parsedBody);
            return;
        }

        if (!isInitializeRequest(parsedBody)) {
            this.writeJsonRpcError(res, 400, -32000, 'Bad Request: No valid session ID provided');
            return;
        }

        const { transport } = await this.createSessionTransport();
        await transport.handleRequest(req, res, parsedBody);
    }

    private async handleSessionRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const sessionId = this.getHeaderValue(req.headers['mcp-session-id']);
        if (!sessionId) {
            this.writeJsonRpcError(res, 400, -32000, 'Bad Request: Mcp-Session-Id header is required');
            return;
        }

        const session = this.mcpSessions.get(sessionId);
        if (!session) {
            this.writeJsonRpcError(res, 404, -32001, 'Session not found');
            return;
        }

        await session.transport.handleRequest(req, res);
    }

    private async closeSession(sessionId: string): Promise<void> {
        const session = this.mcpSessions.get(sessionId);
        if (!session) {
            return;
        }

        this.mcpSessions.delete(sessionId);
        try {
            await session.server.close();
        } catch (error) {
            tools.log.warn(`[MCP] Failed to close session ${sessionId}: ${getErrorMessage(error)}`);
        }
    }

    private async createSessionTransport(): Promise<{ server: McpServer; transport: StreamableHTTPServerTransport }> {
        const server = this.createMcpServer();
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => crypto.randomUUID(),
            enableJsonResponse: true,
            onsessioninitialized: (sessionId) => {
                this.mcpSessions.set(sessionId, {
                    id: sessionId,
                    createdAt: Date.now(),
                    server,
                    transport,
                });
            }
        });

        transport.onerror = (error) => {
            tools.log.error('[MCP] Transport error:', error);
        };

        transport.onclose = () => {
            const sessionId = transport.sessionId;
            if (sessionId) {
                void this.closeSession(sessionId);
            }
        };

        await server.connect(transport);
        return { server, transport };
    }

    private createMcpServer(): McpServer {
        const server = new McpServer({
            name: 'y3-helper',
            version: '1.0.0'
        });

        server.registerTool('launch_game', {
            description: 'Launch the game',
            inputSchema: {}
        }, async () => this.runTool(async () => await this.sessionManager.launchGame({})));

        server.registerTool('get_game_status', {
            description: 'Get the current game status',
            inputSchema: {}
        }, async () => this.runTool(() => this.sessionManager.getGameStatus()));

        server.registerTool('execute_lua', {
            description: 'Execute Lua code in the running game',
            inputSchema: {
                code: z.string()
            }
        }, async ({ code }) => this.runTool(async () => await this.sessionManager.executeLua({ code })));

        server.registerTool('quick_restart', {
            description: 'Quickly restart the game session',
            inputSchema: {}
        }, async () => this.runTool(async () => await this.sessionManager.quickRestart()));

        server.registerTool('stop_game', {
            description: 'Stop the running game session',
            inputSchema: {}
        }, async () => this.runTool(async () => await this.sessionManager.stopGame({})));

        server.registerTool('get_logs', {
            description: 'Fetch recent game logs',
            inputSchema: {
                limit: z.number().optional()
            }
        }, async ({ limit }) => this.runTool(async () => await this.sessionManager.getLogs({ limit })));

        server.registerTool('capture_screenshot', {
            description: 'Capture a screenshot from the running game',
            inputSchema: {}
        }, async () => this.runTool(async () => await this.sessionManager.captureScreenshot()));

        server.registerTool('read_problems_lua', {
            description: 'Run Lua diagnostics on project files',
            inputSchema: {
                pathGlob: z.union([z.string(), z.array(z.string())]).optional()
            }
        }, async ({ pathGlob }) => this.runTool(async () => await this.sessionManager.readProblemsLua({ pathGlob })));

        server.registerTool('get_ui_canvas', {
            description: 'Return the current map UI canvas tree as formatted text, including node names, control types, and UIDs.',
            inputSchema: {
                nodePath: z.string().optional(),
                depth: z.number().optional()
            }
        }, async ({ nodePath, depth }) => this.runTool(async () => await this.getUICanvas({ nodePath, depth })));

        return server;
    }

    private async runTool<T>(handler: () => Promise<T> | T): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
        try {
            const result = await handler();
            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
            };
        } catch (error) {
            return {
                content: [{ type: 'text', text: `Error: ${getErrorMessage(error)}` }],
                isError: true
            };
        }
    }

    private async getUICanvas(toolArgs: { nodePath?: string; depth?: number }): Promise<Record<string, unknown>> {
        const nodePath = toolArgs.nodePath;
        let depth: number | undefined = 1;

        if (toolArgs.depth !== undefined) {
            const rawDepth = Number(toolArgs.depth);
            if (!Number.isNaN(rawDepth)) {
                depth = rawDepth === -1 ? undefined : Math.max(0, Math.floor(rawDepth));
            }
        }

        if (!envImport.env.currentMap) {
            return {
                success: false,
                error: 'No map is currently loaded. Open a Y3 map project in VSCode first.'
            };
        }

        try {
            const uiPackage = await (define(envImport.env.currentMap) as any)[UI_PACKAGE_KEY].getUIPackage();
            const canvases = (uiPackage[UI_CANVAS_KEY] ?? []) as UINode[];

            if (nodePath !== undefined) {
                const segments = nodePath.split('.');
                let target: UINode | undefined;

                for (const canvas of canvases) {
                    if (canvas.name === segments[0]) {
                        if (segments.length === 1) {
                            target = canvas;
                        } else {
                            target = this.findNodeByPath(canvas.childs ?? [], segments.slice(1));
                        }

                        if (target) {
                            break;
                        }
                    }
                }

                if (!target) {
                    return {
                        success: false,
                        error: `Node path not found: ${nodePath}`
                    };
                }

                return {
                    success: true,
                    canvas: this.formatNodeTree(target, '', true, depth)
                };
            }

            const lines: string[] = [];
            if (canvases.length === 0) {
                lines.push('Canvas: (none)');
            } else {
                for (const canvas of canvases) {
                    lines.push(`Canvas: ${canvas.name}`);
                    const children = canvas.childs ?? [];
                    children.forEach((child, index) => {
                        lines.push(this.formatNodeTree(child, '', index === children.length - 1, depth));
                    });
                    lines.push('');
                }
            }

            return {
                success: true,
                canvas: lines.join('\n').trimEnd()
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to read UI data: ${getErrorMessage(error)}`
            };
        }
    }

    private readBody(req: http.IncomingMessage): Promise<string> {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', (chunk) => body += chunk);
            req.on('end', () => resolve(body));
            req.on('error', reject);
        });
    }

    private findNodeByPath(nodes: UINode[], pathSegments: string[]): UINode | undefined {
        if (pathSegments.length === 0) {
            return undefined;
        }

        const [head, ...rest] = pathSegments;
        const found = nodes.find((node) => node.name === head);
        if (!found) {
            return undefined;
        }

        if (rest.length === 0) {
            return found;
        }

        return this.findNodeByPath(found.childs ?? [], rest);
    }

    private formatNodeTree(
        node: UINode,
        prefix: string = '',
        isLast: boolean = true,
        maxDepth?: number,
        currentDepth: number = 0
    ): string {
        const connector = isLast ? '+- ' : '|- ';
        const typeName = this.UI_TYPE_NAMES[node.type] ?? `type_${node.type}`;
        const line = `${prefix}${connector}${node.name} [${typeName}] (uid: ${node.uid})`;

        if (maxDepth !== undefined && currentDepth >= maxDepth) {
            const childCount = (node.childs ?? []).length;
            if (childCount > 0) {
                const childPrefix = prefix + (isLast ? '   ' : '|  ');
                return [line, `${childPrefix}... (${childCount} child nodes)`].join('\n');
            }
            return line;
        }

        const childPrefix = prefix + (isLast ? '   ' : '|  ');
        const children = node.childs ?? [];
        const childLines = children.map((child, index) =>
            this.formatNodeTree(child, childPrefix, index === children.length - 1, maxDepth, currentDepth + 1)
        );

        return [line, ...childLines].join('\n');
    }

    dispose(): void {
        const sessionIds = Array.from(this.mcpSessions.keys());
        for (const sessionId of sessionIds) {
            void this.closeSession(sessionId);
        }

        this.httpServer?.close();
        this.sessionManager.dispose();
    }
}
