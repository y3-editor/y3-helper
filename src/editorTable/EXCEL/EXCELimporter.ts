import * as fs from 'fs-extra';
import * as vscode from 'vscode';
import * as exceljs from 'exceljs';

import { env } from '../../env';
import { ImportRule } from './importRule';
import { toFilePath } from '../../utility';
import { saveEditorTableItemJson } from '../editorTableItemJson';
import { chineseTypeNameToEnglishTypeName, csvTypeToPath } from '../../constants';
export class EXCELimporter{
    private excelTablePath: vscode.Uri | undefined = undefined;
    private ImportRulesModule: any=undefined;
    constructor() {
        if (!env.excelTablePath) {
            vscode.window.showErrorMessage("未找到excel表格的位置，请检查是否初始化Y3开发环境");
            return;
        }
        this.excelTablePath = env.excelTablePath;
    }
    private async loadImportRules():Promise<boolean> {
        if (!env.excelTablePath) {
            return false;
        }
        let src = vscode.Uri.joinPath(env.excelTablePath, "importRules.mjs");
        let tar = vscode.Uri.joinPath(env.extensionImportRulesUri, 'importRules.mjs'); 
        try {
            fs.copySync(src.fsPath, tar.fsPath, { overwrite: true });
            this.ImportRulesModule = await import(toFilePath(tar));
            return true;
        }
        catch (error){
            vscode.window.showErrorMessage("自定义导入规则importRules.mjs加载出错，错误类型为：" + error);
            return false;
        }
    }

    public async excelImport(): Promise<boolean> {
        try {
            await this.loadImportRules();
            let importRules:ImportRule[] = this.ImportRulesModule.importRules;
            for (let rule of importRules) {
                this.excelImportByRule(rule);
            }
            return true;
        }
        catch (error) {
            vscode.window.showErrorMessage("导入时出错,错误为：" + error);
            return false;
        }
    }
    
    private async excelImportByRule(importRule: ImportRule):Promise<boolean> {
        
        if (!env.excelTablePath || !env.editorTableUri) {
            return false;
        }
        let excelPath = vscode.Uri.joinPath(env.excelTablePath, importRule.excelRelativePath);
        let editorTableType = chineseTypeNameToEnglishTypeName[importRule.editorTableType];
        const workbook = new exceljs.Workbook();
        await workbook.xlsx.readFile(excelPath.fsPath);
        const worksheet = workbook.getWorksheet(importRule.sheet); // 选择要读取的工作表
        if (worksheet) {
            
            const headers:string[] = [];
            worksheet.getRow(1).eachCell({ includeEmpty: true }, function (cell) {
                if (cell.value) {
                    headers.push(cell.value.toLocaleString());
                }
                else {
                    headers.push(cell.col);
                }
            });

            // 遍历每行数据
            for (let i = 2; i <= worksheet.rowCount; i++) {
                const row:{ [key:string]:any } = {};
                worksheet.getRow(i).eachCell({ includeEmpty: true }, function (cell, colNumber) {
                    let k = headers[colNumber - 1];
                    if (k) {
                        row[k] = cell.value;
                    }
                    else {
                        vscode.window.showErrorMessage("表头字段：" + headers[colNumber - 1] + "未指定其对应的Json字段");
                        return false;
                    }
                });
                let editorTableJsonObject = importRule.rowImport(row);
                let targetTableFolder = csvTypeToPath[editorTableType];
                let targetEditorTablePath: vscode.Uri = vscode.Uri.joinPath(env.editorTableUri, targetTableFolder);
                if (!saveEditorTableItemJson(editorTableJsonObject, targetEditorTablePath, editorTableType)) {
                    return false;
                }
            }
        }
        return true;
    }
}