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
    const suc = await exc.loadFile(path);
    if (!suc) {
        throw new Error('加载文件失败：' + path.toString());
    }
    const sheet = exc.getSheet(sheetName ?? 1);
    if (!sheet) {
        throw new Error('找不到工作表：' + sheetName);
    }
    return sheet;
}

export function init() {

}
