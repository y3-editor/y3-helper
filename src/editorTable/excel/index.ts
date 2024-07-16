import * as vscode from 'vscode';
import * as excel from './excel';

/**
 * 加载excel文件
 * @param path excel文件路径
 * @param sheetName 工作表的名字或序号，默认为 `1`
 * @returns 
 */
export async function loadFile(path: vscode.Uri | string, sheetName?: number | string) {
    if (typeof path === 'string') {
        path = vscode.Uri.parse(path);
    }
    const exc = new excel.Excel();
    await exc.loadFile(path);
    const sheet = exc.getSheet(sheetName ?? 1);
    return sheet;
}

export function init() {

}
