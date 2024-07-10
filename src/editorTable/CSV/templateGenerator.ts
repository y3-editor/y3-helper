import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import { isPathValid } from '../../utility';
import { Table } from '../../constants';


export class TemplateGenerator {
    private readonly englishToChinese;
    private readonly chineseToEnglish;
    public constructor() {
        this.chineseToEnglish = Table.name.fromCN;
        this.englishToChinese = Table.name.toCN;
    }
    
    /**
     * 选择类型，生成CSV文件模板  如果模板已存在 则不会覆盖
     * @param templateType 模板种类
     * @param targetPath 目标路径
     * @returns true or false 生成成功或失败
     */
    public async generateTemplateCSVToTargetPath(templateType: string, targetPath: vscode.Uri): Promise<boolean> {
        try {
            fs.copySync(path.join(__dirname, "../../template/csv", templateType), targetPath.fsPath, { overwrite: false });
        }
        catch (error) {
            vscode.window.showErrorMessage("模板生成异常:" + error);
            return false;
        }
        return true;
    }

    public async generateAllTemplateCSVtoTargetPath(targetPath: vscode.Uri): Promise<boolean> {
        try {
            await this.renameTemplateCSVtoChinese();
            fs.copySync(path.join(__dirname, "../../template/csv"), targetPath.fsPath, { overwrite: false });
            await this.renameTemplateCSVtoEnglish();
        }
        catch (error) {
            vscode.window.showErrorMessage("模板生成异常:" + error);
            return false;
        }
        return true;
    }

    
    /**
     * vsocde插件的发布打包程序不支持中文路径 只能被迫转换一下 完后又改回原名
     */
    private async renameTemplateCSVtoChinese() {
        for (const key in this.englishToChinese) {
            let oldFile: string = key;
            let newFile: string = this.englishToChinese[key as Table.NameEN];
            oldFile = path.join(__dirname, "../../template/csv/" + oldFile);
            newFile = path.join(__dirname, "../../template/csv/" + newFile);
            if (isPathValid(newFile)) {
                continue;
            }
            fs.renameSync(oldFile, newFile);
        }
    }
    /**
     * vsocde插件的发布打包程序不支持中文路径 只能被迫转换成英文名
     */
    private async renameTemplateCSVtoEnglish() {
        for (let key in this.chineseToEnglish) {
            let oldFile: string = key;
            let newFile: string = this.chineseToEnglish[key as Table.NameCN];
            oldFile = path.join(__dirname, "../../template/csv/" + oldFile);
            newFile = path.join(__dirname, "../../template/csv/" + newFile);
            if (isPathValid(newFile)) {
                continue;
            }
            fs.renameSync(oldFile, newFile);
        }
    }

    /**
     * 生成excel模板
     */
    public async generateExcelTemplate(dstExcelPath: vscode.Uri, dstRulePath: vscode.Uri):Promise<boolean> {
        try {
            fs.copySync(path.join(__dirname, "../../template/excel/table"), dstExcelPath.fsPath, { overwrite: true });
            fs.copySync(path.join(__dirname, "../../template/excel/rule"), dstRulePath.fsPath, { overwrite: true });
        }
        catch (error) {
            vscode.window.showErrorMessage("ExcelTemplate生成异常:" + error);
            return false;
        }
        return true;
    }
}
