 
import { isFileValid, randomInt } from '../utility';
import { englishPathToChinese } from '../constants';
import * as vscode from 'vscode';
 /**
 * 通过物编数据项目的(uid)判断其是否存在于项目中
 * @param uid 
 * @returns 
 */
export function haveEditorTableJson(editorTableUri:vscode.Uri,uid: number): boolean{
    if (!editorTableUri) {
        return false;
    }
    let jsonName: string = String(uid) + '.json';
    for (let folderName in englishPathToChinese) {
        let filePath = vscode.Uri.joinPath(editorTableUri, folderName, jsonName);
        if (isFileValid(filePath)) {
            return true;
        }
    }
    return false;
}

/**
 * 分配新的物编数据项目的UID，注意此函数只保证在项目中不和其他物编数据项目的UID冲突，不保证不和CSV表格的已有UID冲突
 * |--- 作者id（5bit）---|-官方or作者（1bit）-|-是否由war3地图导入(1bit)-|-----预留（9bit）-----|-------生成（16bit）-------|
 * @param editorTableUri 工程项目的物编表路径
 */
export function allocateNewUIDofEditorTableItem(editorTableUri: vscode.Uri) :number{
    let authorId = 1;
    let author = authorId << 27;
    let official = 0;

    // 为了war3导入工具与客户端解耦，保证导入工具生成key不会冲突，客户端内生成key时永远不用标记这一位
    let war3 = 0 << 25;
    let reserved = 0 << 16;
    let randomPart = randomInt(0, (1 << 16) - 1);
    let fixPart = author + official + war3 + reserved;
    let result = fixPart + randomPart;

    // 如果冲突在生成的16bit的范围内随机探测
    while (haveEditorTableJson(editorTableUri,result)) {
        result = fixPart + randomInt(0, (1 << 16) - 1);
    }
    return result;
}