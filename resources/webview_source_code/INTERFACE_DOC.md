
# 背景
如今 CodeMaker 为了后续维护，人力成本等各方面问题，决定 Webview 的设计用统一一套 UI，通过加载 window 实例将部署的 webview 内嵌入各个 IDE 中，约定各种通信接口，用户 IDE 和 Webview 间的交互。

# 通信
如何在 webview 和 IDE 进行通信，主要使用 iframe 嵌入，通过 postMessage 来传输数据。下面的发送和接收均使用在两端（webview 和 IDE）

## 传输
```js
window.parent.postMessage(message, targetOrigin);
```

#### 接收
```js
window.addEventListener('message', handleMessage);

// handleMessage 用于处理该通信数据，可以理解为回调
// 如下是一个 handleMessage 的例子：

function handleMessage(event) {
  if (event.data.type === "LOGIN") {
    console.log("触发登录逻辑")
  }
}
```

# PostMessage 接口

## Webview 到 IDE
> 该部分内容需要负责开发 IDE 端的同学注意，实现以下的各种监听事件对应的回调和逻辑处理。

### 通用
#### 1. 请求登录
```js
postMessage({
  type: "LOGIN",
});
```
#### 2. 获取初始化数据
```js
postMessage({
  type: "GET_INIT_DATA",
});
```
#### 3. 拷贝内容到剪切板
> IDE 监听到该事件后，将 `data` 中的内容复制到剪贴板上
```js
postMessage({
  type: "COPY_TO_CLIPBOARD",
  data: "需要被拷贝的内容",
});
```
#### 4. 获取剪切板内容

```js
postMessage({
  type: "KEYBOARD_PASTE",
});
```

#### 5. 转发请求

> 一般用于webview请求office环境api

```js
// IDE 收到的消息
postMessage({
  type: "PROXY_REQUEST",
  data: {
    requestUrl: "请求地址",
    method: "请求方法",
    requestId: "请求id（唯一标识）",
    requestData: {},    // 请求的 body
    requestHeaders: {}
  }
});
```

根据参数发起请求，在请求返回的时候把返回数据通过 `PROXY_REQUEST_RESPONSE` 事件传给 webview

```js
// IDE 返回的消息
postMessage({
  type: "PROXY_REQUEST_RESPONSE",
  data: [
    {
      requestId: "请求id（唯一标识）",
      response: {
        data: {} | "" | null,  // response.data / response.body（json，string或者空）
        headers: {},
        status: 200  // response.status
      }
    },
    ...
  ]
});
```

在请求异常的时候把异常信息通过 `PROXY_REQUEST_ERROR` 事件传给 webview

```js
// IDE 返回的消息
postMessage({
  type: "PROXY_REQUEST_ERROR",
  data: [
    {
      requestId: "请求id（唯一标识）",
      message: "错误信息"
    },
    ...
  ]
});
```

#### 6. 更新 getway
```js
// Webview 发送的消息
postMessage({
  type: "UPDATE_GATEWAY",
});
```

### Code Chat
#### 1. 将 webview 代码块插入到 IDE 中
> IDE 需要根据当前用户在 editor 中的光标选中的内容或者光标所在的位置来进行内容（代码）的替换或者插入。
```js
postMessage({
  type: "INSERT_TO_EDITOR",
  data: "需要插入的代码块（如有换行符等需要带上）",
});
```
#### 2. 将 webview 代码 merge 到 IDE 中并进行 diff 操作
> IDE 需要根据当前用户在 editor 中的光标选中的内容或者光标所在的位置来进行内容（代码）的替换或者插入，若选中某个代码片段，则需要与该代码片段进行 diff 操作（类似于 git diff）。
```js
postMessage({
  type: "INSERT_WITH_DIFF",
  data: "需要插入并且进行 diff 的代码块"
})
```
#### 3. 获取文件列表
> IDE 需要根据传过来的关键字进行路径匹配获取文件列表并返回

```js
// IDE 收到的消息
postMessage({
  type: "GET_WORKSPACE_FILES",
  data: {
    keyword: "搜索关键字",
    max: 10    // 可能不传，不传时默认为 10
  }
});
```

