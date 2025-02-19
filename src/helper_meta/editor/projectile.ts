export interface ProjectileData {
    /**
     * 字符串ID
     *
     * 投射物的UID
     */
    uid: string; // PText
    /**
     * 描述
     */
    description: string; // PLocalizeText
    /**
     * 敌方特效
     */
    effect_foes: any; // PAst
    /**
     * 可移动通道
     *
     * 当投射物作为运动器的运动对象且开启地形阻挡时，作为是否会触发碰撞静态碰撞事件的条件。
     */
    move_limitation: any; // PCheckBoxBit
    /**
     * ID
     *
     * 投射物的ID
     */
    key: number; // PInt
    /**
     * 标签
     */
    tags: any[]; // PList
    /**
     * 是否循环播放
     *
     * 勾选后投射物会在播放完成后重复播放
     */
    sfx_loop: boolean; // PBool
    /**
     * 图标
     */
    icon: any; // PResource
    /**
     * 是否开启对象池
     *
     * 开启对象池后投射物默认立即移除表现且投射物不会销毁，会以休眠状态进入对象池从而优化性能，重新使用这些对象时自定义属性不会清除，需要手动初始化一遍。
     */
    poolable: boolean; // PBool
    /**
     * 是否立即移除表现
     *
     * 开启后，该投射物被销毁时会立即移除所有表现（适用于没有制作销毁过渡的特效资源）
     */
    effect_destroy_way_is_immediately: boolean; // PBool
    /**
     * 声音事件列表
     *
     * 可以设置触发指定事件时播放的声音
     */
    sound_event_list: any[]; // PSoundList
    /**
     * 移动类型
     *
     * 影响可用的可移动通道。
     */
    move_channel: any; // PEnum
    /**
     * 最大持续时间
     *
     * 投射物会在到达最大持续时间后强制删除。摆放在场景上的投射物不会受到限制。
     */
    max_duration: number; // PFloat
    /**
     * 玩家自定义
     */
    kv: any; // PAst
    /**
     * 名称
     */
    name: string; // PLocalizeText
    /**
     * 特效配置
     */
    effect_friend: any; // PAst
    /**
     * 编辑器后缀
     */
    suffix: string; // PText
    /**
     * 区分敌我特效显示
     *
     * 开启后可以配置该特效在所属单位的敌人眼中的表现。通常用于处理不同颜色的警示圈或不对敌方显示特效。
     */
    async_effect: boolean; // PBool
}
