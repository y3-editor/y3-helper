export interface SoundData {
    /**
     * UID
     */
    uid: string; // PText
    /**
     * 音量
     */
    volume: number; // PFloat
    /**
     * 描述
     */
    description: string; // PLocalizeText
    /**
     * 2D声音
     */
    sound_id: any; // PResource
    /**
     * 最小距离
     */
    min_dist: number; // PFloat
    /**
     * 淡出时间
     */
    fade_out_time: number; // PFloat
    /**
     * 播放速度
     */
    speed: number; // PFloat
    /**
     * 最大距离
     */
    max_dist: number; // PFloat
    /**
     * 总时间
     */
    total_time: number; // PFloat
    /**
     * 标签
     */
    tags: any[]; // PList
    /**
     * 图标
     */
    icon: any; // PResource
    /**
     * 2D声音
     */
    sound_id_list: any[]; // PResourceList
    /**
     * 编辑器后缀
     */
    suffix: string; // PText
    /**
     * 分组
     */
    group: number; // PInt
    /**
     * 玩家自定义
     */
    kv: any; // PAst
    /**
     * 名称
     */
    name: string; // PLocalizeText
    /**
     * 优先级
     */
    priority: number; // PFloat
    /**
     * 类型
     */
    type: number; // PInt
    /**
     * ID
     */
    key: number; // PInt
    /**
     * 淡入时间
     */
    fade_in_time: number; // PFloat
}
