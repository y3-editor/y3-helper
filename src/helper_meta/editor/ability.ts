export interface AbilityData {
    /**
     * 技能阶段配置
     */
    ability_stage_config: any; // PEnum
    /**
     * 物品
     *
     * 类别值越小，优先级越高，如果类别值相同，则距离近优先。
     */
    type_priority_item: number; // PInt
    /**
     * 目标角度
     */
    target_sector_angle: string[]; // PAbilityFormula
    /**
     * 过渡时间
     */
    transition_duration: number; // PFloat
    /**
     * 敌人
     *
     * 阵营值越小，优先级越高，如果阵营值相同，则距离近优先。
     */
    camp_priority_enemy: number; // PInt
    /**
     * 可破坏物
     *
     * 类别值越小，优先级越高，如果类别值相同，则距离近优先。
     */
    type_priority_destructible: number; // PInt
    /**
     * ID
     *
     * 技能的ID
     */
    key: number; // PInt
    /**
     * 近战
     *
     * 开启时，标记这个技能造成的伤害为近战伤害
     */
    is_meele: boolean; // PBool
    /**
     * 过渡起始时间
     */
    transition_start_time: number; // PFloat
    /**
     * 准备特效
     *
     * 技能执行到该阶段时，在自身处显示的特效，技能被打断后会立即停止该特效
     */
    sp_sfx_list: any[]; // PList
    /**
     * 摇杆指示器索敌范围
     */
    ability_joystick_check_range: number; // PFloat
    /**
     * 施法完成可以被打断
     *
     * 技能施法完成阶段能否被其他技能或者移动打断
     */
    can_bs_interrupt: boolean; // PBool
    /**
     * 连续施法
     *
     * 是否在采集完成后继续采集（仅在技能冷却时间为0时生效）
     */
    collection_continuously: boolean; // PBool
    /**
     * 立刻施法
     *
     * 释放这个技能是否需要施法过程，开启时可以在单位存活的任何时期发动该技能，即使被禁止施法也可以正常释放。
     */
    is_immediate: any; // PEnum
    /**
     * 宽度
     *
     * 箭头指示器的宽度
     */
    arrow_width: string[]; // PAbilityFormula
    /**
     * 目标扇形半径
     */
    target_sector_radius: string[]; // PAbilityFormula
    /**
     * 长度
     *
     * 箭头指示器的长度
     */
    arrow_length: string[]; // PAbilityFormula
    /**
     * 指示器类型
     */
    pointer_channel: any; // PEnum
    /**
     * 自定义特效选择
     */
    customized_pointer_sfx: any; // PResource
    /**
     * 生命值消耗
     *
     * 使用该技能时会消耗的生命值
     */
    ability_hp_cost: string[]; // PAbilityFormula
    /**
     * 自定义指示器特效
     */
    enable_customized_pointer_sfx: boolean; // PBool
    /**
     * 声音事件列表
     *
     * 可以设置触发指定事件时播放的声音
     */
    sound_event_list: any[]; // PSoundList
    /**
     * 玩家自定义
     */
    kv: any; // PAst
    /**
     * 自动拾取
     *
     * 当采集到的资源是物品时，是否自动将物品拾取。如果不自动拾取则物品会创建在地面。
     */
    auto_pick: boolean; // PBool
    /**
     * 受击特效
     *
     * 技能命中时，在命中目标处显示的特效
     */
    hit_sfx_list: any[]; // PList
    /**
     * 施法引导
     *
     * 施法引导时长
     */
    ability_prepare_time: number; // PFloat
    /**
     * 消耗生命是否致死
     *
     * 如果单位当前生命值不满足消耗时施放技能，则该项为true时单位会死亡，为false时会保留1点生命值
     */
    cost_hp_can_die: boolean; // PBool
    /**
     * 单位移动类型
     *
     * 技能索敌时只会搜索指定移动类型的单位
     */
    filter_condition_move_channel_type: any; // PEnum
    /**
     * 前摇特效
     *
     * 技能执行到该阶段时，在自身处显示的特效，技能被打断后会立即停止该特效
     */
    ps_sfx_list: any[]; // PList
    /**
     * 建筑
     *
     * 类别值越小，优先级越高，如果类别值相同，则距离近优先。
     */
    type_priority_building: number; // PInt
    /**
     * 攻击范围预览特效
     *
     * 攻击范围预览的特效，大小参考ID为101492的特效资源
     */
    building_attack_range_sfx: any; // PResource
    /**
     * 采集动画
     *
     * 使用采集技能时会播放的动画。会在技能施法开始时播放，施法停止时停止。
     */
    collection_animation: string; // PText
    /**
     * 可破坏物标签要求
     *
     * 技能索敌时只会搜索带有指定标签的可破坏物
     */
    collection_destructible_tags: any; // PTags
    /**
     * 击中音效
     *
     * 技能命中时，会在命中者处播放的音效内容
     */
    hit_sound_effect: any[]; // PList
    /**
     * 结束音效
     *
     * 技能执行到该阶段时，在自身处播放的音效内容，技能被打断后会立即停止该音效
     */
    end_sound_effect: any[]; // PList
    /**
     * 编辑器后缀
     *
     * 只在编辑器中使用，用于区分相同名字的物品。并不会影响到游戏内的显示内容
     */
    suffix: string; // PText
    /**
     * 施法开始可以被打断
     *
     * 技能施法开始阶段能否被其他技能或者移动打断
     */
    can_ps_interrupt: boolean; // PBool
    /**
     * 目标圆形半径
     */
    target_circle_radius: string[]; // PAbilityFormula
    /**
     * 移动会对技能产生影响
     *
     * 勾选后移动会尝试打断当前技能，不勾选则可以实现移动施法
     */
    influenced_by_move: boolean; // PBool
    /**
     * 名称
     *
     * 当前技能的名称
     */
    name: string; // PLocalizeText
    /**
     * 生命不足能否施放
     *
     * 如果单位当前生命值不满足消耗时，能否施放技能
     */
    can_cast_when_hp_insufficient: boolean; // PBool
    /**
     * 前摇音效
     *
     * 技能执行到该阶段时，在自身处播放的音效内容，技能被打断后会立即停止该音效
     */
    ps_sound_effect: any[]; // PList
    /**
     * 英雄
     *
     * 类别值越小，优先级越高，如果类别值相同，则距离近优先。
     */
    type_priority_hero: number; // PInt
    /**
     * 结束特效
     *
     * 技能执行到该阶段时，在自身处显示的特效，技能被打断后会立即停止该特效
     */
    end_sfx_list: any[]; // PList
    /**
     * 消耗生命值施放
     *
     * 开启后可以配置消耗生命值相关的技能参数。如无需要请勿开启该配置，会增加系统消耗。
     */
    can_cost_hp: boolean; // PBool
    /**
     * UID
     *
     * 技能的唯一id
     */
    uid: string; // PText
    /**
     * 施法引导可以被打断
     *
     * 技能施法引导阶段能否被其他技能或者移动打断
     */
    can_prepare_interrupt: boolean; // PBool
    /**
     * 玩家属性消耗
     *
     * 施放技能消耗的玩家属性，技能拥有者的玩家该属性不足时无法施放技能
     */
    player_props_cost: any[]; // PResList
    /**
     * 后摇特效
     *
     * 技能执行到该阶段时，在自身处显示的特效，技能被打断后会立即停止该特效
     */
    bs_sfx_list: any[]; // PList
    /**
     * 技能可以打断其他技能
     *
     * 释放该技能时候会尝试打断当前正在释放的技能
     */
    can_interrupt_others: boolean; // PBool
    /**
     * 技能消耗
     *
     * 释放技能消耗的MP(会根据单位自身的技能资源进行变化)数值
     */
    ability_cost: string[]; // PAbilityFormula
    /**
     * 施法出手
     *
     * 施法出手时长
     */
    ability_channel_time: number; // PFloat
    /**
     * 建造角度
     */
    build_rotate: number; // PFloat
    /**
     * 技能释放类型
     *
     * 技能的释放类型。
     */
    ability_cast_type: any; // PEnum
    /**
     * 自动施法
     *
     * 优先按照阵营选取目标，其次按类别，如果都相同，则距离近优先。
     */
    is_autocast: boolean; // PBool
    /**
     * 充能时间
     *
     * 每增加一层充能数所需的时间（单位为秒）
     */
    ability_stack_cd: string[]; // PAbilityFormula
    /**
     * 物品标签要求
     *
     * 技能索敌时只会搜索带有指定标签的物品
     */
    filter_item_tags: any; // PTags
    /**
     * 建造方式
     */
    ability_build_subtype: any; // PEnum
    /**
     * 前置条件
     *
     * 释放技能的前置条件
     */
    precondition_list: any[]; // PreconditionList
    /**
     * 可以超出范围施法
     *
     * 如果技能目标点超出施法范围，会在施法范围内离目标最近的点施放
     */
    release_immediately_out_of_range: boolean; // PBool
    /**
     * 技能伤害值
     *
     * 技能造成的伤害，可使用公式编辑，需在触发内引用才可生效
     */
    ability_damage: string[]; // PAbilityFormula
    /**
     * 魔法书技能
     *
     * 魔法书中存放的技能list
     */
    magicbook_list: any[]; // PList
    /**
     * 是否转身
     *
     * 开启时，技能释放后单位会自动转到技能释放的方向（转身速度为单位的转身速度）
     */
    need_turn_to_target: boolean; // PBool
    /**
     * 特殊筛选
     *
     * 配置技能索敌时的特殊筛选规则（如排除自己、允许无敌等）
     */
    target_attribute: any; // PCheckBoxBit
    /**
     * 角度
     *
     * 扇形指示器的角度
     */
    sector_angle: string[]; // PAbilityFormula
    /**
     * 显示准备倒计时
     *
     * 开启时，会根据技能的施法时间显示相应的进度条
     */
    sp_count_down: boolean; // PBool
    /**
     * 指示器可被阻挡
     */
    pointer_can_block: boolean; // PBool
    /**
     * 圆形半径
     *
     * 圆形指示器的半径
     */
    circle_radius: string[]; // PAbilityFormula
    /**
     * 是否为蓄力技能
     *
     * 蓄力技能专属，为true时，引导时间会作为蓄力技能一阶段的引导时间。【施法开始阶段需要配置为0】
     */
    is_charge_ability: boolean; // PBool
    /**
     * 建造单位
     *
     * 建造技能建造的单位类型
     */
    build_list: any[]; // PExplorerList
    /**
     * 单位排除标签
     *
     * 技能索敌时不会搜索带有指定标签的单位
     */
    forbid_unit_tags: any; // PTags
    /**
     * 单位标签要求
     *
     * 技能索敌时只会搜索带有指定标签的单位
     */
    filter_unit_tags: any; // PTags
    /**
     * 生物
     *
     * 类别值越小，优先级越高，如果类别值相同，则距离近优先。
     */
    type_priority_creature: number; // PInt
    /**
     * 循环播放动画
     *
     * 采集技能时播放的采集动画是否会循环播放。
     */
    collection_animation_loop: boolean; // PBool
    /**
     * 指示器类型
     *
     * 释放技能时的鼠标指示器的样式
     */
    sight_type: any; // PEnum
    /**
     * 施法完成
     *
     * 施法完成时长（也可以叫做技能后摇）
     */
    ability_bw_point: number; // PFloat
    /**
     * 己方
     *
     * 阵营值越小，优先级越高，如果阵营值相同，则距离近优先。
     */
    camp_priority_self: number; // PInt
    /**
     * 中立
     *
     * 阵营值越小，优先级越高，如果阵营值相同，则距离近优先。
     */
    camp_priority_neutral: number; // PInt
    /**
     * 攻击命令触发自动施法
     *
     * 勾选后攻击命令能触发自动施法。
     */
    can_autocast_when_attack_target: boolean; // PBool
    /**
     * 扇形半径
     *
     * 扇形指示器的边长
     */
    sector_radius: string[]; // PAbilityFormula
    /**
     * 队友
     *
     * 阵营值越小，优先级越高，如果阵营值相同，则距离近优先。
     */
    camp_priority_friend: number; // PInt
    /**
     * 施法开始
     *
     * 施法开始时长（也可以叫做技能前摇）
     */
    ability_cast_point: number; // PFloat
    /**
     * 阵营
     *
     * 按阵营选取目标。
     */
    filter_condition_camp: any; // PCheckBoxBit
    /**
     * 技能绑定动画轨
     */
    ability_timeline_resource: any; // PAnimResource
    /**
     * 准备音效
     *
     * 技能执行到该阶段时，在自身处播放的音效内容，技能被打断后会立即停止该音效
     */
    sp_sound_effect: any[]; // PList
    /**
     * 施法特效
     *
     * 技能执行到该阶段时，在自身处显示的特效，技能被打断后会立即停止该特效
     */
    cst_sfx_list: any[]; // PList
    /**
     * 目标长度
     */
    target_arrow_length: string[]; // PAbilityFormula
    /**
     * 施法音效
     *
     * 技能执行到该阶段时，在自身处播放的音效内容，技能被打断后会立即停止该音效
     */
    cst_sound_effect: any[]; // PList
    /**
     * 技能受冷却影响
     *
     * 技能受到单位属性中的冷却缩短的影响
     */
    influenced_by_cd_reduce: boolean; // PBool
    /**
     * 类型
     *
     * 按种类选取目标。
     */
    filter_condition_type: any; // PCheckBoxBit
    /**
     * 标签
     *
     * 用于对技能的分类处理。为技能贴上标签后可以对其进行更方便的关系，例如编写游戏逻辑：所有拥有XX标签的技能等级+1
     */
    tags: any[]; // PList
    /**
     * 释放范围
     *
     * 以角色为圆心，以该值为半径的圆形区域。是角色不需要移动即可释放技能的最远距离。
     */
    ability_cast_range: string[]; // PAbilityFormula
    /**
     * 目标宽度
     */
    target_arrow_width: string[]; // PAbilityFormula
    /**
     * 技能影响范围
     *
     * 当前技能的影响范围，
     */
    ability_damage_range: string[]; // PAbilityFormula
    /**
     * 描述
     *
     * 技能的介绍说明，用在编辑器内和游戏内的Tips显示上
     */
    description: string; // PLocalizeText
    /**
     * 可以缓存
     *
     * 开启时，被控制时，控制结束 依旧可以继续释放（例如被禁止施法时发布施放命令，禁止施法解除后就会自动施放出来）
     */
    can_cache: boolean; // PBool
    /**
     * 攻击范围预览
     *
     * 开启后，建造时的模型会附带攻击范围预览
     */
    show_building_attack_range: boolean; // PBool
    /**
     * 图标
     *
     * 技能的图标，会在编辑器和游戏的ui上显示
     */
    ability_icon: any; // PResource
    /**
     * 最大充能数
     *
     * 技能的最大充能数，必须满足充能数大于0且不在冷却状态才能施放该技能
     */
    ability_max_stack_count: string[]; // PAbilityFormula
    /**
     * 采集获得量
     *
     * 每次使用采集技能时获取到的资源数量。如果采集的是玩家属性，则获得对应的玩家属性值，如果采集的是物品，则获得对应数量的物品。
     */
    pick_count: number; // PInt
    /**
     * 施法打断范围
     *
     * 当技能施法开始或施法出手阶段结束时，如果与施法目标的距离超过该值，会打断技能释放。
     */
    ability_break_cast_range: string[]; // PAbilityFormula
    /**
     * 冷却时间
     *
     * 技能的冷却时间，释放一次技能后需要等待该时间才可继续释放（单位为秒）
     */
    cold_down_time: string[]; // PAbilityFormula
    /**
     * 允许学习等级
     *
     * 单位学习该技能所需要的等级
     */
    required_level: any; // PRequiredLevel
    /**
     * 技能最大等级
     *
     * 技能的等级上限
     */
    ability_max_level: number; // PInt
    /**
     * 施法出手可以被打断
     *
     * 技能施法出手阶段能否被其他技能或者移动打断
     */
    can_cast_interrupt: boolean; // PBool
    /**
     * 被阻挡类型
     */
    pointer_limitation: any; // PCheckBoxBit
    /**
     * 编辑技能效果
     */
    art_resource_btn: any; // PButton
    /**
     * 后摇音效
     */
    bs_sound_effect: any[]; // PList
}
