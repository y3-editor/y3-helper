import * as vscode from 'vscode';
import { runShell } from './runShell';

export class LuaDocMaker {
    private _context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
    }

    public async make(): Promise<string | undefined> {
        let sumneko = vscode.extensions.getExtension('sumneko.lua');
        if (!sumneko) {
            vscode.window.showErrorMessage('请先安装 sumneko.lua 扩展！');
            return undefined;
        }
        let exeUri = vscode.Uri.joinPath(sumneko.extensionUri, 'server/bin/lua-language-server');
        let currentUri = vscode.workspace.workspaceFolders?.[0].uri;
        if (!currentUri) {
            vscode.window.showErrorMessage('请先打开工作目录！');
            return undefined;
        }
        let y3Uri = vscode.Uri.joinPath(currentUri, 'y3');

        await vscode.workspace.fs.createDirectory(this._context.globalStorageUri);
        let logUri = vscode.Uri.joinPath(this._context.globalStorageUri, 'doc');

        await runShell(
            "导出文档",
            exeUri.fsPath,
            [
                "--doc=" + y3Uri.fsPath,
                "--logpath=" + logUri.fsPath,
            ]
        );

        let jsonUri = vscode.Uri.joinPath(logUri, 'doc.json');
        let content = new TextDecoder().decode(await vscode.workspace.fs.readFile(jsonUri));
        let doc = JSON.parse(content);

        let markdown = this.convertDocToMarkdown(doc);
    }

    private convertDocToMarkdown(doc: Object): string {
        let markdown = new vscode.MarkdownString();

        // for _, class in ipairs(doc) do
        //     md:add('md', '# ' .. class.name)
        //     md:emptyLine()
        //     md:add('md', class.desc)
        //     md:emptyLine()
        //     if class.defines then
        //         for _, define in ipairs(class.defines) do
        //             if define.extends then
        //                 md:add('lua', define.extends.view)
        //                 md:emptyLine()
        //             end
        //         end
        //     end
        //     if class.fields then
        //         local mark = {}
        //         for _, field in ipairs(class.fields) do
        //             if not mark[field.name] then
        //                 mark[field.name] = true
        //                 md:add('md', '## ' .. field.name)
        //                 md:emptyLine()
        //                 md:add('lua', field.extends.view)
        //                 md:emptyLine()
        //                 md:add('md', field.desc)
        //                 md:emptyLine()
        //             end
        //         end
        //     end
        //     md:splitLine()
        // end

        return markdown.value;
    }
}
