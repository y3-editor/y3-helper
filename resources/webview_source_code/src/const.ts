
export const SmallScreenWidth = '(max-width: 280px)';
export const MediumScreenWidth = '(max-width: 340px)';
export const LargeScreenWidth = '(min-width: 340px)';
export const MediumPlusScreenWidth = '(max-width: 500px)';

const PROMPT_CODE_VARIABLE = '{{%code%}}';

/**
 * 1. 通过 html 渲染环境变量
 * 2. 本地启动时在 vite.config.ts 设置 __CODEMAKER_API_URL__
 * 3. 线上环境在 nginx 设置 __CODEMAKER_API_URL__
 * 4. 默认情况下保底请求正式环境
 */
export const CODEMAKER_API_URL = (window as any).CODEMAKER_API_URL;

/**
 * 规范框架初始化指令
 * 用户点击初始化链接时，发送对应的预设指令消息
 */
export const SPEC_INIT_PROMPTS = {
  /** OpenSpec 初始化指令 */
  openspec: `请完成 openspec 初始化
1. 执行 openspec init --tools none
2. 请读取 openspec/project.md 文件，分析当前仓库并完善
`,
  /** SpecKit 初始化指令 (待补充具体内容) */
  speckit: `请完成 SpecKit 初始化
{{待补充：SpecKit 初始化具体步骤}}
`,
} as const;


export const CHAT_SAMPLES = [
  {
    id: 0,
    title: '解释代码',
    description: '这份代码文件是做什么的？可以给我解释一下每个函数和参数吗？',
    prompt: `这份代码文件 ${PROMPT_CODE_VARIABLE} 是做什么的？可以给我解释一下每个函数和参数吗？`,
  },
  {
    id: 1,
    title: '重构代码',
    description: '用 Java 把这份代码重写一遍吧！',
    prompt: `用 Java 把这份代码 ${PROMPT_CODE_VARIABLE} 重写一遍吧！`,
  },
  {
    id: 2,
    title: '生成代码',
    description: '用 Python 给我写一个 Flappy Bird 游戏吧！',
    prompt: '用 Python 给我写一个 Flappy Bird 游戏吧！',
  },
  {
    id: 3,
    title: '学习代码',
    description: '这份代码涉及到哪些技术点？我可以怎么快速学习上手呢？',
    prompt: `这份代码 ${PROMPT_CODE_VARIABLE} 涉及到哪些技术点？我可以怎么快速学习上手呢？`,
  },
  {
    id: 4,
    title: '优化代码',
    description:
      '帮我分析出这份代码存在的编码、安全或性能问题，给我一些优化的建议',
    prompt: `帮我分析出这份代码 ${PROMPT_CODE_VARIABLE} 存在的编码、安全或性能问题，给我一些优化的建议`,
  },
];

// eslint-disable-next-line react-refresh/only-export-components
export const CODEBASE_CHAT_SAMPLES = [
  // 📝 仓库理解与分析
  {
    id: 0,
    title: '功能模块',
    description: '仓库的主要功能模块和设计思路是什么？',
    prompt: `仓库的主要功能模块和设计思路是什么？`,
    category: 'repo',
  },
  {
    id: 1,
    title: '技术栈分析',
    description: '项目使用了哪些核心技术栈和第三方依赖？',
    prompt: `项目使用了哪些核心技术栈和第三方依赖？`,
    category: 'repo',
  },
  {
    id: 2,
    title: '资源结构',
    description: '游戏资源（模型、配置、脚本）的存储结构是怎样的？',
    prompt: `游戏资源（模型、配置、脚本）的存储结构是怎样的？`,
    category: 'repo',
  },
  {
    id: 3,
    title: '版本管理',
    description: '仓库如何管理不同版本的资源和代码分支？',
    prompt: `仓库如何管理不同版本的资源和代码分支？`,
    category: 'repo',
  },
  {
    id: 4,
    title: '热更新机制',
    description: '项目中的资源热更新机制是如何实现的？',
    prompt: `项目中的资源热更新机制是如何实现的？`,
    category: 'repo',
  },
  // 🔍 代码搜索与问答
  {
    id: 5,
    title: '入口函数',
    description: '找到该项目运行的入口函数',
    prompt: `找到该项目运行的入口函数`,
    category: 'search',
  },
  {
    id: 6,
    title: '资源加载',
    description: '资源加载的核心实现逻辑在哪里？',
    prompt: `资源加载的核心实现逻辑在哪里？`,
    category: 'search',
  },
  {
    id: 7,
    title: '存档功能',
    description: '游戏存档 / 读档功能的代码在哪个模块？',
    prompt: `游戏存档 / 读档功能的代码在哪个模块？`,
    category: 'search',
  },
  {
    id: 8,
    title: 'AI 决策',
    description: '敌人 AI 决策逻辑的核心算法是什么？',
    prompt: `敌人 AI 决策逻辑的核心算法是什么？`,
    category: 'search',
  },
  {
    id: 9,
    title: '移动碰撞',
    description: '角色移动与碰撞检测的实现原理是什么？',
    prompt: `角色移动与碰撞检测的实现原理是什么？`,
    category: 'search',
  },
  // 🪄 代码生成与应用
  {
    id: 10,
    title: 'README文件',
    description: '为当前项目生成一份README文件',
    prompt: `为当前项目生成一份README文件`,
    category: 'gen',
  },
  {
    id: 11,
    title: 'UI界面框架',
    description: '生成游戏的UI界面框架（主菜单/设置面板）',
    prompt: `生成游戏的UI界面框架（主菜单/设置面板）`,
    category: 'gen',
  },
  {
    id: 12,
    title: '异步加载',
    description: '生成资源异步加载的通用代码',
    prompt: `生成资源异步加载的通用代码`,
    category: 'gen',
  },
  {
    id: 13,
    title: '战斗系统',
    description: '生成回合制战斗系统的基础代码模板',
    prompt: `生成回合制战斗系统的基础代码模板`,
    category: 'gen',
  },
  {
    id: 14,
    title: '事件总线',
    description: '实现一个游戏事件总线（Event Bus）机制',
    prompt: `实现一个游戏事件总线（Event Bus）机制`,
    category: 'gen',
  },
  // 🚀 项目构建与运行
  {
    id: 15,
    title: '构建运行',
    description: '如何构建和运行当前项目',
    prompt: `如何构建和运行当前项目`,
    category: 'run',
  },
  {
    id: 16,
    title: '环境依赖',
    description: '这个项目的环境依赖有哪些？',
    prompt: `这个项目的环境依赖有哪些？`,
    category: 'run',
  },
  {
    id: 17,
    title: '本地开发',
    description: '配置和启动当前游戏的本地开发环境',
    prompt: `配置和启动当前游戏的本地开发环境`,
    category: 'run',
  },
  {
    id: 18,
    title: '多平台构建',
    description: '构建不同平台（PC/移动/Web）的游戏包，仓库需要做哪些调整？',
    prompt: `构建不同平台（PC/移动/Web）的游戏包，仓库需要做哪些调整？`,
    category: 'run',
  },
  {
    id: 19,
    title: '包体优化',
    description: '如何优化游戏构建后的包体大小？',
    prompt: `如何优化游戏构建后的包体大小？`,
    category: 'run',
  },
];