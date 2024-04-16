import * as vscode from 'vscode';
import * as fs from 'fs';

import { env } from "../env";
import { isInDirectory, isPathValid, toUnicodeIgnoreASCII, hash, mergeObject } from '../utility';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * 从模板中新建物编项目数据Json
 * @param tableType 
 * @param jsonFilePath 
 */
function writeJsonTemplate(tableType: string, jsonFilePath: string) {
    let templateJson = fs.readFileSync(path.join(__dirname, "../../template/json_template/" + tableType + ".json"));
    fs.writeFileSync(jsonFilePath, templateJson);
}

/**
 * 保存物编项目Json数据
 * @param data 
 * @param targetPath 
 * @param tableType 
 * @returns true or false 成功或失败
 */
export async function saveEditorTableItemJson(data: any, targetPath: vscode.Uri, tableType: string): Promise<boolean> {

    if (!data.hasOwnProperty('uid')) {
        vscode.window.showErrorMessage('提供的CSV文件格式错误，缺少uid字段,出错的表类型为:' + tableType);
        return false;
    }

    let uid = data['uid'];

    if ('name' in data) {
        let k = env.writeDataInLanguageJson(String(data['name']));
        data['name'] = k;
    }

    let jsonFilePath = targetPath.fsPath + '\\' + uid + '.json';
    if (!isInDirectory(targetPath.fsPath, uid + '.json')) {
        console.log("没有检测到对应物品的Json，从模板新建了Json文件存储物编数据:" + jsonFilePath);
        writeJsonTemplate(tableType, jsonFilePath);
    }

    let jsonFileStr = fs.readFileSync(jsonFilePath, 'utf8');
    let jsonData: { [key: string]: any };
    if (jsonFileStr === '') {
        jsonData = {};
    }
    else {
        // 解析JSON数据
        try {
            jsonData = JSON.parse(jsonFileStr);
        }
        catch (error) {
            vscode.window.showErrorMessage("Json解析出错，请检查是否符合Json语法，出错的值为：" + jsonFileStr);
            return false;
        }
    }

    jsonData = mergeObject(jsonData, data);
    console.log(jsonData);
    try {
        // 将更新后的数据写回文件
        fs.writeFileSync(jsonFilePath, toUnicodeIgnoreASCII(JSON.stringify(jsonData, null, 2)), 'utf8');
    }
    catch (err) {
        vscode.window.showErrorMessage('保存Json文件时出错 Error writing file:');
        console.error('保存Json文件时出错', err);
        return false;
    }
    return true;
}


/**
 * 检查参数是否有效
 * @param data 
 * @param targetPath 
 * @param tableType 
 * @returns 
 */
function checkParameter(data: any, targetPath: vscode.Uri, tableType: string):boolean {
    if (!isPathValid(targetPath.fsPath)) {
        vscode.window.showErrorMessage('保存Json的路径非有效路径');
        return false;
    }

    if (!data.hasOwnProperty('uid')) {
        vscode.window.showErrorMessage('提供的CSV文件格式错误，缺少uid字段,出错的表类型为:' + tableType);
        return false;
    }
    return true;
}


