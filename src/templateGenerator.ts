import * as vscode from 'vscode';
const fs = require('fs-extra');
import { Env } from './env';
import * as path from 'path';
import { isInDirectory, isFileValid, isPathValid, removeSpacesAndNewlines, toUnicodeIgnoreASCII } from './utility';
export class TemplateGenerator{
    private env: Env;
    public constructor(env: Env) {
        this.env = env;
    }
    
    
    /**
     * 选择类型，生成CSV文件模板  如果模板已存在 则不会覆盖
     * @param templateType 模板种类
     * @param targetPath 目标路径
     * @returns true or false 生成成功或失败
     */
    public generateTemplateCSVToTargetPath(templateType: string, targetPath: vscode.Uri): boolean{
        try {
            fs.copy(path.join(path.join(__dirname, "../template/csv_template"), templateType), targetPath.fsPath,{ overwrite: false });
        }
        catch (error) {
            vscode.window.showErrorMessage("模板生成异常:"+error);
            return false;
        }
        return true;
    }

    public generateAllTemplateCSVtoTargetPath(targetPath: vscode.Uri): boolean{
        
        try {
            fs.copy(path.join(__dirname, "../template/csv_template"), targetPath.fsPath, { overwrite: false });
        }
        catch (error) {
            vscode.window.showErrorMessage("模板生成异常:" + error);
            return false;
        }
        return true;
    }
    
}