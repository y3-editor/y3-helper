// 有用的工具函数集合

import * as vscode from 'vscode';
import * as fs from 'fs';
import { resolveTxt } from 'dns';

/**
 * 判断一个路径是否为指向一个json文件
 * @param path 
 * @returns 
 */
export function isJson(path:string):boolean {
    return path.toLowerCase().endsWith(".json");
}

/**
 * 判断一个uri是否为指向一个CSV文件
 * @param path 
 * @returns 
 */
export function isCSV(path: string): boolean {
    return path.toLowerCase().endsWith(".csv");
}
/**
 * 检查路径是否有效
 * @param path 路径
 * @returns true or false
 */
export function isPathValid(path: string): boolean {
    try {
        fs.accessSync(path, fs.constants.F_OK);
        return true;
    } catch (error) {
        return false;
    }
}
/**
 * 检查文件是否存在
 * @param uri 
 * @returns true or false
 */
export function isFileValid(uri: vscode.Uri | undefined): boolean {
    // 检查是否为 undefined 或 null
    if (!uri) {
        return false;
    }
    return isPathValid(uri.fsPath);
}
/**
 * 检查文件是否在此文件夹中
 * @param directory 文件夹路径
 * @param fileFullName 文件名全称
 * @returns true：在文件夹中 false：不在文件夹中
 */
export function isInDirectory(directory: string, fileFullName: string): boolean {
    const filePath = `${directory}/${fileFullName}`;

    try {
        if (fs.existsSync(filePath)) {
            // 检查文件名是否匹配（包括扩展名）
            return fileFullName === fs.readdirSync(directory).find(file => file === fileFullName);
        }
        return false;
    } catch (error) {
        return false;
    }
}

/** 
 * 检查目录下是否存在特定文件
*/
export async function checkIfFileExists(directoryPath: vscode.Uri, fileName: string): Promise<boolean> {
    try {
        const targetUri = vscode.Uri.joinPath(directoryPath, fileName);
        const stat = await vscode.workspace.fs.stat(targetUri);
        return stat.type === vscode.FileType.File;
    } catch (error) {
        return false;
    }
}

/**
 * 解析该字符串是否完全符合ASCII编码
 * @param str 
 * @returns true or false
 */
function isASCII(str: string): boolean {
    return /^[\x00-\x7F]*$/.test(str);
}
/**
 * 将字符串转化为Unicode编码,但对ASCII编码的字符不做处理，如"你好，世界！hello_world!"转化为 "\u4f60\u597d\u002c\u4e16\u754c\u0021hello_world!"
 * @param str 
 * @returns str
 */
export function toUnicodeIgnoreASCII(str: string): string {
    let result = "";
    for (let i = 0; i < str.length; i++) {
        
        if (!isASCII(str[i])) {
            result += "\\u" + str.charCodeAt(i).toString(16).padStart(4, '0');
        }
        else {
            result += str[i];
        }
    }
    return result;
}


/**
 * 去除字符串中的空格和回车
 * @param input 输入字符串
 * @returns 
 */
export function removeSpacesAndNewlines(input: string): string {
    return input.replace(/\s/g, "");
}

/**
 * 询问用户得到用户指定的目标文件夹
 * @returns vscode.Uri | undefined
 */
export async function askUserTargetDirectory(): Promise < vscode.Uri | undefined > {

    // 询问用户得到目标文件夹
    while(true) {
        let selectedFiles = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            openLabel: '选择文件夹'
        });
        let selectedExe = selectedFiles?.[0];
        if (!selectedExe) {
            return undefined;
        }
        if (isPathValid(selectedExe.fsPath)) {
            return selectedExe;
        }
    }
}

/**
 * 根据uri获取指向的文件名
 * @param uri 
 * @returns 
 */
export function getFileNameByVscodeUri(uri: vscode.Uri) :string{
    let fsPath = uri.fsPath;
    let fsPathSplitArray = (fsPath.split('\\'));
    return fsPathSplitArray[fsPathSplitArray.length - 1];
}

/**
 * 获取字符串的编码
 * @param s 
 * @returns 
 */
export function toCode(s: string):number[]{
    let res: number[] = [];
    for (let i = 0; i < s.length; i++){
        res.push(s.charCodeAt(i));
    }
    return res;
}


/**
 * 对字符串进行哈希，用以分配字符串在zhlanguage.json中的key
 * @param s 
 * @param seed 
 * @returns 
 */
