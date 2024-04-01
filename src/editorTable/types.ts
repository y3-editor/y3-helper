import * as vscode from 'vscode';
import { EditorTableType } from '../constants';
import { isFileValid, isJson} from '../utility';
import * as fs from 'fs';


/**
 * 用以保存物编数据信息的类
 */
export class EditorTableItemInfo{
    constructor(public  uid: number,
        public  name: string,
        public  editorTableType: EditorTableType,
        public  jsonUri:vscode.Uri
        ) {
    }
    
    /**
     * 读取物编数据项目对应的Json文件并返回Json对象
     * 如果路径非法或读取失败则返回undefined
     * @returns any|undefined
     */
    public getJson(): any|undefined{
        if (isFileValid(this.jsonUri)) {
            return undefined;
        }
        if (!isJson(this.jsonUri.fsPath)) {
            return undefined;
        }
        let filePath = this.jsonUri.fsPath;
        let editorTableJsonData: any;
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
        return editorTableJson;
    }
}