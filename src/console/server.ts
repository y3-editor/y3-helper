import * as net from "net";
import * as tools from "../tools";
import { Client } from "./client";
import * as vscode from "vscode";

export class ConsoleServer extends vscode.Disposable {
    private server: net.Server;
    constructor(private port: number) {
        super(() => {
            this.server.close();
        });
        this.server = net.createServer()
            .on('connection', (socket) => {
                tools.log.info('有客户端连接到Y3助手');
                let client = new Client();

                let buffer: Buffer = Buffer.alloc(0);

                client.onSend((obj) => {
                    //协议为定长的4字节头部+数据体json字符串
                    let content = JSON.stringify(obj);
                    let len = Buffer.byteLength(content);
                    let head = Buffer.alloc(4);
                    head.writeUInt32BE(len, 0);
                    socket.write(Buffer.concat([head, Buffer.from(content)]));
                });

                socket.on('data', (data) => {
                    //协议为定长的4字节头部+数据体json字符串
                    //需要处理粘包和半包
                    buffer = Buffer.concat([buffer, data]);
                    while (buffer.length >= 4) {
                        let len = buffer.readUInt32BE(0);
                        if (buffer.length < len + 4) {
                            break;
                        }
                        let content = buffer.slice(4, 4 + len);
                        buffer = buffer.slice(4 + len);
                        try {
                            let obj = JSON.parse(content.toString());
                            client.recv(obj);
                        } catch (e) {
                            tools.log.error(e as Error);
                        }
                    }
                });

                socket.on('close', () => {
                    tools.log.info('客户端断开连接');
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
                tools.log.info(`Y3助手服务器已启动：127.0.0.1:${port}`);
            });
    }
}
