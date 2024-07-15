import * as vscode from 'vscode';
import { env } from '../../env';
import { excelExporter } from './excelExporter';
import { TemplateGenerator } from '../CSV/templateGenerator';

export * from './fieldTypes';
export * from './attrType';
export * from './importRule';
export * from './excelExporter';

/**
* 根据用户配置的路径 和导入规则 导入全部物编数据(Excel)
*/
function registerCommandOfImportEditorTableDataFromExcel() {
    vscode.commands.registerCommand('y3-helper.importEditorTableDataFromExcel', async () => {
        await env.mapReady(true);
        
        let projectUri = env.projectUri;
        let scriptUri = env.scriptUri;
        if (!projectUri) {
            vscode.window.showErrorMessage("没有打开工作目录！，请先初始化");
            return false;
        }

        if (!scriptUri) {
            vscode.window.showErrorMessage("scriptUri不存在");
            return false;
        }
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Executing Task",
            cancellable: false
        }, async (progress, token) => {
            let Expoter = new excelExporter();
            await Expoter?.excelExport();

            // this.editorTableDataProvider?.refresh();
        });
    });
}

function registerCommandOfGenerateTemplates() {
    let templateGenerator = new TemplateGenerator();

    // 生成Excel
    vscode.commands.registerCommand('y3-helper.generateExcelTemplate', async () => {
        await env.mapReady(true);
        let projectUri = env.projectUri;
        if (!projectUri) {
            vscode.window.showErrorMessage("没有打开工作目录！，请先初始化");
            return false;
        }
        if (!env.excelUri || ! env.ruleUri) {
            vscode.window.showErrorMessage("未找到合适的位置生成物编数据Excel表模板");
            return false;
        }
        // 把模板template/excel文件夹生成到模板文件夹的父级路径下
        await templateGenerator.generateExcelTemplate(env.excelUri, env.ruleUri);
    });
}

export function init() {
    registerCommandOfImportEditorTableDataFromExcel();
    registerCommandOfGenerateTemplates();
}
