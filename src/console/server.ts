import * as net from "net";
import * as tools from "../tools";
import { Client } from "./client";
import * as vscode from "vscode";
import { Protocol } from "./protocol";

const l10n = vscode.l10n;

export class ConsoleServer extends vscode.Disposable {
    private server: net.Server;
    constructor(private port: number) {
        super(() => {
            this.server.close();
        });
        this.server = net.createServer()
            .on('connection', (socket) => {
                tools.log.info(l10n.t('有客户端连接到Y3助手'));
                let protocol = new Protocol((data) => {
                    client.recv(data);
                });

                let client = new Client((obj) => {
                    let data = protocol.encode(obj);
                    socket.write(data);
                });

                socket.on('data', (data) => {
                    protocol.needDecode(data);
                });

                socket.on('close', () => {
                    tools.log.info(l10n.t('客户端断开连接'));
                    client.dispose();
                });

                socket.on('error', (err) => {
                    tools.log.error(err);
                    client.dispose();
                });
            })
            .on('error', (err) => {
                tools.log.error(err);
            })
            .listen(port, '127.0.0.1', () => {
                tools.log.info(l10n.t('Y3助手服务器已启动：127.0.0.1:{0}', port));
            });
    }
}
