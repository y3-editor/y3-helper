import { Table } from "../constants";
import { UnitData as Unit } from "../editor_meta/unit";
import { SoundData as Sound } from "../editor_meta/sound";
import { AbilityData as Ability } from "../editor_meta/ability";
import { DecorationData as Decoration } from "../editor_meta/decoration";
import { DestructibleData as Destructible } from "../editor_meta/destructible";
import { ItemData as Item } from "../editor_meta/item";
import { ModifierData as Modifier } from "../editor_meta/modifier";
import { ProjectileData as Projectile } from "../editor_meta/projectile";
import { TechData as Tech } from "../editor_meta/tech";
import * as y3 from 'y3-helper';

interface CommonPatch {
    kv: Record<string, string|number|boolean>;
}

type Data<T> = Omit<T, keyof CommonPatch> & CommonPatch;

export type EditorData<N extends Table.NameCN>
    = N extends '单位' ? Data<Unit>
    : N extends '声音' ? Data<Sound>
    : N extends '技能' ? Data<Ability>
    : N extends '装饰物' ? Data<Decoration>
    : N extends '可破坏物' ? Data<Destructible>
    : N extends '物品' ? Data<Item>
    : N extends '魔法效果' ? Data<Modifier>
    : N extends '投射物' ? Data<Projectile>
    : N extends '科技' ? Data<Tech>
    : never;

interface FieldInfo {
    tableName: Table.NameCN;
    field: string;
    desc?: string;
    tips?: string;
    type?: string;
}

function checkAndConvertType(fieldInfo: FieldInfo, value: any, convertType = false) {
    if (!fieldInfo.type) {
        throw new Error(`未知字段类型:'${fieldInfo.field}'`);
    }
    switch (fieldInfo.type) {
        case 'PLocalizeText': {
            if (convertType) {
                return value?.toString() ?? '';
            }
            if (typeof value !== 'string') {
                throw new Error(`'${fieldInfo.field}'字段应为字符串`);
            }
            return value;
        }
        case 'PBool': {
            if (convertType) {
                return !!value;
            }
            if (typeof value !== 'boolean') {
                throw new Error(`'${fieldInfo.field}'字段应为布尔值`);
            }
            return value;
        }
        case 'PFloat': {
            if (convertType) {
                value = Number(value);
                if (isNaN(value)) {
                    value = 0.0;
                }
            }
            if (typeof value !== 'number' || isNaN(value)) {
                throw new Error(`'${fieldInfo.field}'字段应为数字`);
            }
            return value;
        }
        case 'PInt': {
            if (convertType) {
                value = Number(value);
                if (isNaN(value)) {
                    value = 0;
                }
            }
            if (!Number.isSafeInteger(value)) {
                throw new Error(`'${fieldInfo.field}'字段应为整数`);
            }
            return value;
        }
        case 'PText': {
            if (convertType) {
                return value?.toString() ?? '';
            }
            if (typeof value !== 'string') {
                throw new Error(`'${fieldInfo.field}'字段应为字符串`);
            }
            return value;
        }
    }

    if (fieldInfo.type.endsWith('List')) {
        if (!Array.isArray(value)) {
            throw new Error(`'${fieldInfo.field}'字段应为数组`);
        }
        return value;
    }
    if (fieldInfo.type.endsWith('Formula')) {
        if (!Array.isArray(value)) {
            throw new Error(`'${fieldInfo.field}'字段应为数组`);
        }
        for (let i = 0; i < value.length; i++) {
            let item = value[i];
            if (convertType) {
                item = item?.toString() ?? '';
            }
            if (typeof item !== 'string') {
                throw new Error(`'${fieldInfo.field}'字段的第${i}项应为字符串`);
            }
        }
        return value;
    }
    return value;
}

export function valueOnGet(fieldInfo: FieldInfo, value: any) {
    if (fieldInfo.type === 'PLocalizeText') {
        if (typeof value === 'number' || typeof value === 'string') {
            value = y3.language.get(value) ?? value;
        }
    }
    return value;
}

export function valueOnSet(fieldInfo: FieldInfo, value: any, convertType = false) {
    value = checkAndConvertType(fieldInfo, value, convertType);
    if (fieldInfo.type === 'PLocalizeText') {
        value = y3.language.keyOf(value as string, true);
    }
    return value;
}
