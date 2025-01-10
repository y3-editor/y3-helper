import * as y3 from 'y3-helper';
import * as vscode from 'vscode';

export class ExcelConfig {
    async loadConfig(): Promise<Record<string, string> | undefined> {
        const overridePath = vscode.workspace.getConfiguration('Y3-Helper').get('ECAOverridePath');
        if (typeof overridePath !== 'string' || overridePath === '') {
            return undefined;
        }
        const excelDirUri = vscode.Uri.file(overridePath + '/excel/编辑器/触发器');
        if (!await y3.fs.isDirectory(excelDirUri)) {
            throw new Error('未找到触发器配置文件夹，请检查配置：' + excelDirUri.fsPath);
        }

        let result: Record<string, string> = {};

        for (const fileName of ['02触发器事件条件表.xlsx', '03触发器动作表.xlsx', '04触发器函数表.xlsx']) {
            const excelUri = y3.uri(excelDirUri, fileName);
            const sheet = await y3.excel.loadFile(excelUri, '触发器');
            const table = sheet.makeTable('B1', 1);
            for (const key in table) {
                const value = table[key]['lua文本'];
                if (value !== '') {
                    let params = table[key]['参数'].split(';');
                    result[key] = value
                        .replace(/{#(\d+)}/g, (_, id) => `{${Number(id) + 1}}`)
                        .replace(/<\$(\d+)>/g, (_, id) => `{${Number(id) + 1 + params.length}}`);
                }
            }
        }

        return result;
    }
}
