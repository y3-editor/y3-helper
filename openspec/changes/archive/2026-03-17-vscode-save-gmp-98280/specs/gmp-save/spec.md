# gmp-save Specification

GMP 文件保存功能 - 将 JSON 格式的物编和 UI 数据打包为二进制 GMP 格式。

## ADDED Requirements

### Requirement: Save prefab sections to GMP
系统 SHALL 支持将 `editor_table/` 目录下的物编 JSON 文件打包为 GMP 二进制格式的 Section。

支持的物编类型：
- editor_unit (单位)
- editor_decoration (装饰物)
- ability_all (技能)
- modifier_all (效果)
- projectile_all (投射物)
- technology_all (科技)
- store_all (商店)
- editor_item (物品)
- editor_destructible (可破坏物)
- sound_all (音效)
- state_all (状态)

#### Scenario: Save all prefab sections
- **WHEN** 调用 `save(mapPath, { updatePrefabs: true })`
- **THEN** 系统读取 `editor_table/` 下所有子目录的 JSON 文件
- **THEN** 为每个物编类型生成对应的二进制 Section
- **THEN** 使用 MD5 哈希计算 Section 索引

#### Scenario: Empty prefab folder
- **WHEN** 某个物编类型的文件夹为空或不存在
- **THEN** 系统 SHALL 为该类型打包空字典 `{}`
- **THEN** 不影响其他类型的处理

#### Scenario: JSON parse error
- **WHEN** 某个 JSON 文件格式错误无法解析
- **THEN** 系统 SHALL 记录错误日志
- **THEN** 跳过该文件，继续处理其他文件

---

### Requirement: Save UI section to GMP
系统 SHALL 支持将 `ui/` 目录下的 UI JSON 文件打包为 GMP 二进制格式的 UI Section（固定索引 10）。

UI 数据结构：
- `ui/ui_config.json` - 基础配置
- `ui/prefab/*.json` - 面板定义（需要 `key` 字段）
- `ui/*.json` - 层定义

#### Scenario: Save UI section with all components
- **WHEN** 调用 `save(mapPath, { updateUI: true })`
- **THEN** 系统读取 `ui/ui_config.json` 作为基础配置
- **THEN** 系统读取 `ui/prefab/` 下所有面板文件，按 `key` 字段索引
- **THEN** 系统读取 `ui/` 下所有层 JSON 文件
- **THEN** 合并为单一 UI Section 并写入 GMP

#### Scenario: Empty UI folder
- **WHEN** `ui/` 目录为空或不存在
- **THEN** 系统 SHALL 打包空的 UI 数据结构 `{ ui_data: [], prefab_data: {} }`

#### Scenario: Missing prefab key field
- **WHEN** 某个面板文件缺少 `key` 字段
- **THEN** 系统 SHALL 记录错误日志
- **THEN** 跳过该文件，继续处理其他面板

---

### Requirement: Preserve original GMP sections
系统 SHALL 保留原始 GMP 文件中不在替换范围内的 Section。

#### Scenario: Merge with existing sections
- **WHEN** 重建 GMP 文件
- **THEN** 系统解析原始 GMP 文件
- **THEN** 保留原始 header（UUID、version、stamps）
- **THEN** 保留非物编和非 UI 的 Section（如 desc、tech_data 等）
- **THEN** 仅替换指定更新的 Section

---

### Requirement: Binary serialization pipeline
系统 SHALL 使用以下流程序列化 Section 数据：JSON → MessagePack → Zstd 压缩。

#### Scenario: Serialize section data
- **WHEN** 打包任意 Section 数据
- **THEN** 系统将数据 JSON 序列化为字符串
- **THEN** 使用 MessagePack 编码为二进制
- **THEN** 使用 Zstd 压缩（级别 3）

#### Scenario: Zstd singleton management
- **WHEN** 多次调用压缩功能
- **THEN** 系统 SHALL 复用同一个 Zstd WASM 实例
- **THEN** 避免重复初始化导致内存泄漏

---

### Requirement: Backup original GMP file
系统 SHALL 在覆盖原始 GMP 文件前创建备份。

#### Scenario: Create backup before save
- **WHEN** 保存 GMP 文件且输出路径与原文件相同
- **THEN** 系统 SHALL 创建备份文件 `<原文件名>.gmp.bak`
- **THEN** 然后写入新的 GMP 数据

---

### Requirement: MCP tool integration
系统 SHALL 通过 MCP `save_gmp` 工具暴露 GMP 保存功能给 AI。

#### Scenario: AI calls save_gmp tool
- **WHEN** AI 通过 MCP 调用 `save_gmp` 工具
- **THEN** 系统执行 GMP 保存
- **THEN** 返回 `SaveResult` 包含 success、message、sectionsReplaced、outputSize

---

### Requirement: Auto save before game launch
系统 SHALL 在启动游戏前自动保存 GMP。

#### Scenario: Game launch triggers save
- **WHEN** 通过 MCP 启动游戏
- **THEN** 系统 SHALL 先执行 `save(mapPath, { updatePrefabs: true, updateUI: true })`
- **THEN** 保存成功后再启动游戏
- **THEN** 保存失败时记录警告日志但不阻止游戏启动
