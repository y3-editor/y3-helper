import * as yaml from 'yaml';
import { AgentMetaData } from './types';
const getErrorMessage = (e: any) => (e instanceof Error ? e.message : String(e));
const printLog = (...args: any[]) => console.log('[AgentsHandler:parser]', ...args);

// ─── METADATA_FIELD_MAP ───────────────────────────────────────────────────────

/**
 * 单个 metadata 字段的定义描述符
 * K: AgentMetaData 上的目标属性名
 */
interface MetadataFieldDef<K extends keyof AgentMetaData> {
  /** AgentMetaData 上的目标属性名 */
  key: K;
  /** frontmatter 中的 YAML key，默认与 key 相同 */
  yamlKey?: string;
  /**
   * 类型转换 + 验证函数
   * 返回 undefined 表示值无效，该字段将被忽略
   */
  transform: (raw: unknown, fileBaseName: string) => AgentMetaData[K] | undefined;
  /**
   * stringify 时是否输出该字段（默认 true）
   * prompt 字段不写入 frontmatter，设为 false
   */
  stringifySkip?: boolean;
}

/**
 * defineField 保留泛型精度的 helper
 */
function defineField<K extends keyof AgentMetaData>(
  def: MetadataFieldDef<K>
): MetadataFieldDef<K> {
  return def;
}

/**
 * METADATA_FIELD_MAP
 *
 * 声明顺序即 frontmatter 输出顺序。
 * 新增字段只需在此处追加一个 defineField 条目，无需修改 parseFrontMatter / stringify。
 */
const METADATA_FIELD_MAP = [
  defineField({
    key: 'name',
    transform: (raw, fileBaseName) =>
      raw ? String(raw).trim() : fileBaseName,
  }),
  defineField({
    key: 'description',
    transform: (raw) =>
      raw ? String(raw).trim() : 'No description provided',
  }),
  defineField({
    key: 'tools',
    transform: (raw) => (raw ? String(raw).trim() : undefined),
  }),
  defineField({
    key: 'model',
    // ⚠️ Y3 定制 (sync): 上游用 normalizeModelName(...) 剥离 `netease-codemaker/` 前缀。
    // Y3 既不会写入也不会读到该前缀（agentCreation.ts 已去掉拼接），
    // 所以连同 normalizeModelName / MODEL_PREFIXES_TO_REMOVE 一并删除，避免敏感词。
    // 同步上游时若 diff 出现 normalizeModelName，请保持当前裸 trim 写法。
    transform: (raw) =>
      raw ? String(raw).trim() : undefined,
  }),
  defineField({
    key: 'maxSteps',
    transform: (raw) => {
      if (raw === undefined || raw === null) return undefined;
      const n = Number(raw);
      return !isNaN(n) && n > 0 ? n : undefined;
    },
  }),
  defineField({
    key: 'mcpServers',
    transform: (raw, fileBaseName) => {
      if (!raw) return undefined;
      if (typeof raw === 'object' && !Array.isArray(raw)) {
        return raw as AgentMetaData['mcpServers'];
      }
      printLog(
        `[AgentParser] mcpServers invalid type for ${fileBaseName}: ${typeof raw}${Array.isArray(raw) ? ' (array)' : ''}`
      );
      return undefined;
    },
  }),
  defineField({
    key: 'prompt',
    // prompt 来自 frontmatter 之外的内容，不参与 parseFrontMatter 循环，
    // 也不写入 frontmatter（由 stringify 单独处理）
    transform: () => undefined,
    stringifySkip: true,
  }),
] as const;

