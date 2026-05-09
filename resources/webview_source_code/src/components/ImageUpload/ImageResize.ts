import { toastError } from "../../services/error";

const MAX_FILE_SIZE = 280 * 1024; // 300KB
const MAX_ORIGINAL_FILE_SIZE = 3 * 1024 * 1024; // 3MB - 原始文件大小限制
const MAX_PIXEL_DIMENSION = 1600; // 限制为 2000px 以符合服务端要求
const DEFAULT_QUALITY = 0.8;
const MIN_QUALITY = 0.1;

/**
 * 图片压缩配置
 */
interface CompressConfig {
  maxFileSize: number;
  maxPixelDimension: number;
  defaultQuality: number;
  minQuality: number;
  qualitySteps: number[];
}

/**
 * 默认压缩配置
 */
const DEFAULT_COMPRESS_CONFIG: CompressConfig = {
  maxFileSize: MAX_FILE_SIZE,
  maxPixelDimension: MAX_PIXEL_DIMENSION,
  defaultQuality: DEFAULT_QUALITY,
  minQuality: MIN_QUALITY,
  qualitySteps: [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1], // 智能质量步进
};

/**
 * 压缩图片尺寸
 *
 * 优化后的压缩策略：
 * 1. GIF 格式直接返回（保持动画）
 * 2. 智能尺寸缩放（保持宽高比）
 * 3. 多级质量压缩（避免过度压缩）
 * 4. 完善的错误处理和资源清理
 */
// eslint-disable-next-line react-refresh/only-export-components
export const compressImage = async (
  file: File,
  config: Partial<CompressConfig> = {}
): Promise<File> => {
  const finalConfig = { ...DEFAULT_COMPRESS_CONFIG, ...config };

  // GIF 文件直接返回，保持动画效果
  if (file.type === 'image/gif') {
    // 检查原始文件大小是否超过 3MB
    if (file.size > MAX_ORIGINAL_FILE_SIZE) {
      toastError('模型不支持超过3MB的gif图，请选择更小的图片');
      throw new Error('图片超过3MB，模型不支持');
    }
    return file;
  }

  let imageUrl: string | null = null;

  try {
    imageUrl = URL.createObjectURL(file);
    const img = await loadImage(imageUrl);

    // 计算压缩后的尺寸
    const { width: targetWidth, height: targetHeight } = calculateTargetDimensions(
      img.width,
      img.height,
      finalConfig.maxPixelDimension
    );

    // 创建 Canvas 并绘制图像
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('无法创建 Canvas 2D 上下文');
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    // 尝试多级质量压缩
    const compressedFile = await tryMultiLevelCompression(
      canvas,
      file.name,
      finalConfig
    );

    return compressedFile;
  } catch (error) {
    console.warn('[ImageUpload] 图片压缩失败，返回原文件:', error);
    return file;
  } finally {
    // 确保释放对象 URL
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
  }
};

/**
 * 加载图片到 Image 对象
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve(img);
    img.onerror = (event) => {
      reject(new Error(`图片加载失败: ${event}`));
    };

    // 设置超时处理
    const timeout = setTimeout(() => {
      reject(new Error('图片加载超时'));
    }, 20000); // 20秒超时

    img.onload = () => {
      clearTimeout(timeout);
      resolve(img);
    };

    img.src = src;
  });
}

/**
 * 计算目标尺寸（保持宽高比）
 */
function calculateTargetDimensions(
  originalWidth: number,
  originalHeight: number,
  maxDimension: number
): { width: number; height: number } {
  if (originalWidth <= maxDimension && originalHeight <= maxDimension) {
    return { width: originalWidth, height: originalHeight };
  }

  const ratio = Math.min(
    maxDimension / originalWidth,
    maxDimension / originalHeight
  );

  return {
    width: Math.floor(originalWidth * ratio),
    height: Math.floor(originalHeight * ratio),
  };
}

/**
 * 尝试多级质量压缩
 */
