
import * as exceljs from 'exceljs';
import * as vscode from 'vscode';

import {DEFAULT, IGNORE, REQUIRED, as, AttrKlass, INDEX} from './attrType';
import { ImportRule } from './importRule';
import { metaLoader, metaInfo } from './metaLoader';
import {field} from './field';
import { FieldType, Templete } from './fieldTypes';
import { excelExporter } from './excelExporter';


export class excelConverter{
    public rule: ImportRule;
    public meta: metaInfo;
    public excelPath: vscode.Uri;
    public targetPath: vscode.Uri;
    public hasTmp: boolean;
    public indexField: field | undefined;

    public srcFields: {[key: string]: field};
    // public dstFields: {[key: string]: field};
    public asFields: field[];

    public targetDatas: {[key: string]: any};
    public cHeaders: string [] | undefined;
    public excelDatas: any[];
    // private  merge_headers
    // private  definations
    // private  filter_index
    // private  filter_name
    // private  expand_fields
    // private  related_fields
    // private as_fields
    constructor(rule: ImportRule, excelPath: vscode.Uri, targetPath: vscode.Uri){
        this.srcFields = {};
        // this.dstFields = {};
        this.asFields = [];
        this.hasTmp = false;  
        this.excelDatas = []; //从excel表读取到的data
        this.targetDatas = {}; //根据attrType转换后的data,可以拿去翻译成lua或者json等

        this.rule = rule;
        this.meta = metaLoader.getInstance().load(this.rule);
        this.excelPath = excelPath;
        this.targetPath = targetPath;
    }

    public async convert(){
        if(!this.meta.fieldDefines){
            return false;
        }
        this.addFields();
        await this.parseExcel();
        await this.translateDatas();
        this.userHandleRowData();
        // this.resetKV();
        this.interpret();
    }

    public addFields(){
        for(const fieldName in this.meta.fieldDefines){
            let fld = new field(fieldName, this.meta.fieldDefines[fieldName]);
            if(fld.fieldName && fld.keyName !== undefined){
                let srcName = fld.fieldName;
                // let dstName = fld.keyName;
                if(srcName in this.srcFields){
                    vscode.window.showErrorMessage(`Repeated Excel def : ${srcName}`);
                    continue;
                }
                this.srcFields[srcName] = fld;
                // this.dstFields[dstName] = fld;
                if(fld.attrType instanceof as){
                    this.asFields.push(fld);
                }
                else if(Array.isArray(fld.attrType)){

                }else if(fld.attrType === INDEX){
                    this.indexField = fld;
                }

                if(fld.fieldType.type === FieldType.Templete || fld.fieldType === Templete){
                    this.hasTmp = true;
                }
            }     
        }

        if(!this.hasTmp){
            vscode.window.showErrorMessage("必须存在模板字段");
        }
    }

    public async parseExcel(){
        try {
            const workbook = new exceljs.Workbook();
            await workbook.xlsx.readFile(this.excelPath.fsPath);
            const worksheet = workbook.getWorksheet(this.rule.sheet); // 选择要读取的工作表
            if (worksheet) {
                // 载入表头
                let headers:string[] = [];
                worksheet.getRow(this.meta.jumpHeader).eachCell({ includeEmpty: true }, function (cell) {
                    headers.push(cell.text);
                });
                this.cHeaders = headers;
                // 遍历每行数据 jumpHeader下一行是正式内容
                for (let i = this.meta.jumpHeader + 1; i <= worksheet.actualRowCount; i++) {
                    let row:any [] = [];
                    worksheet.getRow(i).eachCell({ includeEmpty: true }, function (cell, colNumber) {
                        let value = cell.value;
                        if (typeof value === 'object') {
                            value = cell.text;
                        }
                        row.push(value);
                    });
                    if(this.meta.filter !== undefined && this.meta.filter(row) === false){
                        continue;
                    } 
                    this.excelDatas.push(row);
                }
            }
        }
        catch (error) {
            vscode.window.showErrorMessage("parse excelfile error：" + error);
        }
    }

    public async translateDatas(){
        for(let data of this.excelDatas){
            await this.dataConvert(data);
        }
    }

    public resetKV(){
        for(let index in this.targetDatas){
            this.targetDatas[index].kv = {};
        }
    }

