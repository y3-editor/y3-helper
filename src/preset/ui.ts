import { Env } from '../env';
import * as tools from '../tools';
import JSZip from 'jszip';
import vscode from 'vscode';
import xml from 'fast-xml-parser';
import * as uuid from 'uuid';
import * as util from 'util';

interface TextureInfo {
    oldName: number;
    newName: number;
    oldGuid: string;
    newGuid: string;
    xml: { [key: string]: any };
    icon?: string;
    texture?: Buffer;
    noUse?: boolean;
}

export class UI {
    private env: Env;
    private zip?: JSZip;
    private resourceXml?: { [key: string]: any };
    private resourceXmlUri: vscode.Uri;
    private textureInfos: TextureInfo[];

    constructor(env: Env) {
        this.env = env;
        this.resourceXmlUri = vscode.Uri.joinPath(this.env.projectUri!, 'custom/CustomImportRepo.local/resource.repository');
        this.textureInfos = [];
    }

    public async download(url: string) {
        let downloadBuffer: Buffer;
        try {
            downloadBuffer = await tools.download(url);
        } catch (error) {
            tools.log.error(error as Error);
            return;
        }

        this.zip = await new JSZip().loadAsync(downloadBuffer);

        let xmlBuffer = await this.zip.file("custom/CustomImportRepo.local/resource.repository")?.async('nodebuffer');
        if (!xmlBuffer) {
            tools.log.error("下载的文件中没有resource.repository！");
            return;
        }
        this.resourceXml = new xml.XMLParser({
            ignoreAttributes: false,
        }).parse(xmlBuffer);

        if (!this.resourceXml) {
            tools.log.error("resource.repository解析失败！");
            return;
        }

        await this.makeTextureInfos();
        await this.avoidConfict();
        await this.mergeResourceXml();
        await this.importResource();
    }

    private async makeTextureInfos() {
        let items = this.getXmlItem(this.resourceXml!, 'Repository.Items.Item');
        items = typeof items === 'object' ? items : [];
        for (let item of items) {
            let name: number = item.Name;
            let guid: string = item.GUID;
            this.textureInfos.push({
                oldName: name,
                newName: name,
                oldGuid: guid,
                newGuid: guid,
                xml: item,
                icon: await this.zip!.file(`editor_table/editoricon/${name.toString()}.json`)?.async('string'),
                texture: await this.zip!.file(`custom/CustomImportRepo.local/Texture/${guid.slice(0, 2)}/{${guid}}/texture`)?.async('nodebuffer'),
            });
        }
    }

    private async avoidConfict() {
        // 读取项目中已经存在的resource.repository
        let localXml;
        try {
            let xmlContent = Buffer.from(await vscode.workspace.fs.readFile(this.resourceXmlUri));
            localXml = new xml.XMLParser().parse(xmlContent);
        } catch {
            return;
        }
        let itemsPart = localXml?.Repository?.Items;
        let items = typeof itemsPart === 'object' ? itemsPart.Item : undefined;

        if (!items) {
            return;
        }

        let usedNames = new Set<number>();
        for (let item of items) {
            let name = item.Name;
            usedNames.add(name);
        }

        let usedGuids = new Set<string>();
        for (let item of items) {
            let guid = item.GUID;
            usedGuids.add(guid);
        }

        // 将resourceXml中冲突的name改为未使用的name
        for (let texture of this.textureInfos) {
            if (typeof texture.oldName !== 'number') {
                continue;
            }
            if (texture.icon === undefined) {
                if (usedNames.has(texture.oldName)) {
                    texture.noUse = true;
                }
                continue;
            }
            while (usedNames.has(texture.newName)) {
                texture.newName++;
            }
            usedNames.add(texture.newName);
            while (usedGuids.has(texture.newGuid)) {
                texture.newGuid = uuid.v4();
            }
            usedGuids.add(texture.newGuid);
        }
    }

