import * as fs from 'fs';
import * as csv from 'fast-csv';
import * as vscode from 'vscode';
import * as path from 'path';
import { env } from "../../env";
import { SpinLock, isCSV, isPathValid } from "../../utility";
import { allocateNewUIDofEditorTableItem } from '../editorTableUtility';
import {EditorTableType, Table, TableNameEN, TableNameCN
} from '../../constants';
/**
 *  物编数据CSV表格的编辑器s
 */
export class CSVeditor {
    
    /**
     * 通过uid修改物编项目的名称
     * @param uid 
     * @param name 
     */
    public modifyName(uid: number, newName: string) {
        if (!env.scriptUri) {
            vscode.window.showErrorMessage("未找到项目的物编数据");
            return;
        }
        //只搜索九类物编数据的文件夹下的物编数据 不递归搜索
        for (let type in EditorTableType) {
            let typeStr = EditorTableType[type as keyof typeof EditorTableType];
            let folderName: string = env.tableTypeToCSVfolderPath[typeStr];
            this.modifyNameinFolder(vscode.Uri.joinPath(env.scriptUri, folderName), uid, newName);
        }
    }

    private modifyNameinFolder(csvPath: vscode.Uri, uid: number,newName:string) {
        const files = fs.readdirSync(csvPath.fsPath);
        files.forEach(file => {
            if (!isCSV(file)) {
                return;
            }
            const rows: any[] = [];
            const filePath = path.join(csvPath.fsPath, file);
            const fileReadStream = fs.createReadStream(filePath);
            let haveError: boolean = false;
            let i = 0;//行号
            csv.parseStream(fileReadStream, { headers: true })
                .on(
                    'data', (row) => {
                        if (!row.hasOwnProperty('uid')) {
                            haveError = true;
                            vscode.window.showErrorMessage('提供的CSV文件格式错误，缺少uid字段,文件路径为:' + filePath);
                            return;
                        }
                        if (row['uid'] === String(uid)) {
                            row['name'] = newName;
                        }
                        rows.push(row);

                        i++;
                    }
                )
                .on('end', () => {
                    if (!haveError) {
                        const fileWriteStream = fs.createWriteStream(filePath);
                        csv.write(rows, { headers: true })
                            .pipe(fileWriteStream);
                    }
                })
                .on('error', (error) => {
                    console.error('CSV解析错误', error.message);
                    console.error('CSV解析出错的行行号:' + (i - 1) + "");
                    let message = 'CSV解析错误:' + filePath + '\n' + '出错的CSV行，其行号为:' + i;
                    vscode.window.showErrorMessage(message);
                });
        });
    }

    /**
     * 修改物编项目的UID
     * @param oldUID 
     * @param newUID 
     */
    public modifyUID(oldUID: number, newUID: number) {
        if (!env.scriptUri) {
            vscode.window.showErrorMessage("未找到项目的物编数据");
            return;
        }
        //只搜索九类物编数据的文件夹下的物编数据 不递归搜索
        for (let type in EditorTableType) {
            let typeStr = EditorTableType[type as keyof typeof EditorTableType];
            let folderName: string = env.tableTypeToCSVfolderPath[typeStr];
            this.modifyUIDinFolder(vscode.Uri.joinPath(env.scriptUri, folderName), oldUID, newUID);
        }
    };

    private modifyUIDinFolder(csvPath:vscode.Uri,oldUID: number, newUID: number) {
        const files = fs.readdirSync(csvPath.fsPath);
        files.forEach(file => {
            if (!isCSV(file)) {
                return;
            }
            const rows: any[] = [];
            const filePath = path.join(csvPath.fsPath, file);
            const fileReadStream = fs.createReadStream(filePath);
            let haveError: boolean = false;
            let i = 0;//行号
            csv.parseStream(fileReadStream, { headers: true })
                .on(
                    'data', (row) => {
                        if (!row.hasOwnProperty('uid')) {
                            haveError = true;
                            vscode.window.showErrorMessage('提供的CSV文件格式错误，缺少uid字段,文件路径为:' + filePath);
                            return;
                        }
                        if (row['uid'] === String(oldUID)) {
                            row['uid'] = newUID;
                            row['key'] = newUID;
                        }
                        rows.push(row);

                        i++;
                    }
                )
                .on('end', () => {
                    if (!haveError) {
                        const fileWriteStream = fs.createWriteStream(filePath);
                        csv.write(rows, { headers: true })
                            .pipe(fileWriteStream);
                    }
                })
                .on('error', (error) => {
                    console.error('CSV解析错误', error.message);
                    console.error('CSV解析出错的行行号:' + (i - 1) + "");
                    let message = 'CSV解析错误:' + filePath + '\n' + '出错的CSV行，其行号为:' + i;
                    vscode.window.showErrorMessage(message);
                });
        });
    }

    /**
     * 无冲突地添加新的UID和Name到CSV表格中，不会和项目或CSV中已有的物编数据冲突
     * @param typeStr 物编数据种类
     * @param name 物编项目名称
     */
    public async addNewUIDandNameInCSVwithoutConflict(typeStr:TableNameEN,name:string) {
        let uid: number =await this.allocateNewUIDofEditorTableItemToCSV();
        this.addNewUIDandNameInCSV(typeStr, uid, name);
        let englishTypeStr = Table.name.toCN[typeStr];
        vscode.window.showInformationMessage("添加 " + englishTypeStr +": "+name+" 成功");
    }


