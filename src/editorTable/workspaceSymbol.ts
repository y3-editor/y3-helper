import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as y3 from 'y3-helper';
import { env } from '../env';
import { Table } from '../constants';

/**
 * 提供物编数据对应的Json文件的SymbolProvider
 */
export class GoEditorTableSymbolProvider implements vscode.WorkspaceSymbolProvider {

    private async searchEditorTableItemsInFolder(pathStr: string,query:string): Promise<vscode.SymbolInformation[]> {
    let res: vscode.SymbolInformation[] = [];
    const files = await fs.promises.readdir(pathStr);
    for (const file of files) {
        const filePath: string = path.join(pathStr, file);
        
        if (filePath.toLowerCase().endsWith('.json')) {
        let editorTableJsonData: any;
        let label = file;
        try {
            editorTableJsonData = await fs.promises.readFile(filePath, 'utf8');
        }
        catch (error) {
            vscode.window.showErrorMessage("读取" + filePath + "时出错");
        }

        let editorTableJson: any = undefined;
        try {
            editorTableJson = JSON.parse(editorTableJsonData);

        }
        catch (error) {
            vscode.window.showErrorMessage("读取" + filePath + "时失败，错误为：" + error);
        }
        let name;
        if (editorTableJson.hasOwnProperty('name')) {
            let nameKey: any = editorTableJson['name'];
            name = y3.language.get(nameKey);
        }
        if (name !== undefined && typeof name === "string") {
            label = name + "(" + label.substring(0, label.length - 5) + ")";//显示为"这是一个单位(134219828)"的格式
        }

        
        if (label.includes(query)) {
            let editorTableJsonName = label;
            let editorTableJsonKind = vscode.SymbolKind.File;

            let editorTableJsonUri: vscode.Uri = vscode.Uri.file(filePath);
            let editorTableJsonLocation: vscode.Location = new vscode.Location(editorTableJsonUri, new vscode.Position(0, 0));
            let containerName = '';
            let symbolInformation: vscode.SymbolInformation = new vscode.SymbolInformation(
            editorTableJsonName,
            editorTableJsonKind,
            containerName,
            editorTableJsonLocation
            );
            res.push(symbolInformation);
        }
        }
    };
        

    return res;
    
    }
    public async provideWorkspaceSymbols(
    query: string, token: vscode.CancellationToken):
    Promise<vscode.SymbolInformation[]> {
    let res: vscode.SymbolInformation[] = [];
    if (token.isCancellationRequested||query.length===0) {
        return Promise.resolve(res);
    }

    //只搜索九个文件夹下对应的九类类物编数据，不递归搜索子文件夹
    for (let key in Table.path.toCN) {
        res=res.concat(await this.searchEditorTableItemsInFolder(path.join(env.editorTablePath, key), query));
    }
    
    

    return Promise.resolve(res);
    }
}

export function init() {
    vscode.languages.registerWorkspaceSymbolProvider(new GoEditorTableSymbolProvider());
}
