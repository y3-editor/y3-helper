export class AttrKlass{
    private flag: any;
    private desc: string = "";
    constructor(name: any, desc: string = ""){
        this.flag = name;
        this.desc = desc;
    }

    public getString(): string{
        return `AttrKlass${this.flag}:${this.desc}`;
    }
}

export const NONE = new AttrKlass('NONE', "无");  //不做处理
export const INDEX = new AttrKlass('INDEX', "主键");  // 根据主键写入数据
export const DEFAULT = new AttrKlass('DEFAULT', "默认");  //若留空则赋予默认值
export const IGNORE = new AttrKlass('IGNORE', "忽略");  // 不导表
export const REQUIRED = new AttrKlass('REQUIRED', "必填");  // 不能留空
// export const TEMPLETE = new AttrKlass('TEMPLETE', "模板")  // 根据模板id生成数据
export const CONST = new AttrKlass('CONST', "常量");  // 在lua中生成常量字段
export const SKIPNULL = new AttrKlass('SKIPNULL', "跳过空");  // 留空则跳过
export function AS(outKey: string | number, asType: as){
    return new as(outKey, asType);
}

// export function ASTable(outKey: string, asType: as): asTable{               //用来修改导出key
//     return new asTable(outKey, asType);
// }
// export function ASList(index: number, asType: as): asList{               //用来修改导出key
//     return new asList(index, asType);
// }


/*
这个控制类可以用来修改导出key.
	Example:
		'需要到达场景': ('spaceno', Int, AS("target_spaceno")),
		'需要到达坐标': ('pos', Tuple(Float), AS("target_spaceno")),
	在实际的导出文件中, ('需要到达场景', '需要到达坐标') 会被组合成 'target_spaceno': {'spaceno': xx, 'pos': xx}
*/

export class as{
    public outKey: string | number;
    public asType: any;

    constructor(outKey: string | number, asType: as){
        this.outKey = outKey;
        this.asType = asType;
    }
}

// export class asTable extends as{
//     constructor(outKey: string, asType: as){
//         super(outKey, asType);
//     }
// }

// export class asList extends as{
//     constructor(index: number, asType: as){
//         super(index, asType);
//     }
// }