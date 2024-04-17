/**
 * 物编数据项目中的自定义属性的枚举
 */
enum KV_VALUE_TYPE {
    STRING = 0,
    INTEGER = 1,
    FLOAT = 2,
    BOOLEAN = 4,
    UNIT_ENTITY = 5,
    UNIT_GROUP = 6,
    UNIT_NAME = 7,
    VECTOR = 8,
    PLAYER_GROUP = 9,
    PLAYER = 10,
    TEAM = 11,
    ITEM_ENTITY = 12,
    ITEM_NAME = 13,
    RECTANGLE = 15,
    ROUND_AREA = 16,
    UNIT_NAME_POOL = 17,
    POINT = 18,
    TIMER = 19,
    TEXTURE = 20,
    PROJECTILE_ENTITY = 21,
    MODEL = 22,
    ABILITY_NAME = 23,
    POINT_LIST = 24,
    POLYGON = 25,
    MODEL_ENTITY_NEW = 26,
    SFX_KEY = 27,
    SFX_ENTITY = 28,
    MODIFIER_ENTITY = 29,
    ITEM_GROUP = 30,
    PROJECTILE_KEY = 31,
    DYNAMIC_TRIGGER_INSTANCE = 32,
    NEW_TIMER = 33,
    ABILITY_TYPE = 34,
    LINK_SFX_ENTITY = 35,
    RANDOM_POOL = 36,
    DESTRUCTIBLE_ENTITY = 37,
    DESTRUCTIBLE_NAME = 38,
    UNIT_TYPE = 39,
    UI_COMP = 40,
    UI_EVENT = 41,
    SOUND_ENTITY = 42,
    ABILITY_CAST_TYPE = 43,
    DAMAGE_TYPE = 44,
    TECH_KEY = 45,
    MODIFIER_KEY = 46,
    ABILITY = 47,
    MODIFIER_TYPE = 48,
    MODIFIER_EFFECT_TYPE = 49,
    ROLE_RES_KEY = 50,
    ROLE_STATUS = 51,
    ROLE_TYPE = 52,
    STORE_KEY = 53,
    KEYBOARD_KEY = 54,
    MOUSE_KEY = 55,
    CAMERA = 56,
    UNIT_ATTR = 57,
    ATTR_ELEMENT = 58,
    PROJECTILE_GROUP = 59,
    FORMULA = 60,
    TABLE = 61,
    ROLE_RELATION = 62,
    CURVE_PATH = 63,
    UI_COMP_TYPE = 64,
    SCENE_NODE = 65,
    UI_ANIM = 66,
    UNIT_COMMAND_TYPE = 67,
    MINI_MAP_COLOR_TYPE = 68,
    AUDIO_KEY = 69,
    GAME_MODE = 70,
    UI_COMP_EVENT_TYPE = 71,
    IMAGE_QUALITY = 72,
    WINDOW_TYPE_SETTING = 73,
    UNIT_BEHAVIOR = 74,
    ANGLE = 75,
    POINT_LIGHT = 76,
    SPOT_LIGHT = 77,
    Fog = 78,
    CAMLINE = 79,
    UI_COMP_ATTR = 80,
    UI_COMP_ALIGN_TYPE = 81,
    MOUSE_WHEEL = 82,
    FUNC_KEYBOARD_KEY = 83,
    UI_PREFAB = 84,
    POST_EFFECT = 85,
    UI_PREFAB_INS = 86,
    ATTR_ELEMENT_READ = 87,
    UI_PREFAB_INS_UID = 88,
    LINK_SFX_KEY = 89,
    SKILL_POINTER_TYPE = 90,
    SCENE_SOUND = 91,
    MOVER_ENTITY = 92,
    AUDIO_CHANNEL = 93,
    VECTOR3 = 94,
    SEQUENCE = 95,
    PHYSICS_OBJECT = 96,
    PHYSICS_ENTITY = 97,
    RIGID_BODY = 98,
    COLLIDER = 99,
    JOINT = 100,
    PHYSICS_OBJECT_KEY = 101,
    PHYSICS_ENTITY_KEY = 102,
    ROTATION = 103,
    RIGID_BODY_GROUP = 104,
    REACTION = 105,
    REACTION_GROUP = 106,
    UI_ANIM_CURVE = 107,
    CURSOR_STYLE = 108,
    FLOATING_TEXT = 109,
    UI_DIRECTION = 110,
    PHYSICS_ENTITY_STATE = 111,
    DIRECTION = 112,
    CURVE_PATH_3D = 113,
    JUMP_WORD_TRACK = 114,
    UNIT_GROUP_COMMAND_TYPE = 115,
    RESCUE_SEEKER_TYPE = 116,
    RESCUER_TYPE = 117,
    STORE_ITEM_TYPE = 118
}

