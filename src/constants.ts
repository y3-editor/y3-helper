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

/**
 * Y3项目的editor_table文件夹下的各个文件夹名和物编数据种类中文名的对应关系
 */
export const englishPathToChinese: Readonly<{ [key: string]: string } >= {
    "editorunit": "单位",
    "soundall": "声音",
    "abilityall": "技能",
    "editordecoration": "装饰物",
    "editordestructible": "可破坏物",
    "editoritem": "物品",
    "modifierall": "魔法效果",
    "projectileall": "投射物",
    "technologyall": "科技"
};

/**
 * 物编数据种类对应的中文名
 */
export const englishTypeNameToChineseTypeName: Readonly<{ [key: string]: string } >= {
        "unit": "单位",
        "decoration": "装饰物",
        "item": "物品",
        "ability": "技能",
        "modifier": "魔法效果",
        "projectile": "投射物",
        "technology": "科技",
        "destructible": "可破坏物",
        "sound": "声音"
};

/**
 * 物编数据种类对应的英文名
 */
export const chineseTypeNameToEnglishTypeName:Readonly< { [key: string]: string } >= {
        "单位": "unit",
        "装饰物": "decoration",
        "物品": "item",
        "技能": "ability",
        "魔法效果": "modifier",
        "投射物": "projectile",
        "科技": "technology",
        "可破坏物": "destructible",
        "声音": "sound"
};

/**
 * 物编数据类型与其在Y3项目中存放的文件夹名的对应关系
 */
export const editorTableTypeToFolderName: Readonly<{ [key: string]: string }> = {
    "unit": "editorunit",
    "decoration": "editordecoration",
    "item": "editoritem",
    "ability": "abilityall",
    "modifier": "modifierall",
    "projectile": "projectileall",
    "technology": "technologyall",
    "destructible": "editordestructible",
    "sound":"soundall"
};

/**
 * 不同类型的CSV文件导入为Json后会放入不同的文件夹
 */
export const csvTypeToPath: Readonly<{ [key: string]: string }> = {
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
};