    //将收集到的数据 翻译成想要的文件
    //子类必须继承
    public interpret(){
        
    }

    ////针对excel获取到的data转json对象的方法，感觉可以可以给转lua复用，先写在父类里面
    public async dataConvert(data: any[]){
        let output;
        output = await this.doNomalConvert(data);
        output = this.doMultiConvert(output);
        if(output.hasOwnProperty('uid') && output['uid'] !== undefined){
            let uid = output['uid'].toString();
            this.targetDatas[uid] = output;
        }
    }

    //正常转表
    public async doNomalConvert(rowData: any[]): Promise<{[key:string] : any}>{
        let output: {[key:string] : any} = {};
        if(this.cHeaders){
            if(this.hasTmp){
                let tmpID;
                for(let i = 0; i < rowData.length; i++){
                    let fld = this.srcFields[this.cHeaders[i]];
                    if(fld && fld.keyName !== undefined && (fld.fieldType.type === FieldType.Templete || fld.fieldType === Templete)){
                        tmpID = fld.inputConvert(rowData[i]);
                        break;
                    }
                }
                if(tmpID){
                    let exporter = excelExporter.getInstance();
                    if(exporter){
                        output = await exporter.getTmpJsDict(this.rule.editorTableType, tmpID);
                    }
                }
                for(let i = .0; i < rowData.length; i++){
                    let fld = this.srcFields[this.cHeaders[i]];
                    if(fld && fld.keyName !== undefined){
                        let data = fld.inputConvert(rowData[i]);
                        if(data !== null){
                            if(fld === this.indexField){
                                //在编辑器中uid,key是主键，-ref-已经废弃了 但是还是改了以防万一，
                                //这样手动改感觉不太好，希望以后能和编辑器能有同步主键的功能
                                output['uid'] = data.toString();
                                output['key'] = Number(data);
                                output['_ref_'] = data.toString();
                            }else{
                                if(Array.isArray(fld.keyName)){
                                    for(let name of fld.keyName){
                                        if(typeof name === 'string'){
                                            if(typeof fld.attrType === 'function'){
                                                output[name] = fld.attrType(output[name], data);
                                            }else{
                                                output[name] = data;
                                            }
                                        }else if(typeof name === 'number'){
                                            if(fld.fieldName){
                                                output[fld.fieldName + name.toString()] = data;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }else{
                vscode.window.showErrorMessage("必须要有一个模板ID");
            }
        }
        return output;
    }

    //多级字段转表
    public doMultiConvert(output: {[key:string] : any}): {[key:string] : any}{
        for(let fld of this.asFields){
            if(Array.isArray(fld.keyName)){
                for(let name of fld.keyName){
                    if(name !== undefined && fld.fieldName && (output[name] || output[fld.fieldName + name.toString()])){
                        if(output[fld.attrType.outKey]){
                            this.asConvert(output, fld.attrType, name, output[name]?output[name]:output[fld.fieldName + name.toString()]);
                        }
                    }
                }
            }else{
                if(fld.keyName !== undefined && fld.fieldName && (output[fld.keyName] || output[fld.fieldName])){
                    if(output[fld.attrType.outKey]){
                        this.asConvert(output, fld.attrType, fld.keyName, output[fld.keyName]?output[fld.keyName]:output[fld.fieldName]);
                    }
                }
            }
        }
        return output;
    }
    public asConvert(obj: any, attr: as, key:string | number, value: any){
        if(attr.asType instanceof as){
            this.asConvert(obj[attr.outKey], attr.asType, key, value);
        }else if(attr.asType === undefined){
            if(key !== -1){
                obj[attr.outKey][key] = value;
            }else{
                if(!Array.isArray(obj[attr.outKey])){
                    obj[attr.outKey] = [];
                }
                obj[attr.outKey].push(value);
            }
        }
    }

    public userHandleRowData(){
        if(this.meta.rowRehandle){
            for(let index in this.targetDatas){
                let data = this.meta.rowRehandle(this.targetDatas[index]);
                if(Array.isArray(data)){
                    for(let element of data){
                        if(element.uid && typeof element.uid === 'string'){
                            this.targetDatas[element.uid] = element;
                        }
                    }
                }
            }
        }
    }
}