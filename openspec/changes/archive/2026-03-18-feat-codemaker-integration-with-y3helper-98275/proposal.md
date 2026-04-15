## ... existing code ...
## Why

为了解决外部用户无法在 Y3Helper 中使用 CodeMaker 能力的问题，需要将本机现有的 CodeMaker 源码集成到 VSCode 插件中并随 Y3Helper 一起发布。该集成将提升插件能力覆盖面并降低用户配置门槛。\
Issue: #98275

## What Changes

- 集成并打包本机 `H:\CodemakerOpenSource` 中的 CodeMaker 功能到 Y3Helper 插件发布包中
- 在 Y3Helper 中提供可访问的 CodeMaker 功能入口并保证外部用户可用
- 调整构建/打包流程以确保 CodeMaker 相关资源被正确包含

## Capabilities

### New Capabilities
- `codemaker-integration`: 在 Y3Helper 插件内提供 CodeMaker 功能并随发布包对外可用

### Modified Capabilities
- 无

## Impact

- VSCode 扩展打包流程与资源包含策略
- Y3Helper 插件模块（功能入口/命令注册）
- 可能影响发布产物体积与依赖管理