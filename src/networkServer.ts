import * as net from "net";
import * as vscode from "vscode";

export class NetworkServer extends vscode.Disposable {
    private server: net.Server;
    constructor(public ip: string, public port: number) {
        super(() => {
            this.server.close();
        });
        let channel = vscode.window.createOutputChannel('Y3-网络服务器');
        channel.show();

        this.server = net.createServer()
            .on('connection', (socket) => {
                socket.write('欢迎，你已连接到服务器');
                channel.appendLine(`有客户端连接`);

                socket.on('data', (data) => {
                    channel.appendLine(`收到来自客户端的消息：${data}`);
                    socket.write(`你发送了：${data}`);

                    if (data.toString().trim() === '再见！') {
                        socket.end('马达捏~');
                    }
                });

                socket.on('close', () => {
                    channel.appendLine(`客户端已断开`);
                });

                socket.on('error', (err) => {
                    channel.appendLine(`客户端错误：${err}`);
                });
            })
            .on('error', (err) => {
                channel.appendLine(`服务器错误：${err}`);
            })
            .listen(port, ip, () => {
                channel.appendLine(`服务器已启动：${ip}:${port}`);
                channel.appendLine(`客户端发送消息后，会回复“你发送了：<收到的消息>”`);
                channel.appendLine(`客户端发送“再见！”会断开连接`);
            });
    }
}
