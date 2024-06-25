import * as vscode from 'vscode';
export const enum FieldType {
    Default,
    Int,
    Str,
    Bool,
    Float,
    RatiosInt,
    RatiosFloat,
    List,
    Templete,
    Tuple,
    EnumInt,
    EnumStr,
    Enum,
}

export class converter{
    private static _instance: any = null;
    public type: FieldType = FieldType.Default;
    public defaultValue: any = null;

    constructor(){
    }

    public getDefault(): any{
        return null;
    }

    public getTypeDesc(): string{
        return this.constructor.name;
    }

    public getErrorStr(data: any): string{
        let clsName = this.getTypeDesc();
        return `[${data}不是有效的${clsName}]`;
    }

    public inputConvert(data: any): any{
        /*将输入数据转换到内存
		Args:
			data: 输入数据
		*/
		return data;
    }

    public outputConvert(d: any): any{
		return this.inputConvert(d);
    }

    public static getInstance(){
        if (this._instance === null) {
            this._instance = new this();
        }
        return this._instance;
    }
}

export class IntKlass extends converter{
    public type: FieldType = FieldType.Int;
    public defaultValue: number = 0;

    constructor(defaultValue: number | string = 0){
        super();
        let value = this.inputConvert(defaultValue);
        this.defaultValue = typeof value === 'number' ? value:0;
    }

    public getDefault(): number{
        return this.defaultValue;
    }

    public inputConvert(data: any){
        try{
            if(typeof data === 'number'){
                data = Math.floor(data);
            }else if(typeof data === 'string'){
                if(data === ''){
                    return null;
                }
                data = parseInt(data);
            }else{
                throw new Error("data类型不能转换为Int");
            }
            return data;
        }catch(error){
            vscode.window.showErrorMessage("Int类型转换错误：" + error);
        }
    }
}

export class StrKlass extends converter{
    public type: FieldType = FieldType.Str;
    public defaultValue: string = '';

    constructor(defaultValue: any = ''){
        super();
        let value = this.inputConvert(defaultValue);
        this.defaultValue = typeof value === 'string'? value : '';
    }
    public getDefault(): string{
        return this.defaultValue;
    }

    public inputConvert(data: any){
        try{
            data = data.toString();
            return data;
        }catch(error){
            vscode.window.showErrorMessage("Str类型转换错误：" + this.getErrorStr(data));
        }
    }
}


export class BoolenKlass extends converter{
    public type: FieldType = FieldType.Bool;
    public defaultValue: boolean = true;

    constructor(defaultValue: any = true){
        super();
        let value = this.inputConvert(defaultValue);
        this.defaultValue = typeof value === 'boolean'? value : false;
    }

    public getDefault(): boolean{
        return this.defaultValue;
    }

    public inputConvert(data: any){
        try{
            if (typeof data === 'boolean') {
                return data;
              } else if (typeof data === 'string') {
                if(data.toLowerCase() === 'true' || data !== '0'){
                    return true;
                }else if(data.toLowerCase() === 'false' || data === '0'){
                    return false;
                }
              } else if (typeof data === 'number') {
                return data === 0? false : true;
              } else {
                throw new Error(this.getErrorStr(data));
              }
        }catch(error){
            vscode.window.showErrorMessage("Bool类型转换错误：" + error);
        }
    }
}


export class FloatKlass extends converter{
    public type: FieldType = FieldType.Float;
    public defaultValue: number = 0;

    constructor(defaultValue: any = 0){
        super();
        let value = this.inputConvert(defaultValue);
        this.defaultValue = typeof value === 'number'? value : 0;
    }

    public getDefault(): number{
        return this.defaultValue;
    }

    public inputConvert(data: any){
        try{
            if(typeof data === 'string'){
                data = parseFloat(data);
            }else if(typeof data === 'number'){

            }else{
                throw new Error("data 不能转换为Float");
            }
            return data;
        }catch(error){
            vscode.window.showErrorMessage("Float类型转换错误：" + error);
        }
    }
}

export class RatiosIntKlass extends converter{
    public type: FieldType = FieldType.RatiosInt;
    public defaultValue: number = 0;
    public ratios: number = 1;
    constructor(ratios: number = 1, defaultValue: any = 0){
        super();
        this.ratios = ratios;
        let value = this.inputConvert(defaultValue);
        this.defaultValue = typeof value === 'number'? value : 0;
    }

    public getDefault(): number{
        return this.defaultValue;
    }

    public inputConvert(data: any){
        return IntKlass.getInstance().inputConvert(data * this.ratios);
    }
}

export class RatiosFloatKlass extends converter{
    public type: FieldType = FieldType.RatiosFloat;
    public defaultValue: number = 0;
    public ratios: number = 1;
    constructor(ratios: number = 1, defaultValue: any = 0){
        super();
        this.ratios = ratios;
        let value = this.inputConvert(defaultValue);
        this.defaultValue = typeof value === 'number'? value : 0;
    }

    public getDefault(): number{
        return this.defaultValue;
    }

    public inputConvert(data: any){
        return FloatKlass.getInstance().inputConvert(data * this.ratios);
    }
}

export class ListKlass extends converter{
    public type: FieldType = FieldType.List;
    public seperator = ',';
    public ft : converter;

