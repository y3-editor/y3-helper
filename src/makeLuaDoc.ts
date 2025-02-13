import * as vscode from 'vscode';
import { runShell } from './runShell';
import * as l10n from '@vscode/l10n';


type Doc = DocClass[];
type DocClass = {
    name: string,
    desc: string,
    type: string,
    defines?: DocDefine[],
    fields?: DocField[],
};
type DocDefine = {
    name: string,
    file: string,
    extends?: DocExtend,
};
type DocExtend = {
    view: string,
};
type DocField = {
    name: string,
    extends: DocExtend,
    desc: string,
    file: string,
};

export class LuaDocMaker {
    private context: vscode.ExtensionContext;

    private exeUri?: vscode.Uri;
    private y3Uri?: vscode.Uri;
    private bannedClass: string[] = [
        'Class', 'CustomEvent', 'Doctor', 'Dump', 'ECABind',
        'Object', 'Event', 'EventConfig', 'EventManager', 'GCHost',
        'GCNode', 'Helper', 'KV', 'LinkedTable', 'Log', 'ObjectEvent',
        'PYConverter', 'PYEventRef', 'PYEventRegister', 'Proxy',
        'Ref', 'Serialization', 'SortByScoreCallback', 'Storage',
        'switch',
    ];

    get valid(): boolean {
        return this.exeUri !== undefined && this.y3Uri !== undefined;
    }

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        let sumneko = vscode.extensions.getExtension('sumneko.lua');
        if (!sumneko) {
            vscode.window.showErrorMessage(l10n.t('请先安装 sumneko.lua 扩展！'));
            return;
        }
        let exeUri = vscode.Uri.joinPath(sumneko.extensionUri, 'server/bin/lua-language-server');
        let currentUri = vscode.workspace.workspaceFolders?.[0].uri;
        if (!currentUri) {
            vscode.window.showErrorMessage(l10n.t('请先打开工作目录！'));
            return;
        }
        let y3Uri = vscode.Uri.joinPath(currentUri, l10n.t('y3'));
        this.exeUri = exeUri;
        this.y3Uri = y3Uri;
    }

    public async make() {
        if (!this.valid) {
            return undefined;
        }

        await vscode.workspace.fs.createDirectory(this.context.globalStorageUri);
        let logUri = vscode.Uri.joinPath(this.context.globalStorageUri, 'doc');

        await runShell(
            l10n.t("导出文档"),
            this.exeUri!.fsPath,
            [
                "--doc=" + this.y3Uri!.fsPath,
                "--logpath=" + logUri.fsPath,
                "--locale=zh-cn",
            ]
        );

        let jsonUri = vscode.Uri.joinPath(logUri, 'doc.json');
        let content = new TextDecoder().decode(await vscode.workspace.fs.readFile(jsonUri));
        let doc: Doc = JSON.parse(content);

        let clippedDoc = this.clipDoc(doc);
        let markdownMap = this.splitDoc(clippedDoc);
        let menu = this.makeMenu(markdownMap);
        let menuUri = vscode.Uri.joinPath(this.y3Uri!, 'doc/API.md');
        await vscode.workspace.fs.writeFile(menuUri, new TextEncoder().encode(menu));
        for (const [name, doc] of markdownMap) {
            let markdown = this.convertDocToMarkdown(doc);
            let outputUri = vscode.Uri.joinPath(this.y3Uri!, `doc/API/${name}.md`);
            await vscode.workspace.fs.writeFile(outputUri, new TextEncoder().encode(markdown));
        }
    }

    private clipDoc(doc: Doc): Doc {
        let clippedDoc: Doc = [];

        for (let index = 0; index < doc.length; index++) {
            const docClass = doc[index];
            if (!this.isValidName(docClass.name)) {
                continue;
            }
            if (docClass.type !== 'type') {
                continue;
            }
            let filtedDocClass: DocClass = {
                name: docClass.name,
                desc: docClass.desc,
                type: docClass.type,
                defines: [],
                fields: [],
            };
            if (docClass.defines) {
                for (let index = 0; index < docClass.defines.length; index++) {
                    const docDefine = docClass.defines[index];
                    if (this.isValidUri(docDefine.file)) {
                        filtedDocClass.defines?.push(docDefine);
                    }
                }
            }
            if (filtedDocClass.defines!.length === 0) {
                continue;
            }
            clippedDoc.push(filtedDocClass);
            if (docClass.fields) {
                let mark: { [name: string]: boolean } = {};
                for (let index = 0; index < docClass.fields.length; index++) {
                    const docField = docClass.fields[index];
                    if (!mark[docField.name]
                        && this.isValidName(docField.name)
                        && this.isValidUri(docField.file)
                    ) {
                        mark[docField.name] = true;
                        filtedDocClass.fields?.push(docField);
                    }
                }
            }
        }
        return clippedDoc;
    }

    private splitDoc(doc: Doc): Map<string, Doc> {
        let map = new Map<string, Doc>();
        for (let index = 0; index < doc.length; index++) {
            const docClass = doc[index];
            let name = docClass.name;
            if (name.startsWith('y3.Const') || name.startsWith('clicli.Const')) {
                name = 'Const';
            } else if (name.includes('.')) {
                name = name.split('.')[0];
            }
            if (this.bannedClass.includes(name)) {
                continue;
            }
            let docList = map.get(name);
            if (!docList) {
                docList = [];
                map.set(name, docList);
            }
            docList.push(docClass);
        }
        return map;
    }

    private getTitleAndDesc(name: string, doc: Doc): [string, string] {
        let descs: string[] = [];
        for (let index = 0; index < doc.length; index++) {
            const docClass = doc[index];
            if (docClass.name === name && docClass.desc && docClass.desc !== 'unknown') {
                descs.push(docClass.desc);
            }
        }
        if (descs.length === 0) {
            return ['', ''];
        }
        let fullDesc = descs.join('\n\n').replaceAll('\r\n', '\n');
        let lines = fullDesc.split('\n');
        let title = lines[0];
        let firstNonEmptyIndex = 1;
        for (let index = 1; index < lines.length; index++) {
            const line = lines[index];
            if (line.trim() === "") {
                firstNonEmptyIndex = index + 1;
            } else {
                break;
            }
        }
        let desc = lines.slice(firstNonEmptyIndex).join('\n').trim();
        return [title, desc];
    }

    private makeMenu(docMap: Map<string, Doc>): string {
        let markdown = new vscode.MarkdownString();
        for (const [name, doc] of docMap) {
            let [title, desc] = this.getTitleAndDesc(name, doc);
            markdown.appendMarkdown(`# [${name}](API/${name}.md) ${title}\n\n`);
            if (desc) {
                markdown.appendMarkdown(`${desc}\n\n`);
            }
        }
        return markdown.value;
    }

    private convertDocToMarkdown(doc: Doc): string {
        let markdown = new vscode.MarkdownString();

        for (let index = 0; index < doc.length; index++) {
            const docClass = doc[index];
            markdown.appendMarkdown(`# ${docClass.name}\n\n`);
            if (docClass.desc && docClass.desc !== 'unknown') {
                markdown.appendMarkdown(`${docClass.desc}\n\n`);
            }
            if (docClass.defines) {
                for (let index = 0; index < docClass.defines.length; index++) {
                    const docDefine = docClass.defines[index];
                    if (docDefine.extends
                        && docDefine.extends.view
                    ) {
                        markdown.appendCodeblock(docDefine.extends.view, 'lua');
                        markdown.appendMarkdown('\n');
                    }
                }
            }
            if (docClass.fields) {
                for (let index = 0; index < docClass.fields.length; index++) {
                    const docField = docClass.fields[index];
                    markdown.appendMarkdown(`## ${docField.name}\n`);
                    markdown.appendCodeblock(docField.extends.view, 'lua');
                    markdown.appendMarkdown('\n');
                    if (docField.desc) {
                        markdown.appendMarkdown(`${docField.desc}\n`);
                    }
                }
            }
            markdown.appendMarkdown('\n');
        }

        return markdown.value;
    }

    private isValidUri(uriString: string): boolean {
        if (!this.y3Uri) {
            return false;
        }
        return uriString.startsWith(this.y3Uri.toString());
    }

    private isValidName(name: string): boolean {
        if (name.startsWith('_')
            || name.startsWith('GameAPI')
            || name.startsWith('GlobalAPI')
            || name.startsWith('py.')
            || name.startsWith('EventParam.')
        ) {
            return false;
        }
        if (/[A-Z0-9]$/.test(name)) {
            return false;
        }
        return true;
    }
}
