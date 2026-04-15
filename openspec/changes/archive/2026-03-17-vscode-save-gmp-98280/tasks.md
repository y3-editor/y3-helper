# GMP 保存功能实现任务

> 注意：此功能已完成实现，以下任务清单用于归档和追溯。

## 1. 核心模块实现 (`src/tools/y3SaveGmp.ts`)

- [x] 1.1 实现 `BufferReader` 二进制读取辅助类
- [x] 1.2 实现 `GmpParser` 解析原始 GMP 文件（header + sections）
- [x] 1.3 实现 `GmpBuilder` 构建 GMP 二进制输出
- [x] 1.4 实现 Section 索引计算 `genSectionIdx`（MD5 哈希）
- [x] 1.5 实现 `getSectionIndexMap` 缓存索引映射

## 2. 序列化流程实现

- [x] 2.1 实现 Zstd WASM 单例管理 `getZstdSimple`
- [x] 2.2 实现 `packSectionData` 序列化流程（JSON → msgpack → zstd）
- [x] 2.3 添加 npm 依赖 `@msgpack/msgpack` 和 `zstd-codec`

## 3. 物编数据处理

- [x] 3.1 实现 `loadJsonFolderAsDict` 读取文件夹 JSON
- [x] 3.2 实现 `buildPrefabSectionsFromEditorTable` 构建物编 Section
- [x] 3.3 支持空文件夹场景（打包空字典）
- [x] 3.4 支持 11 种物编类型的 Section 构建

## 4. UI 数据处理

- [x] 4.1 实现 `scanUIFolder` 扫描 UI 目录结构
- [x] 4.2 实现 `convertTupleFormat` 处理 tuple 格式转换
- [x] 4.3 实现 `buildUIData` 合并 ui_config + prefab + layer
- [x] 4.4 实现 `buildUISection` 构建 UI Section（固定索引 10）

## 5. GMP 重建流程

- [x] 5.1 实现 `rebuildGmpFull` 合并原始 Section 与新 Section
- [x] 5.2 实现 `saveGmpWithNewData` 统一入口
- [x] 5.3 实现备份原文件到 `.bak`
- [x] 5.4 导出 `save` 主入口函数

## 6. MCP 集成 (`src/mcp/`)

- [x] 6.1 在 `src/mcp/tools/index.ts` 注册 `save_gmp` 工具
- [x] 6.2 在 `src/mcp/tcpServer.ts` 处理 `save_gmp` 请求
- [x] 6.3 在 `src/mcp/gameSessionManager.ts` 添加 `saveGmpBeforeLaunch`

## 7. 清理和优化

- [x] 7.1 移除 Python 脚本依赖（`y3_save_gmp.py`）
- [x] 7.2 优化内存使用（逐个 Section 处理后释放引用）
- [x] 7.3 移除 JSON 格式化以减少内存占用
