// 有用的工具函数集合

import * as vscode from 'vscode';
import * as fs from 'fs';

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

    // 检查是否为 file 类型的 Uri，并且其 fsPath 属性不为空
    if (uri.scheme === 'file' && uri.fsPath) {
        return true;
    }

    return false;
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
            result += "\\u" + str.charCodeAt(i).toString(16);
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
        if (await isPathValid(selectedExe.fsPath)) {
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
    for (let block_start: number = 0; block_start < nblocks * 4;block_start+=4 ){
        let k1: number = key[block_start + 3] << 24 | key[block_start + 2] << 16 | key[block_start + 1] << 8 | key[block_start + 0];

        k1 = (c1 * k1) & 0xFFFFFFFF;
        k1 = (k1 << 15 | k1 >> 17) & 0xFFFFFFFF;
        k1 = (c2 * k1) & 0xFFFFFFFF;

        h1 ^= k1;
        h1 = (h1 << 13 | h1 >> 19) & 0xFFFFFFFF;
        h1 = (h1 * 5 + 0xe6546b64) & 0xFFFFFFFF;
    }
		
    // tail
    let tail_index: number = nblocks * 4;
    let k1: number = 0;
    let tail_size: number = length & 3;

    if (tail_size >= 3) {
        k1 ^= key[tail_index + 2] << 16;
    }
    if (tail_size >= 2) {
        k1 ^= key[tail_index + 1] << 8;
    }
    if (tail_size >= 1) {
        k1 ^= key[tail_index + 0];
    }

    if (tail_size > 0) {
        k1 = (k1 * c1) & 0xFFFFFFFF;
        k1 = (k1 << 15 | k1 >> 17) & 0xFFFFFFFF;  // inlined ROTL32
        k1 = (k1 * c2) & 0xFFFFFFFF;
        h1 ^= k1;
    }

    // finalization
    let unsigned_val:number = fmix(h1 ^ length);
    if ((unsigned_val & 0x80000000) === 0) {
        return unsigned_val;
    }
    else {
        return -((unsigned_val ^ 0xFFFFFFFF) + 1);
    }
}