- `keyword` 为空表示获取当前打开的文件
- `keyword` 不为空时则根据匹配当前工作空间下的文件并返回
- `keyword` 匹配时大小写不敏感
- 需要过滤掉 c 和 lpc 文件
- 未匹配到任何结果时 `data` 返回空数组

```js
// IDE 返回的消息
postMessage({
  type: "WORKSPACE_FILES",
  data: [
    {
      path: "相对路径",
      content: "文件内容",
      fileName: "文件名"
    },
    ...
  ]
});
```

#### 4. 获取编辑器中当前文件信息
```js
// IDE 收到的消息
postMessage({
  type: "GET_EDITOR_FILE_STATE",
});
```

#### 5. 更新 Chat 快捷键设置
> Webview 通知 IDE 用户修改了 Chat 发送快捷键，IDE 需要同步更新本地配置。

```js
// Webview 发送的消息
postMessage({
  type: "UPDATE_CHAT_SUBMIT_KEY",
  data: {
    submitKey: "Enter" | "Ctrl + Enter" | "Shift + Enter" | "Alt + Enter" | "Command + Enter"
  }
});
```

支持的快捷键枚举值：
- `"Enter"` - 回车键
- `"Ctrl + Enter"` - Ctrl + 回车键（Windows/Linux）
- `"Command + Enter"` - Command + 回车键（macOS）
- `"Shift + Enter"` - Shift + 回车键
- `"Alt + Enter"` - Alt + 回车键

#### 6. Chat 回复完成通知
> 当 AI 回复完成（或出错/取消）后，Webview 会发送该事件通知 IDE。IDE 监听到后可调用 `vscode.window.showInformationMessage` 等系统级通知 API 弹窗提示用户。

```js
postMessage({
  type: "CHAT_REPLY_DONE",
  data: {
    topic: "会话主题（可选）",
    success: true,
  }
});
```

### Code Review
#### 1. 获取 IDE 中缓存的用户 review 数据（目前只是 vscode 需要触发这个事件）
> IDE 监听到该事件后，获取本地用户缓存的 review 数据，并通过 `IDE_CACHE_REVIEWS` 事件广播到 Webview 中。
```js
postMessage({
  type: "GET_IDE_CACHE_REVIEWS"
});
```
#### 2. 打开某个对应的文件
> IDE 监听到该事件后，打开某个文件
```js
postMessage({
  type: "OPEN_REVIEW_FILE",
  data: "文件相对路径"
});
```
### Code Search

#### 1. 发送 Code Search 请求

> IDE 监听到该事件之后，发送 Search 请求，成功获取到返回数据之后再通过 `receiveSearchData` 事件回传搜索结果

```js
postMessage({
  type: "REQUEST_CODE_SEARCH",
  data: "Search请求body参数"
});
```

## IDE 到 Webview

### 通用
1. 粘贴内容到 Webview 内的输入框中
> IDE 监听到 `KEYBOARD_PASTE` 事件后，触发该事件，将剪切板的内容发送到 Webview 中
```js
postMessage({
  type: 'APPLY_KEYBOARD_PASTE',
  data: '需要粘贴的内容',
});
```

### Code Chat
#### 1. 对某个代码片段，进行 chat 操作
> IDE 选择某段代码后，右键 `Codemaker > CodeMaker:Chat`。

```js
postMessage({
  type: 'CHAT_INSERT_CODE',
  data: {
    content: '代码块或者内容',
    language: '代码块语言，一般上根据当前文件后缀判断，各个 IDE 应该有对应的 API 可以获取到',
    path: '代码块所属文件的路径（取当前 workspace 下的相对路径即可）',
  },
});
```

#### 2. 对某个代码片段进行快速 chat 操作，简单来说是 `pre prompt + 代码片段` 的操作，用户可以将问题结合代码块一并发给 CodeMaker 进行 chat。
> IDE 选择某段代码后，右键`Codemaker > CodeMaker: XXX`

