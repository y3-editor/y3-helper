export interface ItemData {
    /**
     * UID
     */
    uid: string; // PText
    /**
     * 未拾取时间到期消失
     *
     * 物品在地面上是否会自动销毁
     */
    delete_on_discard: boolean; // PBool
    /**
     * 尺寸
     *
     * 物品模型的缩放比例
     */
    body_size: number; // PFloat
    /**
     * 合成素材
     *
     * 合成这件物品所需要的材料，拥有所有合成原料后会自动合成该物品
     */
    compose_list: any[]; // PList
    /**
     * 菲涅尔强度
     */
    fresnel_emissive_color_strength: number; // PFloat
    /**
     * 声音事件列表
     *
     * 可以设置触发指定事件时播放的声音
     */
    sound_event_list: any[]; // PSoundList
    /**
     * 启用补光效果
     */
    use_virtual_light: boolean; // PBool
    /**
     * 菲涅尔颜色
     */
    fresnel_color: any; // PAst
    /**
     * 模型
     *
     * 物品掉落在地面的模型
     */
    model: any; // PResource
    /**
     * 生命值
     *
     * 物品的生命值，生命值归零则会被销毁
     */
    hp_max: number; // PFloat
    /**
     * 前置条件
     *
     * 只有满足对应条件之后物品才会在商店中可购买。
     */
    precondition_list: any[]; // PreconditionList
    /**
     * 默认充能数
     *
     * 物品创建后的初始充能层数
     */
    cur_charge: number; // PInt
    /**
     * 不透明度
     */
    material_alpha: number; // PFloat
    /**
     * 图标
     *
     * 物品的头像
     */
    icon: any; // PResource
    /**
     * 开启碰撞
     *
     * 开启后物品与物品之间会发生碰撞，可以防止物品堆叠在一起。碰撞范围设置在游戏规则-通用-物品碰撞范围中。
     */
    disable_overlapping: boolean; // PBool
    /**
     * 初始库存
     *
     * 物品作为商品时在商店中的初始可购买数
     */
    init_stock: number; // PInt
    /**
     * 材质变色强度
     */
    material_color_intensity: number; // PFloat
    /**
     * 特效列表
     */
    effect_list: any; // PAst
    /**
     * 预览堆叠效果
     *
     * 勾选后可预览面板在进行平铺堆叠时效果
     */
    preview_name_stack: boolean; // PBool
    /**
     * 名称面板不遮挡
     *
     * 开启后，该物品的名称面板将不会与其他开启了该属性的物品的名称面板重叠。
     */
    name_not_occlusion: boolean; // PBool
    /**
     * 堆叠类型
     *
     * 物品的堆叠或者充能逻辑。
     */
    stack_type: any; // PEnum
    /**
     * 点击名称面板拾取
     *
     * 开启后，该物品的名字面板可以响应点击，点击后触发拾取道具逻辑。
     */
    click_name_pick_up: boolean; // PBool
    /**
     * 库存恢复间隔
     *
     * 当前物品作为商品时，商店库存增加的间隔时间
     */
    refresh_interval: number; // PFloat
    /**
     * 预览面板判定区域
     *
     * 勾选后可预览面板在进行点击判定和堆叠时的区域大小
     */
    preview_name_click_range: boolean; // PBool
    /**
     * 启用菲涅尔效果
     */
    use_fresnel: boolean; // PBool
    /**
     * 消失时间
     *
     * 掉落在地面上的消失时间
     */
    drop_stay_time: number; // PFloat
    /**
     * 模型不透明度
     */
    model_opacity: number; // PFloat
    /**
     * 被动技能
     *
     * 携带该物品时会获得的被动技能
     */
    attached_passive_abilities: any[]; // PExplorerList
    /**
     * nil
     */
    name_offset_based_on_root: any; // PAst
    /**
     * 基础材质变色
     */
    base_tint_color: any; // PColor
    /**
     * 持有者死亡时掉落
     *
     * 物品是否会在携带者死亡时掉落地面
     */
    discard_when_dead: boolean; // PBool
    /**
     * 材质颜色叠加类型
     */
    base_color_mod: any; // PEnum
    /**
     * 可以遗弃
     *
     * 玩家是否可以将物品丢弃到地面
     */
    discard_enable: boolean; // PBool
    /**
     * 自动使用
     *
     * 勾选后获得该物品时会自动使用该物品，如果不满足该物品的主动技能消耗条件则无法拾取
     */
    auto_use: boolean; // PBool
    /**
     * 名称显示方式
     *
     * 鼠标悬浮到物品上时显示的名称样式
     */
    item_billboard_type: any; // PEnum
    /**
     * 菲涅尔指数
     */
    fresnel_exp: number; // PFloat
    /**
     * 玩家自定义
     */
    kv: any; // PAst
    /**
     * 出售获得资源
     *
     * 出售到商店时获得的资源
     */
    sell_res_list: any[]; // PResList
    /**
     * 购买所需资源
     *
     * 从商店里购买这件物品所需要的资源
     */
    buy_res_list: any[]; // PResList
    /**
     * 偏移
     */
    offset: any; // PAst
    /**
     * 可以被抵押
     *
     * 是否可以将该物品出售到商店
     */
    sale_enable: boolean; // PBool
    /**
     * 等级
     *
     * 物品的等级
     */
    level: number; // PInt
    /**
     * 物品标签
     *
     * 用于对物体的分类处理。为单位贴上标签后可以对其进行更方便的关系，例如编写游戏逻辑：杀死所有拥有XX标签的单位
     */
    tags: any[]; // PList
    /**
     * 最大充能数
     *
     * 物品可以设置的最大充能层数
     */
    maximum_charging: number; // PInt
    /**
     * nil
     */
    rotation: any; // PAst
    /**
     * 购买开始时间
     *
     * 游戏开始后多长时间才能购买该类物品
     */
    start_rft: number; // PFloat
    /**
     * CD组
     *
     * 该物品所在的CD组，物品使用时会使单位持有的相同CD组内所有物品进入使用物品的主动技能冷却
     */
    cd_type: string; // PText
    /**
     * 主动技能
     *
     * 使用该物品的时释放的主动技能
     */
    attached_ability: any; // PSingleSelectExplorer
    /**
     * 使用消耗次数
     *
     * 物品是堆叠类型时，每次使用该物品消耗的堆叠层数
     */
    use_consume: number; // PInt
    /**
     * 默认堆叠数
     *
     * 物品创建后的初始堆叠层数
     */
    cur_stack: number; // PInt
    /**
     * 材质变化颜色
     */
    material_color: any; // PColor
    /**
     * 最大堆叠
     *
     * 物品可以叠加的最大堆叠层数。重复获得物品时，在不大于该值的情况下物品会自动堆叠。
     */
    maximum_stacking: number; // PInt
    /**
     * 名称面板外边距
     *
     * 以名称面板中所有图片计算最大范围，并向外扩展指定的数值
     */
    name_margin: any; // PFourDirMargin
    /**
     * 最大库存
     *
     * 物品作为商品时在商店中的最大可购买数
     */
    max_stock: number; // PInt
    /**
     * ID
     *
     * 物品的ID
     */
    key: number; // PInt
    /**
     * 名称
     */
    name: string; // PLocalizeText
    /**
     * 编辑器后缀
     *
     * 在编辑器下显示在名字后面的后缀，在游戏内不显示
     */
    suffix: string; // PText
    /**
     * 是否启用基础材质变色
     */
    use_base_tint_color: boolean; // PBool
    /**
     * 材质变化
     */
    material_change: any; // PEnum
    /**
     * 描述
     *
     * 物品的描述和介绍
     */
    description: string; // PLocalizeText
}
