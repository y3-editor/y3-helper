import * as yaml from 'yaml';
import { AgentMetaData } from './types';
const getErrorMessage = (e: any) => (e instanceof Error ? e.message : String(e));

/**
 * Agent MDC文件解析结果
 */
export interface AgentParseResult {
  /** 元信息 */
  metaData: AgentMetaData;
  /** 内容 */
  content: string;
  /** 是否解析成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * Agent MDC文件解析器
 * 解析格式：
 * ---
 * name: code-reviewer
 * description: Reviews code for quality and best practices
 * tools: Read, Glob, Grep
 * model: sonnet
 * ---
 *
 * You are a code reviewer. When invoked, analyze the code and provide
 * specific, actionable feedback on quality, security, and best practices.
 */
export class AgentMdcParser {
  private static readonly FRONT_MATTER_DELIMITER = '---';

  /**
   * 解析Agent MDC格式文件内容
   * @param content 文件内容
   * @param fileName 文件名（包含扩展名）
   */
  public static parse(content: string, fileName: string): AgentParseResult {
    try {
      // 统一换行符：将 CRLF 转为 LF，避免 \r 残留导致 YAML 解析异常
      const normalizedContent = content.replace(/\r\n/g, '\n');
      const trimmedContent = normalizedContent.trim();

      // 从文件名提取 agent name（移除.md后缀）
      const fileBaseName = fileName.replace(/\.md$/i, '');

      // 检查是否以front matter开始
      if (!trimmedContent.startsWith(AgentMdcParser.FRONT_MATTER_DELIMITER)) {
        // 如果没有front matter，使用文件名作为默认name
        return AgentMdcParser.parseWithoutFrontMatter(content, fileBaseName);
      }

      // 分割front matter和content
      const lines = trimmedContent.split('\n');
      if (lines.length < 3) {
        throw new Error('Invalid MDC format: insufficient lines');
      }

      // 查找第二个分隔符
      let frontMatterEnd = -1;
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === AgentMdcParser.FRONT_MATTER_DELIMITER) {
          frontMatterEnd = i;
          break;
        }
      }

      if (frontMatterEnd === -1) {
        throw new Error('Invalid MDC format: missing closing front matter delimiter');
      }

      // 提取front matter内容（去除分隔符行）
      const frontMatterLines = lines.slice(1, frontMatterEnd);
      const frontMatterContent = frontMatterLines.join('\n');

      // 提取content部分（去除front matter和分隔符）
      const contentLines = lines.slice(frontMatterEnd + 1);
      const promptContent = contentLines.join('\n').trim();

      // 解析YAML front matter，传入文件基础名作为默认name
      const metaData = AgentMdcParser.parseFrontMatter(frontMatterContent, fileBaseName);

      return {
        metaData: {
          ...metaData,
          prompt: promptContent
        },
        content: promptContent,
        success: true
      };

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      const fileBaseName = fileName.replace(/\.md$/i, '');
      return {
        metaData: {
          name: fileBaseName,
          description: 'No description provided',
          prompt: ''
        },
        content: '',
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 解析没有front matter的内容
   * @param content 文件内容
   * @param fileBaseName 文件基础名（已移除扩展名）
   */
  private static parseWithoutFrontMatter(content: string, fileBaseName: string): AgentParseResult {
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    let name = fileBaseName; // 默认使用文件基础名
    let description = 'No description provided';

    // 尝试从 Markdown 标题中提取 name（这会覆盖文件名）
    const firstLine = lines[0]?.trim();
    if (firstLine?.startsWith('# ')) {
      name = firstLine.substring(2).trim();
    }

    // 尝试从第二行提取描述
    const secondLine = lines[1]?.trim();
    if (secondLine && !secondLine.startsWith('#') && secondLine.length > 0) {
      description = secondLine;
    }

    return {
      metaData: {
        name,
        description,
        prompt: content.trim()
      },
      content: content.trim(),
      success: true
    };
  }

  /**
   * 解析front matter YAML内容
   * @param yamlContent YAML内容
   * @param fileBaseName 文件基础名（作为默认name）
   */
  private static parseFrontMatter(yamlContent: string, fileBaseName: string): Omit<AgentMetaData, 'prompt'> {
    try {
      const parsed = yaml.parse(yamlContent) || {};

      // 默认使用文件基础名，如果YAML中定义了name则覆盖
      const metaData: Omit<AgentMetaData, 'prompt'> = {
        name: parsed.name ? String(parsed.name).trim() : fileBaseName,
        description: parsed.description ? String(parsed.description).trim() : 'No description provided'
      };

      // 可选字段
      if (parsed.model) {
        metaData.model = String(parsed.model).trim();
      }

      if (parsed.tools) {
        metaData.tools = String(parsed.tools).trim();
      }

      return metaData;
    } catch (error) {
      // 如果YAML解析失败，返回默认值
      return {
        name: fileBaseName,
        description: 'No description provided'
      };
    }
  }

  /**
   * 将Agent对象转换为MDC格式字符串
   */
  public static stringify(metaData: AgentMetaData): string {
    try {
      // 构建front matter对象
      const frontMatterObj: Record<string, any> = {
        name: metaData.name,
        description: metaData.description
      };

      // 添加可选字段，按照 Claude Code 格式的顺序
      if (metaData.tools) {
        frontMatterObj.tools = metaData.tools;
      }

      if (metaData.model) {
        frontMatterObj.model = metaData.model;
      }

      // 生成YAML front matter
      const yamlContent = yaml.stringify(frontMatterObj, {
        indent: 2
      }).trim();

      // 组合完整的MDC内容
      const mdcContent = [
        AgentMdcParser.FRONT_MATTER_DELIMITER,
        yamlContent,
        AgentMdcParser.FRONT_MATTER_DELIMITER,
        '', // 空行分隔
        metaData.prompt?.trim() || ''
      ].join('\n');

      return mdcContent;
    } catch (error) {
      throw new Error(`Failed to stringify Agent MDC content: ${getErrorMessage(error)}`);
    }
  }

  /**
   * 验证Agent MDC格式是否有效
   */
  public static validate(content: string, fileName: string): { valid: boolean; error?: string } {
    const result = AgentMdcParser.parse(content, fileName);
    return {
      valid: result.success,
      error: result.error
    };
  }

  /**
   * 提取纯内容（不包含front matter）
   */
  public static extractContent(content: string, fileName: string): string {
    const result = AgentMdcParser.parse(content, fileName);
    return result.content;
  }

  /**
   * 提取元信息
   */
  public static extractMetaData(content: string, fileName: string): AgentMetaData | null {
    const result = AgentMdcParser.parse(content, fileName);
    return result.success ? result.metaData : null;
  }
}


export default AgentMdcParser;
