import { env } from '../env';
import * as tools from '../tools';
import vscode from 'vscode';
import xml from 'fast-xml-parser';
import * as util from 'util';

interface TextureInfo {
    oldName: number;
    newName: number;
    guid: string;
    xml: { [key: string]: any };
    icon?: string;
    texture?: Buffer;
    textureWhat?: Buffer;
    noUse?: boolean;
}

export class UI {
    private resourceUri: vscode.Uri;
    private resourceXml?: { [key: string]: any };
    private resourceXmlUri: vscode.Uri;
    private textureInfos: TextureInfo[];

    constructor(resourceUri: vscode.Uri) {
        this.resourceUri = resourceUri;
        this.resourceXmlUri = vscode.Uri.joinPath(env.projectUri!, 'custom/CustomImportRepo.local/resource.repository');
        this.textureInfos = [];
    }

    public async install() {
        let repository = await tools.readFile(this.resourceUri, "custom/CustomImportRepo.local/resource.repository");
        if (!repository) {
            tools.log.error("未找到resource.repository！");
            return;
        }
        this.resourceXml = new xml.XMLParser({
            ignoreAttributes: false,
        }).parse(repository.buffer);

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
                guid: guid,
                xml: item,
                icon: (await tools.readFile(this.resourceUri, `editor_table/editoricon/${name.toString()}.json`))?.string,
                texture: (await tools.readFile(this.resourceUri, `custom/CustomImportRepo.local/Texture/${guid.slice(0, 2)}/{${guid}}/texture`))?.buffer,
                textureWhat: (await tools.readFile(this.resourceUri, `custom/CustomImportRepo.local/Texture/${guid.slice(0, 2)}/{${guid}}/${guid}.1`))?.buffer,
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
            if (usedGuids.has(texture.guid)) {
                texture.noUse = true;
                continue;
            }
            while (usedNames.has(texture.newName)) {
                texture.newName++;
            }
            usedNames.add(texture.newName);
            usedGuids.add(texture.guid);
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
            localXml = {
                "?xml": {
                    "@_version": "1.0",
                    "@_encoding": "utf-8",
                },
            };
        }
        let items = this.getXmlItem(localXml, 'Repository.Items.Item');
        items = typeof items === 'object' ? items : [];
        this.setXmlItem(localXml, 'Repository.Items.Item', items);
        // 将resourceXml中的内容合并到项目中
        let textureInfos = this.textureInfos.filter((texture) => !texture.noUse);
        for (let texture of textureInfos) {
            let xml = { ...texture.xml };
            xml.Name = texture.newName;
            xml.GUID = texture.guid;
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
                let iconUri = vscode.Uri.joinPath(env.projectUri!, 'editor_table/editoricon', textureInfo.newName.toString() + '.json');
                // 全词匹配数字，如果数字 === oldName，替换为newName
                if (textureInfo.oldName !== textureInfo.newName) {
                    icon = icon.replace(new RegExp(`(?<=\\D)${textureInfo.oldName}(?=\\D)`, 'g'), textureInfo.newName.toString());
                }
                pushTask(vscode.workspace.fs.writeFile(iconUri, Buffer.from(icon)));
            }
            let texture = textureInfo.texture;
            if (texture !== undefined) {
                let textureUri = vscode.Uri.joinPath(env.projectUri!, 'custom/CustomImportRepo.local/Texture', textureInfo.guid.slice(0, 2), `{${textureInfo.guid}}`, 'texture');
                pushTask(vscode.workspace.fs.writeFile(textureUri, texture));
            }
            let textureWhat = textureInfo.textureWhat;
            if (textureWhat !== undefined) {
                let textureWhatUri = vscode.Uri.joinPath(env.projectUri!, 'custom/CustomImportRepo.local/Texture', textureInfo.guid.slice(0, 2), `{${textureInfo.guid}}`, `${textureInfo.guid}.1`);
                pushTask(vscode.workspace.fs.writeFile(textureWhatUri, textureWhat));
            }
        }

        // 收集oldName和newName的对应关系
        let nameMap: { [key: number]: number } = {};
        for (let textureInfo of textureInfos) {
            if (textureInfo.oldName !== textureInfo.newName) {
                nameMap[textureInfo.oldName] = textureInfo.newName;
            }
        }

        // 导入UI定义
        let basePath = 'maps/EntryMap/ui/';
        for (let [name, fileType] of await tools.dir(this.resourceUri, basePath) ?? []) {
            if (fileType === vscode.FileType.Directory) {
                continue;
            }
            let file = await tools.readFile(this.resourceUri, `${basePath}/${name}`);
            if (!file) {
                continue;
            }
            let fileContent = file.string;
            // 全词匹配数字，将oldName替换为newName
            fileContent = fileContent.replace(/\b\d+\b/g, (match) => nameMap[parseInt(match)]?.toString() ?? match);

            let uri = vscode.Uri.joinPath(env.mapUri!, 'ui', name);
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
