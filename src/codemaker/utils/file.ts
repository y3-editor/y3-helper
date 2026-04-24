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

const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico']);

/**
 * 判断是否是图片文件
 */
export const isImageFile = (filePath: string) => {
    const ext = path.extname(filePath).toLowerCase().slice(1);
    return imageExtensions.has(ext);
};

export const maxDocsetFileSize = 10 * 1024 * 1024; // 10MB
