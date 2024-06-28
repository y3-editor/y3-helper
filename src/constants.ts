// 本项目的常量尽量放到这里

/**
 * 物编数据种类枚举
 */
export enum EditorTableType {
    Unit = "unit",
    Decoration = "decoration",
    Item = "item",
    Ability = "ability",
    Modifier = "modifier",
    Projectile = "projectile",
    Technology = "technology",
    Destructible = "destructible",
    Sound = "sound"
}

export const Table = {
    path: {
        toCN: {
            "editorunit": "单位",
            "soundall": "声音",
            "abilityall": "技能",
            "editordecoration": "装饰物",
            "editordestructible": "可破坏物",
            "editoritem": "物品",
            "modifierall": "魔法效果",
            "projectileall": "投射物",
            "technologyall": "科技",
        },
        fromCN: {
            "单位": "editorunit",
            "声音": "soundall",
            "技能": "abilityall",
            "装饰物": "editordecoration",
            "可破坏物": "editordestructible",
            "物品": "editoritem",
            "魔法效果": "modifierall",
            "投射物": "projectileall",
            "科技": "technologyall",
        },
        toName: {
            "editorunit": "unit",
            "soundall": "sound",
            "abilityall": "ability",
            "editordecoration": "decoration",
            "editordestructible": "destructible",
            "editoritem": "item",
            "modifierall": "modifier",
            "projectileall": "projectile",
            "technologyall": "technology",
        },
        fromName: {
            "unit": "editorunit",
            "sound": "soundall",
            "ability": "abilityall",
            "decoration": "editordecoration",
            "destructible": "editordestructible",
            "item": "editoritem",
            "modifier": "modifierall",
            "projectile": "projectileall",
            "technology": "technologyall",
        },
    },
    name: {
        toCN: {
            "unit": "单位",
            "decoration": "装饰物",
            "item": "物品",
            "ability": "技能",
            "modifier": "魔法效果",
            "projectile": "投射物",
            "technology": "科技",
            "destructible": "可破坏物",
            "sound": "声音",
        },
        fromCN: {
            "单位": "unit",
            "装饰物": "decoration",
            "物品": "item",
            "技能": "ability",
            "魔法效果": "modifier",
            "投射物": "projectile",
            "科技": "technology",
            "可破坏物": "destructible",
            "声音": "sound",
        },
    },
} as const;

export type TablePath = keyof typeof Table.path.toCN;
export type TableNameEN = keyof typeof Table.name.toCN;
export type TableNameCN = keyof typeof Table.name.fromCN;

/**
 * 不同类型的CSV文件导入为Json后会放入不同的文件夹
 */
export const csvTypeToPath = {
    "unit": "editorunit",
    "sound": "soundall",
    "ability": "abilityall",
    "model": "editormodel",
    "decoration": "editordecoration",
    "destructible": "editordestructible",
    "effect": "editoreffect",
    "icon": "editoricon",
    "item": "editoritem",
    "physics_object": "editorphysicsobject",
    "physics_object_logic": "editorphysicsobjectlogic",
    "modifier": "modifierall",
    "projectile": "projectileall",
    "store": "storeall",
    "technology": "technologyall"
} as const;

// 默认情况下各类型物编数据CSV文件的相对路径 （相对于工程项目的script文件）
export const defaultTableTypeToCSVfolderPath = {
    unit: "./y3-helper/editor_table/csv/单位",
    decoration: "./y3-helper/editor_table/csv/装饰物",
    item: "./y3-helper/editor_table/csv/物品",
    ability: "./y3-helper/editor_table/csv/技能",
    modifier: "./y3-helper/editor_table/csv/魔法效果",
    projectile: "./y3-helper/editor_table/csv/投射物",
    technology: "./y3-helper/editor_table/csv/科技",
    destructible: "./y3-helper/editor_table/csv/可破坏物",
    sound: "./y3-helper/editor_table/csv/声音"
} as const;

export const typeID = {
    100000: ["number", "实数"],
    100001: ["boolean", "布尔"],
    100002: ["integer", "整数"],
    100003: ["string", "字符串"],
    100004: ["Point", "点"],
    100006: ["Unit", "单位"],
    100010: ["UnitKey", "单位类型"],
    100011: ["table", "表"],
    100014: ["Ability", "技能"],
    100025: ["Player", "玩家"],
    100026: ["UnitGroup", "单位组"],
    100027: ["PlayerGroup", "玩家组"],
    100031: ["Item", "物品"],
    100032: ["ItemKey", "物品类型"],
    100039: ["AbilityKey", "技能类型"],
    100263: ["Mover", "运动器"],
} as const;
