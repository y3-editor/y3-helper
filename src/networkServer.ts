import * as net from "net";
import * as vscode from "vscode";

export class NetworkServer extends vscode.Disposable {
    private server1: net.Server;
    private server2: net.Server;
    private channel: vscode.OutputChannel;
    constructor(port1: number, port2: number) {
        super(() => {
            this.server1.close();
            this.server2.close();
            this.channel.dispose();
        });
        this.channel = vscode.window.createOutputChannel('Y3-网络服务器');
        this.channel.show();

        this.server1 = this.runServer1(port1);
        this.server2 = this.runServer2(port2);
    }

    private runServer1(port: number) {
        return net.createServer()
            .on('connection', (socket) => {
                socket.write('欢迎，你已连接到服务器');
                this.channel.appendLine(`有客户端连接到服务器1`);

                socket.on('data', (data) => {
                    this.channel.appendLine(`收到来自客户端的消息：${data}`);
                    socket.write(`你发送了：${data}`);

                    if (data.toString().trim() === '再见！') {
                        socket.end('马达捏~');
                    }
                });

                socket.on('close', () => {
                    this.channel.appendLine(`客户端已断开服务器1`);
                });

                socket.on('error', (err) => {
                    this.channel.appendLine(`客户端错误：${err}`);
                });
            })
            .on('error', (err) => {
                this.channel.appendLine(`服务器1错误：${err}`);
            })
            .listen(port, '127.0.0.1', () => {
                this.channel.appendLine(`服务器1已启动：127.0.0.1:${port}`);
                this.channel.appendLine(
`客户端发送消息后，会回复“你发送了：<收到的消息>”
客户端发送“再见！”会断开连接
`);
            });
    }

    private runServer2(port: number) {
        function packData(data: Object) {
            let str = JSON.stringify(data);
            let len = Buffer.alloc(4);
            len.writeUInt32BE(str.length);
            return Buffer.concat([len, Buffer.from(str)]);
        }
        return net.createServer()
            .on('connection', (socket) => {
                this.channel.appendLine(`有客户端连接到服务器2`);

                let count = 0;
                let timer = setInterval(() => {
                    count++;
                    socket.write(packData({
                        count,
                        time: Date.now(),
                    }));
                    if (count >= 10) {
                        clearInterval(timer);
                    }
                }, 1000);
                
                socket.on('close', () => {
                    this.channel.appendLine(`客户端已断开服务器2`);
                });

                socket.on('error', (err) => {
                    this.channel.appendLine(`客户端错误：${err}`);
                });
            })
            .on('error', (err) => {
                this.channel.appendLine(`服务器2错误：${err}`);
            })
            .listen(port, '127.0.0.1', () => {
                this.channel.appendLine(`服务器2已启动：127.0.0.1:${port}`);
                this.channel.appendLine(
`会在10秒内发送10个数据包给客户端，格式为：
* 4个字节的包头，表示包体的长度（大端）
* Json表示的包体，包含2个字段“count”和“time”
`);
            });
    }
}
