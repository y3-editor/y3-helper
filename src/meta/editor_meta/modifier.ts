export interface ModifierData {
    /**
     * UID
     */
    uid: string; // PText
    /**
     * 是否影响自己
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
     */
    same_origin_cover: boolean; // PBool
    /**
     * 不影响单位标签
     */
    ign_inf_unit_tag: any[]; // PList
    /**
     * 护盾类型
     */
    shield_type: any; // PEnum
    /**
     * 目标允许
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
     */
    sound_event_list: any[]; // PSoundList
    /**
     * 效果影响
     */
    modifier_effect: any; // PEnum
    /**
     * 覆盖护盾变化
     */
    shield_change_of_cover: any; // PEnum
    /**
     * 影响单位标签
     */
    inf_unit_tag: any[]; // PList
    /**
     * 描述
     */
    description: string; // PLocalizeText
    /**
     * 覆盖类型
     */
    modifier_cover_type: any; // PEnum
    /**
     * 覆盖层数变化
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
     */
    layer_max: number; // PInt
    /**
     * 效果类别
     */
    modifier_type: any; // PEnum
    /**
     * 循环周期
     */
    cycle_time: number; // PFloat
    /**
     * 不影响单位类型
     */
    ign_inf_unit_type: any; // PCheckBoxBit
    /**
     * 名称
     */
    name: string; // PLocalizeText
    /**
     * 是否死亡时消失
     */
    disappear_when_dead: boolean; // PBool
    /**
     * 编辑器后缀
     */
    suffix: string; // PText
    /**
     * 光环效果
     */
    halo_effect: any; // PSingleSelectExplorer
    /**
     * 影响范围
     */
    influence_rng: number; // PFloat
    /**
     * ID
     */
    key: number; // PInt
    /**
     * 玩家自定义
     */
    kv: any; // PAst
    /**
     * 覆盖时间变化
     */
    time_change_of_cover: any; // PEnum
    /**
     * 显示图标
     */
    show_on_ui: boolean; // PBool
    /**
     * 材质变化
     */
    material_change: any; // PEnum
    /**
     * 护盾值
     */
    shield_value: number; // PInt
}
