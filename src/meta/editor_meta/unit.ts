export interface UnitData {
    /**
     * 躲避率(%)
     *
     * 单位躲避其他单位普通攻击的概率
     */
    dodge_rate: number; // PFloat
    /**
     * 普攻类型
     */
    common_atk_type: any; // PEnum
    /**
     * 模型缩放
     *
     * 对当前物体模型的缩放倍数，用于调整模型大小。
     */
    body_size: number; // PFloat
    /**
     * 法术穿透
     *
     * 穿透敌人法术防御力。先计算固定穿透，再计算百分比穿透
     */
    pene_mag: number; // PFloat
    /**
     * 智力
     *
     * 智力
     */
    intelligence_grow: number; // PFloat
    /**
     * 小地图头像缩放
     *
     * 单位在小地图上的头像的缩放
     */
    mini_map_icon_scale: number; // PFloat
    /**
     * x轴缩放
     */
    billboard_scale_x: number; // PFloat
    /**
     * 法术穿透
     *
     * 穿透敌人法术防御力。先计算固定穿透，再计算百分比穿透
     */
    pene_mag_grow: number; // PFloat
    /**
     * 默认行为
     *
     * 单位默认状态下会执行的行为
     */
    default_behaviour_type: any; // PEnum
    /**
     * 头像
     *
     * 单位在游戏中显示的头像
     */
    icon: any; // PResource
    /**
     * 开启对象池
     */
    poolable: boolean; // PBool
    /**
     * 初始库存
     *
     * 单位作为商品的初始库存
     */
    init_stock: number; // PInt
    /**
     * 隐藏技能
     *
     * 隐藏技能，放在这类技能位中的技能将不会被显示在游戏中。
     */
    passive_ability_list: any[]; // PExplorerList
    /**
     * 转身速度
     *
     * 单位的转身速度
     */
    rotate_speed: number; // PFloat
    /**
     * 敏捷
     *
     * 敏捷
     */
    agility_grow: number; // PFloat
    /**
     * 商店范围
     */
    shop_range: number; // PFloat
    /**
     * 移动类型
     *
     * 影响可用的可移动通道。
     */
    move_type: any; // PCheckBoxBit
    /**
     * 物理防御力
     *
     * 单位的物理防御力
     */
    defense_phy_grow: number; // PFloat
    /**
     * 法术攻击力
     *
     * 单位的法术攻击力
     */
    attack_mag_grow: number; // PFloat
    /**
     * 技能资源恢复
     *
     * 单位的每秒技能资源恢复数值
     */
    mp_rec_grow: number; // PFloat
    /**
     * 菲涅尔指数
     */
    fresnel_exp: number; // PFloat
    /**
     * 转向时移动速度系数
     *
     * 当单位转向时，移动速度会受到一定的影响。
     */
    speed_ratio_in_turn: number; // PFloat
    /**
     * 英雄技能
     *
     * 单位的英雄技能，可以通过学习升级，每次学习需要消耗一个技能点（升级时获取）。在默认UI界面中，会显示在后6个技能栏内，超出的不显示但依然生效。
     */
    hero_ability_list: any[]; // PExplorerList
    /**
     * 暴击伤害(%)
     *
     * 发生暴击时，造成的暴击伤害倍数
     */
    critical_dmg_grow: number; // PFloat
    /**
     * 头顶名称显示方式
     *
     * 影响游戏内物体上方的文本显示内容。
     */
    bar_show_name: any; // PEnum
    /**
     * 生命恢复
     *
     * 单位的每秒生命恢复数值
     */
    hp_rec_grow: number; // PFloat
    /**
     * 最大生命值
     *
     * 单位的最大生命值
     */
    hp_max_grow: number; // PFloat
    /**
     * 单位状态
     *
     * 进入游戏时,为单位附加的初始状态
状态会记录层数，初始为1层。每次添加/移除状态会增加/减少一层。
     */
    ori_bits: any; // PCheckBoxBit
    /**
     * 启用圆盘阴影
     */
    is_open_disk_shadow: boolean; // PBool
    /**
     * 可研发科技
     *
     * 这些科技，可以在单位身上研发、升级。
     */
    research_techs: any[]; // PExplorerList
    /**
     * 开启面向移动模式
     */
    enable_strict_facing_mode: boolean; // PBool
    /**
     * 最大技能资源
     *
     * 单位的最大技能资源
     */
    mp_max_grow: number; // PFloat
    /**
     * 主属性
     *
     * 英雄单位的主要属性，一般主属性的提升会对英雄有额外加成
     */
    main_attr: any; // PEnum
    /**
     * 物理穿透
     *
     * 穿透敌人物理防御力。先计算固定穿透，再计算百分比穿透
     */
    pene_phy_grow: number; // PFloat
    /**
     * 尸体消失时间
     *
     * 尸体消失时间
     */
    keep_dead_body_time: number; // PFloat
    /**
     * 法术攻击力
     *
     * 单位的法术攻击力
     */
    attack_mag: number; // PFloat
    /**
     * 出售列表
     *
     * 单位作为商店时的出售列表
     */
    sell_list: any; // PAst
    /**
     * 生命恢复
     *
     * 单位的每秒生命恢复数值
     */
    hp_rec: number; // PFloat
    /**
     * 技能资源条颜色
     *
     * 该单位用来释放技能的能量的颜色
     */
    mp_color: any; // PEnum
    /**
     * 技能资源恢复
     *
     * 单位的每秒技能资源恢复数值
     */
    mp_rec: number; // PFloat
    /**
     * 求救距离
     */
    rescue_seeker_distance: number; // PFloat
    /**
     * nil
     */
    vision_sector_rng_grow: number; // PFloat
    /**
     * 伤害减免(%)
     *
     * 百分比降低受到的伤害
     */
    dmg_reduction: number; // PFloat
    /**
     * 移动速度
     *
     * 单位每秒移动的距离。
     */
    ori_speed: number; // PFloat
    /**
     * 购买开始时间
     *
     * 单位作为商品的可购买时间(游戏开始多久后可以购买）
     */
    start_rft: number; // PFloat
    /**
     * 悬浮信息显示
     *
     * 开启后鼠标悬浮到单位身上时会显示单位名称和等级的文本框
     */
    show_y3_extra_info: boolean; // PBool
    /**
     * 移动速度
     *
     * 单位每秒移动的距离。
     */
    ori_speed_grow: number; // PFloat
    /**
     * 特殊状态
     *
     * 特殊状态下会播放的动画
     */
    special_idle_anim: string; // PText
    /**
     * 物理穿透(%)
     *
     * 百分比穿透敌人物理防御力。先计算固定穿透，再计算百分比穿透
     */
    pene_phy_ratio: number; // PFloat
    /**
     * 防御类型
     *
     * 单位的护甲类型，具体效果可在游戏规则中查看
     */
    armor_type: any; // PEnum
    /**
     * 是否在小地图显示
     *
     * 单位是否会在小地图上显示出来
     */
    is_mini_map_show: boolean; // PBool
    /**
     * 简易普攻
     */
    simple_common_atk: any; // PAst
    /**
     * 物理攻击力
     *
     * 单位的物理攻击力
     */
    attack_phy: number; // PFloat
    /**
     * 攻击间隔
     */
    attack_interval_grow: number; // PFloat
    /**
     * 是否预览血条
     */
    need_preview_billboard: boolean; // PBool
    /**
     * 被治疗效果提升(%)
     *
     * 提高接受治疗时受到的治疗效果
     */
    heal_effect_grow: number; // PFloat
    /**
     * 所有伤害加成(%)
     *
     * 百分比提高造成的伤害
     */
    extra_dmg: number; // PFloat
    /**
     * 警戒范围(AI)
     *
     * 单位的警戒范围(AI)
     */
    alarm_range: number; // PFloat
    /**
     * 出售获得资源
     *
     * 单位作为商品的出售获得资源
     */
    sell_res_list: any[]; // PResList
    /**
     * 是否开启透视
     */
    is_open_Xray: boolean; // PBool
    /**
     * 敏捷
     *
     * 敏捷
     */
    agility: number; // PFloat
    /**
     * 小地图头像
     *
     * 单位在小地图上的头像
     */
    mini_map_icon: any; // PResource
    /**
     * y轴缩放
     */
    billboard_scale_y: number; // PFloat
    /**
     * 物理主控行走速度
     */
    cc_walk_speed: number; // PFloat
    /**
     * 死亡
     *
     * 死亡状态下会播放的动画
     */
    die_anim: string; // PText
    /**
     * 标签
     *
     * 用于对物体的分类处理。为单位贴上标签后可以对其进行更方便的关系，例如编写游戏逻辑：杀死所有拥有XX标签的单位
     */
    tags: any[]; // PList
    /**
     * nil
     */
    height_offset: number; // PFloat
    /**
     * 被治疗效果提升(%)
     *
     * 提高接受治疗时受到的治疗效果
     */
    healing_effect_grow: number; // PFloat
    /**
     * 视野类型
     *
     * 单位与战争迷雾相关的一些属性
     */
    view_type: any; // PEnum
    /**
     * 物理主控跳跃高度
     */
    cc_jump_height: number; // PFloat
    /**
     * 暴击伤害(%)
     *
     * 发生暴击时，造成的暴击伤害倍数
     */
    critical_dmg: number; // PFloat
    /**
     * 默认状态
     *
     * 默认状态下会播放的动画
     */
    idle_anim: string; // PText
    /**
     * 圆盘阴影大小
     */
    disk_shadow_size: number; // PFloat
    /**
     * 物理攻击力
     *
     * 单位的物理攻击力
     */
    attack_phy_grow: number; // PFloat
    /**
     * 描述
     *
     * 单位的介绍说明，用在编辑器内和游戏内的Tips显示上
     */
    description: string; // PLocalizeText
    /**
     * 动态碰撞半径
     */
    collision_radius_2: number; // PFloat
    /**
     * 血条样式
     *
     * 该单位在游戏内的血条样式
     */
    blood_bar: any; // PEnum
    /**
     * 单位血条高度偏移
     */
    billboard_height_offset: number; // PFloat
    /**
     * 物理
     */
    physics_composite: any; // PropertyDict
    /**
     * 是否开启描边
     */
    is_open_outline_pass: boolean; // PBool
    /**
     * 死亡后是否销毁单位
     *
     * 死亡后是否会把单位完全销毁。（会在尸体消失时间结束后进行销毁，销毁后将无法再获取单位相关信息）
     */
    destroy_after_die: boolean; // PBool
    /**
     * 菲涅尔颜色
     */
    fresnel_color: any; // PAst
    /**
     * 启用菲涅尔效果
     */
    use_fresnel: boolean; // PBool
    /**
     * 最大技能资源
     *
     * 单位的最大技能资源
     */
    mp_max: number; // PFloat
    /**
     * 法术防御力
     *
     * 单位的法术防御力
     */
    defense_mag_grow: number; // PFloat
    /**
     * 物理穿透(%)
     *
     * 百分比穿透敌人物理防御力。先计算固定穿透，再计算百分比穿透
     */
    pene_phy_ratio_grow: number; // PFloat
    /**
     * 是否应用玩家颜色光圈
     */
    is_apply_role_color: boolean; // PBool
    /**
     * 寻路碰撞额外范围
     */
    path_finding_external_size: number; // PInt
    /**
     * 碰撞格点
     */
    collision_points: any; // PAst
    /**
     * 扇形视野夜晚夹角
     *
     * 单位在夜晚拥有的扇形视野夹角。
     */
    vision_sector_angle_night: number; // PFloat
    /**
     * 玩家颜色缩放
     */
    role_color_scale: number; // PFloat
    /**
     * 单位状态列表
     */
    state_list: any[]; // PExplorerList
    /**
     * 使用简易小地图头像
     *
     * 简易小地图头像的表现为一个小点。简易小地图头像的绘制性能消耗相比普通小地图头像更小，如果地图上会出现大量的该类型单位，建议使用简易小地图头像。
     */
    use_simple_mini_map_icon: boolean; // PBool
    /**
     * 启用补光效果
     */
    use_virtual_light: boolean; // PBool
    /**
     * 攻击范围
     */
    attack_range_grow: number; // PFloat
    /**
     * ID
     *
     * 单位的唯一表示
     */
    key: number; // PInt
    /**
     * 最大生命值
     *
     * 单位的最大生命值
     */
    hp_max: number; // PFloat
    /**
     * 单位初始状态
     */
    state_init: any; // PEnum
    /**
     * 声音事件列表
     */
    sound_event_list: any[]; // PSoundList
    /**
     * 法术穿透(%)
     *
     * 百分比穿透敌人法术防御力。先计算固定穿透，再计算百分比穿透
     */
    pene_mag_ratio_grow: number; // PFloat
    /**
     * nil
     */
    is_x_offset: boolean; // PBool
    /**
     * 出售阵营参数
     */
    shop_camp_args: any; // PAst
    /**
     * 玩家自定义
     */
    kv: any; // PAst
    /**
     * 救援类型
     */
    rescuer_type: any; // PEnum
    /**
     * 法术吸血(%)
     *
     * 造成法术伤害后可以恢复自身生命值
     */
    vampire_mag: number; // PFloat
    /**
     * nil
     */
    width_offset: number; // PFloat
    /**
     * 物理主控跑步速度
     */
    cc_run_speed: number; // PFloat
    /**
     * 动画状态名
     */
    anim_state_name: string; // PText
    /**
     * 建造时忽略动态碰撞
     */
    build_ignore_dyn_collision: boolean; // PBool
    /**
     * 资源消耗
     *
     * 单位作为建筑时建造会消耗的资源
     */
    build_res_cost_list: any[]; // PList
    /**
     * 扇形视野白天夹角
     *
     * 单位在白天拥有的扇形视野夹角。
     */
    vision_sector_angle_day: number; // PFloat
    /**
     * 攻击速度(%)
     *
     * 攻击速度(倍数)
     */
    attack_speed_grow: number; // PFloat
    /**
     * 命中率(%)
     *
     * 单位普通攻击命中其他单位的概率
     */
    hit_rate: number; // PFloat
    /**
     * 真实视野
     *
     * 单位所能侦测到隐身单位的范围
     */
    vision_true: number; // PFloat
    /**
     * 是否敌友方显示不同头像
     */
    separate_enemy_icon: boolean; // PBool
    /**
     * 物理吸血(%)
     *
     * 造成物理伤害后可以恢复自身生命值
     */
    vampire_phy_grow: number; // PFloat
    /**
     * 应用科技
     *
     * 单位的可应用科技（会受到该科技的影响）
     */
    affect_techs: any[]; // PExplorerList
    /**
     * 真实视野
     *
     * 单位所能侦测到隐身单位的范围
     */
    vision_true_grow: number; // PFloat
    /**
     * 百分比生命恢复
     *
     * 单位的每秒生命恢复百分比数值
     */
    hp_rec_percent: number; // PFloat
    /**
     * 出售阵营类型
     */
    shop_sell_type: any; // PEnum
    /**
     * 物理穿透
     *
     * 穿透敌人物理防御力。先计算固定穿透，再计算百分比穿透
     */
    pene_phy: number; // PFloat
    /**
     * 命中率(%)
     *
     * 单位普通攻击命中其他单位的概率
     */
    hit_rate_grow: number; // PFloat
    /**
     * 商店
     */
    shop_edit: any; // PButton
    /**
     * 头顶名称字体
     *
     * 在单位头顶显示的文字字体
     */
    billboard_name_font: any; // PEnum
    /**
     * 可移动通道
     *
     * 对单位移动类型的补充，决定单位究竟是在哪些通道移动。任意通道被碰撞阻挡该单位均无法通过。
     */
    move_limitation: any; // PCheckBoxBit
    /**
     * 是否做为商店
     *
     * 开启后单位可以作为商店编辑出售的物品
     */
    is_shop: boolean; // PBool
    /**
     * 悬浮信息显示内容
     */
    y3_extra_info_show_type: any; // PEnum
    /**
     * 单位分类
     *
     * 单位类型决定了这类单位的一些特性，包括其可编辑的属性和某些属性的默认值。
     */
    type: any; // PEnum
    /**
     * 是否有技能资源条
     *
     * 该单位是否有可以用来释放技能的能量
     */
    has_mp: boolean; // PBool
    /**
     * 购买所需资源
     *
     * 单位作为商品的购买所需资源
     */
    buy_res_list: any[]; // PResList
    /**
     * 攻击范围
     */
    attack_range: number; // PFloat
    /**
     * 库存恢复间隔
     *
     * 单位作为商品的库存恢复间隔
     */
    refresh_interval: number; // PFloat
    /**
     * 夜晚视野
     *
     * 单位在夜晚可以看到（驱散战争迷雾）的范围
     */
    vision_night: number; // PFloat
    /**
     * 物品栏
     *
     * 单位的物品栏格数
     */
    bar_slot_size: number; // PInt
    /**
     * 编辑简易普攻
     */
    jump_to_display: any; // PButton
    /**
     * 通用技能
     *
     * 单位的通用技能。在默认UI界面中，会显示在前6个技能栏内，超出的不显示但依然生效。
     */
    common_ability_list: any[]; // PExplorerList
    /**
     * 普通攻击
     *
     * 单位的普通攻击，唯一，单位对目标普通攻击时释放的技能
     */
    common_atk: any; // PSingleSelectExplorer
    /**
     * 允许移动的角度差
     *
     * 当单位转向时，如果转向角度小于该值，则会直接朝目标方向移动；反之会边转向，边移动。
     */
    angle_tolerance: number; // PFloat
    /**
     * 编辑器后缀
     *
     * 给使用编辑器的用户看的备注，无实际作用
     */
    suffix: string; // PText
    /**
     * 静态碰撞跟随面向
     *
     * 仅对建筑类型单位生效。勾选时，单位改变朝向时会使静态碰撞跟随旋转。
     */
    collision_box_turning_enable: boolean; // PBool
    /**
     * 移动类型
     *
     * 单位的移动类型，决定单位究竟是在地面移动还是在空中移动。
     */
    move_channel: any; // PEnum
    /**
     * 掉落物品
     *
     * 单位死亡后会掉落的物品
     */
    drop_items_tuple: any[]; // PExplorerList
    /**
     * 是否显示血条刻度
     *
     * 单位血条上是否会出现刻度线
     */
    bar_show_scale: boolean; // PBool
    /**
     * 攻击类型
     *
     * 单位的攻击类型，具体效果可在游戏规则中查看
     */
    attack_type: any; // PEnum
    /**
     * 求救类型
     */
    rescue_seeker_type: any; // PEnum
    /**
     * 取消警戒范围(AI)
     *
     * 单位的取消警戒范围(AI)，敌方离开取消警戒范围后会不再主动攻击敌方
     */
    cancel_alarm_range: number; // PFloat
    /**
     * 背包栏
     *
     * 单位的背包栏格数
     */
    pkg_slot_size: number; // PInt
    /**
     * 法术防御力
     *
     * 单位的法术防御力
     */
    defense_mag: number; // PFloat
    /**
     * UID
     */
    uid: string; // PText
    /**
     * 防御塔仇恨持续时间
     */
    tower_hatred_duration: number; // PFloat
    /**
     * 开启物品背包栏
     */
    enable_item_slots: boolean; // PBool
    /**
     * 所有伤害加成(%)
     *
     * 百分比提高造成的伤害
     */
    extra_dmg_grow: number; // PFloat
    /**
     * 暴击率(%)
     *
     * 单位普通攻击有概率造成额外伤害
     */
    critical_chance: number; // PFloat
    /**
     * 经验
     *
     * 单位被敌方击杀后，敌方可获得的经验
     */
    reward_exp: number; // PInt
    /**
     * 预览血量
     */
    preview_billboard_health_value: number; // PFloat
    /**
     * 最大平衡角度
     */
    max_balance_angle: number; // PFloat
    /**
     * 离地高度
     *
     * 单位的离地高度
     */
    model_height: number; // PFloat
    /**
     * 救援后返回
     */
    rescue_finish_return: boolean; // PBool
    /**
     * 百分比生命恢复
     *
     * 单位的每秒生命恢复百分比数值
     */
    hp_rec_percent_grow: number; // PFloat
    /**
     * 移动动画播放速率系数
     *
     * 单位移动时动画的播放速度
     */
    standard_walk_rate: number; // PFloat
    /**
     * nil
     */
    vision_sector_angle_night_grow: number; // PFloat
    /**
     * 前置条件
     *
     * 训练、购买、建造该单位的前置条件
     */
    precondition_list: any[]; // PreconditionList
    /**
     * 白天视野
     *
     * 单位在白天可以看到（驱散战争迷雾）的范围
     */
    vision_rng_grow: number; // PFloat
    /**
     * 攻击间隔
     */
    attack_interval: number; // PFloat
    /**
     * 描边色值（RGB）
     */
    outline_pass_color: any; // PVector3
    /**
     * nil
     */
    vision_sector_angle_day_grow: number; // PFloat
    /**
     * 力量
     *
     * 力量
     */
    strength: number; // PFloat
    /**
     * nil
     */
    vision_sector_night_grow: number; // PFloat
    /**
     * 夜晚视野
     *
     * 单位在夜晚可以看到（驱散战争迷雾）的范围
     */
    vision_night_grow: number; // PFloat
    /**
     * 白天视野
     *
     * 单位在白天可以看到（驱散战争迷雾）的范围
     */
    vision_rng: number; // PFloat
    /**
     * 寻路碰撞网格边长
     *
     * 碰撞动态半径，每50为1个标准格。
     */
    dynamic_collision_r: number; // PFloat
    /**
     * 暴击率(%)
     *
     * 单位普通攻击有概率造成额外伤害
     */
    critical_chance_grow: number; // PFloat
    /**
     * nil
     */
    is_z_offset: boolean; // PBool
    /**
     * 菲涅尔强度
     */
    fresnel_emissive_color_strength: number; // PFloat
    /**
     * 冷却缩减(%)
     *
     * 单位技能进入cd时减少部分冷却时间
     */
    cd_reduce_grow: number; // PFloat
    /**
     * 物理防御力
     *
     * 单位的物理防御力
     */
    defense_phy: number; // PFloat
    /**
     * 等级
     *
     * 单位的默认等级
     */
    level: number; // PInt
    /**
     * 血条显示模式
     *
     * 该单位在游戏内的血条的显示时机
     */
    blood_show_type: any; // PEnum
    /**
     * 模型不透明度
     */
    model_opacity: number; // PFloat
    /**
     * 基础材质变色
     */
    base_tint_color: any; // PAst
    /**
     * 强制显示在小地图
     *
     * 勾选后单位将强制显示在小地图上，无视战争阴影
     */
    force_show_on_mini_map: boolean; // PBool
    /**
     * 材质颜色叠加类型
     */
    base_color_mod: any; // PEnum
    /**
     * 被治疗效果加成(%)
     *
     * 提高接受治疗时受到的治疗效果
     */
    heal_effect: number; // PFloat
    /**
     * 建造时间（秒）
     */
    build_time: number; // PInt
    /**
     * 伤害减免(%)
     *
     * 百分比降低受到的伤害
     */
    dmg_reduction_grow: number; // PFloat
    /**
     * 技能资源名称
     *
     * 该单位用来释放技能的能量的名称
     */
    mp_key: string; // PText
    /**
     * 冷却缩减(%)
     *
     * 单位技能进入cd时减少部分冷却时间
     */
    cd_reduce: number; // PFloat
    /**
     * 无法移动时仍然保持目标
     *
     * 该字段未勾选时，在目标移动出自身的警戒范围后，且自身不能移动时，会立即开始寻找一个新的攻击目标。多用于定点守卫。
     */
    keep_target: boolean; // PBool
    /**
     * 名称
     *
     * 当前单位的名称
     */
    name: string; // PLocalizeText
    /**
     * 无法反击时会逃跑
     *
     * 当单位受到伤害且自身无法反击时，会向伤害来源的相反方向移动一段距离，仅在警戒状态下生效
     */
    can_flee: boolean; // PBool
    /**
     * 物理主控加速速率
     */
    cc_move_acc_rate: number; // PFloat
    /**
     * 物理主控加速度
     */
    cc_move_acc: number; // PFloat
    /**
     * 行走
     *
     * 行走状态下会播放的动作
     */
    walk_anim: string; // PText
    /**
     * 描边厚度
     */
    outline_pass_width: number; // PFloat
    /**
     * 求救间隔
     */
    rescue_seeker_interval: number; // PFloat
    /**
     * 敌方小地图头像
     */
    enemy_mini_map_icon: any; // PResource
    /**
     * 力量
     *
     * 力量
     */
    strength_grow: number; // PFloat
    /**
     * 物理吸血(%)
     *
     * 造成物理伤害后可以恢复自身生命值
     */
    vampire_phy: number; // PFloat
    /**
     * 攻击速度(%)
     *
     * 单位的攻击速度百分比，局内显示的实际攻速为:1/单位当前普通攻击技能冷却时间*攻击速度
     */
    attack_speed: number; // PFloat
    /**
     * 扇形视野夜晚半径
     *
     * 单位在夜晚拥有的扇形视野半径。
     */
    vision_sector_night: number; // PFloat
    /**
     * 被治疗效果加成(%)
     *
     * 提高接受治疗时受到的治疗效果
     */
    healing_effect: number; // PFloat
    /**
     * 模型
     *
     * 当前单位所使用的的模型
     */
    model: any; // PResource
    /**
     * 智力
     *
     * 智力
     */
    intelligence: number; // PFloat
    /**
     * 法术吸血(%)
     *
     * 造成法术伤害后可以恢复自身生命值
     */
    vampire_mag_grow: number; // PFloat
    /**
     * 最大库存
     *
     * 单位作为商品的最大库存
     */
    max_stock: number; // PInt
    /**
     * 扇形视野白天半径
     *
     * 单位在白天拥有的扇形视野半径。
     */
    vision_sector_rng: number; // PFloat
    /**
     * 允许反击范围
     */
    counterattack_range: number; // PFloat
    /**
     * 躲避率(%)
     *
     * 单位躲避其他单位普通攻击的概率
     */
    dodge_rate_grow: number; // PFloat
    /**
     * 是否启用基础材质变色
     */
    use_base_tint_color: boolean; // PBool
    /**
     * 升级列表
     */
    build_upgrade_list: any[]; // PExplorerList
    /**
     * 法术穿透(%)
     *
     * 百分比穿透敌人法术防御力。先计算固定穿透，再计算百分比穿透
     */
    pene_mag_ratio: number; // PFloat
}
