## Context

Y3Helper 是一个 VSCode 扩展，内部集成了 CodeMaker 的前端 webview 源码（`resources/webview_source_code/`）和后端胶水层（`src/codemaker/`）。当前所有用户可见的品牌名称均为 "CodeMaker"，分布在：

- `package.json`：视图容器、命令、配置项声明（约 20 处）
- `src/codemaker/` 下的 TypeScript 文件：日志前缀、webview HTML、配置读取
- `resources/webview_source_code/src/`：提示词、store、服务层
- 用户工程目录下的 `.codemaker/` 目录：rules、skills、MCP 配置、codewiki

本次变更需要将品牌统一为 "Y3Maker"，涉及 30+ 文件，同时需要处理 `.codemaker` → `.y3maker` 的目录迁移兼容。

## Goals / Non-Goals

**Goals:**
- 所有用户可见的 UI 文本统一显示为 "Y3Maker"（不使用全大写 "Y3MAKER"）
- VSCode Settings 配置项命名空间从 `CodeMaker.*` 迁移到 `Y3Maker.*`
- LLM 系统提示词中 AI 自称 "Y3Maker" 而非 "CodeMaker"
- `.codemaker` 目录自动迁移为 `.y3maker`，无需用户手动操作
- 日志前缀统一为 `[Y3Maker]`
- 低风险 HTTP header 和 API 路径同步更新

**Non-Goals:**
- 不重命名内部类名/变量名（`CodeMakerWebviewProvider` 等保持不变）
- 不改动高风险后端 API 标识（`X-Auth-Project`、prompt 命名空间、docset tag）
- 不改动 npm 包引用（`@dep305/codemaker-web-tools`）
- 不改动源码注释中的历史移植说明
- 不改动 `src/codemaker/` 目录名本身（仅改内容，不改目录结构）

## Decisions

### D1: 品牌名大小写统一为 "Y3Maker"

**决定**: 所有位置统一使用 "Y3Maker"，包括原来全大写 "CODEMAKER" 的地方。

**理由**: 一会大写一会小写影响品牌一致性。"Y3Maker" 是最合适的 PascalCase 风格。

**替代方案**: 保留大小写区分（"Y3Maker" vs "Y3MAKER"）—— 被否决，视觉不统一。

### D2: VSCode Settings 命名空间直接替换，接受 Breaking Change

**决定**: `CodeMaker.*` 直接改为 `Y3Maker.*`，不做配置迁移。

**理由**: 
- 配置项仅 4 个（ApiKey、ApiBaseUrl、Model、WireApi），用户重新配置成本低
- 做自动迁移（读旧写新）会增加代码复杂度，且只需一次，性价比低
- 当前用户规模较小，Breaking Change 影响可控

**实现**: `configProvider.ts` 中 `vscode.workspace.getConfiguration('CodeMaker')` → `vscode.workspace.getConfiguration('Y3Maker')`，以及 `package.json` 中对应的 `configuration` 声明。

**替代方案**: 双配置兼容（先读 Y3Maker，读不到再 fallback 读 CodeMaker）—— 被否决，过度设计。

### D3: `.codemaker` → `.y3maker` 目录自动重命名迁移

**决定**: 在扩展激活时（`extension.ts` 初始化阶段），检测用户工程目录，若 `.y3maker` 不存在但 `.codemaker` 存在，则自动 `rename` 为 `.y3maker`。重命名失败时弹出提示信息。

**实现策略**:
```
1. 检查 projectUri/.y3maker 是否存在
2. 若存在 → 正常流程，无需迁移
3. 若不存在 → 检查 projectUri/.codemaker 是否存在
4. 若 .codemaker 存在 → 尝试 vscode.workspace.fs.rename(.codemaker, .y3maker)
5. rename 成功 → 正常流程
6. rename 失败 → vscode.window.showWarningMessage 提示用户手动重命名
```

**触发时机**: 放在 `extension.ts` 中地图环境初始化完成后、CodeMaker 模块初始化之前。这样在 webview 加载 rules/skills 时，目录已经是 `.y3maker`。

