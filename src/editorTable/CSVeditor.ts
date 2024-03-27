import { Env } from "../env";
import csvParser from 'csv-parser';
import { EditorTableType,editorTableTypeToFolderName } from '../constants';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { isPathValid, isJson, getFileNameByVscodeUri } from '../utility';
/**
 *  物编数据CSV表格的编辑器
 */
export class CSVeditor {
    constructor(private readonly env: Env) {
        
    }
    
    public modifyUID(oldUID: number, newUID: number) {
        
    };
    
    /**
     * 从工程文件添加
     */
    public addEditorTableItemFromProject(editorTableItem:vscode.QuickPickItem) {
        
    }
    
    public searchAllEditorTableItemInProject(query: string): vscode.QuickPickItem[]{
        let res: vscode.QuickPickItem[] = [];
        if (query.length === 0) {
            return res;
        }
        //只搜索九类物编数据的文件夹下的物编数据 不递归搜索
        for (let type in EditorTableType) {
            let folderName = editorTableTypeToFolderName[type];
            res = res.concat(this.searchEditorTableItemsInFolder(type,path.join(this.env.editorTablePath, folderName), query));
        }
        return res;
    }

    private searchEditorTableItemsInFolder(editorTableType:string,pathStr: string, query: string): vscode.QuickPickItem[] {
        let res: vscode.QuickPickItem[] = [];
        const files = fs.readdirSync(pathStr);
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
                if (name !== undefined && typeof name === "string") {
                    label = name + "(" + label.substring(0, label.length - 5) + ")";//显示为"这是一个单位(134219828)"的格式
                }


                if (label.includes(query)) {
                    let editorTableJsonName:string = label;
                    let editorTableJsonUri: vscode.Uri = vscode.Uri.file(filePath);
                    let quickPickItem: vscode.QuickPickItem = {
                        label: editorTableJsonName,
                        description: editorTableType,
                        detail: editorTableJsonUri.fsPath,
                    };
                    res.push(quickPickItem);
                }
            }
        });
        return res;
    }
}