    constructor(seperator: string = ',', filedType: Function | converter = Str){
        super();
        this.ft = StrKlass.getInstance();
        if(typeof filedType === 'function'){
            if(filedType === Int){
                this.ft = IntKlass.getInstance();
            }else if(filedType === Float){
                this.ft = FloatKlass.getInstance();
            }else if(filedType === Str){
                this.ft = StrKlass.getInstance();
            }else if(filedType === Bool){
                this.ft = BoolenKlass.getInstance();
            }else if(filedType === List){
                this.ft = ListKlass.getInstance();
            }else if(filedType === Tuple){
                this.ft = TupleKlass.getInstance();
            }
        }else if(filedType instanceof converter){
            this.ft = filedType;
        }
        
        let value = StrKlass.getInstance().inputConvert(seperator);
        this.seperator = typeof value === 'string'? value : ',';
    }

    public getDefault(): []{
        return [];
    }

    public inputConvert(data: any){
        try{
            data = data.toString();
            if(data === null || data === ''){
                return null;
            }
            let datas: string[] = data.split(this.seperator);
            let output = [];
            for(let i in datas){
                output.push(this.ft.inputConvert(datas[i]));
            }
            return output;
        }catch(error){
            vscode.window.showErrorMessage("List类型转换错误：" + this.getErrorStr(data));
        }
    }
}

export class TupleKlass extends converter{
    public type: FieldType = FieldType.List;
    public seperator = ',';
    public ftList :Function[] | converter[];

    constructor(seperator: string, args: Function[] | converter[]){
        super();
        this.seperator = seperator;
        this.ftList = args;
    }

    public inputConvert(data: any){
        data = data.toString();
        let datas: string[] = data.split(this.seperator);
        let output = [];
        for(let i = 0 ; i < datas.length ; i++){
            let ft = StrKlass.getInstance();
            if(typeof this.ftList[i] === 'function'){
                if(this.ftList[i] === Int){
                    ft = IntKlass.getInstance();
                }else if(this.ftList[i] === Float){
                    ft = FloatKlass.getInstance();
                }else if(this.ftList[i] === Str){
                    ft = StrKlass.getInstance();
                }else if(this.ftList[i] === Bool){
                    ft = BoolenKlass.getInstance();
                }else if(this.ftList[i] === List){
                    ft = ListKlass.getInstance();
                }else if(this.ftList[i] === Tuple){
                    ft = TupleKlass.getInstance();
                }
            }else if(this.ftList[i] instanceof converter){
                ft = this.ftList[i];
            }
            output.push(ft.inputConvert(datas[i]));
        }
        return output;
    }
}

export class EnumKlass extends converter{
    public type = FieldType.Enum;
    public enumMap: {[key:string] : any};
    constructor(map: {[key:string] : any}){
        super();
        this.enumMap = map;
    }
    public inputConvert(data: any){
        if(typeof data === 'string'){
            return this.enumMap[data];
        }
        return null;
    }
}

// export class EnumIntKlass extends converter{
//     public type = FieldType.EnumInt;
//     public enumMap: {[key:string] : any};
//     constructor(map: {[key:string] : any}){
//         super();
//         this.enumMap = map;
//     }
//     public inputConvert(data: any){
//         if(typeof data === 'string'){
//             data = this.enumMap[data];
//         }
//         return IntKlass.getInstance().inputConvert(data);
//     }
// }

// export class EnumStrKlass extends converter{
//     public type = FieldType.EnumInt;
//     public enumMap: {[key:string] : any};
//     constructor(map: {[key:string] : any}){
//         super();
//         this.enumMap = map;
//     }
//     public inputConvert(data: any){
//         if(typeof data === 'string'){
//             data = this.enumMap[data];
//         }
//         return IntKlass.getInstance().inputConvert(data);
//     }
// }

export class TempleteKlass extends converter{
    public type: FieldType = FieldType.Templete;
    public getDefault(){
        vscode.window.showErrorMessage("Templete类型不能设置默认(DEFAULT)，请使用TEMPLETE");
        return null;
    }

    public inputConvert(data: any){
        try{
            data = StrKlass.getInstance().inputConvert(data);
            return data;
        }catch(error){
            vscode.window.showErrorMessage("TempleteID转换错误：" + this.getErrorStr(data));
        }
    }
}








export function Int(value: any){
    return new IntKlass(value);
}

export function Float(value: any){
    return new FloatKlass(value);
}

export function Str(value: any){
    return new StrKlass(value);
}

export function Bool(value: any){
    return new BoolenKlass(value);
}

export function Templete(){
    return new TempleteKlass();
}

export function List(seperator: any, type: Function){
    return new ListKlass(seperator, type);
}

export function Tuple(seperator: string = ',', ...args: Function[] | converter[]){
    return new TupleKlass(seperator, args);
}

// export function EnumInt(map: {[key:string] : any}){
//     return new EnumIntKlass(map);
// }

// export function EnumStr(map: {}){
//     return new EnumStrKlass(map);
// }

export function Enum(map: {}){
    return new EnumKlass(map);
}

export function RatiosInt(retios: any = 1, value: any = 0){
    return new RatiosIntKlass(retios, value);
}

export function RatiosFloat(retios: any = 1, value: any = 0){
    return new RatiosFloatKlass(retios, value);
}


