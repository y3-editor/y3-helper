import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import { env } from '../env';
import * as path from 'path';
import { isPathValid } from '../utility';
import { chineseTypeNameToEnglishTypeName,englishTypeNameToChineseTypeName } from '../constants';
export class TemplateGenerator{
    private readonly englishToChinese;
    private readonly chineseToEnglish;
    public constructor() {
        this.chineseToEnglish = chineseTypeNameToEnglishTypeName;
        this.englishToChinese = englishTypeNameToChineseTypeName;
    }
    
    
    /**
     * 选择类型，生成CSV文件模板  如果模板已存在 则不会覆盖
     * @param templateType 模板种类
     * @param targetPath 目标路径
     * @returns true or false 生成成功或失败
     */
    public generateTemplateCSVToTargetPath(templateType: string, targetPath: vscode.Uri): boolean{
        try {
            fs.copy(path.join(path.join(__dirname, "../../template/csv_template"), templateType), targetPath.fsPath,{ overwrite: false });
        }
        catch (error) {
            vscode.window.showErrorMessage("模板生成异常:"+error);
            return false;
        }
        return true;
    }

    public async generateAllTemplateCSVtoTargetPath(targetPath: vscode.Uri): Promise<boolean>{
        
        try {
            await this.renameTemplateCSVtoChinese();
            fs.copySync(path.join(__dirname, "../../template/csv_template"), targetPath.fsPath, { overwrite: false });
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
        for (let key in this.englishToChinese) {
            let oldFile: string = key;
            let newFile: string = this.englishToChinese[key];
            oldFile = path.join(__dirname, "../../template/csv_template/" + oldFile);
            newFile = path.join(__dirname, "../../template/csv_template/" + newFile);
            if (isPathValid(newFile)) {
                continue;
            }
            fs.renameSync(oldFile, newFile);
        }
    }

    private async renameTemplateCSVtoEnglish() {
        for (let key in this.chineseToEnglish) {
            let oldFile: string = key;
            let newFile: string = this.chineseToEnglish[key];
            oldFile = path.join(__dirname, "../../template/csv_template/" + oldFile);
            newFile = path.join(__dirname, "../../template/csv_template/" + newFile);
            if (isPathValid(newFile)) {
                continue;
            }
            fs.renameSync(oldFile, newFile);
        }
    }
}
