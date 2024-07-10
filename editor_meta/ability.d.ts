export interface AbilityData {
    /**
     * 物品
     */
    type_priority_item: number; // PInt
    /**
     * 施法开始可以被打断
     */
    can_ps_interrupt: boolean; // PBool
    /**
     * 阵营
     */
    filter_condition_camp: any; // PCheckBoxBit
    /**
     * 敌人
     */
    camp_priority_enemy: number; // PInt
    /**
     * 可破坏物
     */
    type_priority_destructible: number; // PInt
    /**
     * ID
     */
    key: number; // PInt
    /**
     * 近战
     */
    is_meele: boolean; // PBool
    /**
     * 准备特效
     */
    sp_sfx_list: any[]; // PList
    /**
     * 施法完成可以被打断
     */
    can_bs_interrupt: boolean; // PBool
    /**
     * 连续施法
     */
    collection_continuously: boolean; // PBool
    /**
     * 立刻施法
     */
    is_immediate: boolean; // PBool
    /**
     * 宽度
     */
    arrow_width: string[]; // PAbilityFormula
    /**
     * 长度
     */
    arrow_length: string[]; // PAbilityFormula
    /**
     * 消耗生命是否致死
     */
    cost_hp_can_die: boolean; // PBool
    /**
     * 生命值消耗
     */
    ability_hp_cost: string[]; // PAbilityFormula
    /**
     * 魔法书技能
     */
    magicbook_list: any[]; // PList
    /**
     * 受击特效
     */
    hit_sfx_list: any[]; // PList
    /**
     * 施法引导
     */
    ability_prepare_time: number; // PFloat
    /**
     * 单位移动类型
     */
    filter_condition_move_channel_type: any; // PEnum
    /**
     * 前摇特效
     */
    ps_sfx_list: any[]; // PList
    /**
     * 攻击范围预览特效
     */
    building_attack_range_sfx: any; // PResource
    /**
     * 可破坏物标签要求
     */
    collection_destructible_tags: any; // PTags
    /**
     * 编辑器后缀
     */
    suffix: string; // PText
    /**
     * 声音事件列表
     */
    sound_event_list: any[]; // PSoundList
    /**
     * 移动会对技能产生影响
     */
    influenced_by_move: boolean; // PBool
    /**
     * 生命不足能否施放
     */
    can_cast_when_hp_insufficient: boolean; // PBool
    /**
     * 玩家自定义
     */
    kv: any; // PAst
    /**
     * 英雄
     */
    type_priority_hero: number; // PInt
    /**
     * 自动拾取
     */
    auto_pick: boolean; // PBool
    /**
     * 消耗生命值施放
     */
    can_cost_hp: boolean; // PBool
    /**
     * UID
     */
    uid: string; // PText
    /**
     * 施法引导可以被打断
     */
    can_prepare_interrupt: boolean; // PBool
    /**
     * 玩家属性消耗
     */
    player_props_cost: any[]; // PResList
    /**
     * 可以缓存
     */
    can_cache: boolean; // PBool
    /**
     * 名称
     */
    name: string; // PLocalizeText
    /**
     * 技能消耗
     */
    ability_cost: string[]; // PAbilityFormula
    /**
     * 采集动画
     */
    collection_animation: string; // PText
    /**
     * 击中音效
     */
    hit_sound_effect: any[]; // PList
    /**
     * 技能释放类型
     */
    ability_cast_type: any; // PEnum
    /**
     * 自动施法
     */
    is_autocast: boolean; // PBool
    /**
     * 充能时间
     */
    ability_stack_cd: string[]; // PAbilityFormula
    /**
     * 结束音效
     */
    end_sound_effect: any[]; // PList
    /**
     * 前置条件
     * 训练、购买、建造该单位的前置条件
     */
    precondition_list: any[]; // PreconditionList
    /**
     * 生物
     */
    type_priority_creature: number; // PInt
    /**
     * 可以超出范围施法
     */
    release_immediately_out_of_range: boolean; // PBool
    /**
     * 技能伤害值
     */
    ability_damage: string[]; // PAbilityFormula
    /**
     * 角度
     */
    sector_angle: string[]; // PAbilityFormula
    /**
     * 是否转身
     */
    need_turn_to_target: boolean; // PBool
    /**
     * 攻击范围预览
     */
    show_building_attack_range: boolean; // PBool
    /**
     * 建造方式
     */
    ability_build_subtype: any; // PEnum
    /**
     * 显示准备倒计时
     */
    sp_count_down: boolean; // PBool
    /**
     * 冷却时间
     */
    cold_down_time: string[]; // PAbilityFormula
    /**
     * 圆形半径
     */
    circle_radius: string[]; // PAbilityFormula
    /**
     * 是否为蓄力技能
     */
    is_charge_ability: boolean; // PBool
    /**
     * 建造单位
     */
    build_list: any[]; // PExplorerList
    /**
     * 前摇音效
     */
    ps_sound_effect: any[]; // PList
    /**
     * 结束特效
     */
    end_sfx_list: any[]; // PList
    /**
     * 后摇特效
     */
    bs_sfx_list: any[]; // PList
    /**
     * 循环播放动画
     */
    collection_animation_loop: boolean; // PBool
    /**
     * 建筑
     */
    type_priority_building: number; // PInt
    /**
     * 己方
     */
    camp_priority_self: number; // PInt
    /**
     * 建造角度
     */
    build_rotate: number; // PFloat
    /**
     * 特殊筛选
     */
    target_attribute: any; // PCheckBoxBit
    /**
     * 攻击命令触发自动施法
     */
    can_autocast_when_attack_target: boolean; // PBool
    /**
     * 扇形半径
     */
    sector_radius: string[]; // PAbilityFormula
    /**
     * 物品标签要求
     */
    filter_item_tags: any; // PTags
    /**
     * 描述
     */
    description: string; // PLocalizeText
    /**
     * 单位排除标签
     */
    forbid_unit_tags: any; // PTags
    /**
     * 单位标签要求
     */
    filter_unit_tags: any; // PTags
    /**
     * 准备音效
     */
    sp_sound_effect: any[]; // PList
    /**
     * 施法特效
     */
    cst_sfx_list: any[]; // PList
    /**
     * 图标
     */
    ability_icon: any; // PResource
    /**
     * 施法音效
     */
    cst_sound_effect: any[]; // PList
    /**
     * 技能受冷却影响
     */
    influenced_by_cd_reduce: boolean; // PBool
    /**
     * 类型
     */
    filter_condition_type: any; // PCheckBoxBit
    /**
     * 标签
     */
    tags: any[]; // PList
    /**
     * 释放范围
     */
    ability_cast_range: string[]; // PAbilityFormula
    /**
     * 施法打断范围
     */
    ability_break_cast_range: string[]; // PAbilityFormula
    /**
     * 中立
     */
    camp_priority_neutral: number; // PInt
    /**
     * 允许学习等级
     */
    required_level: any; // PRequiredLevel
    /**
     * 指示器类型
     */
    sight_type: any; // PEnum
    /**
     * 施法完成
     */
    ability_bw_point: number; // PFloat
    /**
     * 技能影响范围
     */
    ability_damage_range: string[]; // PAbilityFormula
    /**
     * 最大充能数
     */
    ability_max_stack_count: string[]; // PAbilityFormula
    /**
     * 采集获得量
     */
    pick_count: number; // PInt
    /**
     * 技能可以打断其他技能
     */
    can_interrupt_others: boolean; // PBool
    /**
     * 施法开始
     */
    ability_cast_point: number; // PFloat
    /**
     * 施法出手
     */
    ability_channel_time: number; // PFloat
    /**
     * 技能最大等级
     */
    ability_max_level: number; // PInt
    /**
     * 施法出手可以被打断
     */
    can_cast_interrupt: boolean; // PBool
    /**
     * 队友
     */
    camp_priority_friend: number; // PInt
    /**
     * 编辑技能效果
     */
    art_resource_btn: any; // PButton
    /**
     * 后摇音效
     */
    bs_sound_effect: any[]; // PList
}
