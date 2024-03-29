 
import { isFileValid, randomInt, isJson, isCSV, isPathValid } from '../utility';
import { englishPathToChinese, editorTableTypeToFolderName, EditorTableType, englishTypeNameToChineseTypeName } from '../constants';
import { env } from "../env";
import * as csv from 'fast-csv';
import * as path from 'path';
import * as fs from 'fs';
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

 export function searchAllEditorTableItemInProject(query: string): vscode.QuickPickItem[]{
    let res: vscode.QuickPickItem[] = [];
    if (query.length === 0) {
        return res;
    }
    //只搜索九类物编数据的文件夹下的物编数据 不递归搜索
    for (let type in EditorTableType) {
        let typeStr = EditorTableType[type as keyof typeof EditorTableType];
        let folderName: string = editorTableTypeToFolderName[typeStr];
        res = res.concat(searchEditorTableItemsInFolder(type, path.join(env.editorTablePath, folderName), query));
    }
    return res;
}

/**
 * 搜索文件夹下的物编数据Json
 * @param editorTableType 
 * @param pathStr 
 * @param query 
 * @returns 
 */
export function searchEditorTableItemsInFolder(editorTableType: string, pathStr: string, query: string): vscode.QuickPickItem[] {
    let res: vscode.QuickPickItem[] = [];
    const files = fs.readdirSync(pathStr);
    editorTableType = editorTableType.toLowerCase();
    files.forEach(file => {
        const filePath: string = path.join(pathStr, file);
        const stat = fs.statSync(filePath);

        if (isJson(filePath)) {
            let editorTableJsonData: any;
            let label = file;
            try {
                editorTableJsonData = fs.readFileSync(filePath, 'utf8');
            }
            catch (error) {
                vscode.window.showErrorMessage("读取" + filePath + "时出错");
            }

            let editorTableJson: any = undefined;
            try {
                editorTableJson = JSON.parse(editorTableJsonData);

            }
            catch (error) {
                vscode.window.showErrorMessage("读取" + filePath + "时失败，错误为：" + error);
            }
            let name;
            if (editorTableJson.hasOwnProperty('name')) {
                let nameKey: any = editorTableJson['name'];
                name = env.zhlanguageJson[nameKey];
            }
            let uid = editorTableJson['uid'];
            if (!uid || typeof uid !== 'number') {
                uid = label.substring(0, label.length - 5);
            }
            if (name !== undefined && typeof name === "string") {
                label = name + "(" + uid + ")";//转为"这是一个单位(134219828)"的格式
            }


            if (label.includes(query)) {
                let editorTableJsonUri: vscode.Uri = vscode.Uri.file(filePath);
                let quickPickItem: vscode.QuickPickItem = {
                    label: name,
                    description: englishTypeNameToChineseTypeName[editorTableType],
                    detail: uid,
                };
                res.push(quickPickItem);
            }
        }
    });
    return res;
}

export function searchAllEditorTableItemInCSV(query: string): vscode.QuickPickItem[] {
    let res: vscode.QuickPickItem[] = [];
    if (!env.scriptUri) {
        vscode.window.showErrorMessage("未初始化Y3项目");
        return res;
    }
    

    // 搜索九类CSV文件
    for (let type in EditorTableType) {
        let typeStr = EditorTableType[type as keyof typeof EditorTableType];
        let csvRelativePath = env.tableTypeToCSVfolderPath[typeStr];
        let csvPath = vscode.Uri.joinPath(env.scriptUri, csvRelativePath);
        if (!isPathValid(csvPath.fsPath)) {
            vscode.window.showErrorMessage("未找到CSV文件，请先生成");
            return res;
        }
        const files = fs.readdirSync(csvPath.fsPath);
        files.forEach(file => {
            if (!isCSV(file)) {
                return;
            }
            const filePath = path.join(csvPath.fsPath, file);
            const fileReadStream = fs.createReadStream(filePath);
            let i = 1;//行号,第0行是表头，从第一行开始读
            csv.parseStream(fileReadStream, { headers: true })
                .on(
                    'data', (row) => {
                        
                        // 忽略第1，2行
                        if (i <= 2) {
                            i++;
                            return;
                        }

                        if (!row.hasOwnProperty('uid')) {
                            vscode.window.showErrorMessage('提供的CSV文件格式错误，缺少uid字段,文件路径为:' + filePath);
                            return;
                        }
                        if (!row.hasOwnProperty('name')) {
                            vscode.window.showErrorMessage('提供的CSV文件格式错误，缺少name字段,文件路径为:' + filePath);
                            return;
                        }
                        let uid: number = row['uid'];
                        let name: string = row['name'];
                        i++;
                    }
                )
                .on('end', () => {

                })
                .on('error', (error) => {
                    console.error('CSV解析错误', error.message);
                    console.error('CSV解析出错的行行号:' + (i - 1) + "");
                    let message = 'CSV解析错误:' + filePath + '\n' + '出错的CSV行，其行号为:' + i;
                    vscode.window.showErrorMessage(message);
                });
        });
    }
    return res;
}
