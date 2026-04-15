/**
 * 移植自源码版 utils/file.ts
 */
import * as path from 'path';

const docsetExtensions = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);

/**
 * 判断是否是 docset 类型文件（二进制文档）
 */
export const isDocsetFile = (filePath: string) => {
    const ext = path.extname(filePath).toLowerCase().slice(1);
    return docsetExtensions.has(ext);
};