export function hash(s:string,seed:number=0x0): number{
    
    let key = toCode(s);

    function fmix(h: number):number {
        h ^= h >> 16;
        h = (h * 0x85ebca6b) & 0xFFFFFFFF;
        h ^= h >> 13;
        h = (h * 0xc2b2ae35) & 0xFFFFFFFF;
        h ^= h >> 16;
        return h;
    }

    let length = key.length;
    let nblocks = Math.floor(length / 4);

    let h1 = seed;

    let c1 = 0xcc9e2d51;
    let c2 = 0x1b873593;

	// body
    for (let blockStart: number = 0; blockStart < nblocks * 4;blockStart+=4 ){
        let k1: number = key[blockStart + 3] << 24 | key[blockStart + 2] << 16 | key[blockStart + 1] << 8 | key[blockStart + 0];

        k1 = (c1 * k1) & 0xFFFFFFFF;
        k1 = (k1 << 15 | k1 >> 17) & 0xFFFFFFFF;
        k1 = (c2 * k1) & 0xFFFFFFFF;

        h1 ^= k1;
        h1 = (h1 << 13 | h1 >> 19) & 0xFFFFFFFF;
        h1 = (h1 * 5 + 0xe6546b64) & 0xFFFFFFFF;
    }
		
    // tail
    let tailIndex: number = nblocks * 4;
    let k1: number = 0;
    let tailSize: number = length & 3;

    if (tailSize >= 3) {
        k1 ^= key[tailIndex + 2] << 16;
    }
    if (tailSize >= 2) {
        k1 ^= key[tailIndex + 1] << 8;
    }
    if (tailSize >= 1) {
        k1 ^= key[tailIndex + 0];
    }

    if (tailSize > 0) {
        k1 = (k1 * c1) & 0xFFFFFFFF;
        k1 = (k1 << 15 | k1 >> 17) & 0xFFFFFFFF;  // inlined ROTL32
        k1 = (k1 * c2) & 0xFFFFFFFF;
        h1 ^= k1;
    }

    // finalization
    let unsignedVal:number = fmix(h1 ^ length);
    if ((unsignedVal & 0x80000000) === 0) {
        return unsignedVal;
    }
    else {
        return -((unsignedVal ^ 0xFFFFFFFF) + 1);
    }
}

/**
 * 生成[min,max]区间内的随机数(左右闭区间)
 * @param min 
 * @param max 
 * @returns 
 */
export function randomInt(min: number, max: number):number{
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


/**
 * 将vscode.Uri 转化为file:// 开头的uri字符串 以便TypeScript的import语法运行时导入一个js文件 
 * @param uri 
 * @returns 转换后的结果
 */
export function toFilePath(uri: vscode.Uri):string {
    return "file://" + uri.fsPath.replace(/\\/g, "/");
}

/**
 * 将一个对象的字段依据分隔符嵌套构造
 * 如{"aaa.bbb":1} separator=='.' 转化为{"aaa":{"bbb":1}} 
 * @param object 
 * @param separator 
 * @returns 
 */
export function toNestedObject(object: any, separator: string): any {
    if (!object) {
        return;
    }
    let res: any = {};
    for (let key in object) {
        let keyArr: string[] = key.split(separator);
        
        let p = res;
        for (let i = 0; i < keyArr.length - 1; i++) {
            if (!(keyArr[i] in p)) {
                p[keyArr[i]] = {};
            }
            p = p[keyArr[i]];
        }
        p[keyArr[keyArr.length - 1]] = object[key];
    }
    return res;
}

/**
 * 递归合并两个对象
 * extra中有base中没有的字段会被添加
 * base中有extra没有的字段会被保留 
 * base中有extra中也有的字段会被extra覆盖
 * @param base 
 * @param extra 
 * @returns 
 */
export function mergeObject(base: any, extra: any): any {
    let res: any = base;
    if (!extra) {
        return res;
    }
    for (let key in extra) {
        if ((key in res) === false) {
            if(Array.isArray(extra[key])){
                res[key] = [];
            }else if(extra[key] instanceof Object){
                res[key] = {};
            }
        }
        if (extra[key] instanceof Object) {
            res[key] = mergeObject(res[key], extra[key]);
        }
        else {
            res[key] = extra[key];
        }
    }
    return res;
}

/**
 * 尝试保存Json并返回是否能保存成功
 * @param jsonData 
 * @param jsonFilePath 
 * @returns 
 */
export function tryWriteJson(jsonData: any, jsonFilePath: string): boolean {
    try {
        // 将更新后的数据写回文件
        fs.writeFileSync(jsonFilePath, toUnicodeIgnoreASCII(JSON.stringify(jsonData, null, 4)), 'utf8');
    }
    catch (err) {
        vscode.window.showErrorMessage('保存Json文件时出错 Error writing file:');
        console.error('保存Json文件时出错', err);
        return false;
    }
    return true;
}

/**
 * 尝试读取Json，如果读取失败则返回null
 * @param jsonFilePath 
 * @returns 
 */
export function tryReadJson(jsonFilePath: string): { [key: string]: any } | null {
    if (jsonFilePath === '') {
        return null;
    }
    let jsonData: { [key: string]: any } = {};
    // 尝试解析JSON数据
    try {
        let jsonFileStr = fs.readFileSync(jsonFilePath, 'utf8');
        jsonData = JSON.parse(jsonFileStr);
        return jsonData;
    }
    catch (error) {
        vscode.window.showErrorMessage("Json解析出错，路径" + jsonFilePath +"错误为：" + error);
        return null;
    }
}