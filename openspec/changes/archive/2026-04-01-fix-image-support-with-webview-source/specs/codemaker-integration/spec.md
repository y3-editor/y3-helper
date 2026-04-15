## ADDED Requirements

### Requirement: fixedModel 自动注入 chatModels 支持图片上传
当 WebView 通过 `INIT_DATA` 接收到 `fixedModel`（用户自定义模型名）时，前端 SHALL 自动将该模型注入到 `chatModels` 映射表中，设置 `parseImgType` 为 `BASE64`，使用户可以在聊天中粘贴/上传图片。

#### Scenario: fixedModel 不在 chatModels 中时自动注入
- **WHEN** WebView 收到 `INIT_DATA` 消息且 `fixedModel` 不为空，且 `chatModels` 中不存在该模型
- **THEN** 前端 SHALL 自动将 `fixedModel` 作为新模型注入 `chatModels`，配置 `parseImgType: BASE64`、`chatType: ALL`、`enabled: true`

#### Scenario: fixedModel 已在 chatModels 中时不覆盖
- **WHEN** WebView 收到 `INIT_DATA` 消息且 `fixedModel` 不为空，但 `chatModels` 中已存在该模型
- **THEN** 前端 SHALL NOT 覆盖已有的模型配置

#### Scenario: 用户粘贴图片成功
- **WHEN** 用户使用自定义模型（通过 `fixedModel` 设置）并在聊天输入框粘贴图片
- **THEN** 前端 SHALL 正常处理图片为 BASE64 格式并附加到消息中，不弹出"该模型不支持选择图片"提示

#### Scenario: 用户拖拽图片成功
- **WHEN** 用户使用自定义模型并将图片文件拖拽到聊天区域
- **THEN** 前端 SHALL 正常处理图片上传，不弹出"当前模型不支持图片拖拽进行上传"提示

#### Scenario: fixedModel 为空时不注入
- **WHEN** WebView 收到 `INIT_DATA` 消息且 `fixedModel` 为空字符串或 undefined
- **THEN** 前端 SHALL NOT 向 `chatModels` 注入任何模型