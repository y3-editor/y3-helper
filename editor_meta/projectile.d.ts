export interface ProjectileData {
    /**
     * 字符串ID
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
     * 对单位移动类型的补充，决定单位究竟是在哪些通道移动。任意通道被碰撞阻挡该单位均无法通过。
     */
    move_limitation: any; // PCheckBoxBit
    /**
     * ID
     */
    key: number; // PInt
    /**
     * 标签
     */
    tags: any[]; // PList
    /**
     * 移动类型
     * 单位的移动类型，决定单位究竟是在地面移动还是在空中移动。
     */
    move_channel: any; // PEnum
    /**
     * 图标
     */
    icon: any; // PResource
    /**
     * 是否立即移除表现
     */
    effect_destroy_way_is_immediately: boolean; // PBool
    /**
     * 声音事件列表
     */
    sound_event_list: any[]; // PSoundList
    /**
     * 是否循环播放
     */
    sfx_loop: boolean; // PBool
    /**
     * 最大持续时间
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
     */
    async_effect: boolean; // PBool
}
