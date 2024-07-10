export interface DecorationData {
    /**
     * UID
     */
    uid: string; // PText
    /**
     * 材质变色强度
     */
    material_color_intensity: number; // PFloat
    /**
     * 高度图
     */
    collision_height: any; // PAst
    /**
     * 启用补光效果
     */
    use_virtual_light: boolean; // PBool
    /**
     * 模型
     */
    model: any; // PResource
    /**
     * 暂未配置55
     */
    icon: any; // PResource
    /**
     * 效果编辑按钮
     */
    effect_button: any; // PButton
    /**
     * 挂接物列表
     */
    attach_models: any; // PAst
    /**
     * 接收贴花
     */
    receive_decal: boolean; // PBool
    /**
     * 启用菲涅尔效果
     */
    use_fresnel: boolean; // PBool
    /**
     * 碰撞盒
     */
    collision_box: any; // PAst
    /**
     * 材质颜色叠加类型
     */
    base_color_mod: any; // PEnum
    /**
     * 不透明度
     */
    material_alpha: number; // PFloat
    /**
     * 菲涅尔指数
     */
    fresnel_exp: number; // PFloat
    /**
     * 菲涅尔强度
     */
    fresnel_emissive_color_strength: number; // PFloat
    /**
     * 名称
     */
    name: string; // PLocalizeText
    /**
     * 菲涅尔颜色
     */
    fresnel_color: any; // PAst
    /**
     * 是否产生阴影
     */
    cast_shadow: boolean; // PBool
    /**
     * nil
     */
    enable_camera_collision: boolean; // PBool
    /**
     * 可通行
     */
    use_physics: boolean; // PBool
    /**
     * 遮挡透视
     */
    enable_occlusion_perspective: boolean; // PBool
    /**
     * 碰撞格点
     */
    collision_points: any; // PAst
    /**
     * 基础材质变色
     */
    base_tint_color: any; // PColor
    /**
     * 基础材质变色
     */
    material_color: any; // PAst
    /**
     * 编辑器后缀
     */
    suffix: string; // PText
    /**
     * 模型不透明度
     */
    model_opacity: number; // PFloat
    /**
     * ID
     */
    key: number; // PInt
    /**
     * 缩放
     */
    scale: number; // PFloat
    /**
     * 玩家自定义
     */
    kv: any; // PAst
    /**
     * 获得特效列表
     */
    effect_list: any; // PAst
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
     */
    description: string; // PLocalizeText
}
