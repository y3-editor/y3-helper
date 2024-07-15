import { ImportRule } from './importRule';

export class metaInfo{
    public filter: Function | undefined;
    public jumpHeader: number;
    public fieldDefines: {[key: string]: any[]};  //域定义
    public rowRehandle: Function | undefined;

    constructor(){
        this.filter = (row: [])=>{return true;};
        this.jumpHeader = 0;
        this.fieldDefines = {};
    }

}

export class metaLoader{
    private static _instance: any = null;
    // private loadRule: any = null;
    public static loadFunc: Function[] = [];
    constructor(){}

    public static getInstance(): metaLoader{
        if (this._instance === null) {
          this._instance = new this();
        }
        return this._instance;
    }

    public load(rule: ImportRule): metaInfo{
        // this.loadRule = rule;
        let meta = new metaInfo();
        for(let lFunc of metaLoader.loadFunc){
            lFunc(meta, rule);
        }
        return meta;
    }
}


metaLoader.loadFunc.push(
    function parseMeta(meta: metaInfo, rule: ImportRule){
        if(!rule.fieldDefs){
            return;
        }
        meta.fieldDefines = rule.fieldDefs;
    }
);

metaLoader.loadFunc.push(
    function parseHeader(meta: metaInfo, rule: ImportRule){
        if(rule.filter){
            meta.filter = rule.filter;
            meta.jumpHeader = rule.jumpHeader;
        }
    }
);

metaLoader.loadFunc.push(
    function collectRowHandler(meta: metaInfo, rule: ImportRule){
        if(typeof rule.dataRehandle === 'function'){
            meta.rowRehandle = rule.dataRehandle;
        }
    }
);