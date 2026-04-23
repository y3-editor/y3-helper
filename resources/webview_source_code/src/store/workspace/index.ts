import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { isEqual } from 'lodash';
import constructReActPrompt from './constructReActPrompt';
import constructH75Prompt from './constructH75Prompt';
import { BroadcastActions } from '../../PostMessageProvider';
import { useMCPStore } from '../mcp';
import { getToolsEN } from './toolsEN';
import { getTools } from './tools';
import constructRemixPrompt from './constructRemixPrompt';
import { useChatApplyStore } from '../chatApply';
import constructToolCallPrompt from './constructToolCallPrompt';
import { IDE, useExtensionStore } from '../extension';
import { useChatTerminalStore } from '../chatTerminal';
import { devcloudOfficeRequest } from '../../services';
import { IMultiAttachment, useChatStore } from '../chat';
import { minimatch } from 'minimatch';
import { AttachType } from '../attaches';
import { useSkillsStore } from '../skills';

export enum LocalRepoType {
  GIT = 'git',
  SVN = 'svn',
  PERFORCE = 'p4',
  NO_REPO = 'noRepo',
}

export interface DevSpaceOption {
  _id: string;
  name: string;
  project: string;
  data: {
    knowledge_bases: {
      knowledge_base_id: string;
      knowledge_base_name: string;
      env: string;
    }[];
    codebases: {
      codebase_id: string;
      codebase_name: string;
    }[];
    code_styles: {
      style: string;
    }[];
    repos: {
      address: string;
      path: string[];
      type: 'gitlab' | 'svn';
    }[];
    ai_repo_chats: {
      ignore_paths: string[];
      allow_paths: string[];
    }[];
    allow_public_model_access?: boolean;
    rules: {
      code: string;
      name: string;
      data: {
        codeMaker: "string";
      }
    }[];
  }
}

export interface DevSpace {
  _id: string;
  name: string;
  project: string;
  knowledge_bases: {
    knowledge_base_id: string;
    knowledge_base_name: string;
    env: string;
  }[];
  codebases: {
    codebase_id: string;
    codebase_name: string;
  }[];
  code_style: string;
  ignore_paths: string[];
  allow_paths: string[];
  allow_public_model_access?: boolean;
  repos: {
    address: string;
    path: string[];
    type: 'gitlab' | 'svn';
  }[];
  rules: {
    code: string;
    name: string;
    data: {
      codeMaker: "string";
    }
  }[];
}

export interface WorkspaceInfo {
  workspace: string;
  repoUrl: string;
  repoName: string;
  osName: string;
  shell: string;
  currentFilePath: string;
  openFilePaths: string[];
  repoCodeTable: string;
  codebaseCustomPrompt: string;
  repoType: LocalRepoType;
}

export interface Tool {
  type: string;
  function: {
    name: string;
    description: string;
    parameters?: {
      type: string;
      properties: any;
      required: string[];
    };
  };
}

/**
 * Rule的元信息
 */
export interface RuleMetaData {
  /** 规则名称/别名 */
  name?: string;
  /** 规则描述 */
  description?: string;
  /** 文件匹配模式 */
  globs?: string[];
  /** 是否默认引入 */
  alwaysApply: boolean;
  /** 兼容cursor的嵌套目录rules用，标记生效的路径 */
  nestedPath?: string;
  /** 规则来源 */
  source?: 'codemaker' | 'cursor' | 'cline' | 'devspace' | 'original';
}

/**
 * 完整的Rule对象
 */
export interface Rule {
  /** 元信息 */
  metaData: RuleMetaData;
  /** 规则名称 */
  name: string;
  /** 规则内容 */
  content: string;
  /** 文件路径 */
  filePath: string;
  /** 最后修改时间 */
  lastModified?: number;
}

/**
 * Spec 框架类型枚举
 */
export enum SpecFramework {
  OpenSpec = 'openspec',
  SpecKit = 'speckit',
  Unknown = 'unknown',
}

/**
 * Setup 步骤 ID 枚举
 */
