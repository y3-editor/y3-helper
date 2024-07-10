export interface ItemData {
    /**
     * UID
     */
    uid: string; // PText
    /**
     * 掉落后时间到期消失
     */
    delete_on_discard: boolean; // PBool
    /**
     * 可以遗弃
     *
     * 玩家是否可以将物品丢弃到地面
     */
    discard_enable: boolean; // PBool
    /**
     * 合成素材
     *
     * 合成这件物品所需要的材料，拥有所有合成原料后会自动合成该物品
     */
    compose_list: any[]; // PList
    /**
     * 启用补光效果
     */
    use_virtual_light: boolean; // PBool
    /**
     * ID
     *
     * 物品的ID
     */
    key: number; // PInt
    /**
     * 购买开始时间
     *
     * 游戏开始后多长时间才能购买该类物品
     */
    start_rft: number; // PFloat
    /**
     * 前置条件
     *
     * 训练、购买、建造该单位的前置条件
     */
    precondition_list: any[]; // PreconditionList
    /**
     * 图标
     *
     * 物品的头像
     */
    icon: any; // PResource
    /**
     * 开启碰撞
     */
    disable_overlapping: boolean; // PBool
    /**
     * 初始库存
     *
     * 物品作为商品时在商店中的初始可购买数
     */
    init_stock: number; // PInt
    /**
     * 特效列表
     */
    effect_list: any; // PAst
    /**
     * 声音事件列表
     */
    sound_event_list: any[]; // PSoundList
    /**
     * 堆叠类型
     *
     * 物品的堆叠或者充能逻辑。
     */
    stack_type: any; // PEnum
    /**
     * 库存恢复间隔
     *
     * 当前物品作为商品时，商店库存增加的间隔时间
     */
    refresh_interval: number; // PFloat
    /**
     * 主动技能
     *
     * 使用该物品的时释放的主动技能
     */
    attached_ability: any; // PSingleSelectExplorer
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
     * 菲涅尔强度
     */
    fresnel_emissive_color_strength: number; // PFloat
    /**
     * 被动技能
     */
    attached_passive_abilities: any[]; // PExplorerList
    /**
     * 描述
     *
     * 物品的描述和介绍
     */
    description: string; // PLocalizeText
    /**
     * 菲涅尔颜色
     */
    fresnel_color: any; // PAst
    /**
     * 持有者死亡时掉落
     *
     * 物品是否会在携带者死亡时掉落地面
     */
    discard_when_dead: boolean; // PBool
    /**
     * 不透明度
     */
    material_alpha: number; // PFloat
    /**
     * 材质变色强度
     */
    material_color_intensity: number; // PFloat
    /**
     * 自动使用
     *
     * 勾选后获得该物品时会自动使用该物品，如果不满足该物品的主动技能消耗条件则无法拾取
     */
    auto_use: boolean; // PBool
    /**
     * 名称显示方式
     */
    item_billboard_type: any; // PEnum
    /**
     * 菲涅尔指数
     */
    fresnel_exp: number; // PFloat
    /**
     * 模型
     *
     * 物品掉落在地面的模型
     */
    model: any; // PResource
    /**
     * 等级
     *
     * 物品的等级
     */
    level: number; // PInt
    /**
     * 基础材质变色
     */
    base_tint_color: any; // PColor
    /**
     * CD组
     *
     * 该物品所在的CD组，物品使用时会使单位持有的相同CD组内所有物品进入使用物品的主动技能冷却
     */
    cd_type: string; // PText
    /**
     * 材质颜色叠加类型
     */
    base_color_mod: any; // PEnum
    /**
     * 生命值
     *
     * 物品的生命值，生命值归零则会被销毁
     */
    hp_max: number; // PFloat
    /**
     * 使用消耗次数
     *
     * 物品是堆叠类型时，每次使用该物品消耗的堆叠层数
     */
    use_consume: number; // PInt
    /**
     * 最大充能数
     *
     * 物品可以设置的最大充能层数
     */
    maximum_charging: number; // PInt
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
     * 可以被抵押
     *
     * 是否可以将该物品出售到商店
     */
    sale_enable: boolean; // PBool
    /**
     * 物品标签
     *
     * 用于对物体的分类处理。为单位贴上标签后可以对其进行更方便的关系，例如编写游戏逻辑：杀死所有拥有XX标签的单位
     */
    tags: any[]; // PList
    /**
     * 默认堆叠数
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
     * 模型不透明度
     */
    model_opacity: number; // PFloat
    /**
     * 最大库存
     *
     * 物品作为商品时在商店中的最大可购买数
     */
    max_stock: number; // PInt
    /**
     * 编辑器后缀
     *
     * 在编辑器下显示在名字后面的后缀，在游戏内不显示
     */
    suffix: string; // PText
    /**
     * 名称
     */
    name: string; // PLocalizeText
    /**
     * 默认充能数
     */
    cur_charge: number; // PInt
    /**
     * 是否启用基础材质变色
     */
    use_base_tint_color: boolean; // PBool
    /**
     * 材质变化
     */
    material_change: any; // PEnum
    /**
     * 尺寸
     *
     * 物品模型的缩放比例
     */
    body_size: number; // PFloat
}
