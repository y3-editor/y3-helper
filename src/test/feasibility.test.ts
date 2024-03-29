import * as vscode from 'vscode';
const jsonStr: string = "[1,2,3,4,5]";
let jsonObject = JSON.parse(jsonStr);
console.log(jsonObject);

type MyObjectType = {
    id: number;
    name: string;
    // 其他属性
};

function compareByProperty(prop: keyof MyObjectType) {
    return function (a: MyObjectType, b: MyObjectType) {
        return a[prop] === b[prop] ? 0 : a[prop] < b[prop] ? -1 : 1;
    };
}

let set = new Set<MyObjectType>();

let obj1: MyObjectType = { id: 1, name: "Object 1" };
let obj2: MyObjectType = { id: 1, name: "Object 1" };

set.add(obj1);
set.add(obj2);

console.log(set.size); // 输出: 1
for (let v of set) {
    console.log(v);
}