/**
* 保存CSV表格中的一行数据  到物编
* 导入一个物编项目的属性，原来的json文件中没有的字段会被添加，已有的字段如果data里面有那么会覆盖，data里面没有的字段保持原状
* 
* todo:
* 由于开发时才发现物编数据格式要求复杂 要处理的特殊case实在是太多 不得不增加大量if else 后续此函数需要拆解重构
* @param data 行号
* @param targetPath 目标路径
* @param tableType 物编表类型
* @returns 
*/
export async function saveRowOfCSV(data: any, targetPath: vscode.Uri, tableType: string): Promise<boolean> {
    if (checkParameter(data, targetPath, tableType) === false) {
        return false;
    }

    //获取uid
    let uid = String(data['uid']);
    if (uid[0] === '\'') {
        uid = uid.substring(1);
    }
    let jsonFilePath = targetPath.fsPath + '\\' + uid + '.json';
    if (!isInDirectory(targetPath.fsPath, uid + '.json')) {
        console.log("没有检测到对应物品的Json，从模板新建了Json文件存储物编数据:" + jsonFilePath);
        let templateJson = fs.readFileSync(path.join(__dirname, "../../template/json_template/" + tableType + ".json"));
        fs.writeFileSync(jsonFilePath, templateJson);
    }

    let jsonFileStr = fs.readFileSync(jsonFilePath, 'utf8');
    let jsonData: { [key: string]: any };
    if (jsonFileStr === '') {
        jsonData = {};
    }
    else {
        // 解析JSON数据
        try {
            jsonData = JSON.parse(jsonFileStr);
            return true;
        }
        catch (error) {
            vscode.window.showErrorMessage("Json解析出错，请检查是否符合Json语法，出错的值为：" + jsonFileStr);
            return false;
        }
    }

    console.log("read_json：" + jsonFilePath);
    
    // 遍历所有属性
    for (const key in data) {
        if (data.hasOwnProperty(key)) {
            let value = data[key];
            
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
                        if (env.mapUri) {
                            attrJson = await fs.readFileSync(vscode.Uri.joinPath(env.mapUri, "attr.json").fsPath);
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

                        customAttrData.items = [uuidKey, customAttrDataItem];
                        attrJson['c'].push(customAttrData);
                    }
                    try {
                        await fs.writeFileSync(vscode.Uri.joinPath(env.mapUri, "attr.json").fsPath, toUnicodeIgnoreASCII(JSON.stringify(attrJson, null, 2)), 'utf8');
                    }
                    catch (error) {
                        vscode.window.showErrorMessage("保存attr.json失败");
                        return false;
                    }
                    console.log(`${key}: ${jsonObject}`);
                }
                else if (key === 'name') {
                    let zhlanguageJson: any;
                    try {
                        if (env.mapUri) {
                            zhlanguageJson = await fs.readFileSync(vscode.Uri.joinPath(env.mapUri, "zhlanguage.json").fsPath, 'utf8');
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
                    let hashOfName: number = hash(value);
                    zhlanguageJson[hashOfName] = value;
                    jsonData[key] = hashOfName;
                    try {
                        fs.writeFileSync(vscode.Uri.joinPath(env.mapUri, "zhlanguage.json").fsPath, JSON.stringify(zhlanguageJson, null, 2), 'utf8');
                    }
                    catch (error) {
                        vscode.window.showErrorMessage("保存zhlanguage.json失败");
                        return false;
                    }
                }
                else if (value in ["True", "true", "TRUE"]) {
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
                    catch (error) {
                        vscode.window.showErrorMessage("对于元组的Json解析出错，请检查是否符合json语法，出错的值为：" + newValue + "\n" + error + "出错的表类型为:" + tableType);
                        return false;
                    }

                    let jsonObject: any = new Object;
                    jsonObject.__tuple__ = true;
                    jsonObject.items = jsonArray;

                    console.log(`${key}: ${jsonObject}`);
                    jsonData[key] = jsonObject;
                }
                else if ((value.length >= 2 && value[0] === '{' && value[value.length - 1] === '}') || (value.length >= 2 && value[0] === '[' && value[value.length - 1] === ']')) {

                    // 把value中的'转化为"以解析，之所以填CSV表的时候不用Json语法规定的"是因为这会导致CSV表格识别为此格内的字符串填写结束
                    value = value.replace(/'/g, '"');
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

    return tryWriteJson(jsonData, jsonFilePath);
}

function tryWriteJson(jsonData: any, jsonFilePath:string):boolean {
    try {
        // 将更新后的数据写回文件
        fs.writeFileSync(jsonFilePath, toUnicodeIgnoreASCII(JSON.stringify(jsonData, null, 2)), 'utf8');
    }
    catch (err) {
        vscode.window.showErrorMessage('保存Json文件时出错 Error writing file:');
        console.error('保存Json文件时出错', err);
        return false;
    }
    return true;
}