export enum SpecSetupStepId {
  // OpenSpec 步骤 (2 步)
  OpenspecCli = 'openspec-cli',
  OpenspecInit = 'openspec-init',
  // SpecKit 步骤 (2 步)
  SpecifyCli = 'specify-cli',
  SpeckitInit = 'speckit-init',
  // OpenSpec 升级步骤 (3 步)
  UpgradeVersionCheck = 'upgrade-version-check',
  UpgradeCli = 'upgrade-cli',
  UpgradeMigrateDocs = 'upgrade-migrate-docs',
}

/**
 * Spec 初始化步骤状态
 */
export enum SpecSetupStepStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
}

/**
 * Setup 错误码枚举
 * Webview 通过 TIPS 映射表根据错误码展示对应提示
 */
export enum SpecSetupErrorCode {
  // OpenSpec 错误码
  NODE_UNAVAILABLE = 'NODE_UNAVAILABLE',           // Node.js 未安装
  NODE_VERSION_INVALID = 'NODE_VERSION_INVALID',   // Node.js 版本不满足要求
  OPENSPEC_CLI_UNAVAILABLE = 'OPENSPEC_CLI_UNAVAILABLE', // OpenSpec CLI 安装失败
  OPENSPEC_INIT_FAILED = 'OPENSPEC_INIT_FAILED',   // OpenSpec 初始化失败

  // SpecKit 错误码
  UV_UNAVAILABLE = 'UV_UNAVAILABLE',               // uv 未安装
  SPECIFY_CLI_UNAVAILABLE = 'SPECIFY_CLI_UNAVAILABLE', // Specify CLI 安装失败
  SPECKIT_INIT_FAILED = 'SPECKIT_INIT_FAILED',     // SpecKit 初始化失败

  // OpenSpec 升级错误码
  UPGRADE_NOT_023 = 'UPGRADE_NOT_023',             // 非 0.23 版本，无需升级
  UPGRADE_CLI_FAILED = 'UPGRADE_CLI_FAILED',       // CLI 升级失败
  UPGRADE_MIGRATE_FAILED = 'UPGRADE_MIGRATE_FAILED', // 文档迁移失败
}

/**
 * 单个初始化步骤
 */
export interface SpecSetupStep {
  /** 步骤 ID */
  id: SpecSetupStepId;
  /** 步骤状态 */
  status: SpecSetupStepStatus;
  /** 错误码 (仅在 status 为 failed 时有值) */
  errorCode?: SpecSetupErrorCode;
  /** 错误信息 (仅在 status 为 failed 时有值，用于调试) */
  errorMessage?: string;
  /** 进度消息 (仅在 status 为 running 时有值，用于显示当前正在执行的操作) */
  progressMessage?: string;
}
/**
 * OpenSpec Setup 状态 (2 步)
 */
export interface OpenSpecSetupStatus {
  openspecCli: SpecSetupStep;
  openspecInit: SpecSetupStep;
  /** 检测到的全局 CLI 版本号 */
  cliVersion?: string;
}

/**
 * SpecKit Setup 状态 (2 步)
 */
export interface SpecKitSetupStatus {
  specifyCli: SpecSetupStep;
  speckitInit: SpecSetupStep;
}

/**
 * OpenSpec 升级状态 (0.23 -> 1.x)
 * 3 步：版本检测 → CLI 升级 → 文档迁移
 */
export interface OpenSpecUpgradeStatus {
  /** 版本检测 (检测是否为 0.23) */
  versionCheck: SpecSetupStep;
  /** CLI 升级 (npm install 1.x) */
  cliUpgrade: SpecSetupStep;
  /** 文档迁移 (openspec update --force) */
  migrateDocs: SpecSetupStep;
  /** 升级后的版本号 */
  upgradedVersion?: string;
}

/**
 * 完整 Setup 状态
 */
export interface SpecSetupStatus {
  openspec: OpenSpecSetupStatus;
  speckit: SpecKitSetupStatus;
  /** OpenSpec 升级状态 (仅升级流程中有值) */
  openspecUpgrade?: OpenSpecUpgradeStatus;
}