// ─── Parser ───────────────────────────────────────────────────────────────────

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
 * maxSteps: 50
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

      // 检查是否以 front matter 开始
      if (!trimmedContent.startsWith(AgentMdcParser.FRONT_MATTER_DELIMITER)) {
        // 如果没有 front matter，使用文件名作为默认 name
        return AgentMdcParser.parseWithoutFrontMatter(content, fileBaseName);
      }

      // 分割 front matter 和 content
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
        throw new Error(
          'Invalid MDC format: missing closing front matter delimiter'
        );
      }

      // 提取 front matter 内容（去除分隔符行）
      const frontMatterLines = lines.slice(1, frontMatterEnd);
      const frontMatterContent = frontMatterLines.join('\n');

      // 提取 content 部分（去除 front matter 和分隔符）
      const contentLines = lines.slice(frontMatterEnd + 1);
      const promptContent = contentLines.join('\n').trim();

      // 解析 YAML front matter，传入文件基础名作为默认 name
      const metaData = AgentMdcParser.parseFrontMatter(
        frontMatterContent,
        fileBaseName
      );

      return {
        metaData: {
          ...metaData,
          prompt: promptContent,
        },
        content: promptContent,
        success: true,
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      const fileBaseName = fileName.replace(/\.md$/i, '');
      return {
        metaData: {
          name: fileBaseName,
          description: 'No description provided',
          prompt: '',
        },
        content: '',
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 解析没有 front matter 的内容
   * @param content 文件内容
   * @param fileBaseName 文件基础名（已移除扩展名）
   */
  private static parseWithoutFrontMatter(
    content: string,
    fileBaseName: string
  ): AgentParseResult {
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
        prompt: content.trim(),
      },
      content: content.trim(),
      success: true,
    };
  }

  /**
   * 解析 front matter YAML 内容（映射表驱动）
   * @param yamlContent YAML内容
   * @param fileBaseName 文件基础名（作为默认 name）
   */
  private static parseFrontMatter(
    yamlContent: string,
    fileBaseName: string
  ): Omit<AgentMetaData, 'prompt'> {
    try {
      const parsed = yaml.parse(yamlContent) || {};
      const metaData: Partial<AgentMetaData> = {};

      for (const fieldDef of METADATA_FIELD_MAP) {
        if (fieldDef.stringifySkip) continue;
        const yamlKey = fieldDef.yamlKey ?? fieldDef.key;
        const value = fieldDef.transform(parsed[yamlKey], fileBaseName);
        if (value !== undefined) {
          (metaData as Record<string, unknown>)[fieldDef.key] = value;
        }
      }

      // name / description 有兜底默认值，始终存在
      return metaData as Omit<AgentMetaData, 'prompt'>;
    } catch (error) {
      return {
        name: fileBaseName,
        description: 'No description provided',
      };
    }
  }

  /**
   * 将 Agent 对象转换为 MDC 格式字符串（映射表驱动，字段顺序由映射表声明顺序决定）
   */
  public static stringify(metaData: AgentMetaData): string {
    try {
      const frontMatterObj: Record<string, unknown> = {};

      for (const fieldDef of METADATA_FIELD_MAP) {
        if (fieldDef.stringifySkip) continue;
        const value = metaData[fieldDef.key];
        if (value !== undefined && value !== null) {
          // mcpServers 空对象不输出
          if (
            fieldDef.key === 'mcpServers' &&
            typeof value === 'object' &&
            Object.keys(value as object).length === 0
          ) {
            continue;
          }
          frontMatterObj[fieldDef.yamlKey ?? fieldDef.key] = value;
        }
      }

      // 生成YAML front matter
      const yamlContent = yaml
        .stringify(frontMatterObj, { indent: 2 })
        .trim();

      // 组合完整的MDC内容
      const mdcContent = [
        AgentMdcParser.FRONT_MATTER_DELIMITER,
        yamlContent,
        AgentMdcParser.FRONT_MATTER_DELIMITER,
        '', // 空行分隔
        metaData.prompt?.trim() || '',
      ].join('\n');

      return mdcContent;
    } catch (error) {
      throw new Error(
        `Failed to stringify Agent MDC content: ${getErrorMessage(error)}`
      );
    }
  }

  /**
   * 验证Agent MDC格式是否有效
   */
  public static validate(
    content: string,
    fileName: string
  ): { valid: boolean; error?: string } {
    const result = AgentMdcParser.parse(content, fileName);
    return {
      valid: result.success,
      error: result.error,
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
  public static extractMetaData(
    content: string,
    fileName: string
  ): AgentMetaData | null {
    const result = AgentMdcParser.parse(content, fileName);
    return result.success ? result.metaData : null;
  }
}

export default AgentMdcParser;