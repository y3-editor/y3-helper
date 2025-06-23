import { Table } from "../constants";
import { UnitData as Unit } from "../helper_meta/editor/unit";
import { SoundData as Sound } from "../helper_meta/editor/sound";
import { AbilityData as Ability } from "../helper_meta/editor/ability";
import { DecorationData as Decoration } from "../helper_meta/editor/decoration";
import { DestructibleData as Destructible } from "../helper_meta/editor/destructible";
import { ItemData as Item } from "../helper_meta/editor/item";
import { ModifierData as Modifier } from "../helper_meta/editor/modifier";
import { ProjectileData as Projectile } from "../helper_meta/editor/projectile";
import { TechData as Tech } from "../helper_meta/editor/tech";
import * as y3 from 'y3-helper';
import { hash } from "../utility";
import * as MapData from 'map-declare';
import * as vscode from 'vscode';
import * as l10n from '@vscode/l10n';


type KV = Record<string, string|number|boolean>;

interface CommonPatch {
    /**
     * 存放自定义的键值对。新增值只能为字符串、数字或布尔值。
     */
    kv: KV;
}

type Data<T> = T & CommonPatch;

export type EditorData<N extends Table.NameCN>
    = N extends '单位' ? Data<Unit> & MapData.MapUnit
    : N extends '声音' ? Data<Sound> & MapData.MapSound
    : N extends '技能' ? Data<Ability> & MapData.MapAbility
    : N extends '装饰物' ? Data<Decoration> & MapData.MapDecoration
    : N extends '可破坏物' ? Data<Destructible> & MapData.MapDestructible
    : N extends '物品' ? Data<Item> & MapData.MapItem
    : N extends '魔法效果' ? Data<Modifier> & MapData.MapModifier
    : N extends '投射物' ? Data<Projectile> & MapData.MapProjectile
    : N extends '科技' ? Data<Tech> & MapData.MapTech
    : never;

interface FieldInfo {
    tableName: Table.NameCN;
    field: string;
    desc?: string;
    tips?: string;
    type?: string;
}

interface KVShape {
    annotation: string,
    desc: string,
    etype: keyof typeof Table.type.etype,
    key: string,
    prop_cls: "PText"|"PBool"|"PFloat"|"PInt",
    remark: string,
    show_in_attr: boolean,
    sort: bigint,
    type: keyof typeof Table.type.type,
    value: string|number|boolean,
}

function fromKV(kvMap: Record<string, KVShape>): KV {
    let result: Record<string, string|number|boolean> = {};
    // 按照 sort 字段的值排序，然后将重新组成 { K: V.value } 的形式
    let kvList = Object.values(kvMap).sort((a, b) => Number(a.sort) - Number(b.sort));
    for (let kv of kvList) {
        result[kv.key] = kv.value;
    }
    return result;
}

function toKV(kv: KV, raw: Record<string, KVShape>): Record<string, KVShape> {
    let result: Record<string, KVShape> = { ...raw };
    let sort = 0;
    for (let [key, value] of Object.entries(kv)) {
        if (key in result) {
            result[key] = {
                ...result[key],
                etype: BigInt(result[key].etype) as any,
                type: BigInt(result[key].type) as any,
                sort: BigInt(result[key].sort),
                value,
            };
            sort = Math.max(sort, Number(result[key].sort));
        } else {
            let etype, type, prop_cls;
            if (typeof value === 'string') {
                etype = 0n;
                type = 0n;
                prop_cls = 'PText';
            } else if (typeof value === 'number') {
                etype = 2n;
                type = 1n;
                prop_cls = 'PFloat';
            } else if (typeof value === 'bigint') {
                etype = 1n;
                type = 2n;
                prop_cls = 'PInt';
            } else if (typeof value === 'boolean') {
                etype = 4n;
                type = 3n;
                prop_cls = 'PBool';
            } else {
                continue;
            }
            result[key] = {
                annotation: '',
                desc: '',
                etype: etype as any,
                key,
                prop_cls: prop_cls as any,
                remark: '',
                show_in_attr: false,
                sort: BigInt(++sort),
                type: type as any,
                value,
            };
        }
    }
    return result;
}

