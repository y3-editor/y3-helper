/**
 * 从CSV表格中导入物编数据
 */

import * as vscode from 'vscode';
import csvParser  from 'csv-parser';
import * as fs from 'fs';

import { Env } from "../env";
import { isInDirectory, isFileValid, isPathValid, removeSpacesAndNewlines, toUnicodeIgnoreASCII, getFileNameByVscodeUri, hash } from '../utility';
import { csvTypeToPath } from "../constants";
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { log } from 'console';

export class CSVimporter
{
    private readonly csvTypeToPath: Readonly<{ [key: string]: string }>;
    private env: Env;
    public constructor(env: Env) {
        this.env = env;
        this.csvTypeToPath = csvTypeToPath;
    }

    // 默认情况下的文件夹名与其存放的物编数据类型的对应关系
    private readonly defaultFolderNameToTableType: { [key: string]: string } = {
        "单位": "unit",
        "装饰物": "decoration",
        "物品": "item",
        "技能":"ability",
        "魔法效果": "modifier",
        "投射物": "projectile",
        "科技": "technology",
        "可破坏物": "destructible",
        "声音":"sound"
    };
    

    /**
     * 从插件配置中指定的文件夹 导入对应类型的物编数据CSV文件
     * @returns true or false 成功或失败
     */
    public async importCSVFromOrderFolder():Promise<boolean> {
        if (!this.env.scriptUri) {
            vscode.window.showErrorMessage("scriptUri不存在，请检查项目是否初始化");
            return false;
        }
        for (const key in this.env.tableTypeToCSVfolderPath) {
            let csvRelativeFolderPath = this.env.tableTypeToCSVfolderPath[key];
            let csvFolderUri: vscode.Uri = vscode.Uri.joinPath(this.env.scriptUri, csvRelativeFolderPath);
            if (!isPathValid(csvFolderUri.fsPath)) {
                vscode.window.showErrorMessage("未找到CSV表格的路径，请从模板中生成");
                return false;
            }
            if (!await this.importAllCSVinFolder(csvFolderUri, key)) {
                return false;
            }
        }
        return true;
    }


    /**
     * 从文件夹导入其中的所有CSV文件
     * @param folder 
     * @param tableType 
     * @returns 
     */
    private async importAllCSVinFolder(folder: vscode.Uri, tableType:string): Promise<boolean> {
        if (!this.env.editorTableUri) {
            vscode.window.showErrorMessage("物编数据表路径为空");
            return false;
        }
        let targetTableFolder = this.csvTypeToPath[tableType];
        let targetEditorTablePath: vscode.Uri = vscode.Uri.joinPath(this.env.editorTableUri, targetTableFolder);
        let files = await vscode.workspace.fs.readDirectory(folder);
        for (const file of files) {
            console.log(file);
            if (file[0].endsWith(".csv")) {
                if (!this.importCSVtoTargetJson(vscode.Uri.joinPath(folder, file[0]), targetEditorTablePath, tableType)) {
                    return false;
                }
            }

        };

        return true;
    }

    
    
