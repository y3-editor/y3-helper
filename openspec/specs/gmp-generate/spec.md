# gmp-generate Specification

多关卡 GMP 离线生成 - 不启动编辑器，从工程源文件重建每个关卡的 gmp。

## 入口

- MCP 工具 `generate_gmp`：供 AI 在修改 `editor_table/`、`ui/`、`terrain.json`、`script/` 等文件后调用。
- VS Code 命令 `y3-helper.generateGmp`：侧边栏「功能 -> 重建所有关卡 GMP」按钮触发。

## Requirements

### Requirement: 遍历工程内所有关卡

系统 SHALL 从当前 Y3 工程的 `maps/` 枚举所有关卡，并逐关卡重建 gmp。

初始化工程与生成 GMP SHALL 共用只读的有效关卡扫描：只接纳包含可解析 `header.map`、且 ID 为正整数的目录；数字 ID SHALL 无损读取。缺少 `header.map` 的残留目录记录日志后忽略；已存在但损坏的 `header.map`、无效 ID 或重复 ID SHALL 明确报错。

每次生成 SHALL 重新读取工程头、关卡目录与共享设置，不依赖缓存的 `project.maps`。扫描不得创建 `Map`、插件管理器或 `.log` 目录。入口关卡按 `header.project` 中的 ID 匹配，缺失时不得回退到其他关卡。

#### Scenario: 多关卡工程
- **WHEN** 工程包含 `EntryMap` 和多个子关卡
- **THEN** 系统依次处理每个关卡
- **THEN** 任一步失败时返回该关卡的错误，不静默跳过

#### Scenario: 残留目录或旧缓存
- **WHEN** `maps/Project_Map4` 没有 `header.map`，或缓存名单仍有已删除/改名的关卡
- **THEN** 仅按当前磁盘上的有效关卡生成，不把残留目录作为缺少 GMP 的关卡报错

#### Scenario: 合法关卡缺少对应包
- **WHEN** 有效关卡缺少 `<关卡ID>.gmp`，但目录中有旧包或 `trigger.gmp`
- **THEN** 系统报告期望的完整 GMP 路径，不使用其他包代替
- **THEN** 错误提示包含工程路径，并同时标识关卡显示名与目录名

#### Scenario: 损坏的关卡元数据
- **WHEN** 扫描发现 `header.map` 损坏、ID 无效/重复或入口关卡缺失
- **THEN** 系统在写入 GMP 前报告配置文件路径，不将扫描失败显示为“所有关卡 GMP 已是最新”

### Requirement: 共享 section 从入口关卡读取

系统 SHALL 按项目 `setting.json` 判断共享数据：
- `use_main_level_trigger_and_object` 为真时，物编、多语言、表格、全局触发器、属性从入口关卡读取。
- `use_main_level_ui` 为真时，UI 与 UI 动画从入口关卡读取。

#### Scenario: 两个开关都开启
- **WHEN** `use_main_level_trigger_and_object=true` 且 `use_main_level_ui=true`
- **THEN** 所有关卡的物编、UI、多语言等共享 section 内容一致
- **THEN** 地形、Lua、关卡专属 JSON 仍从各自关卡目录读取

### Requirement: 保留无法离线复刻的 section

系统 SHALL 保留原 gmp 中以下内容，不尝试重建：
- `trigger_data` 及各类 `*_trigger` section
- `table_data`
- `dec_data`、`resource_object_data`
- `archive_data`、`global_archive_data`
- `grid_data`、`custom_eca`、`resource_data`
- `user_data`、`texture_data`、`texture_foliage_data`
- `logic_res`、`cloud_res_dep_data`、`custom_api`

#### Scenario: 触发器源变化
- **WHEN** 仅 `global_trigger/` 发生变化
- **THEN** `generate_gmp` 不会重建 `trigger_data`
- **THEN** 需要先在编辑器中保存该关卡，或等待后续触发器编译器里程碑

### Requirement: 只替换已存在的 section

系统 SHALL 只替换原 gmp 中已经存在的 section，不新增 section。

#### Scenario: 源文件存在但 gmp 中没有该 section
- **WHEN** 某个可选 section 的磁盘文件存在，但原 gmp 未包含该 section
- **THEN** 系统跳过它，保持原 gmp 的 section 集合不变

### Requirement: 原子写入与备份

系统 SHALL 在写入前备份原 gmp 为 `<原文件>.gmp.bak`，并通过临时文件原子替换。

已有 `.gmp.bak` SHALL 保留，不因重复生成而覆盖。某关卡任一 section 构建失败时，系统 SHALL 返回错误并保留该关卡原 GMP，不写入部分成功的结果。

#### Scenario: 地形或 JSON 构建失败
- **WHEN** 某关卡发生压缩失败或源 JSON 解析失败
- **THEN** 该关卡 GMP、备份与临时文件均不因本次构建而写入
- **THEN** 返回具体 section 的错误

### Requirement: 离线生成不触发保存插件

系统 SHALL 区分编辑器保存与 y3-helper 自己生成的 GMP。离线生成只写入 GMP、备份及位于系统临时目录的写入来源记录，不得因文件监听事件自动执行 `onSave` 插件或改写 Lua 源文件。

来源识别 SHALL 支持独立命令行进程与 VS Code 扩展宿主之间的事件，并按具体文件版本匹配；不得通过全局时间窗口屏蔽正常保存。

#### Scenario: 延迟或重复的文件事件
- **WHEN** 离线生成替换 GMP，文件创建或修改事件在写入完成后才到达，或同一次写入收到多个事件
- **THEN** 所有对应的事件均不执行 `onSave`

#### Scenario: 后续编辑器保存
- **WHEN** 编辑器随后保存相同文件，或保存同目录内其他 GMP
- **THEN** 正常执行 `onSave` 插件，保持原来的去抖行为

### Requirement: 保留编辑器序列化类型

旧版 section SHALL 按编辑器 `_JsonObjHook` 的规则将数字形式的 JSON 键编码为 msgpack 整数键，并保留 int64 的整数类型。UI 面板文件的 `key` SHALL 只作为 `prefab_data` 的索引，不进入面板内容。

系统 SHALL 还原显式 tuple，以及属性映射、场景实体定点坐标中由编辑器序列化规则决定的嵌套 tuple。不能从 JSON 恢复类型的其他 section 仍按 v1 保留策略处理。

#### Scenario: 大关卡地形
- **WHEN** 地形源文件约 6MB
- **THEN** 在支持原生 zstd 的 Node 运行时中可完成压缩并正确解压，不受旧 WASM 固定 16MB 堆限制

### Requirement: 语义验收

v1 以语义一致为验收标准：替换后的 section 解压后数据与编辑器生成的 gmp 一致。

#### Scenario: Lua 源文件比 gmp 新
- **WHEN** `script/main.lua` 在 gmp 保存后被修改
- **THEN** 生成结果会包含新内容
- **THEN** 与旧 gmp 的字节差异属于预期更新

## 已知限制

- 不校验编辑器版本；section 列表与序列化格式按当前格式固定。
- `trigger_data` 全量离线编译留待后续里程碑。
- `logic_res` 等丢失嵌套 tuple 类型信息的 JSON 暂不重建。