export const EDITOR_KV_TYPE_TO_GAME: Readonly<{ [key: string]:number }> = {
    string: KV_VALUE_TYPE.STRING,
    float: KV_VALUE_TYPE.FLOAT,
    int: KV_VALUE_TYPE.INTEGER,
    boolean: KV_VALUE_TYPE.BOOLEAN,
    // 物编类型
    Unit: KV_VALUE_TYPE.UNIT_NAME,
    // Decoration: KV_VALUE_TYPE.,      // 还没定义
    Item: KV_VALUE_TYPE.ITEM_NAME,
    Ability: KV_VALUE_TYPE.ABILITY_NAME,
    Modifier: KV_VALUE_TYPE.MODIFIER_KEY,
    Projectile: KV_VALUE_TYPE.PROJECTILE_KEY,
    Technology: KV_VALUE_TYPE.TECH_KEY,
    LogicSound: KV_VALUE_TYPE.AUDIO_KEY,
    Destructible: KV_VALUE_TYPE.DESTRUCTIBLE_NAME,
    // 资源类型
    Model: KV_VALUE_TYPE.MODEL,
    Icon: KV_VALUE_TYPE.TEXTURE,
    Effect: KV_VALUE_TYPE.SFX_KEY,
    Sound: KV_VALUE_TYPE.AUDIO_KEY,
    // 单位分类
    UnitType: KV_VALUE_TYPE.UNIT_TYPE,
    // 魔法效果类别
    ModifierType: KV_VALUE_TYPE.MODIFIER_TYPE,
    // 魔法效果影响类别
    ModifierEffectType: KV_VALUE_TYPE.MODIFIER_EFFECT_TYPE,
    // 技能子类型
    AbilityType: KV_VALUE_TYPE.ABILITY_TYPE,
    // 伤害类型
    DamageType: KV_VALUE_TYPE.DAMAGE_TYPE,
    // 按键输入
    KeyBoard: KV_VALUE_TYPE.KEYBOARD_KEY,
    // 鼠标输入
    Mouse: KV_VALUE_TYPE.MOUSE_KEY,
    // 公式
    FORMULAR: KV_VALUE_TYPE.FLOAT,
    // 鼠标滚轮
    Wheel: KV_VALUE_TYPE.MOUSE_WHEEL,
    // 单位属性
    UnitAttr: KV_VALUE_TYPE.UNIT_ATTR,
    // 镜头动画
    CameraAnim: KV_VALUE_TYPE.CAMLINE,
    // 玩家
    Player: KV_VALUE_TYPE.PLAYER,
    // 阵营
    Camp: KV_VALUE_TYPE.TEAM,
    // 玩家属性
    PlayerAttr: KV_VALUE_TYPE.ROLE_RES_KEY,
    // 单位属性类型
    AttrElement: KV_VALUE_TYPE.ATTR_ELEMENT,
    // 角度
    Degree: KV_VALUE_TYPE.FLOAT,
    // 链接特效路径
    LinkEffectPath: KV_VALUE_TYPE.LINK_SFX_KEY,
    // UI
    UI: KV_VALUE_TYPE.UI_COMP,
    // 表
    Table: KV_VALUE_TYPE.TABLE,
    // 序列帧
    SpriteSheet: KV_VALUE_TYPE.SEQUENCE,
    // 鼠标样式
    CursorStyle: KV_VALUE_TYPE.CURSOR_STYLE,
    // 伤害跳字
    FloatingText: KV_VALUE_TYPE.FLOATING_TEXT,
    // 逻辑物理组件类型
    PhysicsEntityKey: KV_VALUE_TYPE.PHYSICS_ENTITY_KEY,
    // 逻辑物理组件
    PhysicsEntity: KV_VALUE_TYPE.PHYSICS_ENTITY
};

export const kvDefaultItem:Readonly<{}> = {
    "": {
        "annotation": "",
        "desc": "",
        "etype": 0,
        "key": "",
        "prop_cls": "PInt",
        "remark": "",
        "show_in_attr": true,
        "sort": 0,
        "type": 0,
        "value": "0"
    },
};