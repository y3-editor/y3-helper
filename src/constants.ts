export namespace Table {
    export const path = {
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
        } as const,
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
        } as const,
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
        } as const,
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
        } as const,
    } as const;

    export const name = {
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
        } as const,
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
        } as const,
    } as const;

    export const type = {
        toLuaType: {
            100000: "number",
            100001: "boolean",
            100002: "integer",
            100003: "string",
            100004: "Point",
            100006: "Unit",
            100010: "UnitKey",
            100011: "table",
            100014: "Ability",
            100025: "Player",
            100026: "UnitGroup",
            100027: "PlayerGroup",
            100031: "Item",
            100032: "ItemKey",
            100039: "AbilityKey",
            100263: "Mover",
        } as const,
        toName: {
            100000: "实数",
            100001: "布尔",
            100002: "整数",
            100003: "字符串",
            100004: "点",
            100006: "单位",
            100010: "单位类型",
            100011: "表",
            100014: "技能",
            100025: "玩家",
            100026: "单位组",
            100027: "玩家组",
            100031: "物品",
            100032: "物品类型",
            100039: "技能类型",
            100263: "运动器",
        } as const,
        etype: {
            0: "字符串",
            1: "整数",
            2: "实数",
            4: "布尔",
        } as const,
        type: {
            0: "字符串",
            1: "实数",
            2: "整数",
            3: "布尔",
        }
    } as const;

    export type Path = keyof typeof path.toCN;
    export type NameEN = keyof typeof name.toCN;
    export type NameCN = keyof typeof name.fromCN;
    export type TypeID = keyof typeof type.toLuaType;
}
