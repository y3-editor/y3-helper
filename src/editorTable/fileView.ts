import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as y3 from 'y3-helper';
import { env } from '../env';
import { Table } from '../constants';
import { isPathValid, getFileNameByVscodeUri } from '../utility';

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

/**
 * 提供物编数据的Json文件内的中英文字段搜索的DocumentSymbolProvider
 */
export class GoEditorTableDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    private englishKeyToChineseKey: any;
    constructor(private zhlanguageJson: any = undefined ) {
    let englishKeyToChineseKeyJsonPath = path.join(__dirname, "../../config/englishKeyToChineseKey.json");
    if (isPathValid(englishKeyToChineseKeyJsonPath)) {
        try {
        this.englishKeyToChineseKey = JSON.parse(fs.readFileSync(englishKeyToChineseKeyJsonPath, 'utf8'));
        }
        catch (error) {
        vscode.window.showErrorMessage("读取和解析" + englishKeyToChineseKeyJsonPath + "时失败，错误为：" + error);
        }
    }
    else {
        vscode.window.showErrorMessage("在以下路径找不到englishKeyToChineseKey.json:\n"+englishKeyToChineseKeyJsonPath);
    }
    }
    public provideDocumentSymbols(
    document: vscode.TextDocument, token: vscode.CancellationToken):
    Thenable<vscode.SymbolInformation[]> {
    let res: vscode.SymbolInformation[] = [];
    if (token.isCancellationRequested) {
        return Promise.resolve(res);
    }
    res=this.getEditorTableJsonDocumentSymbols(document);

    return Promise.resolve(res);
    }
    private getEditorTableJsonDocumentSymbols(document: vscode.TextDocument): vscode.SymbolInformation[] {
    let res: vscode.SymbolInformation[] = [];
    const keyToLine: { [key: string]: number } = {};
    let editorTableJsonData:any = JSON.parse(document.getText());
    for (let i = 0; i < document.lineCount; i++){
        let line = document.lineAt(i).text;
        const matches = line.match(/"\s*([^"]+)"\s*(?=:)/g);// 正则表达式匹配双引号内，且后缀为':'的字符串，视为Json的键
        if (matches) {
        matches.forEach(match => {
            match = match.substring(1, match.length - 1);
            keyToLine[match] = i;
        });
        };
    }
    let fileName: string = getFileNameByVscodeUri(vscode.Uri.file(document.fileName));
    let chineseName = this.zhlanguageJson[editorTableJsonData['name']];
    let finalFileName = fileName;
    if (chineseName !== undefined && typeof chineseName === 'string') {
        finalFileName = chineseName + "(" + fileName.substring(0, fileName.length - 5) + ")";//这是一个单位(134219828)"的格式
    }
    for (let key in keyToLine) {
        let name = key;
        let kind: vscode.SymbolKind;
        
        if (typeof editorTableJsonData[key] === typeof []) {
        kind = vscode.SymbolKind.Array;
        }
        else if (typeof editorTableJsonData[key]===typeof {} ) {
        kind = vscode.SymbolKind.Module;
        }
        else if (typeof editorTableJsonData[key] === typeof true) {
        kind = vscode.SymbolKind.Boolean;
        }
        else if (!isNaN(editorTableJsonData[key])) {
        kind = vscode.SymbolKind.Number;
        }
        else if (typeof editorTableJsonData[key] === typeof "") {
        kind = vscode.SymbolKind.String;
        }
        else {
        kind = vscode.SymbolKind.Module;
        }

        let uri: vscode.Uri = document.uri;
        let location: vscode.Location = new vscode.Location(document.uri, new vscode.Position(keyToLine[key], 0));
        let containerName = finalFileName;
        if (key in this.englishKeyToChineseKey) {
        // todo:获得字段对应的中文名
        name = this.englishKeyToChineseKey[key] + '(' + key + ')';
        let symbolInformation: vscode.SymbolInformation = new vscode.SymbolInformation(
            name,
            kind,
            containerName,
            location
        );
        res.push(symbolInformation);
        }
        
    }
    
    return res;
    }
}

export function init() {

}
