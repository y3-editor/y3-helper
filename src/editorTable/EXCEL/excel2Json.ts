import * as vscode from 'vscode';

import { ImportRule } from './importRule';
import { saveEditorTableItemJson } from '../editorTableItemJson';
import { chineseTypeNameToEnglishTypeName } from '../../constants';
import { excelConverter } from './excelConverter';


export class excel2Json extends excelConverter {
    constructor(rule: ImportRule, excelPath: vscode.Uri, targetPath: vscode.Uri)  {
        super(rule, excelPath, targetPath);
    }
    public interpret(){
        let editorTableType = chineseTypeNameToEnglishTypeName[this.rule.editorTableType];
        for(let index in this.targetDatas){
            //把获取到的数据转换成json
            //异步的
            saveEditorTableItemJson(index, this.targetDatas[index], this.targetPath, editorTableType);
        }
    }
}