function checkAndConvertType(fieldInfo: FieldInfo, value: any, convertType = false) {
    if (!fieldInfo.type) {
        return value;
    }
    switch (fieldInfo.type) {
        case 'PLocalizeText': {
            if (convertType) {
                return value?.toString() ?? '';
            }
            if (typeof value !== 'string') {
                throw new Error(l10n.t("'{0}'字段应为字符串", fieldInfo.field));
            }
            return value;
        }
        case 'PBool': {
            if (convertType) {
                return !!value;
            }
            if (typeof value !== 'boolean') {
                throw new Error(l10n.t("'{0}'字段应为布尔值", fieldInfo.field));
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
                throw new Error(l10n.t("'{0}'字段应为数字", fieldInfo.field));
            }
            return value;
        }
        case 'PResource':
        case 'PInt': {
            if (convertType) {
                try {
                    value = BigInt(value);
                } catch {
                    throw new Error(l10n.t("'{0}'字段应为整数", fieldInfo.field));
                }
            }
            return value;
        }
        case 'PText': {
            if (convertType) {
                return value?.toString() ?? '';
            }
            if (typeof value !== 'string') {
                throw new Error(l10n.t("'{0}'字段应为字符串", fieldInfo.field));
            }
            return value;
        }
    }

    if (fieldInfo.type.endsWith('List')) {
        if (!Array.isArray(value)) {
            throw new Error(l10n.t("'{0}'字段应为数组", fieldInfo.field));
        }
        return value;
    }
    if (fieldInfo.type.endsWith('Formula')) {
        if (!Array.isArray(value)) {
            throw new Error(l10n.t("'{0}'字段应为数组", fieldInfo.field));
        }
        for (let i = 0; i < value.length; i++) {
            let item = value[i];
            if (convertType) {
                item = item?.toString() ?? '';
            }
            if (typeof item !== 'string') {
                throw new Error(l10n.t("'{0}'字段的第{1}项应为字符串", fieldInfo.field, i));
            }
        }
        return value;
    }
    return value;
}

export function valueOnGet(fieldInfo: FieldInfo, value: any, objectKey?: number) {
    if (fieldInfo.field === 'kv') {
        value = fromKV(value);
    }
    if (fieldInfo.field === 'name' && objectKey !== undefined) {
        const key = `${Table.name.fromCN[fieldInfo.tableName]}_${objectKey}_name`;
        const hashKey = hash(key);
        return y3.env.currentTriggerMap?.language.get(hashKey);
    }
    if (fieldInfo.field === 'description' && objectKey !== undefined) {
        const key = `${Table.name.fromCN[fieldInfo.tableName]}_${objectKey}_description`;
        const hashKey = hash(key);
        return y3.env.currentTriggerMap?.language.get(hashKey);
    }
    if (fieldInfo.type === 'PLocalizeText') {
        if (typeof value === 'number' || typeof value === 'string') {
            value = y3.env.currentTriggerMap?.language.get(value) ?? value;
        }
    }
    return value;
}

export function valueOnSet(fieldInfo: FieldInfo, value: any, raw: any, convertType = false, objectKey?: number) {
    if (fieldInfo.field === 'kv') {
        value = toKV(value, raw);
    }
    if (fieldInfo.field === 'name' && objectKey !== undefined) {
        const key = `${Table.name.fromCN[fieldInfo.tableName]}_${objectKey}_name`;
        const hashKey = hash(key);
        y3.env.currentTriggerMap?.language.set(hashKey, value);
        return BigInt(hashKey);
    }
    if (fieldInfo.field === 'description' && objectKey !== undefined) {
        const key = `${Table.name.fromCN[fieldInfo.tableName]}_${objectKey}_description`;
        const hashKey = hash(key);
        y3.env.currentTriggerMap?.language.set(hashKey, value);
        return BigInt(hashKey);
    }
    value = checkAndConvertType(fieldInfo, value, convertType);
    if (fieldInfo.type === 'PLocalizeText') {
        value = y3.env.currentTriggerMap?.language.keyOf(value as string);
    }
    return value;
}