/**
 * 单个 Spec 文件信息
 */
export interface SpecFileInfo {
  /** 相对于工作区根目录的路径 */
  path: string;
  /** 文件名 */
  name: string;
  /** 文件内容 */
  content: string;
  /** 最后修改时间戳 */
  lastModified: number;
}

/**
 * Capability 信息 (OpenSpec)
 */
export interface CapabilityInfo {
  /** capability 标识 (目录名) */
  id: string;
  /** 显示名称 */
  name: string;
  /** spec.md 文件信息 */
  specFile: SpecFileInfo;
  /** design.md 文件信息 (可选) */
  designFile?: SpecFileInfo;
}

/**
 * Change 信息 (OpenSpec)
 */
export interface ChangeInfo {
  /** change 标识 (目录名) */
  id: string;
  /** proposal.md 文件信息 */
  proposalFile: SpecFileInfo;
  /** tasks.md 文件信息 (可选) */
  tasksFile?: SpecFileInfo;
  /** design.md 文件信息 (可选) */
  designFile?: SpecFileInfo;
  /** delta specs 文件列表 */
  specFiles: SpecFileInfo[];
}

/**
 * SpecKit Feature 信息
 * Feature 是 SpecKit 中的核心概念，包含规格和实现规划
 */
export interface SpecKitFeatureInfo {
  /** 特性标识 (目录名，如 "001-create-taskify") */
  id: string;
  /** 特性名称 (解析自 id，如 "create-taskify") */
  name: string;
  /** spec.md 文件信息 */
  specFile?: SpecFileInfo;
  /** plan.md 文件信息 (技术规划) */
  planFile?: SpecFileInfo;
  /** tasks.md 文件信息 (任务列表) */
  tasksFile?: SpecFileInfo;
  /** research.md 文件信息 (技术调研) */
  researchFile?: SpecFileInfo;
  /** data-model.md 文件信息 (数据模型) */
  dataModelFile?: SpecFileInfo;
  /** quickstart.md 文件信息 (快速启动指南) */
  quickstartFile?: SpecFileInfo;
  /** checklist.md 文件信息 (检查清单) */
  checklistFile?: SpecFileInfo;
  /** contracts/ 目录下的接口契约文件 */
  contractFiles: SpecFileInfo[];
}

/**
 * SpecKit 配置信息
 * 存储在 .specify/ 目录下的配置和模板
 */
export interface SpecKitConfigInfo {
  /** constitution.md 文件信息 (项目治理原则) */
  constitutionFile?: SpecFileInfo;
  /** templates/ 目录下的模板文件 */
  templateFiles: SpecFileInfo[];
}

/**
 * 单个框架的 Spec 信息
 */
export interface FrameworkSpecInfo {
  /** 框架类型 */
  framework: SpecFramework;
  /** spec 根目录路径 (相对路径) */
  rootPath: string;
  /** 项目上下文信息 (OpenSpec 的 project.md 内容) */
  projectContext?: string;
  /** capability 列表 (OpenSpec) */
  capabilities: CapabilityInfo[];
  /** 活跃的 change 列表 (不包含 archive) (OpenSpec) */
  activeChanges: ChangeInfo[];
  /** SpecKit 配置信息 (SpecKit) */
  configInfo?: SpecKitConfigInfo;
  /** Feature 列表 (SpecKit) */
  features?: SpecKitFeatureInfo[];
  /** 是否已完成初始化 */
  isInitialized?: boolean;
  /** OpenSpec 文档版本 (OpenSpec) */
  version?: '0.23' | '1.x' | 'unknown';
}

/**
 * 完整的 Spec 信息 (支持多框架)
 */
export interface SpecInfo {
  /** 所有检测到的框架信息 */
  frameworks: FrameworkSpecInfo[];
  /** 最后扫描时间戳 */
  lastScanTime: number;
  /** 各框架的初始化状态 */
  setupStatus?: SpecSetupStatus;
}

