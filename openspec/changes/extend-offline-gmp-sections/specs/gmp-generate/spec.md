## MODIFIED Requirements

### Requirement: 保留无法离线复刻的 section

系统 SHALL 原样保留 `cloud_res_dep_data`、`resource_data`、`trigger_data` 和各类 `*_trigger`、`grid_data`、`custom_eca`、`user_data`、`logic_res`、`custom_api`，以及其它未支持的段，不重算资源依赖。

#### Scenario: 触发器源变化
- **WHEN** 仅 `global_trigger/` 发生变化
- **THEN** `generate_gmp` 不会重建 `trigger_data`
- **THEN** 用户须通过编辑器保存来更新该段

#### Scenario: 场景或表格与资源依赖同时有关
- **WHEN** 场景对象或表格重建成功
- **THEN** `cloud_res_dep_data` 与 `resource_data` 段保持原有编码字节

### Requirement: 只替换已存在的 section

系统 SHALL 以已有 GMP 为基础。一般只替换已有段；对七个新增支持的目标段，只有经编辑器对照样本证实在相同工程模式与输入条件下会创建或省略的段，才允许按已验证的规则新增或移除。存档还须验证本地运行时从相应产物读取。

#### Scenario: 源文件存在但 gmp 中没有该 section
- **WHEN** 一个不满足明确新增条件的可选段有源文件，但原 GMP 没有该段
- **THEN** 系统保持原段集合不变，并报告未生成的原因

#### Scenario: 首次新增运行时表格
- **WHEN** 兼容工程的原包没有表格段，且首次保存了有效非空 JSON 表格，同版本编辑器在该条件下会创建表格段
- **THEN** 离线重建新增表格段，并能按目标 GMP 的规则读回

### Requirement: 语义验收

重建段 SHALL 与同版本编辑器针对同一输入生成的结果语义一致，并保留有意义的类型差异。新增支持的段若内容未变，系统 SHALL 复用原编码字节。

#### Scenario: Lua 源文件比 gmp 新
- **WHEN** `script/main.lua` 在 GMP 保存后被修改
- **THEN** 生成结果包含新内容，与旧包的字节差异属于预期更新

#### Scenario: 同一段内容未变但压缩结果可能不同
- **WHEN** 一个新增支持的段解码后与当前源对应的逻辑数据相同
- **THEN** 直接保留原段字节，不重复编码该段

## ADDED Requirements

### Requirement: 离线重建场景装饰与纹理

系统 SHALL 从关卡本地数据构建 `dec_data`、`resource_object_data`、`texture_data` 和 `texture_foliage_data`。结构化二进制解析 SHALL 拒绝任何需要执行代码才能读取的载荷。

#### Scenario: 修改关卡独立的场景源
- **WHEN** 一个关卡的装饰、资源对象、纹理或纹理植被源有有效改动
- **THEN** 离线重建后相应段反映新内容，不把该场景源用于其他关卡

### Requirement: 离线导出运行时表格

系统 SHALL 从生效关卡的 `tables/` 与项目级 `archive/init_tables/` 读取编辑器保存的 `.json` 文件以构建 `table_data`，保留编辑器定义的表格类型、键类型和初始化表命名，并按目标 GMP 的编码和加密要求写入。

#### Scenario: 共享入口关卡的表格
- **WHEN** 项目启用主关卡表格共享
- **THEN** 所有有效关卡采用入口关卡的表格源和项目级初始化表

#### Scenario: 使用关卡自己的表格
- **WHEN** 项目关闭主关卡表格共享
- **THEN** 各关卡使用自己的表格源和项目级初始化表

#### Scenario: 忽略非 JSON 表格文件
- **WHEN** 表格源目录包含非 `.json` 文件
- **THEN** 不读取这些文件，也不参与重建、冲突检测或清空判断
- **THEN** 没有任何 JSON 源时，保留已有的 `table_data`

### Requirement: 应用玩家与全局存档配置

系统 SHALL 使用本地运行时认可的权威源与优先级，使玩家存档配置和全局存档配置在重建后可用于本地测试。既有 GMP 中需要更新的相应存档段 SHALL 与生效配置一致；生成过程 SHALL NOT 修改玩家实际存档或用户编辑的源配置。

#### Scenario: 工程与关卡的存档配置副本不同
- **WHEN** 2.0 工程的权威项目配置与关卡副本不一致
- **THEN** 使用项目级配置，不让关卡旧副本覆盖生效配置

#### Scenario: 新增非空全局存档配置
- **WHEN** 原包没有全局存档段，且项目设置了新的全局存档配置
- **THEN** 依据已验证的本地加载契约使配置在本地运行时可用

#### Scenario: 运行时直接读取存档配置
- **WHEN** 已验证本地运行时直接读取项目配置，且同版本编辑器不会为此写入对应的关卡 GMP 段
- **THEN** 本地运行时读到新的配置即满足验收，不新增对应 GMP 段
- **THEN** 结果说明该配置由项目直接读取，无需重建该段

### Requirement: 区分源缺失、有效清空和构建失败

系统 SHALL 区分缺少可选源、支持的空输入、无效输入，并报告受影响关卡和段。任一目标段构建失败时，系统 SHALL 保留该关卡的原 GMP 及备份。

#### Scenario: 可选源缺失
- **WHEN** 原 GMP 有该段，但对应的可选源不存在，且未明确清空
- **THEN** 保留并报告该段，不以空值覆盖

#### Scenario: 已存在的源无法解析
- **WHEN** 一个目标段的源损坏或格式不受支持
- **THEN** 报告关卡、段和源路径，不写该关卡的部分生成结果

#### Scenario: 用户显式清空
- **WHEN** 用户将源保存为该格式支持的有效空值
- **THEN** 按同版本编辑器的空输入语义生成结果，不沿用已清除的旧数据