```js
// CodeMaker: Find Probleam
postMessage({
  type: 'CHAT_ACTION',
  data: {
    code: '代码片段',
    language: '代码片段语言',
    prompt_prefix: '请找出下面这段代码存在的问题'
  },
});

// CodeMaker: Optimize
postMessage({
  type: 'CHAT_ACTION',
  data: {
    code: '代码片段',
    language: '代码片段语言',
    prompt_prefix: '请优化下面这段代码'
  },
});

// CodeMaker: Explain
postMessage({
  type: 'CHAT_ACTION',
  data: {
    code: '代码片段',
    language: '代码片段语言',
    prompt_prefix: '请解释下面这段代码'
  },
});
```
#### 3.导出历史会话
```js
postMessage({
  type: 'EXPORT_FILE',
  data: {
  	content: '导出的会话内容',
  	filename: '默认的导出名字',
  },
});
```

#### 4. 返回编辑器中当前文件信息

```js
postMessage({
  type: 'EDITOR_FILE_STATE',
  data: {
		// 当前文件元信息
		current_file: {
			// 文件内容
			content: string;
			// 文件路径
			path: string;
			// 文件名称
			file_name: string;
			// 文件语言
			language: string;
		};
		// 光标位置信息
		cursor_position: {
			line: number;
			character: number;
		};
		// 光标选中区域
		selection: {
			// 光标选中区域的起始位置
			start: {
				line: number;
				character: number;
			};
			// 光标选中区域的结束位置
			end: {
				line: number;
				character: number;
			};
		};
	}
});
```

### Code Review
#### 1. 对某段代码进行 Review 分析
> IDE 选择某段代码后，右键 `Codemaker > CodeMaker:Review > Review with xxx`，`xxx`分别为 `bugsensor` 和 `gpt`。
```js
postMessage({
  type: 'REVIEW_CODE',
  data: {
    workspace: '',
    code:'代码块',
    // 选中的代码开始行号
    startLine: 0,
    // 选中的代码结束行号
    endLine: 10,
    language: '代码块语言',
    file: '文件名',
    path: '文件的相对路径',
    // bugsensor 或者是是 gpt
    mode: 'bugsensor',
  },
});
```
#### 2. 回传 IDE 中缓存的用户 review 数据（仅 vscode 下）
> 监听 Webview 的 `GET_IDE_CACHE_REVIEWS` 事件时，获取本地缓存并且广播
```ts
postMessage({
  type: 'IDE_CACHE_REVIEWS',
  data: {
    workspace: '',
    reviews: {
      [workspace: string]: {
        workspaceName: 'xxx',
        filesInfo: []
      }
    }
  },
});
```
#### 3. focus 到 Code Review 文件目录下对应的文件
> 当切换当前 focus 的文件时，触发该事件，将文件相对路径广播给 Webview，`filePath` 需要和 *第1点* 中的 path 保持一致的获取逻辑。
```js
postMessage({
  type: 'currentFileChange',
  data: {
    filePath: '文件的相对路径',
  },
});
```


# Plugin Interface (插件市场接口)

```js
const payload = {
  // 应用标识
  app_id: '',
  action: {
    // IDE上新建文件/IDE上修改文件/Webview进行chat
    name: 'create/insert/chat',
    // 其他操作相关的参数
    params: {},
  },
  shortcut: {
    // 快捷操作
    action: 'create/insert/chat', // 快捷指令类型
    name: 'xxx', // 快捷指令名字
  },
  app_settings: {},
  // 当前文件元信息
  current_file: {
    // 文件内容
    content: '',
    // 文件路径
    path: '',
    // 文件名
    file_name: '',
    // 语言ID
    language: '',
  },
  cursor_position: {
    // 光标位置
    line: 0,
    character: 0,
  },
  selection: {
    // 光标选中范围
    start: {
      // 选中起始位置
      line: 0,
      character: 0,
    },
    end: {
      // 选中结束位置
      line: 0,
      character: 0,
    },
  },
  // 用户输入描述 (prompt)
  description: '',
  // 其他参考信息
  reference: {
    // 知识库片段
    docsets: [],
    // 代码库片段
    codebase: [],
    // 本地文件
    files: [],
    // 代码片段
    code_snippets: [],
  },
  // 可拓展的额外字段
  extends: {
    // 当前会话 id
    session_id: '',
    // 当前 message id
    message_id: '',
  },
};

```