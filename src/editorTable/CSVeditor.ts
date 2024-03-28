import { Env } from "../env";
import * as csv from 'fast-csv';
import { EditorTableType, editorTableTypeToFolderName, englishTypeNameToChineseTypeName,chineseTypeNameToEnglishTypeName } from '../constants';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { hash, isJson, getFileNameByVscodeUri, isCSV, isPathValid } from '../utility';
/**
 *  物编数据CSV表格的编辑器
 */
export class CSVeditor {
    constructor(private env: Env) {
        
    }
    
    public modifyUID(oldUID: number, newUID: number) {
        
    };
    
    /**
     * 从工程文件添加
     */
    public addEditorTableItemFromProject(editorTableItem: vscode.QuickPickItem) {
        if (!editorTableItem.description || !this.env.scriptUri) {
            vscode.window.showErrorMessage("未初始化Y3项目");
            return;
        }
        let englishEditorTableType = chineseTypeNameToEnglishTypeName[editorTableItem.description];
        let csvRelativePath = this.env.tableTypeToCSVfolderPath[englishEditorTableType];
        let csvPath = vscode.Uri.joinPath(this.env.scriptUri, csvRelativePath);
        if (!isPathValid(csvPath.fsPath)) {
            vscode.window.showErrorMessage("未找到CSV文件，请先生成");
            return;
        }
        const files = fs.readdirSync(csvPath.fsPath);
        files.forEach(file => {
            if (!isCSV(file)) {
                return;
            }
            const rows: any[] = [];
            const filePath = path.join(csvPath.fsPath, file);
            const fileReadStream = fs.createReadStream(filePath);
            let haveItem: boolean = false;
            let haveError: boolean = false;
            let i = 0;//行号
            csv.parseStream(fileReadStream,{ headers: true })
            .on(
                'data',  (row) => { 
                    if (!row.hasOwnProperty('uid')) {
                        haveError = true;
                        vscode.window.showErrorMessage('提供的CSV文件格式错误，缺少uid字段,文件路径为:'+filePath);
                        return;
                    }
                    if (row['uid'] === editorTableItem.detail) {
                        haveItem = true;
                    }
                    rows.push(row);

                    i++;
                }
            )
            .on('end', () => {
                if (!haveItem) {
                    let newRow: any={};
                    newRow['uid'] = editorTableItem.detail;
                    newRow['key'] = editorTableItem.detail;
                    newRow['name'] = editorTableItem.label;
                    rows.push(newRow);
                }
                if (!haveError) {
                    const fileWriteStream = fs.createWriteStream(filePath);
                    csv.write(rows, { headers: true })
                        .pipe(fileWriteStream);
                }
            })
            .on('error', (error) => {
                console.error('CSV解析错误', error.message);
                console.error('CSV解析出错的行行号:' + (i - 1) + "");
                let message = 'CSV解析错误:' + filePath + '\n' + '出错的CSV行，其行号为:' + i;
                vscode.window.showErrorMessage(message);
            });
        });
    }
    
    public searchAllEditorTableItemInProject(query: string): vscode.QuickPickItem[]{
        let res: vscode.QuickPickItem[] = [];
        if (query.length === 0) {
            return res;
        }
        //只搜索九类物编数据的文件夹下的物编数据 不递归搜索
        for (let type in EditorTableType) {
            let typeStr = EditorTableType[type as keyof typeof EditorTableType];
            let folderName: string = editorTableTypeToFolderName[typeStr];
            res = res.concat(this.searchEditorTableItemsInFolder(type,path.join(this.env.editorTablePath, folderName), query));
        }
        return res;
    }

    private searchEditorTableItemsInFolder(editorTableType:string,pathStr: string, query: string): vscode.QuickPickItem[] {
        let res: vscode.QuickPickItem[] = [];
        const files = fs.readdirSync(pathStr);
        editorTableType=editorTableType.toLowerCase();
        files.forEach(file => {
            const filePath: string = path.join(pathStr, file);
            const stat = fs.statSync(filePath);

            if (isJson(filePath)) {
                let editorTableJsonData: any;
                let label = file;
                try {
                    editorTableJsonData = fs.readFileSync(filePath, 'utf8');
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
                    name = this.env.zhlanguageJson[nameKey];
                }
                let uid = editorTableJson['uid'];
                if (!uid || typeof uid !=='number') {
                    uid = label.substring(0, label.length - 5);
                }
                if (name !== undefined && typeof name === "string") {
                    label = name + "(" + uid + ")";//转为"这是一个单位(134219828)"的格式
                }


                if (label.includes(query)) {
                    let editorTableJsonUri: vscode.Uri = vscode.Uri.file(filePath);
                    let quickPickItem: vscode.QuickPickItem = {
                        label: name,
                        description: englishTypeNameToChineseTypeName[editorTableType],
                        detail: uid,
                    };
                    res.push(quickPickItem);
                }
            }
        });
        return res;
    }
}