    /**
     * 强行添加新的UID和Name到CSV表格中,可能会有冲突
     * @param typeStr 
     * @param uid 
     * @param name 
     * @returns 
     */
    private addNewUIDandNameInCSV(typeStr:string,uid: number, name: string) {
        if (!env.scriptUri) {
            vscode.window.showErrorMessage("未初始化Y3项目");
            return;
        }
        
        let englishEditorTableType = typeStr;
        let csvRelativePath = env.tableTypeToCSVfolderPath[englishEditorTableType];
        let csvPath = vscode.Uri.joinPath(env.scriptUri, csvRelativePath);
        if (!isPathValid(csvPath.fsPath)) {
            vscode.window.showErrorMessage("未找到CSV文件，请先生成");
            return;
        }
        const files = fs.readdirSync(csvPath.fsPath);
        files.forEach(file => {
            if (!isCSV(file)) {
                return;
            }
            const rows: any[] = [];
            const filePath = path.join(csvPath.fsPath, file);
            const fileReadStream = fs.createReadStream(filePath);
            let haveItem: boolean = false;
            let haveError: boolean = false;
            let i = 0;//行号
            csv.parseStream(fileReadStream, { headers: true })
                .on(
                    'data', (row) => {
                        if (!row.hasOwnProperty('uid')) {
                            haveError = true;
                            vscode.window.showErrorMessage('提供的CSV文件格式错误，缺少uid字段,文件路径为:' + filePath);
                            return;
                        }
                        if (row['uid'] === String(uid)) {
                            haveItem = true;
                        }
                        rows.push(row);

                        i++;
                    }
                )
                .on('end', () => {
                    if (!haveItem) {
                        let newRow: any = {};
                        newRow['key'] = uid;
                        newRow['uid'] = uid;
                        newRow['name'] = name;
                        rows.push(newRow);
                    }
                    if (!haveError) {
                        const fileWriteStream = fs.createWriteStream(filePath);
                        csv.write(rows, { headers: true })
                            .pipe(fileWriteStream);
                    }
                })
                .on('error', (error) => {
                    console.error('CSV解析错误', error.message);
                    console.error('CSV解析出错的行行号:' + (i - 1) + "");
                    let message = 'CSV解析错误:' + filePath + '\n' + '出错的CSV行，其行号为:' + i;
                    vscode.window.showErrorMessage(message);
                });
        });
    }
    
    /**
     * 从工程文件添加
     */
    public addEditorTableItemFromProject(editorTableItem: vscode.QuickPickItem) {
        if (!editorTableItem.description || !editorTableItem.detail||!editorTableItem.label) {
            vscode.window.showErrorMessage("选择的项目的label或description或label不存在");
            return;
        }
        let englishEditorTableType = Table.name.fromCN[editorTableItem.description as TableNameCN];
        let uid: number = Number(editorTableItem.detail);
        this.addNewUIDandNameInCSV(englishEditorTableType, uid, editorTableItem.label);
        
        vscode.window.showInformationMessage("添加 " + editorTableItem.description + ": " + editorTableItem.label + " 成功");
    }
    
   


    
    private uidToFolder: { [key: number]: string } = {};
    private async refreshUIDtoFolder() {
        if (!env.scriptUri) {
            vscode.window.showErrorMessage("未初始化Y3项目");
            return;
        }
        this.uidToFolder = {};
        
        // 搜索九类CSV文件
        for (let type in EditorTableType ) {
            let typeStr = EditorTableType[type as keyof typeof EditorTableType];
            let csvRelativePath = env.tableTypeToCSVfolderPath[typeStr];
            let csvPath = vscode.Uri.joinPath(env.scriptUri, csvRelativePath);
            if (!isPathValid(csvPath.fsPath)) {
                vscode.window.showErrorMessage("未找到CSV文件，请先生成");
                return;
            }
            const files = fs.readdirSync(csvPath.fsPath);
            files.forEach(async file => {
                if (!isCSV(file)) {
                    return;
                }

                /**
                * 自旋锁 等待当前文件读取完毕
                */
                let spinLockForWaitfileReaded = new SpinLock();
                spinLockForWaitfileReaded.release();
                spinLockForWaitfileReaded.acquire();

                const filePath = path.join(csvPath.fsPath, file);
                const fileReadStream = fs.createReadStream(filePath);
                let i = 0;//行号


                csv.parseStream(fileReadStream, { headers: true })
                    .on(
                        'data', (row) => {
                            if (!row.hasOwnProperty('uid')) {
                                vscode.window.showErrorMessage('提供的CSV文件格式错误，缺少uid字段,文件路径为:' + filePath);
                                return;
                            }
                            let uid:number = row['uid'];
                            this.uidToFolder[uid] = csvPath.fsPath;
                            i++;
                        }
                    )
                    .on('end', () => {
                        /**
                        * 读完了就释放自旋锁
                        */
                        spinLockForWaitfileReaded.release();
                    })
                    .on('error', (error) => {
                        /**
                         * 出错就释放自旋锁 以免阻塞
                         */
                        spinLockForWaitfileReaded.release();
                        console.error('CSV解析错误', error.message);
                        console.error('CSV解析出错的行行号:' + (i - 1) + "");
                        let message = 'CSV解析错误:' + filePath + '\n' + '出错的CSV行，其行号为:' + i;
                        vscode.window.showErrorMessage(message);
                    });
                /**
                * 等待当前文件读取完毕
                */
                await spinLockForWaitfileReaded.acquire();
            });
            
        }
    }

    /**
     * 分配一个在CSV表格和Y3项目中都不冲突的物编数据UID
     */
    private async allocateNewUIDofEditorTableItemToCSV(): Promise<number>{
        if (!env.editorTableUri) {
            vscode.window.showInformationMessage("未初始化Y3项目");
            return 0;
        }
        await this.refreshUIDtoFolder();
        let uid = allocateNewUIDofEditorTableItem(env.editorTableUri);
        while (uid in this.uidToFolder) {
            uid = allocateNewUIDofEditorTableItem(env.editorTableUri);
        }
        return Promise.resolve(uid);
    }

}
