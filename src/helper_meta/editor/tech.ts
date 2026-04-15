export interface TechData {
    /**
     * UID
     */
    uid: string; // PText
    /**
     * 影响单位标签
     */
    affect_tags: any[]; // PList
    /**
     * 描述信息
     */
    description: string; // PLocalizeText
    /**
     * 编辑器后缀
     */
    suffix: string; // PText
    /**
     * 玩家自定义
     */
    kv: any; // PAst
    /**
     * 影响全部单位
     */
    affect_all: boolean; // PBool
    /**
     * 名称
     */
    name: string; // PLocalizeText
    /**
     * ID
     */
    key: number; // PInt
    /**
     * 应用科技
     */
    cells: any; // PAst
    /**
     * 标签
     */
    tags: any[]; // PList
    /**
     * 最大等级
     */
    max_lv: number; // PInt
}
