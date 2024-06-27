import * as fs from 'fs-extra';
import * as vscode from 'vscode';
import * as path from 'path';

import { chineseTypeNameToEnglishTypeName, csvTypeToPath, englishPathToChinese } from '../../constants';
import { tableExpoter } from './tableExpoter';
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

export class excelExporter extends tableExpoter{
    private static _instance: excelExporter;
    private excelPath: vscode.Uri;
    private rulePath: vscode.Uri;
    private editorTablePath: vscode.Uri;
    private importRules: any;
    private editorTableDatas: {[key: string] : editorTableDir};

    constructor(excelUri: vscode.Uri, ruleUri: vscode.Uri, destinationUri: vscode.Uri){
        super();
        this.excelPath = excelUri;
        this.rulePath = ruleUri;
        this.editorTablePath = destinationUri;
        this.importRules = [];
        this.editorTableDatas = {};
    }

    public static getInstance(){
        if(!excelExporter._instance){
            if (!env.excelUri || !env.editorTableUri || !env.ruleUri) {
                vscode.window.showErrorMessage("未找到excel表格的位置,请检查是否初始化Y3开发环境");
                return null;
            }
            excelExporter._instance = new excelExporter(env.excelUri, env.ruleUri, env.editorTableUri);
        }
        return excelExporter._instance;
    }

    public async excelExport(){
        await this.getEditorTableData();
        await this.loadImportRules();
        await this.convertByRules();
    }

    public async getEditorTableData() {
        let editorTablePath = env.editorTablePath;
        const files = await fs.promises.readdir(editorTablePath);
        for (const file of files) {
          const filePath = path.join(editorTablePath, file);
          let editorTableType: string = file;
          if (editorTableType in englishPathToChinese) {
            editorTableType = englishPathToChinese[editorTableType];
            const jsFileList = await fs.promises.readdir(filePath);// 此目录下的编文件js文件目录
            this.editorTableDatas[editorTableType] = new editorTableDir(jsFileList, filePath);
          }
          else {
            continue;
          }
        }
    }

    private async convertByRules(){
        // 处理 Excel 文件
        try {
            let importRules: any[] = this.importRules;
            for(let rule of importRules){
                if(!rule || !rule.excelRelativePath || !rule.editorTableType){
                    throw new Error("rule定义出错");
                }
                let excelPath = vscode.Uri.joinPath(this.excelPath, rule.excelRelativePath);
                let editorTableType = chineseTypeNameToEnglishTypeName[rule.editorTableType];
                let targetPath: vscode.Uri = vscode.Uri.joinPath(this.editorTablePath, csvTypeToPath[editorTableType]);
                let converter = new excel2Json(rule, excelPath, targetPath);
                await converter.convert();//TODO: 把excel数据通过converter转换为目标数据
            }
            return true;
        }
        catch (error){
            vscode.window.showErrorMessage("处理导入规则importRule出错，错误类型为：" + error);
            return false;
        }
      }

    private async loadImportRules(){
        this.importRules = [];
        // 读取目录中的所有.mjs文件
        const files = fs.readdirSync(this.rulePath.fsPath).filter(file => file.endsWith('.js') || file.endsWith('.mjs'));
        for (const file of files) {
            let src = vscode.Uri.joinPath(this.rulePath, file);
            try {
                delete require.cache[src.fsPath];
                let ImportRulesModule = require(src.fsPath);
                for(let ruleName in ImportRulesModule){
                    if(ImportRulesModule[ruleName] instanceof ImportRule){
                        this.importRules.push(ImportRulesModule[ruleName]);
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