**理由**: 
- 用户无感知，自动完成迁移
- 只在 `.y3maker` 不存在时才触发，已迁移的用户不受影响
- rename 是原子操作，比 copy+delete 更安全

**替代方案**: 
- fallback 兼容（优先 .y3maker，找不到读 .codemaker）—— 被否决，长期维护两套路径代价大
- 不迁移，直接新建空 .y3maker —— 被否决，会丢失用户已有的 rules/skills 配置

### D4: `.codemaker.codebase.md` → `.y3maker.codebase.md`

**决定**: 同理对 `.codemaker.codebase.md` 文件也做自动重命名。这是工程根目录下的单独文件，迁移逻辑与 D3 类似但针对文件而非目录。

### D5: y3-lualib 中的 `.codemaker` 源目录

**决定**: `extension.ts` 中复制 y3-lualib 资源的逻辑，将源路径和目标路径都改为 `.y3maker`。

**注意**: y3-lualib 仓库本身也需要同步将 `.codemaker/` 目录重命名为 `.y3maker/`。这是外部依赖变更，不在本次代码变更范围内，但需要协同处理。

### D6: 低风险 API/HTTP 变更

**决定**: 
- HTTP header `codemaker-version` → `y3maker-version`（前后端同步改）
- API 路径 `/proxy/codemaker/reports` → `/proxy/y3maker/reports`（前后端同步改）

**理由**: 这些是前后端约定的协议字段，后端是自己团队维护，可以一起改。

**保留不改**: `X-Auth-Project: 'codemaker'`、`root.${username}.codemaker` 命名空间、`CODEMAKER_DOCSET_TAG`、`codemaker_public` 字段 —— 高风险，涉及后端权限系统和已有数据。

### D7: 提示词中的目录引用

**决定**: 所有提示词/内置 prompt 中引用的 `.codemaker/rules/rules.mdc`、`.codemaker/codewiki/wiki.json`、`.codemaker/skills/` 等路径全部改为 `.y3maker` 对应路径。这样 LLM 生成的指令会引导用户操作正确的目录。

### D8: webview 内嵌 HTML 中的品牌名

**决定**: `webviewProvider.ts` 中生成的 HTML 的 `<title>CodeMaker</title>` 和 iframe `id="codemaker-webui"` —— title 改为 "Y3Maker"，iframe id 保持不变（属于内部标识符，用户不可见）。

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 用户已有 Settings 配置丢失 | 用户需重新配置 4 个设置项 | 在 CHANGELOG / 更新说明中明确提示 |
| `.codemaker` → `.y3maker` 重命名失败（权限/占用） | 用户的 rules/skills/MCP 配置无法加载 | 捕获异常并弹出 warning，引导用户手动重命名 |
| y3-lualib 未同步改名 | 新建项目初始化时复制源目录失败 | 需要协同 y3-lualib 仓库同步发版 |
| 后端未同步改 header/路径 | review 上报、版本统计失败 | 前后端同步发布，或后端兼容新旧两种 header |
| 遗漏未改的 "CodeMaker" 文本 | 用户在某些角落看到旧品牌名 | 变更完成后全局搜索验证 |

## Migration Plan

1. **前端变更**（本次 PR）：
   - 一次性完成所有文本替换 + 目录迁移逻辑
   - 自测：全新安装 + 从旧版升级两种场景

2. **后端变更**（协同 PR）：
   - 修改 `codemaker-version` → `y3maker-version` header 识别
   - 修改 `/proxy/codemaker/reports` → `/proxy/y3maker/reports` 路由
   - 建议后端临时兼容新旧两种 header（过渡期）

3. **y3-lualib 变更**（协同 PR）：
   - 将 `.codemaker/` 目录重命名为 `.y3maker/`

4. **发布顺序**：后端先发（兼容新旧） → 前端 + y3-lualib 同时发

## Open Questions

- y3-lualib 仓库的 `.codemaker` 改名是否需要单独提 PR？谁负责？
- 后端是否能在过渡期兼容 `codemaker-version` 和 `y3maker-version` 两种 header？
- 是否需要在扩展更新日志中特别说明 Settings 配置项变更？
