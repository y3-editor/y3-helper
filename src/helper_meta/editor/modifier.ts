export interface ModifierData {
    /**
     * UID
     *
     * 魔法效果的UID
     */
    uid: string; // PText
    /**
     * 是否影响自己
     *
     * 是否对光环的拥有者添加光环效果
     */
    is_influence_self: boolean; // PBool
    /**
     * 材质变色强度
     */
    material_color_intensity: number; // PFloat
    /**
     * 最大持续时间
     */
    get_effect_list: any; // PAst
    /**
     * 最大持续时间
     */
    attach_model_list: any; // PAst
    /**
     * 同源覆盖
     *
     * “同源”指覆盖发生时2个魔法效果的关联技能类型和来源单位相同

当同源覆盖要求为是，2个不同源的魔法效果不会发生覆盖，走不覆盖规则
     */
    same_origin_cover: boolean; // PBool
    /**
     * 不影响单位标签
     *
     * 不会对拥有指定标签的单位施加光环效果。
只有满足所有判断条件时，单位才会获得光环效果。
     */
    ign_inf_unit_tag: any[]; // PList
    /**
     * 护盾类型
     *
     * 通用类可以抵挡物理或法术伤害，物理和法术护盾只能抵挡对应的伤害
     */
    shield_type: any; // PEnum
    /**
     * 目标允许
     *
     * 根据敌我关系决定是否对单位施加光环效果
     */
    target_allow: any; // PCheckBoxBit
    /**
     * 图标
     */
    modifier_icon: any; // PResource
    /**
     * 最大持续时间
     */
    lose_effect_list: any; // PAst
    /**
     * 声音事件列表
     *
     * 可以设置触发指定事件时播放的声音
     */
    sound_event_list: any[]; // PSoundList
    /**
     * 效果影响
     *
     * 仅用于标记，用来进行效果分类，在ECA中可以对单位身上同一分类的魔法效果统一处理
     */
    modifier_effect: any; // PEnum
    /**
     * 覆盖护盾变化
     *
     * 护盾发生覆盖时的护盾值的处理方式
     */
    shield_change_of_cover: any; // PEnum
    /**
     * 影响单位标签
     *
     * 会对拥有指定标签的单位施加光环效果。
只有满足所有判断条件时，单位才会获得光环效果。
     */
    inf_unit_tag: any[]; // PList
    /**
     * 描述
     */
    description: string; // PLocalizeText
    /**
     * 覆盖类型
     *
     * 用于决定单位获得相同的魔法效果时，是否进行覆盖以及如何进行覆盖。
     */
    modifier_cover_type: any; // PEnum
    /**
     * 覆盖层数变化
     *
     * 不变会保留旧的魔法效果对象（事件中获取），覆盖会保留新的对象。 
     */
    layer_change_of_cover: any; // PEnum
    /**
     * 标签
     */
    tags: any[]; // PList
    /**
     * 不透明度
     */
    material_alpha: number; // PFloat
    /**
     * 基础材质变色
     */
    material_color: any; // PAst
    /**
     * 层数上限
     *
     * 魔法效果的最大层数，如果最大层数为1则魔法效果在局内的属性面板中不会显示层数
     */
    layer_max: number; // PInt
    /**
     * 效果类别
     *
     * 不同类别的魔法效果将会有
     */
    modifier_type: any; // PEnum
    /**
     * 循环周期
     *
     * 每隔多长时间触发一次循环周期到期事件
     */
    cycle_time: number; // PFloat
    /**
     * 不影响单位类型
     *
     * 不会对指定类型的单位施加光环效果。
只有满足所有判断条件时，单位才会获得光环效果。
     */
    ign_inf_unit_type: any; // PCheckBoxBit
    /**
     * 名称
     */
    name: string; // PLocalizeText
    /**
     * 是否死亡时消失
     *
     * 死亡时是否销毁这个魔法效果。永久型的魔法效果不要勾选该选项。
     */
    disappear_when_dead: boolean; // PBool
    /**
     * 编辑器后缀
     */
    suffix: string; // PText
    /**
     * 光环效果
     *
     * 光环会对附近符合条件的单位添加该光环效果
     */
    halo_effect: any; // PSingleSelectExplorer
    /**
     * 影响范围
     *
     * 对多大范围内的单位添加光环效果
     */
    influence_rng: number; // PFloat
    /**
     * ID
     *
     * 魔法效果的ID
     */
    key: number; // PInt
    /**
     * 玩家自定义
     */
    kv: any; // PAst
    /**
     * 覆盖时间变化
     *
     * 若覆盖类型为覆盖时，不变会保留旧的持续时间，覆盖会保留新的持续时间，若覆盖类型为叠加时，规则相反。
     */
    time_change_of_cover: any; // PEnum
    /**
     * 显示图标
     *
     * 勾选后会在局内单位的魔法效果栏中显示该魔法效果
     */
    show_on_ui: boolean; // PBool
    /**
     * 材质变化
     *
     * 影响魔法效果携带者的材质
     */
    material_change: any; // PEnum
    /**
     * 护盾值
     *
     * 护盾可以抵挡的伤害值
     */
    shield_value: number; // PInt
}
