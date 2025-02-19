export interface DestructibleData {
    /**
     * UID
     */
    uid: string; // PText
    /**
     * 小地图 - 显示
     */
    show_on_mini_map: boolean; // PBool
    /**
     * 资源名称
     */
    source_desc: string; // PLocalizeText
    /**
     * 模型缩放
     */
    body_size: number; // PFloat
    /**
     * 可被攻击
     */
    is_attacked: boolean; // PBool
    /**
     * 死亡时销毁
     */
    destroy_on_die: boolean; // PBool
    /**
     * 玩家属性资源
     */
    source_player_prop: any; // PEnum
    /**
     * 启用补光效果
     */
    use_virtual_light: boolean; // PBool
    /**
     * ID
     */
    key: number; // PInt
    /**
     * 生命值
     */
    hp_max: number; // PFloat
    /**
     * 图标
     */
    icon: any; // PResource
    /**
     * 资源初始数量
     */
    source_nums_init: number; // PInt
    /**
     * 持续特效列表
     */
    effect_list: any; // PAst
    /**
     * 声音事件列表
     */
    sound_event_list: any[]; // PSoundList
    /**
     * 接收贴花
     */
    receive_decal: boolean; // PBool
    /**
     * 菲涅尔强度
     */
    fresnel_emissive_color_strength: number; // PFloat
    /**
     * 资源类型
     */
    source_type: any; // PEnum
    /**
     * 是否可通行
     */
    passable: boolean; // PBool
    /**
     * nil
     */
    dead_height_box_data: string; // PText
    /**
     * 资源回复间隔
     */
    source_refresh_interval: number; // PFloat
    /**
     * 遮挡透视
     */
    enable_occlusion_perspective: boolean; // PBool
    /**
     * 启用菲涅尔效果
     */
    use_fresnel: boolean; // PBool
    /**
     * 材质颜色叠加类型
     */
    base_color_mod: any; // PEnum
    /**
     * 玩家自定义
     */
    kv: any; // PAst
    /**
     * 死亡特效列表
     */
    die_effect_list: any; // PAst
    /**
     * 描述
     */
    description: string; // PLocalizeText
    /**
     * 不透明度
     */
    material_alpha: number; // PFloat
    /**
     * 菲涅尔指数
     */
    fresnel_exp: number; // PFloat
    /**
     * 基础材质变色
     */
    base_tint_color: any; // PColor
    /**
     * 物品类型
     */
    source_item: any; // PSingleSelectExplorer
    /**
     * 小地图 - 颜色
     */
    mini_map_color: any; // PAst
    /**
     * 可被采集
     */
    is_collected: boolean; // PBool
    /**
     * 材质变色强度
     */
    material_color_intensity: number; // PFloat
    /**
     * 基础材质变色
     */
    material_color: any; // PAst
    /**
     * 物品标签
     */
    tags: any[]; // PList
    /**
     * 菲涅尔颜色
     */
    fresnel_color: any; // PAst
    /**
     * 可被选中
     */
    is_selected: boolean; // PBool
    /**
     * 默认角度
     */
    collision_points_dead: any; // PAst
    /**
     * 可被作为技能目标
     */
    is_ability_target: boolean; // PBool
    /**
     * 资源回复数量
     */
    source_refresh_count: number; // PInt
    /**
     * 模型
     */
    model: any; // PResource
    /**
     * 默认角度
     */
    collision_points_alive: any; // PAst
    /**
     * 资源最大数量
     */
    source_nums_max: number; // PInt
    /**
     * 编辑器后缀
     */
    suffix: string; // PText
    /**
     * 模型不透明度
     */
    model_opacity: number; // PFloat
    /**
     * 死亡销毁延迟
     */
    destroy_delay: number; // PFloat
    /**
     * 名称
     */
    name: string; // PLocalizeText
    /**
     * 资源耗尽时死亡
     */
    die_on_source_run_out: boolean; // PBool
    /**
     * nil
     */
    alive_height_box_data: string; // PText
    /**
     * 是否启用基础材质变色
     */
    use_base_tint_color: boolean; // PBool
    /**
     * 材质变化
     */
    material_change: any; // PEnum
    /**
     * 默认角度
     */
    collision_box: any; // PAst
}
