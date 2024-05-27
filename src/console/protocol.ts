import * as tools from "../tools";

export class Protocol {
    constructor(private onDecode: (data: any) => void) {
    }

    private buffer: Buffer = Buffer.alloc(0);

    needDecode(data: Buffer) {
        //协议为定长的4字节头部+数据体json字符串
        //需要处理粘包和半包
        this.buffer = Buffer.concat([this.buffer, data]);
        while (this.buffer.length >= 4) {
            let len = this.buffer.readUInt32BE(0);
            if (this.buffer.length < len + 4) {
                break;
            }
            let content = this.buffer.slice(4, 4 + len);
            this.buffer = this.buffer.slice(4 + len);
            try {
                let obj = JSON.parse(content.toString());
                this.onDecode(obj);
            } catch (e) {
                tools.log.error(e as Error);
            }
        }
    };

    encode(obj: any): Buffer {
        //协议为定长的4字节头部+数据体json字符串
        let content = JSON.stringify(obj);
        let len = Buffer.byteLength(content);
        let head = Buffer.alloc(4);
        head.writeUInt32BE(len, 0);
        return Buffer.concat([head, Buffer.from(content)]);
    }
}
