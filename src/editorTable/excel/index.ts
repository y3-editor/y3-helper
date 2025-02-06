import * as vscode from 'vscode';
import * as excel from './excel';
import { Table } from '../../constants';
import * as y3 from 'y3-helper';
import { Rule } from './rule';

export * from './excel';
import * as l10n from '@vscode/l10n';


let baseDir: vscode.Uri;

/**
 * 加载excel文件
 * @param path excel文件路径，可以不写后缀，默认为 `.xlsx`
 * @param sheetName 工作表的名字或序号，默认为 `1`
 * @returns 
 */
export async function loadFile(path: vscode.Uri | string, sheetName?: number | string) {
    path = getUri(path);
    const exc = new excel.Excel();
    const suc = await exc.loadFile(path);
    if (!suc) {
        throw new Error(l10n.t('Excel打开失败：') + path.fsPath);
    }
    const sheet = exc.getSheet(sheetName);
    if (!sheet) {
        throw new Error(l10n.t('找不到工作表：') + sheetName);
    }
    return sheet;
}

/**
 * 加载excel文件，并返回它的所有sheet
 * @param path excel文件路径，可以不写后缀，默认为 `.xlsx`
 * @returns 
 */
export async function loadFileWithAllSheets(path: vscode.Uri | string) {
    path = getUri(path);
    const exc = new excel.Excel();
    const suc = await exc.loadFile(path);
    if (!suc) {
        throw new Error(l10n.t('Excel打开失败：') + path.fsPath);
    }
    const sheets = exc.getAllSheets();
    return sheets;
}

export function setBaseDir(path: vscode.Uri | string) {
    if (typeof path === 'string') {
        path = vscode.Uri.parse(path);
    }
    baseDir = path;
}

function getUri(path: vscode.Uri | string) {
    if (path instanceof vscode.Uri) {
        return path;
    }
    if (y3.fs.isAbsolutePath(path)) {
        return y3.uri(path);
    }
    return y3.uri(baseDir, path);
}

export function rule<N extends Table.NameCN>(tableName: N, path: vscode.Uri | string, sheetName?: number | string) {
    path = getUri(path);
    const ruleInstance = new Rule(tableName, path, sheetName);

    y3.plugin.onceDidRun(async () => {
        await ruleInstance.apply();
    });

    return ruleInstance;
}

export function init() {

}
