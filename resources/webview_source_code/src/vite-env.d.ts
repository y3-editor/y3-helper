/// <reference types="vite/client" />

/**
 * 编译时标记，由 vite-plugin-abort-source 插件替换为 '文件名:行号'。
 * 用于 abort reason 中自动携带源码位置信息。
 */
declare const __ABORT_LOC__: string;
