import {DEFAULT, IGNORE, REQUIRED, AttrKlass, NONE, as} from './attrType';
import * as vscode from 'vscode';
import {Bool, BoolenKlass, Enum, EnumKlass, Float, FloatKlass, Int, IntKlass, List, ListKlass, Str, 
    StrKlass, Templete, TempleteKlass, Tuple, TupleKlass, converter, RatiosInt, RatiosIntKlass, RatiosFloatKlass, RatiosFloat} from './fieldTypes';

export class field{
    public fieldName: string | undefined;
    public keyName: string | number | string[] | number[] | undefined;
    public fieldType: any;

    // public ignored: boolean | undefined  // 忽略 ?
    // public isAuto: boolean | undefined  // 自动填充 ?
    // public isRequired: boolean | undefined  // 必须 ?
    // public isMerged: boolean | undefined  // 合并项 ?
    // public isAs: boolean | undefined  // 导表转换项

    // 实际项
    public attrType: any;
    public _as: any;

    /*
        unitRule.def('fieldName', 'keyName, fieldType, attrType);
        parameters：(表头名，[物编(代码)key，数据导出类型，数据填写类型])
    */
    constructor(fieldName: string, fieldDefine: any[]){
        if(fieldDefine.length < 2 || (typeof fieldDefine[0] !== "string" && typeof fieldDefine[0] !== 'number' && !(Array.isArray(fieldDefine[0])))
             || (typeof fieldDefine[1] !== 'function' && !(fieldDefine[1] instanceof converter))){
            vscode.window.showErrorMessage("ImportRules.mjs 下的" + fieldName + "配置出错");
            return;
        }
        this.fieldName = fieldName;
        if(typeof fieldDefine[0] === 'string'){
            this.keyName = fieldDefine[0].split('.');
        }else if(typeof fieldDefine[0] === 'number'){
            this.keyName = [fieldDefine[0]];
        }
        this.fieldType = fieldDefine[1];
        this.attrType = NONE;
        if(fieldDefine[2] && (typeof fieldDefine[2] === 'function' ||fieldDefine[2] instanceof AttrKlass || fieldDefine[2] instanceof as || Array.isArray(fieldDefine[2]))){
            this.attrType = fieldDefine[2];
        }
    }

    public inputConvert(cellValue: any): any{
        let ft;
        if(typeof this.fieldType === 'function'){
            if(this.fieldType === Int){
                ft =  IntKlass.getInstance();
            }else if(this.fieldType === Float){
                ft =  FloatKlass.getInstance();
            }else if(this.fieldType === Str){
                ft =  StrKlass.getInstance();
            }else if(this.fieldType === Bool){
                ft =  BoolenKlass.getInstance();
            }else if(this.fieldType === List){
                ft =  ListKlass.getInstance();
            }else if(this.fieldType === RatiosInt){
                ft =  RatiosIntKlass.getInstance();
            }else if(this.fieldType === RatiosFloat){
                ft =  RatiosFloatKlass.getInstance();
            }else if(this.fieldType === Tuple){
                ft =  TupleKlass.getInstance();
            }else if(this.fieldType === Enum){
                ft =  EnumKlass.getInstance();
            }else if(this.fieldType === Templete){
                ft =  TempleteKlass.getInstance();
            }else{
                return this.fieldType(cellValue);
            }
        }
        else if(this.fieldType instanceof converter){
            ft = this.fieldType;
        }


        if(Array.isArray(this.attrType)){
            //TODO: 想做链式反应  但是太复杂了 以后有需求再说吧
        }else{
            if(this.attrType === NONE){
                
            }else if(this.attrType === DEFAULT){
                if(cellValue === null || cellValue === "" || cellValue === undefined){
                    return ft.getDefault();
                }
            }else if(this.attrType === REQUIRED){
                if(cellValue === null || cellValue === "" || cellValue === undefined){
                    vscode.window.showErrorMessage("The REQUIRED Excel cellValue cant be empty");
                    return null;
                }
            }else if(this.attrType === IGNORE){
                return null;
            }else if(this.attrType instanceof as){
                
            }else if(typeof this.attrType === 'function'){

            }
            return ft.inputConvert(cellValue);
        }
    }
}