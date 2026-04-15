# Codemaker Web Ui

### 开始

```sh
pnpm dev
```

### 代码提交
```sh
pnpm run prettier

# 确保无错误再提交
pnpm run build
```

### ⚠️开发时需要注意的点

1. 由于复制粘贴并非使用原生的原因，需要通过操作 input 或者 textarea 来修改元素的 value，而使用了 `chakra-react-select` 的组件，因为组件的设计和展示的问题，需要添加一个 props: `inputId`，值为 `chakra-react-select-xxx`，其中 xxx 为该组件的 `name`。譬如：
```tsx
<Select<GroupValue, false, GroupBase<GroupValue>>
	name="code"
	inputId="chakra-react-select-code"
/>
```