export type WorkspaceStore = {
  workspaceInfo: WorkspaceInfo;
  /** 规范框架初始化状态信息 */
  specInfo: SpecInfo;
  devSpace: DevSpace;
  devSpaceOptions: DevSpaceOption[];
  workspaceList: any[];
  currentFileAutoAttach: boolean;
  rules: Rule[];
  teamRules: Rule[];
  setWorkspaceInfo: (info: Partial<WorkspaceInfo>) => void;
  /** 更新规范信息 */
  updateSpecInfo: (info: SpecInfo) => void;
  /** 判断指定规范框架是否已初始化 */
  isSpecFrameworkInitialized: (framework: SpecFramework) => boolean;
  /** 获取指定框架的 Spec 信息 */
  getFrameworkSpecInfo: (framework: SpecFramework) => FrameworkSpecInfo | undefined;
  /** 请求 IDE 获取最新的 Spec 信息 */
  requestSpecInfo: () => void;
  getCodebaseChatSystemPrompt: (options?: {
    isReAct?: boolean,
    effectiveRules: Rule[]
  }) => string;
  getCodebaseChatTools: () => Tool[];
  getCodebaseFunctionPrompt: () => string;
  setDevSpace: (newDevSpace: DevSpace) => void;
  setDevSpaceOptions: (options: DevSpaceOption[]) => void;
  setWorkspaceList: (list: any[]) => void;
  syncDevSpaceOptions: () => void;
  setCurrentFileAutoAttach: (autoAttach: boolean) => void;
  setRules: (rules: Rule[]) => void;
  setTeamRules: (rules: Rule[]) => void;
  selectedRules: string[];
  selectedCodebases: string[];
  selectedKnowledgeBases: string[];
  setSelectedRules: (rules: string[]) => void;
  setSelectedCodebases: (codebases: string[]) => void;
  setSelectedKnowledgeBases: (knowledgeBases: string[]) => void;
  /** Spec 初始化弹窗可见性 */
  initModalVisible: boolean;
  /** 设置 Spec 初始化弹窗可见性 */
  setInitModalVisible: (visible: boolean) => void;
  /** 当前选中的 Spec 框架（用于初始化弹窗） */
  currentSpecFramework: SpecFramework | null;
  /** 设置当前选中的 Spec 框架 */
  setCurrentSpecFramework: (framework: SpecFramework | null) => void;
  /** OpenSpec 升级弹窗可见性 */
  openspecUpdateModalVisible: boolean;
  /** 设置 OpenSpec 升级弹窗可见性 */
  setOpenspecUpdateModalVisible: (visible: boolean) => void;
};

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      workspaceInfo: {
        workspace: '',
        repoUrl: '',
        repoName: '',
        osName: '',
        shell: '',
        currentFilePath: '',
        openFilePaths: [],
        repoCodeTable: '',
        codebaseCustomPrompt: '',
        repoType: LocalRepoType.NO_REPO
      },
      specInfo: {
        frameworks: [],
        lastScanTime: 0,
      },
      devSpace: {
        _id: '',
        name: '',
        project: '',
        knowledge_bases: [],
        codebases: [],
        code_style: '',
        ignore_paths: [],
        allow_paths: [],
        allow_public_model_access: false,
        repos: [],
        rules: []
      },
      devSpaceOptions: [],
      workspaceList: [],
      currentFileAutoAttach: false,
      rules: [],
      teamRules: [],
      selectedCodebases: [],
      selectedKnowledgeBases: [],
      selectedRules: [],
      setWorkspaceInfo(info) {
        const workspaceInfo = get().workspaceInfo;
        const newInfo = {
          ...workspaceInfo,
          ...info,
        };

        if (isEqual(workspaceInfo, newInfo)) {
          return;
        }

        set({
          workspaceInfo: newInfo,
        });
        if (newInfo.repoCodeTable && newInfo.repoName) {
          // 缓存关联代码地图
          const codeTableCacheStr =
            window.localStorage.getItem('codeTableCache') || '{}';
          const codeTableCache = JSON.parse(codeTableCacheStr);
          codeTableCache[newInfo.repoName] = newInfo.repoCodeTable;
          window.localStorage.setItem(
            'codeTableCache',
            JSON.stringify(codeTableCache),
          );
        } else if (!newInfo.repoCodeTable && newInfo.repoName) {
          // 读取缓存关联代码地图
          const codeTableCacheStr =
            window.localStorage.getItem('codeTableCache') || '{}';
          const codeTableCache = JSON.parse(codeTableCacheStr);
          const repoCodeTable = codeTableCache[newInfo.repoName];
          if (repoCodeTable && repoCodeTable !== 'dep35_test') {
            set({
              workspaceInfo: {
                ...newInfo,
                repoCodeTable,
              },
            });
          }
        }
      },
      updateSpecInfo(info: SpecInfo) {
        const specInfo = get().specInfo;

        if (isEqual(specInfo, info)) {
          return;
        }

        set({
          specInfo: info,
        });
      },
      isSpecFrameworkInitialized(framework: SpecFramework) {
        const specInfo = get().specInfo;
        return specInfo.frameworks.some(f => f.framework === framework);
      },
      getFrameworkSpecInfo(framework: SpecFramework) {
        const specInfo = get().specInfo;
        return specInfo.frameworks.find(f => f.framework === framework);
      },
      requestSpecInfo() {
        // 向 IDE 发送请求，获取最新的 Spec 信息
        (window as any).parent.postMessage(
          {
            type: BroadcastActions.GET_SPEC_INFO,
            data: {},
          },
          '*',
        );
      },
      setDevSpace(newDevSpace) {
        // 如果配置了 ignore_path，同步给插件
        if (newDevSpace.ignore_paths) {
          (window as any).parent.postMessage({
            type: BroadcastActions.UPDATE_CODEBASE_IGNORE_PATH,
            data: {
              codebaseIgnorePath: newDevSpace.ignore_paths
            }
          }, '*')
        }
        if (newDevSpace.rules) {
          get().setTeamRules(newDevSpace.rules.map(rule => {
            return {
              metaData: {
                name: rule.name,
                alwaysApply: true,
                source: 'devspace'
              },
              name: rule.name,
              content: rule.data.codeMaker,
              filePath: rule.name
            }
          }));
        } else {
          get().setTeamRules([]);
        }
        set({
          devSpace: newDevSpace,
          selectedCodebases: newDevSpace.codebases.map(codebase => codebase.codebase_id),
          selectedKnowledgeBases: newDevSpace.knowledge_bases.map(knowledgeBase => knowledgeBase.knowledge_base_id)
        })
      },
      setDevSpaceOptions(options: DevSpaceOption[]) {
        set({
          devSpaceOptions: options
        });
      },
      setWorkspaceList(list: any[]) {
        set({
          workspaceList: list
        });
      },
      getCodebaseChatSystemPrompt(options: {
        isReAct?: boolean,
        effectiveRules: Rule[]
      } = {
          isReAct: false,
          effectiveRules: []
        }) {
        const { isReAct, effectiveRules } = options;
        const { workspace, osName, shell, openFilePaths, repoCodeTable, codebaseCustomPrompt } =
          get().workspaceInfo;
        const { enableNewApply } = useChatApplyStore.getState();
        const MCPServers = useMCPStore.getState().getAvailableMCPServers();
        const disabledSwitches = useMCPStore.getState().disabledSwitches;
        const isVSCode = useExtensionStore.getState().IDE === IDE.VisualStudioCode;
        const isJetbrains = useExtensionStore.getState().IDE === IDE.JetBrains;
        const enableTerminal = useChatTerminalStore.getState().enableTerminal;
        const codeMakerVersion = useExtensionStore.getState().codeMakerVersion || '';

        const code_style = get().devSpace.code_style;
        const { codebases } = get().devSpace;
        const hasCodeTable = codebases.length || repoCodeTable;

        // 过滤掉被禁用的 MCP 服务器
        const filteredMCPServers = MCPServers.filter(server => !disabledSwitches.has(server.name));

        let customPrompt = '';
        if (code_style) {
          customPrompt = code_style;
        } else if (codebaseCustomPrompt) {
          customPrompt = codebaseCustomPrompt;
        }
        if (isReAct) {
          return constructReActPrompt({
            info: { workspace, osName, shell, codebaseCustomPrompt: customPrompt },
            MCPServers: filteredMCPServers,
            enableTerminal,
            codeMakerVersion,
            isVSCode
          })
        }

        if (repoCodeTable && repoCodeTable.includes('h75_scripts_1211')) {
          return constructH75Prompt({ workspace, osName, openFilePaths, codebaseCustomPrompt: customPrompt });
        }

        const skills = useSkillsStore.getState().skills;

        if (enableNewApply) {
          const openspecVersion = get().getFrameworkSpecInfo(SpecFramework.OpenSpec)?.version;
          return constructRemixPrompt({
            info: { workspace, osName, shell, codebaseCustomPrompt: customPrompt },
            MCPServers: filteredMCPServers,
            codeMakerVersion,
            enableTerminal: enableTerminal && (isVSCode || isJetbrains),
            effectiveRules,
            skills,
            openspecVersion
          });
        } else {
          return constructToolCallPrompt({
            info: { workspace, osName, shell, openFilePaths, codebaseCustomPrompt: customPrompt },
            withCodeTable: !!hasCodeTable,
            MCPServers: filteredMCPServers,
            enableTerminal: enableTerminal && (isVSCode || isJetbrains),
            effectiveRules,
            skills
          });
        }
      },
      getCodebaseChatTools() {
        const { workspace } = get().workspaceInfo;
        const { codebases } = get().devSpace;
        const { enableNewApply } = useChatApplyStore.getState();
        const MCPServers = useMCPStore.getState().getAvailableMCPServers();
        const disabledSwitches = useMCPStore.getState().disabledSwitches;
        const enableTerminal = useChatTerminalStore.getState().enableTerminal;
        const codeMakerVersion = useExtensionStore.getState().codeMakerVersion || '';
        const isVSCode = useExtensionStore.getState().IDE === IDE.VisualStudioCode;

        // 过滤掉被禁用的 MCP 服务器
        const filteredMCPServers = MCPServers.filter(server => !disabledSwitches.has(server.name));

        let hasCodeTable = !!codebases.length;
        if (!hasCodeTable) {
          const recentUserMessage = useChatStore.getState().getRecentUserMessageFromCurrentSession()
          const attach = recentUserMessage?._originalRequestData?.attachs as IMultiAttachment
          hasCodeTable = attach?.attachType === AttachType.MultiAttachment && attach.dataSource.some(i => i.attachType === AttachType.CodeBase)
        }
        if (enableNewApply) {
          return getToolsEN({
            workspace,
            hasCodeTable,
            MCPServers: filteredMCPServers,
            enableTerminal,
            codeMakerVersion,
            isVSCode
          });
        } else {
          return getTools({
            workspace,
            hasCodeTable,
            MCPServers: filteredMCPServers,
            enableTerminal,
            codeMakerVersion,
            isVSCode
          });
        }
      },
      getCodebaseFunctionPrompt() {
        const chatTools = get().getCodebaseChatTools();
        let functionPrompt = '';
        chatTools.forEach((tool) => {
          functionPrompt += `${tool.function.name}${tool.function.description}${tool.function.parameters ? JSON.stringify(tool.function.parameters) : ''}`;
        });
        return functionPrompt;
      },
      syncDevSpaceOptions() {
        devcloudOfficeRequest.get('/api/v1/dev_spaces', {
          params: {
            _global: '1',
            _num: '50',
            _page: 1
          },
          headers: {
            'X-Auth-Project': 'dep305'
          }
        }).then((res: any) => {
          const data = res.data;
          if (data && data.items && data.items.length) {
            get().setDevSpaceOptions(data.items);
          }
        })
      },
      setCurrentFileAutoAttach(autoAttach) {
        set({
          currentFileAutoAttach: autoAttach
        })
      },
      setRules(rules: Rule[]) {
        const currentRules = get().rules;

        // 如果是初次设置或当前为空，直接设置
        if (currentRules.length === 0) {
          set({
            rules: rules
          });
          get().setSelectedRules(rules.map(rule => rule.filePath));
          return;
        }

        // 基于 filePath 进行智能更新，保持原有顺序
        const filePathMap = new Map(rules.map(rule => [rule.filePath, rule]));
        const updatedRules: Rule[] = [];

        // 首先保留现有规则的顺序，更新存在的规则
        currentRules.forEach(currentRule => {
          const updatedRule = filePathMap.get(currentRule.filePath);
          if (updatedRule) {
            updatedRules.push(updatedRule);
            filePathMap.delete(currentRule.filePath); // 从待处理中移除
          }
          // 如果不存在于新规则中，则被移除（不添加到 updatedRules）
        });

        // 然后添加新的规则（保持新规则的原始顺序）
        const newRules = Array.from(filePathMap.values());
        updatedRules.push(...newRules);
        set({
          rules: updatedRules
        });
        get().setSelectedRules(updatedRules.map(rule => rule.filePath));
      },
      setSelectedCodebases(codebases: string[]) {
        set({
          selectedCodebases: codebases
        })
      },
      setTeamRules(rules: Rule[]) {
        set({
          teamRules: rules
        })
      },
      setSelectedKnowledgeBases(knowledgeBases: string[]) {
        set({
          selectedKnowledgeBases: knowledgeBases
        })
      },
      setSelectedRules(rules: string[]) {
        set({
          selectedRules: rules
        })
      },
      initModalVisible: false,
      setInitModalVisible(visible: boolean) {
        set({
          initModalVisible: visible
        })
      },
      currentSpecFramework: null,
      setCurrentSpecFramework(framework: SpecFramework | null) {
        set({
          currentSpecFramework: framework
        })
      },
      openspecUpdateModalVisible: false,
      setOpenspecUpdateModalVisible(visible: boolean) {
        set({
          openspecUpdateModalVisible: visible
        })
      }
    }),
    {
      name: 'codemaker-workspace-config',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        devSpace: state.devSpace,
      }),
    }
  )
);


