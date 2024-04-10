
import path, { dirname } from 'path';
import { HashSet } from '../utility/hashSet';
import { exec } from 'child_process';


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