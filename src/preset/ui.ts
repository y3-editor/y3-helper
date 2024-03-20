import { Env } from '../env';
import * as tools from '../tools';
import JSZip from 'jszip';
import vscode from 'vscode';
import xml from 'fast-xml-parser';
import * as uuid from 'uuid';

export class UI {
    private env: Env;
    private zip?: JSZip;
    private uiFiles?: { [key: string]: string };
    private tableFiles?: { [key: string]: string };
    private resourceXml?: { [key: string]: any };
    private namePatch?: { [key: number]: number };
    private resourceXmlUri: vscode.Uri;

    constructor(env: Env) {
        this.env = env;
        this.resourceXmlUri = vscode.Uri.joinPath(this.env.projectUri!, 'custom/CustomImportRepo.local/resource.repository');
    }

    private async pickZipFiles(zip: JSZip, basePath: string): Promise<{ [key: string]: string }> {
        let files: { [key: string]: string } = {};

        for (const file of zip.filter((path) => path.startsWith(basePath))) {
            let name = file.name.slice(basePath.length);
            let content = await file.async('string');
            files[name] = content;
        }

        return files;
    }

    public async make() {
        let downloadBuffer: Buffer;
        try {
            downloadBuffer = await tools.download('https://up5.nosdn.127.net/editor/zip/edc461b312fc308779be9273a2cee6bb');
        } catch (error) {
            tools.log.error(error as Error);
            return;
        }

        this.zip = await new JSZip().loadAsync(downloadBuffer);

        this.uiFiles = await this.pickZipFiles(this.zip, 'maps/EntryMap/ui/');
        this.tableFiles = await this.pickZipFiles(this.zip, 'editor_table/editoricon/');
        let xmlBuffer = await this.zip.file("custom/CustomImportRepo.local/resource.repository")?.async('nodebuffer');
        if (!xmlBuffer) {
            tools.log.error("下载的文件中没有resource.repository！");
            return;
        }
        this.resourceXml = new xml.XMLParser({
            ignoreAttributes: false,
        }).parse(xmlBuffer);

        try {
            this.avoidConfict();
        } catch {}

        await this.mergeResourceXml();
    }

    private async avoidConfict() {
        // 读取项目中已经存在的resource.repository
        let xmlContent = Buffer.from(await vscode.workspace.fs.readFile(this.resourceXmlUri));
        let localXml = new xml.XMLParser().parse(xmlContent);
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

        // 将resourceXml中冲突的name改为未使用的name
        this.namePatch = {};
        let newItems = this.resourceXml?.Repository?.Items;
        if (newItems) {
            for (let item of newItems.Item) {
                let name = item.Name;
                if (typeof name !== 'number') {
                    continue;
                }
                if (usedNames.has(name)) {
                    let newName = name;
                    while (usedNames.has(newName)) {
                        newName++;
                    }
                    this.namePatch[name] = newName;
                    usedNames.add(newName);
                }
            }
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
        if (!this.resourceXml) {
            return;
        }
        // 读取项目中已经存在的resource.repository
        let xmlContent = Buffer.from(await vscode.workspace.fs.readFile(this.resourceXmlUri));
        let localXml = new xml.XMLParser({
            ignoreAttributes: false,
        }).parse(xmlContent) ?? {};
        let items = this.getXmlItem(localXml, 'Repository.Items.Item');
        items = typeof items === 'object' ? items : [];
        this.setXmlItem(localXml, 'Repository.Items.Item', items);
        // 将resourceXml中的内容合并到项目中，如果有冲突则修改name
        let newItems = this.getXmlItem(this.resourceXml, 'Repository.Items.Item') ?? [];
        for (let item of newItems) {
            let name = item.Name;
            item.GUID = uuid.v4();
            if (this.namePatch && this.namePatch[name]) {
                item.Name = this.namePatch[name];
                item.Annotation.SourcePath = item.Annotation.SourcePath.replace(name.toString(), this.namePatch[name].toString());
            }
            items.push(item);
        }
        let newXmlContent = new xml.XMLBuilder({
            format: true,
            indentBy: '',
            ignoreAttributes: false,
        }).build(localXml);

        await vscode.workspace.fs.writeFile(this.resourceXmlUri, Buffer.from(newXmlContent));
    }
}
