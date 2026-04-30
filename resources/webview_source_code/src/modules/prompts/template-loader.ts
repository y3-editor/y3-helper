/**
 * 简单的 Prompt 模板加载和管理系统
 * 只支持基础变量替换 {{variable}}
 */

export class PromptTemplateLoader {
  private static templateCache = new Map<string, string>();

  /**
   * 加载模板文件
   */
  static async loadTemplate(templateName: string): Promise<string> {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    try {
      // 动态导入模板文件
      const templateModule = await import(`./templates/${templateName}.txt?raw`);
      const content = templateModule.default;
      this.templateCache.set(templateName, content);
      return content;
    } catch (error) {
      console.warn(`Failed to load template: ${templateName}`, error);
      return '';
    }
  }

  /**
   * 简单变量替换 {{variable}}
   * 支持默认值 {{variable|default}}
   */
  static interpolateTemplate(
    template: string,
    variables: Record<string, any> = {}
  ): string {
    return template.replace(/\{\{(\w+)(\|([^}]+))?\}\}/g, (_match, key, _, fallback) => {
      const value = variables[key];
      if (value !== undefined && value !== null) {
        return String(value);
      }
      return fallback || '';
    });
  }

  /**
   * 渲染模板
   */
  static async renderTemplate(
    templateName: string,
    variables: Record<string, any> = {}
  ): Promise<string> {
    const template = await this.loadTemplate(templateName);
    return this.interpolateTemplate(template, variables);
  }

  /**
   * 简单变量插值（向后兼容）
   * @deprecated 请使用 interpolateTemplate
   */
  static interpolateVariables(template: string, variables: Record<string, string>): string {
    return this.interpolateTemplate(template, variables);
  }

  /**
   * 清空缓存
   */
  static clearCache(): void {
    this.templateCache.clear();
  }
}