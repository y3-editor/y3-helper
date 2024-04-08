/**
 * 从CSV表格中导入物编数据
 */

import * as vscode from 'vscode';
import csvParser  from 'csv-parser';
import * as fs from 'fs';

import { env } from "../../env";
import { isPathValid } from '../../utility';
import { csvTypeToPath } from "../../constants";
import { saveEditorTableItemJson } from '../editorTableItemJson';


export class CSVimporter
{
    private readonly csvTypeToPath: Readonly<{ [key: string]: string }>;
    public constructor() {
        this.csvTypeToPath = csvTypeToPath;
    }

    /**
     * 从插件配置中指定的文件夹 导入对应类型的物编数据CSV文件
     * @returns true or false 成功或失败
     */
    public async importCSVFromOrderFolder():Promise<boolean> {
        if (!env.scriptUri) {
            vscode.window.showErrorMessage("scriptUri不存在，请检查项目是否初始化");
            return false;
        }
        for (const key in env.tableTypeToCSVfolderPath) {
            let csvRelativeFolderPath = env.tableTypeToCSVfolderPath[key];
            let csvFolderUri: vscode.Uri = vscode.Uri.joinPath(env.scriptUri, csvRelativeFolderPath);
            if (!isPathValid(csvFolderUri.fsPath)) {
                vscode.window.showErrorMessage("未找到CSV表格的路径，请从模板中生成");
                return false;
            }
            if (!await this.importAllCSVinFolder(csvFolderUri, key)) {
                return false;
            }
        }
        return true;
    }


    /**
     * 从文件夹导入其中的所有CSV文件
     * @param folder 
     * @param tableType 
     * @returns 
     */
    private async importAllCSVinFolder(folder: vscode.Uri, tableType:string): Promise<boolean> {
        if (!env.editorTableUri) {
            vscode.window.showErrorMessage("物编数据表路径为空");
            return false;
        }
        let targetTableFolder = this.csvTypeToPath[tableType];
        let targetEditorTablePath: vscode.Uri = vscode.Uri.joinPath(env.editorTableUri, targetTableFolder);
        let files = await vscode.workspace.fs.readDirectory(folder);
        for (const file of files) {
            console.log(file);
            if (file[0].endsWith(".csv")) {
                if (!this.importCSVtoTargetJson(vscode.Uri.joinPath(folder, file[0]), targetEditorTablePath, tableType)) {
                    return false;
                }
            }

        };

        return true;
    }

    /**
     * 导入该CSV文件的数据到目标json文件中
     * @param csv_uri 
     * @param targetJson 
     */
    private async importCSVtoTargetJson(csv_uri:vscode.Uri,targetJson:vscode.Uri,tableType:string):Promise<Boolean>
    {
        const csvFilePath = csv_uri.fsPath;
        console.log("开始读取csv文件:" + csvFilePath);
        
        let i=0;// 当前读取行号
        fs.createReadStream(csvFilePath)
        .pipe(csvParser())
            .on('data', async (row) => {
            
                console.log("第"+i+"行如下：");
                console.log(row);
                // 从英文字段名往下数第一行是中文字段名，再下一是给用户看的样例，再下一行才是用户新添加的
                if(i>=2)
                {
                    

                    // 如果此行保存失败就停止
                    if (!(await saveEditorTableItemJson(row, targetJson, tableType))) {
                        console.log("保存失败的行：" + i + "路径：" + csv_uri.path);
                        return false;
                    }
                    
                }
                
                i++;
        })
        .on('end', () => {
            vscode.window.showInformationMessage("全部导入成功");
            console.log('Parsed CSV data Length:', i);
        })
        .on('error', (error) => {
            console.error('CSV解析错误', error.message);
            console.error('CSV解析出错的行行号:' + (i-1) + "");
            let message = 'CSV解析错误:' + csvFilePath + '\n' + '出错的CSV行，其行号为:' + i;
            vscode.window.showErrorMessage(message);
        });
        return true;
    }
} 