export function getEffectiveRules(options: {
  selectedRules: Rule[];
  mentionPaths: string[];
  oldVersion?: boolean;
  code_style?: string;
  codebaseCustomPrompt?: string;
}) {
  const { selectedRules, mentionPaths, oldVersion, code_style, codebaseCustomPrompt } = options;
  const effectiveRules: Rule[] = [];
  try {
    if (oldVersion) {
      if (code_style) {
        effectiveRules.push({
          metaData: {
            name: 'team rules',
            alwaysApply: true,
            source: 'devspace'
          },
          name: 'team rules',
          content: code_style,
          filePath: 'team_rules'
        });
      } else if (codebaseCustomPrompt) {
        effectiveRules.push({
          metaData: {
            description: 'Original codebase rule',
            alwaysApply: true,
            source: 'original'
          },
          name: '.codemaker.codebase.md',
          content: codebaseCustomPrompt,
          filePath: '.codemaker.codebase.md'
        });
      }
    } else {
      selectedRules.forEach((rule) => {
        if (rule.metaData.nestedPath) {
          if (!mentionPaths.some((filePath) => filePath.startsWith(rule.metaData.nestedPath as string))) {
            return false;
          }
        }
        if (rule.metaData.alwaysApply) {
          effectiveRules.push(rule);
        } else {
          if (rule.metaData.globs) {
            const matched = rule.metaData.globs.some((glob) => {
              return mentionPaths.some((mentionPath) => {
                if (mentionPath.includes(glob)) {
                  return true;
                } else {
                  return minimatch(mentionPath, glob);
                }
              })
            })
            if (matched) {
              effectiveRules.push(rule);
            }
          }
        }
      })
    }
  } catch (err) {
    console.error('获取有效规则失败', err);
    return [];
  }
  return effectiveRules;
}