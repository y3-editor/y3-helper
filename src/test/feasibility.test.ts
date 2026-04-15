
import path, { dirname } from 'path';
import { HashSet } from '../utility/hashSet';



const jsonStr: string = "[1,2,3,4,5]";
let jsonObject = JSON.parse(jsonStr);
console.log(jsonObject);

type MyObjectType = {
    id: number;
    name: string;
};

function compareByProperty(prop: keyof MyObjectType) {
    return function (a: MyObjectType, b: MyObjectType) {
        return a[prop] === b[prop] ? 0 : a[prop] < b[prop] ? -1 : 1;
    };
}

// 测试HashSet
let set = new HashSet<MyObjectType>();

let obj1: MyObjectType = { id: 1, name: "Object 1" };
let obj2: MyObjectType = { id: 1, name: "Object 1" };
let obj3: MyObjectType = { id: 1, name: "Object 2" };
let obj4: MyObjectType = { id: 1, name: "Object 1" };
let obj5: MyObjectType = { id: 5, name: "Object 1" };
set.add(obj1);
set.add(obj2);
set.add(obj3);
set.add(obj4);
set.add(obj5);
console.log(set.size); 
for(let value of set){
    console.log(value); 
};

// 测试运行时动态载入importRules.ts————导表规则
const importRulesModulePath = "file://" + (path.join(__dirname, "../../importRules/importRules.mjs").replace(/\\/g, "/"));

console.log(importRulesModulePath);
let importRulesModule: any;


async function testImportRules() {
    
    importRulesModule = await import(importRulesModulePath);
    console.log(importRulesModule.importRules);
}

testImportRules();

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
let object1 = { "aaa.bbb": 1 };
console.log(toNestedObject(object1, '.'));
let object2 = { "aaa.bbb.ccc": 1 };
console.log(toNestedObject(object2, '.'));
let object3 = { "aaa.bbb.ccc": 1, "aaa.bbb.ddd": 2 };
console.log(toNestedObject(object3, '.'));
let object4:any = { "aaa.bbb.ccc": 1, "aaa.bbb.ddd.eee": 2, "aaa.bbb.ddd.fff": 3 };
object4 = toNestedObject(object4, '.');
console.log(object4);
console.log(object4['aaa']['bbb']); 


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
            res[key] = {};
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

console.log("mergeObject函数 对象合并测试");
let object5 = { "aaa": { "bbb": 1 },"ddd":0 };
let object6 = { "aaa": { "ccc": 2 },"ddd":"3" };
console.log(mergeObject(object5, object6));