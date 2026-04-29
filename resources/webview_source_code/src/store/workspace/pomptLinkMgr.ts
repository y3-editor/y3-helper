/**
 * @description 提示词链接管理类
 */
export class PromptLinkMgr {
  private static _ins: PromptLinkMgr;
  public static get ins(): PromptLinkMgr {
    if (this._ins == null) {
      this._ins = new PromptLinkMgr();
    }
    return this._ins;
  }

  public mcpPrompt = "";
  public skillPrompt = "";
  public rulePrompt = "";
  private hasInit = false; // 防止Prompt被初始化多次

  public async init(option: {
    mcpPrompt?: string,
    skillPrompt?: string,
    rulePrompt?: string,
  }) {
    if (this.hasInit) return
    this.hasInit = true;
    this.mcpPrompt = option.mcpPrompt || '';
    this.skillPrompt = option.skillPrompt || '';
    this.rulePrompt = option.rulePrompt || '';
  }

  public reset() {
    this.hasInit = false;
    this.mcpPrompt = "";
    this.skillPrompt = "";
    this.rulePrompt = "";
  }
}