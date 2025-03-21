import * as y3 from 'y3-helper';
import * as vscode from 'vscode';

export class ExcelConfig {
    async findExcelDir(): Promise<vscode.Uri | undefined> {
        const overridePath = vscode.workspace.getConfiguration('Y3-Helper').get('ECAOverridePath');
        if (typeof overridePath !== 'string' || overridePath === '') {
            return undefined;
        }
        let guessUri = vscode.Uri.file(overridePath + '/excel/编辑器/触发器');
        if (await y3.fs.isDirectory(guessUri)) {
            return guessUri;
        }
        return vscode.Uri.file(overridePath);
    }

    async loadConfig(): Promise<Record<string, string> | undefined> {
        const excelDirUri = await this.findExcelDir();
        if (!excelDirUri) {
            return;
        }

        if (!await y3.fs.isDirectory(excelDirUri)) {
            throw new Error('未找到触发器配置文件夹，请检查配置：' + excelDirUri.fsPath);
        }

        let result: Record<string, string> = {};

        for (const fileName of ['02触发器事件条件表.xlsx', '03触发器动作表.xlsx', '04触发器函数表.xlsx']) {
            const excelUri = y3.uri(excelDirUri, fileName);
            if (!await y3.fs.isFile(excelUri)) {
                continue;
            }
            const sheet = await y3.excel.loadFile(excelUri, '触发器');
            const table = sheet.makeTable('B1', 1);
            for (const key in table) {
                const value = table[key]['lua文本'];
                if (value !== '') {
                    let params = table[key]['参数'].split(';');
                    let optionals = table[key]['可选参数'].split(';');
                    result[key] = value
                        . replace(/{#(\d+)}/g, (_, id) => {
                            let str = `{${Number(id) + 1}}`;
                            if (params[Number(id)] === 'ACTION_LIST') {
                                str = '\n' + str + '\n';
                            }
                            return str;
                        })
                        . replace(/<\$(\d+)>/g, (_, id) => {
                            let str = `{${Number(id) + 1 + params.length}}`;
                            if (optionals[Number(id)] === 'ACTION_LIST') {
                                str = '\n' + str + '\n';
                            }
                            return str;
                        });
                }
            }
        }

        return result;
    }
}