    private getXmlItem(item: { [key: string]: any }, path: string): any|undefined {
        if (typeof item !== 'object') {
            return undefined;
        }
        let firstPath = path.split('.')[0];
        if (item[firstPath] !== undefined) {
            if (path.includes('.')) {
                return this.getXmlItem(item[firstPath], path.slice(firstPath.length + 1));
            } else {
                return item[firstPath];
            }
        }
        return undefined;
    }

    private setXmlItem(item: { [key: string]: any }, path: string, value: any) {
        if (typeof item !== 'object') {
            return undefined;
        }
        let firstPath = path.split('.')[0];
        if (path.includes('.')) {
            if (typeof item[firstPath] !== 'object') {
                item[firstPath] = {};
            }
            this.setXmlItem(item[firstPath], path.slice(firstPath.length + 1), value);
        } else {
            item[firstPath] = value;
        }
    }

    private async mergeResourceXml() {
        // 读取项目中已经存在的resource.repository
        let localXml;
        try {
            let xmlContent = Buffer.from(await vscode.workspace.fs.readFile(this.resourceXmlUri));
            localXml = new xml.XMLParser({
                ignoreAttributes: false,
            }).parse(xmlContent) ?? {};
        } catch {
            localXml = {};
        }
        let items = this.getXmlItem(localXml, 'Repository.Items.Item');
        items = typeof items === 'object' ? items : [];
        this.setXmlItem(localXml, 'Repository.Items.Item', items);
        // 将resourceXml中的内容合并到项目中
        let textureInfos = this.textureInfos.filter((texture) => !texture.noUse);
        for (let texture of textureInfos) {
            let xml = { ...texture.xml };
            xml.Name = texture.newName;
            xml.GUID = texture.newGuid;
            items.push(xml);
        }
        let newXmlContent = new xml.XMLBuilder({
            format: true,
            indentBy: '',
            ignoreAttributes: false,
        }).build(localXml);

        await vscode.workspace.fs.writeFile(this.resourceXmlUri, Buffer.from(newXmlContent));
    }

    private async importResource() {
        let total = 0;
        let resolved = 0;

        async function pushTask(thenable: Thenable<any>) {
            total++;
            thenable.then(() => {
                resolved++;
            });
        }

        // 导入资源文件
        let textureInfos = this.textureInfos;
        for (let textureInfo of textureInfos) {
            let icon = textureInfo.icon;
            if (icon !== undefined) {
                let iconUri = vscode.Uri.joinPath(this.env.projectUri!, 'editor_table/editoricon', textureInfo.newName.toString() + '.json');
                pushTask(vscode.workspace.fs.writeFile(iconUri, Buffer.from(icon)));
            }
            let texture = textureInfo.texture;
            if (texture !== undefined) {
                let textureUri = vscode.Uri.joinPath(this.env.projectUri!, 'custom/CustomImportRepo.local/Texture', textureInfo.newGuid.slice(0, 2), `{${textureInfo.newGuid}}`, 'texture');
                pushTask(vscode.workspace.fs.writeFile(textureUri, texture));
            }
        }

        // 导入UI定义
        let basePath = 'maps/EntryMap/ui/';
        for (let file of this.zip!.filter(path => path.startsWith(basePath))) {
            if (file.dir) {
                continue;
            }
            let fileContent = await file.async('string');
            if (fileContent === undefined) {
                continue;
            }
            let uri = vscode.Uri.joinPath(this.env.mapUri!, 'ui', file.name.slice(basePath.length));
            pushTask(vscode.workspace.fs.writeFile(uri, Buffer.from(fileContent)));
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "正在导入资源文件...",
            cancellable: false,
        }, async (progress) => {
            progress.report({ increment: 0, message: `(${resolved}/${total})` });
            let last = 0;
            while (resolved < total) {
                await util.promisify(setTimeout)(100);
                let delta = resolved - last;
                if (delta === 0) {
                    continue;
                }
                last = resolved;
                progress.report({ increment: delta / total * 100, message: `(${resolved}/${total})` });
            }
            progress.report({ increment: 100, message: "导入资源完成!" });
        });
    }
}
