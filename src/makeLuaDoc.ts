import * as vscode from 'vscode';
import { runShell } from './runShell';

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
    private _context: vscode.ExtensionContext;

    private exeUri?: vscode.Uri;
    private y3Uri?: vscode.Uri;

    get valid(): boolean {
        return this.exeUri !== undefined && this.y3Uri !== undefined;
    }

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
        let sumneko = vscode.extensions.getExtension('sumneko.lua');
        if (!sumneko) {
            vscode.window.showErrorMessage('请先安装 sumneko.lua 扩展！');
            return;
        }
        let exeUri = vscode.Uri.joinPath(sumneko.extensionUri, 'server/bin/lua-language-server');
        let currentUri = vscode.workspace.workspaceFolders?.[0].uri;
        if (!currentUri) {
            vscode.window.showErrorMessage('请先打开工作目录！');
            return;
        }
        let y3Uri = vscode.Uri.joinPath(currentUri, 'y3');
        this.exeUri = exeUri;
        this.y3Uri = y3Uri;
    }

    public async make(): Promise<string | undefined> {
        if (!this.valid) {
            return undefined;
        }

        await vscode.workspace.fs.createDirectory(this._context.globalStorageUri);
        let logUri = vscode.Uri.joinPath(this._context.globalStorageUri, 'doc');

        await runShell(
            "导出文档",
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

        let markdown = this.convertDocToMarkdown(doc);
        let outputUri = vscode.Uri.joinPath(this.y3Uri!, 'doc/doc.md');
        await vscode.workspace.fs.writeFile(outputUri, new TextEncoder().encode(markdown));
    }

    private convertDocToMarkdown(doc: Doc): string {
        let markdown = new vscode.MarkdownString();
        let filtedDoc: Doc = [];

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
            filtedDoc.push(filtedDocClass);
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

        for (let index = 0; index < filtedDoc.length; index++) {
            const docClass = filtedDoc[index];
            markdown.appendMarkdown(`# ${docClass.name}\n`);
            if (docClass.desc && docClass.desc !== 'unknown') {
                markdown.appendMarkdown(`${docClass.desc}`);
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
                        markdown.appendCodeblock(`${docField.desc}\n`, 'lua');
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