async function tryMultiLevelCompression(
  canvas: HTMLCanvasElement,
  originalFileName: string,
  config: CompressConfig
): Promise<File> {
  for (const quality of config.qualitySteps) {
    try {
      const blob = await canvasToBlob(canvas, 'image/jpeg', quality);

      if (blob.size <= config.maxFileSize) {
        return new File(
          [blob],
          originalFileName.replace(/\.\w+$/, '.jpeg'),
          {
            type: 'image/jpeg',
            lastModified: Date.now(),
          }
        );
      }
    } catch (error) {
      console.warn(`[ImageUpload] 质量 ${quality} 压缩失败:`, error);
      continue;
    }
  }

  // 如果所有质量级别都失败，尝试最低质量
  const blob = await canvasToBlob(canvas, 'image/jpeg', config.minQuality);
  return new File(
    [blob],
    originalFileName.replace(/\.\w+$/, '.jpeg'),
    {
      type: 'image/jpeg',
      lastModified: Date.now(),
    }
  );
}

/**
 * Canvas 转 Blob（Promise 化）
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas 转换为 Blob 失败'));
        }
      },
      type,
      quality
    );
  });
}

/**
 * Base64 图片压缩
 *
 * 将 base64 图片转换为 File，经过 compressImage 压缩，然后转回 base64
 *
 * @param base64 - base64 图片字符串（包含或不包含 data:image/xxx;base64, 前缀）
 * @param config - 压缩配置
 * @returns Promise<string> - 压缩后的 base64 字符串（包含 data:image/jpeg;base64, 前缀）
 */
export const compressBase64Image = async (
  base64: string,
  config: Partial<CompressConfig> = {}
): Promise<string> => {
  try {
    // 解析 base64 字符串，提取格式信息
    const { dataUrl, fileName } = parseBase64(base64);

    // 将 base64 转换为 File 对象
    const file = await base64ToFile(dataUrl, fileName);

    // 使用现有的压缩函数进行压缩
    const compressedFile = await compressImage(file, config);

    // 将压缩后的文件转换回 base64
    const compressedBase64 = await fileToBase64(compressedFile);

    return compressedBase64;
  } catch (error) {
    console.warn('[ImageUpload] Base64图片压缩失败:', error);
    throw error;
  }
};

/**
 * 解析 base64 字符串，提取格式信息
 */
function parseBase64(base64: string): {
  dataUrl: string;
  mimeType: string;
  fileName: string;
} {
  // 如果没有 data:image 前缀，默认为 jpeg
  if (!base64.startsWith('data:')) {
    return {
      dataUrl: `data:image/jpeg;base64,${base64}`,
      mimeType: 'image/jpeg',
      fileName: 'image.jpeg',
    };
  }

  // 提取 MIME 类型
  const mimeMatch = base64.match(/^data:([^;]+)/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

  // 根据 MIME 类型生成文件名
  const extension = mimeType.split('/')[1] || 'jpeg';
  const fileName = `image.${extension}`;

  return {
    dataUrl: base64,
    mimeType,
    fileName,
  };
}

/**
 * Base64 转 File
 */
function base64ToFile(dataUrl: string, fileName: string): Promise<File> {
  return new Promise((resolve, reject) => {
    try {
      // 提取纯 base64 数据
      const base64Data = dataUrl.split(',')[1];
      if (!base64Data) {
        throw new Error('无效的 base64 数据');
      }

      // 解码 base64
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);

      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);

      // 提取 MIME 类型
      const mimeMatch = dataUrl.match(/^data:([^;]+)/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

      // 创建 File 对象
      const file = new File([byteArray], fileName, {
        type: mimeType,
        lastModified: Date.now(),
      });

      resolve(file);
    } catch (error) {
      reject(new Error(`Base64 转 File 失败: ${error}`));
    }
  });
}

/**
 * File 转 Base64
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('FileReader 结果不是字符串'));
      }
    };

    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };

    reader.readAsDataURL(file);
  });
}
