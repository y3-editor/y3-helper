import * as fs from 'fs-extra';
import * as vscode from 'vscode';
import * as path from 'path';

import { EditorTableName, ObjectTypeNameCN, ObjectTypeNameEN, chineseTypeNameToEnglishTypeName, csvTypeToPath, englishPathToChinese } from '../../constants';
import { excel2Json } from './excel2Json';
import { ImportRule } from './importRule';
import { env } from '../../env';

class editorTableDir{
    public fileNameList: string[];
    public filePath: string;
    constructor(fileNameList: string[], filePath: string){
        this.fileNameList = fileNameList;
        this.filePath = filePath;
    }
}

export class excelExporter {
    private excelPath: vscode.Uri;
    private rulePath: vscode.Uri;
    private editorTablePath: vscode.Uri;
    private editorTableDatas: {[key: string] : editorTableDir} = {};

    constructor() {
        if (!env.excelUri || !env.ruleUri || !env.editorTableUri) {
            throw new Error('未找到地图目录');
        }
        this.excelPath = env.excelUri;
        this.rulePath = env.ruleUri;
        this.editorTablePath = env.editorTableUri;
    }

    public async excelExport(){
        await this.getEditorTableData();
        await this.loadImportRules();
    }

    public async getEditorTableData() {
        let editorTablePath = env.editorTablePath;
        const files = await fs.promises.readdir(editorTablePath);
        for (const file of files) {
            const filePath = path.join(editorTablePath, file);
            let editorTableType: string = file;
            if (editorTableType in englishPathToChinese) {
                editorTableType = englishPathToChinese[editorTableType as EditorTableName];
                const jsFileList = await fs.promises.readdir(filePath);// 此目录下的编文件js文件目录
                this.editorTableDatas[editorTableType] = new editorTableDir(jsFileList, filePath);
            }
            else {
                continue;
            }
        }
    }

    async runRule(rule: ImportRule) {
        let excelPath = rule.excelRelativePath ? vscode.Uri.joinPath(this.excelPath, rule.excelRelativePath) : undefined;
        let editorTableType = chineseTypeNameToEnglishTypeName[rule.editorTableType];
        let targetPath: vscode.Uri = vscode.Uri.joinPath(this.editorTablePath, csvTypeToPath[editorTableType]);
        //let converter = new excel2Json(rule, excelPath, targetPath);
        //await converter.convert();//TODO: 把excel数据通过converter转换为目标数据
    }

    private async loadImportRules(){
        // 读取目录中的所有.mjs文件
        const files = fs.readdirSync(this.rulePath.fsPath).filter(file => file.endsWith('.js') || file.endsWith('.mjs'));
        for (const file of files) {
            let src = vscode.Uri.joinPath(this.rulePath, file);
            try {
                delete require.cache[src.fsPath];
                let ImportRulesModule = require(src.fsPath);
                for(let ruleName in ImportRulesModule){
                    if(ImportRulesModule[ruleName] instanceof ImportRule){
                        await this.runRule(ImportRulesModule[ruleName]);
                    }
                }
            } catch (error) {
                vscode.window.showErrorMessage(`加载导入规则"${file}"出错：${error}`);
            }
        }
    }

    public async getTmpJsDict(editorTableType: string, tmpID: string){
        let data = this.editorTableDatas[editorTableType];
        if(data.fileNameList.includes(tmpID + '.json')){
            const jsData = await fs.readFile(data.filePath + '//' + tmpID + '.json', 'utf8');
            return JSON.parse(jsData);
        }
        return {};
    }
}
