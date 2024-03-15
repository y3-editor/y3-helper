import { Env } from '../env';
import * as tools from '../tools';
import JSZip from 'jszip';
import vscode from 'vscode';
import xml from 'fast-xml-parser';

export class UI {
    private env: Env;
    private zip?: JSZip;
    private uiFiles?: { [key: string]: string };
    private tableFiles?: { [key: string]: string };
    private resourceXml?: Object;
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
        this.resourceXml = new xml.XMLParser().parse(xmlBuffer);

        this.avoidConfict();
    }

    private async avoidConfict() {
        let xmlContent: Buffer;
        try {
            xmlContent = Buffer.from(await vscode.workspace.fs.readFile(this.resourceXmlUri));
        } catch {
            return;
        }
        let obj = new xml.XMLParser().parse(xmlContent);
        debugger;
    }
}
