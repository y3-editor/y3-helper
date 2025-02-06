import * as net from "net";
import * as vscode from "vscode";
import * as l10n from '@vscode/l10n';

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
        this.channel = vscode.window.createOutputChannel(l10n.t('Y3-网络服务器'));
        this.channel.show();

        this.server1 = this.runServer1(port1);
        this.server2 = this.runServer2(port2);
    }

    private runServer1(port: number) {
        return net.createServer()
            .on('connection', (socket) => {
                socket.write(l10n.t('欢迎，你已连接到服务器'));
                this.channel.appendLine(l10n.t('有客户端连接到服务器1'));

                socket.on('data', (data) => {
                    this.channel.appendLine(l10n.t('收到来自客户端的消息：{0}', String(data)));
                    socket.write(l10n.t('你发送了：{0}', String(data)));

                    if (data.toString().trim() === l10n.t('再见！')) {
                        socket.end(l10n.t('马达捏~'));
                    }
                });

                socket.on('close', () => {
                    this.channel.appendLine(l10n.t('客户端已断开服务器1'));
                });

                socket.on('error', (err) => {
                    this.channel.appendLine(l10n.t('客户端错误：{0}', String(err)));
                });
            })
            .on('error', (err) => {
                this.channel.appendLine(l10n.t('服务器1错误：{0}', String(err)));
            })
            .listen(port, '127.0.0.1', () => {
                this.channel.appendLine(l10n.t('服务器1已启动：127.0.0.1:{0}', port));
                this.channel.appendLine(l10n.t("客户端发送消息后，会回复“你发送了：<收到的消息>”"));
                this.channel.appendLine(l10n.t("客户端发送“再见！”会断开连接"));
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
                this.channel.appendLine(l10n.t('有客户端连接到服务器2'));

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
                    this.channel.appendLine(l10n.t('客户端已断开服务器2'));
                });

                socket.on('error', (err) => {
                    this.channel.appendLine(l10n.t('客户端错误：{0}', String(err)));
                });
            })
            .on('error', (err) => {
                this.channel.appendLine(l10n.t('服务器2错误：{0}', String(err)));
            })
            .listen(port, '127.0.0.1', () => {
                this.channel.appendLine(l10n.t('服务器2已启动：127.0.0.1:{0}', port));
                this.channel.appendLine(l10n.t("会在10秒内发送10个数据包给客户端，格式为："));
                this.channel.appendLine(l10n.t("* 4个字节的包头，表示包体的长度（大端）"));
                this.channel.appendLine(l10n.t("* Json表示的包体，包含2个字段“count”和“time”"));
            });
    }
}