    private async saveRowToTargetPath(row:any,target_path:vscode.Uri,tableType:string):Promise<boolean>{
        if(!isPathValid(target_path.fsPath)){
            vscode.window.showErrorMessage('保存Json的路径非有效路径');
            return false;
        }

        if(!row.hasOwnProperty('uid')) {
            vscode.window.showErrorMessage('提供的CSV文件格式错误，缺少uid字段,出错的表类型为:'+tableType);
            return false;
        }

        let uid = String(row['uid']);
        if (uid[0] === '\'') {
            uid = uid.substring(1);
        }

        let jsonFilePath=target_path.fsPath+'\\'+uid+'.json';
        if(!isInDirectory(target_path.fsPath,uid+'.json')){
            console.log("没有检测到对应物品的Json，从模板新建了Json文件存储物编数据:" + jsonFilePath);
            let templateJson = await fs.readFileSync(path.dirname(__dirname) + "\\template\\json_template\\" + tableType + ".json");
            await fs.writeFileSync(jsonFilePath,templateJson);
        }
      
        let jsonFileStr=await fs.readFileSync(jsonFilePath, 'utf8');
        let jsonData: { [key: string]: any };
        if (jsonFileStr === '') {
            jsonData = {};
        }
        else {
            // 解析JSON数据
            try {
                jsonData = JSON.parse(jsonFileStr);
            }
            catch (error)
            {
                vscode.window.showErrorMessage("Json解析出错，请检查是否符合Json语法，出错的值为：" + jsonFileStr);
                return false;
            }
        }
       
        console.log("read_json：" + jsonFilePath);
        // 打印此行数据
        for (const key in row) {
            if (row.hasOwnProperty(key)) {
                let value = row[key];
                // 添加或更新键值对
                
                
                if (value && value !== undefined) {
                    
                    let valueNumber = parseFloat(value);

                    // 自定义属性要特殊处理
                    if (key === 'ky') {
                        let jsonObject: any;
                        try {
                            jsonObject = JSON.parse(value);

                        }
                        catch (error) {
                            vscode.window.showErrorMessage("对自定义属性ky的Json解析出错，请检查是否符合json语法，出错的值为：" + `${key}: ${value}`);
                            return false;
                        }
                        
                        let attrJson: any;
                        // 自定义属性的描述要加到工程文件的attr.json中
                        try {
                            if (this.env.mapUri) {
                                attrJson = await fs.readFileSync(vscode.Uri.joinPath(this.env.mapUri, "attr.json").fsPath);
                                attrJson = JSON.parse(attrJson);
                            }
                            else {
                                vscode.window.showErrorMessage("mapUri未定义");
                                return false;
                            }
                        }
                        catch (error) {
                            vscode.window.showErrorMessage("打开attr.json失败");
                            return false;
                        }

                        for (let customChineseKey in value) {
                            //customChineseKey = toUnicodeIgnoreASCII(customChineseKey);
                            const uuidKey = uuidv4();
                            let customAttrData: any;
                            customAttrData.__tuple__ = true;
                            customAttrData.items = [];
                            let customAttrDataItem = JSON.parse("\{\"default\": 0.0,\"desc\": \"\",\"desc_bit\": 1,\"key\": \"CUSTEM_KEY\",\"maximun\": 10000000.0,\"minimun\": -10000000.0,\"type\": \"Fixed\"\} ");
                            customAttrDataItem.key = uuidKey;
                            customAttrDataItem.desc = customChineseKey;

                            customAttrData.items = [uuidKey,customAttrDataItem];
                            attrJson['c'].push(customAttrData);
                        }
                        try {
                            await fs.writeFileSync(vscode.Uri.joinPath(this.env.mapUri, "attr.json").fsPath, toUnicodeIgnoreASCII(JSON.stringify(attrJson, null, 2)), 'utf8');
                        }
                        catch (error)
                        {
                            vscode.window.showErrorMessage("保存attr.json失败");
                            return false;
                        }
                        console.log(`${key}: ${jsonObject}`);
                    }
                    else if (key === 'name') {
                        let zhlanguageJson: any;
                        try {
                            if (this.env.mapUri) {
                                zhlanguageJson = await fs.readFileSync(vscode.Uri.joinPath(this.env.mapUri, "zhlanguage.json").fsPath, 'utf8');
                                zhlanguageJson = JSON.parse(zhlanguageJson);
                            }
                            else {
                                vscode.window.showErrorMessage("mapUri未定义");
                                return false;
                            }
                        }
                        catch (error) {
                            vscode.window.showErrorMessage("打开zhlanguage.json失败");
                            return false;
                        }
                        //value = toUnicodeIgnoreASCII(value);
                        let hashOfName:number = hash(value);
                        zhlanguageJson[hashOfName] = value;
                        jsonData[key] = hashOfName;
                        try {
                            await fs.writeFileSync(vscode.Uri.joinPath(this.env.mapUri, "zhlanguage.json").fsPath, JSON.stringify(zhlanguageJson, null, 2), 'utf8');
                        }
                        catch (error) {
                            vscode.window.showErrorMessage("保存zhlanguage.json失败");
                            return false;
                        }
                    }
                    else if (value in ["True","true","TRUE"]) {
                        value = true;

                        console.log(`${key}: ${value}`);
                        jsonData[key] = value;
                    }
                    else if (value in ["False", "false", "FALSE"]) {
                        value = false;

                        console.log(`${key}: ${value}`);
                        jsonData[key] = value;
                    }
                    else if (!isNaN(valueNumber) && key !== 'uid') {
                        value = valueNumber;

                        console.log(`${key}: ${value}`);
                        jsonData[key] = value;
                    }
                        
                    // 有左右圆括号的是元组
                    else if (value.length >= 2 && value[0] === '(' && value[value.length - 1] === ')') {

                        // 解析元组
                        let newValue = value.split("");
                        newValue[0] = '[';
                        newValue[newValue.length - 1] = ']';
                        newValue = newValue.join("");
                        let jsonArray: any;
                        try {
                            jsonArray = JSON.parse(newValue);
                        }
                        catch(error) {
                            vscode.window.showErrorMessage("对于元组的Json解析出错，请检查是否符合json语法，出错的值为：" + newValue+"\n"+error+"出错的表类型为:"+tableType);
                            return false;
                        }
                        
                        let jsonObject: any=new Object;
                        jsonObject.__tuple__ = true;
                        jsonObject.items = jsonArray;

                        console.log(`${key}: ${jsonObject}`);
                        jsonData[key] = jsonObject;
                    }
                    else if ((value.length >= 2 && value[0] === '{' && value[value.length - 1] === '}') || (value.length >= 2 && value[0] === '[' && value[value.length - 1] === ']')) { 

                        // 把value中的'转化为"以解析，之所以填CSV表的时候不用Json语法规定的"是因为这会导致CSV表格识别为此格内的字符串填写结束
                        value= value.replace(/'/g, '"');
                        let jsonObject: any;
                        try {
                            jsonObject = JSON.parse(value);
                        }
                        catch (error) {
                            vscode.window.showErrorMessage("Json解析出错，其检查是否符合json语法，出错的值为：" + value + "\n" + error + "出错的表类型为:" + tableType);
                            return false;
                        }
                        console.log(`${key}: ${jsonObject}`);
                        jsonData[key] = jsonObject;
                    }
                    else {
                        console.log(`${key}: ${value}`);
                        jsonData[key] = value;
                    }
                }
                

            }
        }
        console.log("-----------------------");
        
        try {
            // 将更新后的数据写回文件
            await fs.writeFileSync(jsonFilePath, toUnicodeIgnoreASCII(JSON.stringify(jsonData, null, 2)), 'utf8');
        }
        catch (err)
        {
            vscode.window.showErrorMessage('保存Json文件时出错 Error writing file:');
            console.error('保存Json文件时出错', err);
            return false;
        }
        //console.log('此行保存成功');
        return true;
    }

    

    /**
     * 导入该CSV文件的数据到目标json文件中
     * @param csv_uri 
     * @param target_json 
     */
    private async importCSVtoTargetJson(csv_uri:vscode.Uri,target_json:vscode.Uri,tableType:string):Promise<Boolean>
    {
        const csvFilePath = csv_uri.fsPath;
        console.log("开始读取csv文件:" + csvFilePath);
        
        let i=0;// 当前读取行号
        await fs.createReadStream(csvFilePath)
        .pipe(csvParser())
            .on('data', async (row) => {
            
                console.log("第"+i+"行如下：");
                console.log(row);
                // 从英文字段名往下数第一行是中文字段名，再下一行才是正文
                if(i>=1)
                {
                    

                    // 如果此行保存失败就停止
                    if (!(await this.saveRowToTargetPath(row, target_json, tableType))) {
                        console.log("保存失败的行：" + i + "路径：" + csv_uri.path);
                        return false;
                    }
                    
                }
                
                i++;
        })
        .on('end', () => {
            vscode.window.showInformationMessage("全部导入成功");
;           console.log('Parsed CSV data Length:', i);
        })
        .on('error', (error) => {
            console.error('CSV解析错误 Error parsing CSV', error.message);
            console.error('Error parsing CSV row number:' + (i-1) + "");
            let message = 'CSV解析错误 Error parsing CSV:' + csvFilePath + '\n' + '出错的CSV行，其行号为:' + i;
        });
        return true;
    }
} 


