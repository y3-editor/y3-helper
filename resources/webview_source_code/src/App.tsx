import * as React from 'react';
import {
  Box,
  Spinner,
  AlertStatus,
} from '@chakra-ui/react';
import {
  updateContexts as updateWebToolsContexts,
  hub as webToolsHub,
} from '@dep305/codemaker-web-tools';
import {
  BroadcastActions,
  PostMessageSubscribeType,
  SubscribeActions,
  usePostMessage,
} from './PostMessageProvider';
import { selectIsSpecStaging, useAuthStore } from './store/auth';
import Login from './components/Login';
import CodeChat from './routes/CodeChat';
import { IDE, useExtensionStore } from './store/extension';
import ContextMenu from './components/ContextMenu/ContextMenu';
import './utils/webvitals';
import { useConfigStore, TabsProps, SubmitKey } from './store/config';
import useCustomToast from './hooks/useCustomToast';
import 'simplebar-react/dist/simplebar.min.css';
import './index.scss';
import { createDebouncedToast } from './components/CustomToast/debounceToast';
import { CreateCustomToast } from './components/CustomToast';
import { isMacOS } from './utils';
import { useTheme, ThemeStyle } from './ThemeContext';
import { setCodeCoverageApiUrl } from './routes/CodeCoverage/const';
import { useWorkspaceStore } from './store/workspace';
import { useChatStore, ChatType } from './store/chat';
import ErrorBoundary from './components/ErrorBoundary';
import { useMCPStore } from './store/mcp';
import UserDashboard from './components/UserDashboard/UserDashboard';
import { useChatApplyStore } from './store/chatApply';
import { useChatConfig } from './store/chat-config';
import { ChatModel, ParseImgType, ModelIconType, ChatModelType } from './services/chatModel';
import { fetchBuiltInServers, fetchNameMappings, fetchPrivateModelOnlyServers } from './services/mcp';
import { useChatTerminalStore } from './store/chatTerminal';
import { usePanelContext } from './context/PanelContext';
import { useSkillsStore } from './store/skills';
import { FeatureTour } from './components/FeatureTour';
import { useLoadWorkspace } from './hooks/useLoadWorkspace';

const debouncedToast = createDebouncedToast();

function toastMessage(content: string, status: AlertStatus) {
  return debouncedToast({
    title: content,
    status,
    duration: 5000,
    position: 'top',
    isClosable: true,
    render: CreateCustomToast,
  });
}

// TODO：插件端的 Tab 和 Webview 的 Tab 对应不上，所以先做一层映射，后续统一
const TabsMap: Record<string, string> = {
  chat: 'codeChat',
  review: 'codeReview',
  scan: 'codeScan',
  coverage: 'coverage',
  search: 'codeSearch',
  discussion: 'codeDicussion',
  help: 'help',
};
const minWidth = 168;

function App() {
  const { postMessage } = usePostMessage();

  const {
    panelId,
    restoreSessionId,
    isPanelMode,
    initialChatType,
  } = usePanelContext();
  const [chatType] = useChatStore((state) => [state.chatType]);
  const tabs = useConfigStore((state) => state.config.tabs);
  const currentTab = useConfigStore((state) => state.config.currentTab);
  const updateConfig = useConfigStore((state) => state.updateConfig);
  const extensionStore = useExtensionStore();
  const accessToken = useAuthStore((state) => state.accessToken);
  const ide = useExtensionStore((state) => state.IDE);
  const setWorkspaceInfo = useWorkspaceStore((state) => state.setWorkspaceInfo);
  const setWorkspaceList = useWorkspaceStore((state) => state.setWorkspaceList);
  const setCurrentFileAutoAttach = useWorkspaceStore(
    (state) => state.setCurrentFileAutoAttach,
  );
  const [loginLoading, setLoginLoading] = React.useState(true);
  const authStore = useAuthStore();
  const { setSystemTheme } = useTheme();
  const setMCPServers = useMCPStore((state) => state.setMCPServers);
  const setShowMcpError = useMCPStore((state) => state.setShowMcpError);
  const setBuiltInServers = useMCPStore((state) => state.setBuiltInServers);
  const setPrivateModelOnlyServers = useMCPStore(
    (state) => state.setPrivateModelOnlyServers,
  );
  const setDisableNewApply = useChatApplyStore(
    (state) => state.setDisableNewApply,
  );
  const setPlanModeButtonEnabled = useChatConfig(
    (state) => state.setPlanModeButtonEnabled,
  );

  const setChatType = useChatStore((state) => state.setChatType);
  const selectSession = useChatStore((state) => state.selectSession);
  const onNewSession = useChatStore((state) => state.onNewSession);
  const currentSession = useChatStore((state) => state.currentSession());
  const setRules = useWorkspaceStore((state) => state.setRules);
  const setTerminalTimeout = useChatTerminalStore(state => state.setTerminalTimeout);
  const setSkills = useSkillsStore((state) => state.setSkills);
  const requestSpecInfo = useWorkspaceStore((state) => state.requestSpecInfo);
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const setUsername = useAuthStore((state) => state.setUsername);
  const setLoginFrom = useAuthStore((state) => state.setLoginFrom);

  const isSpecStaging = useAuthStore(selectIsSpecStaging);

  // 未处理事件队列
  const pendingEventsRef = React.useRef<PostMessageSubscribeType[]>([]);

  const { toast } = useCustomToast();
  const [userDashboardOpen, setUserDashboardOpen] = React.useState(false);

  const isVsCodeIDE = ide === IDE.VisualStudioCode;

  const filterTabs = React.useMemo(() => {
    return tabs ? tabs.filter((tab) => tab.selected) : [];
  }, [tabs]);

  const [activeIndex, setActiveIndex] = React.useState(
    findIndexByTabValue(filterTabs, currentTab),
  );

  // 追踪待确认的 tab 切换
  const pendingTabSwitchRef = React.useRef<{
    targetIndex: number;
    targetTab: string;
  } | null>(null);
  const pendingChatTypeRef = React.useRef<ChatType | null>(null);
  useLoadWorkspace()

  React.useEffect(() => {
    const activeIndex = findIndexByTabValue(filterTabs, currentTab) || 0;
    setActiveIndex(activeIndex);
  }, [filterTabs, currentTab]);

  // 监听 activeIndex 变化，确认切换完成后发送 ACK
  React.useEffect(() => {
    const pending = pendingTabSwitchRef.current;
    if (pending && activeIndex === pending.targetIndex) {
      postMessage({
        type: 'WEBVIEW_ACK',
        data: {
          event: 'switch_tab',
          payload: {
            tab: pending.targetTab,
          },
        },
      });
      pendingTabSwitchRef.current = null;

      // 处理 codeReview 的特殊逻辑
      if (pending.targetTab === 'codeReview') {
        setTimeout(() => {
          window.postMessage(
            {
              type: 'TEAM_REVIEW_REFRESH',
            },
            '*',
          );
        });
      }
    }
  }, [activeIndex, postMessage]);

  React.useEffect(() => {
    postMessage({
      type: BroadcastActions.GET_RULES
    });
    postMessage({
      type: BroadcastActions.GET_SKILLS
    });
    if (isSpecStaging) {
      requestSpecInfo();
    }
  }, [chatType, postMessage, requestSpecInfo, isSpecStaging])

  React.useEffect(() => {
    // setTimeout(() => {
    if (accessToken) {
      // 加载内置服务器列表
      fetchBuiltInServers().then((servers) => {
        // 遍历服务器列表，如果没有type参数，则添加一个默认值"stdio"
        const serversWithType = servers.map((server) => {
          if (server.server_config && !server.server_config.type) {
            return {
              ...server,
              server_config: {
                ...server.server_config,
                type: 'stdio',
              },
            };
          }
          return server;
        });

        setBuiltInServers(serversWithType);
      });
      fetchNameMappings().then(nameMappings => {
        useMCPStore.getState().setNameMappings(nameMappings);
      });
      fetchPrivateModelOnlyServers().then(servers => {
        setPrivateModelOnlyServers(servers);
      });
    }

    // }, 5000);
  }, [setBuiltInServers, accessToken, setPrivateModelOnlyServers]);

  React.useEffect(() => {
    let loadingTimer: any = null;
    function getInitData() {
      setLoginLoading(true);
      loadingTimer = setTimeout(() => {
        setLoginLoading(false);
      }, 5000);
      postMessage({
        type: 'GET_INIT_DATA',
      });
      const url = new URL(window.location.href);
      const accessToken = url.searchParams.get('access_token');
      const username = url.searchParams.get('username');
      const loginFrom = url.searchParams.get('login_from');
      if (accessToken && username) {
        setAccessToken(accessToken);
        setUsername(username);
        setLoginFrom(loginFrom);
      }
    }
    postMessage({
      type: 'GET_MCP_SERVERS',
    });
    const timer = setTimeout(() => getInitData(), 1000);
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
      if (loadingTimer) {
        clearTimeout(loadingTimer);
      }
    };
  }, [postMessage, setAccessToken, setLoginFrom, setUsername]);

  React.useEffect(() => {
    async function handleMessage(event: MessageEvent<PostMessageSubscribeType>) {
      // 多面板模式下，只处理指定给自己的消息或广播消息
      if (isPanelMode) {
        if (event.data.targetPanelId && event.data.targetPanelId !== panelId) {
          return;
        }
      }

      // 未登录的时候，除了 init data 事件外的事件都放到未处理事件池
      if (!accessToken && event.data.type !== SubscribeActions.INIT_DATA) {
        pendingEventsRef.current = [...pendingEventsRef.current, event.data];
        return;
      }
      if (event.data?.type === SubscribeActions.SWITCH_TAB) {
        const switchTab = event.data?.data as string;
        if (switchTab) {
          // 找到对应的 Tab 索引并且 Tab 是开启的状态
          const switchIndex = filterTabs?.findIndex((t) => {
            return switchTab === TabsMap[t.value] && t.selected;
          });
          if (switchIndex !== -1) {
            // 如果已经是目标 tab，立即发送 ACK
            if (activeIndex === switchIndex) {
              postMessage({
                type: 'WEBVIEW_ACK',
                data: {
                  event: 'switch_tab',
                  payload: {
                    tab: switchTab,
                  },
                },
              });
              if (switchTab === 'codeReview') {
                setTimeout(() => {
                  window.postMessage(
                    {
                      type: 'TEAM_REVIEW_REFRESH',
                    },
                    '*',
                  );
                });
              }
            } else {
              // 记录待确认的切换，等待 activeIndex 更新后再发送 ACK
              pendingTabSwitchRef.current = {
                targetIndex: switchIndex,
                targetTab: switchTab,
              };
              setActiveIndex(switchIndex);
            }
          } else {
            // 没有打开 Tab ，给用户相应的提示
            toast({
              title: `请打开 ${switchTab} Tab`,
              status: 'warning',
              duration: 2000,
            });
          }
        }
      } else if (event.data?.type === SubscribeActions.SET_CHAT_TYPE) {
        const inferredChatType = event.data?.data;
        const isChatType = (value: unknown): value is ChatType =>
          value === 'codebase' || value === 'default';

        if (!isChatType(inferredChatType)) {
          toast({
            title: `暂不支持切换到 ${inferredChatType || '未知'} 会话类型`,
            status: 'warning',
            duration: 2000,
          });
          postMessage({
            type: 'WEBVIEW_ACK',
            data: {
              event: 'set_chat_type',
              payload: {
                chatType: chatType,
                success: false,
              },
            },
          });
          return;
        }

        // 已经是目标类型则立即响应
        if (chatType === inferredChatType) {
          postMessage({
            type: 'WEBVIEW_ACK',
            data: {
              event: 'set_chat_type',
              payload: {
                chatType,
                success: true,
              },
            },
          });
          return;
        }

        pendingChatTypeRef.current = inferredChatType;
        setChatType(inferredChatType);
      } else if (event.data?.type === SubscribeActions.TOAST_MESSAGE) {
        const { status, content } = event.data?.data as any;
        toastMessage(content, status);
      } else if (event.data.type === SubscribeActions.INIT_DATA) {
        // TODO: auth 信息和插件信息分不同事件获取
        const {
          accessToken,
          username,
          codeGenerateModel,
          codeGenerateModelCode,
          codeMakerVersion,
          gatewayName,
          // TODO: 暂时解决 vscod 和 jetbrains 系列的功能差异
          IDE,
          newCodeReview,
          // TODO: 暂时解决 code search 数据集选择逻辑
          isMhxy,
          entrance,
          submitKey,
          app_version,
          CODE_COVERAGE_API_URL,
          codeChatApiKey,
          codeChatApiBaseUrl,
          codebaseDefaultAuthorizationPath,
          codeChatModelsSetting,
          codeBaseCheckCommands,
          currentFileAutoAttach,
          disableNewApply,
          codeChatTerminalTimeout,
          themeStyle,
          loginFrom,
          login_from,
          fixedModel,
        } = event.data.data as any;
        setCodeCoverageApiUrl(CODE_COVERAGE_API_URL);
        authStore.setAccessToken(accessToken);
        authStore.setUsername(username);
        if (loginFrom || login_from) {
          authStore.setLoginFrom(loginFrom || login_from);
        }
        // authStore.setAccessToken('');
        // authStore.setUsername('123');
        // authStore.setLoginFrom('browser');
        extensionStore.setGenerateModel(codeGenerateModel);
        extensionStore.setGenerateModelCode(codeGenerateModelCode);
        extensionStore.setCodeMakerVersion(codeMakerVersion);
        extensionStore.setGatewayName(gatewayName);
        extensionStore.setIDE(IDE);
        extensionStore.setIsMhxy(isMhxy);
        extensionStore.setEntrance(entrance);
        extensionStore.setAppVersion(app_version);

        setCurrentFileAutoAttach(!!currentFileAutoAttach);
        setDisableNewApply(!!disableNewApply);
        setPlanModeButtonEnabled(IDE === 'vscode' || IDE === 'JetBrains');
        setTerminalTimeout(codeChatTerminalTimeout)
        // 设置系统主题
        if (themeStyle) {
          setSystemTheme(themeStyle as ThemeStyle);
        }
        // update((config) => {
        //   config.app_id = appID;
        //   config.app_key = appKey;
        // });
        if (!newCodeReview) {
          extensionStore.setNewCodeReview(false);
        }
        updateConfig((config) => {
          if (submitKey) {
            // 兼容旧缓存值：将 'Command + Enter' 转换为 'Cmd + Enter'
            config.submitKey =
              submitKey === 'Command + Enter'
                ? SubmitKey.MetaEnter
                : submitKey;
          } else {
            config.submitKey = isMacOS()
              ? SubmitKey.MetaEnter
              : SubmitKey.CtrlEnter;
          }
          config.codeChatApiKey = codeChatApiKey || '';
          config.codeChatApiBaseUrl = codeChatApiBaseUrl || '';
          config.codebaseDefaultAuthorizationPath =
            codebaseDefaultAuthorizationPath || [];
          config.codeBaseCheckCommands = codeBaseCheckCommands || [];
          // TEMP: 临时设置默认值
          config.codeChatModelsSetting = codeChatModelsSetting || {
            'Claude3.7': true,
            'Claude3.7 Thinking': true,
            'DeepSeek-R1': true,
            'Claude3.5': true,
            'QWQ Plus': true,
            'DeepSeek-R1(70b)': true,
            'QWQ(32b)': true,
            'DeepSeek-V3': false,
            'Gemini-2.0': true,
            'QWEN 2.5 max': false,
            'GPT-4o': false,
            'GPT o3 mini': true,
            通义千问: false,
          };
        });

        // Y3Helper: 当 fixedModel 存在时，自动注入到 chatModels 中，使自定义模型支持图片上传
        extensionStore.setFixedModel(fixedModel || '');
        if (fixedModel) {
          const currentModels = useChatConfig.getState().chatModels;
          if (!currentModels[fixedModel]) {
            useChatConfig.getState().setChatModels({
              ...currentModels,
              [fixedModel]: {
                code: fixedModel as ChatModel,
                title: fixedModel,
                enabled: true,
                icon: ModelIconType.GPT,
                chatType: ChatModelType.ALL,
                parseImgType: ParseImgType.BASE64,
                isPrivate: false,
                tags: [],
                hasComputableToken: false,
                hasTokenCache: false,
                hasThinking: false,
                peerUserContent: false,
                displayOrder: 0,
                tokenInfo: { maxTokens: 128000, maxTokensInCodebase: 128000 },
                priceInfo: { currency: "CNY", promptWeight: 0, completionWeight: 0, cacheWeightFor5min: 0, hitCacheWeight: 0 },
                authInfo: { allowAll: true, allowedUsers: [], allowedDepartments: [] },
              },
            });
          }
          // 设置当前模型为 fixedModel
          useChatConfig.getState().update((config) => {
            config.model = fixedModel as ChatModel;
          });
        }

        setLoginLoading(false);

        const eventsToProcess = [...pendingEventsRef.current];
        pendingEventsRef.current = [];
        // 以广播的形式处理未处理的事件。使用 setTimeout 来确保在当前事件循环结束后发送这些事件
        setTimeout(() => {
          eventsToProcess.forEach((pendingEvent) => {
            window.postMessage(pendingEvent, '*');
          });
        }, 1000);

        webToolsHub.configureScope((scope) => {
          const context = {
            editor_type: IDE,
            app_version,
            plugin_version: codeMakerVersion,
            user: username,
          };
          scope.mergeContext(context);
          scope.setTag('source', 'web-ui');
          updateWebToolsContexts(context);
        });
      } else if (event.data.type === SubscribeActions.SYNC_WORKSPACE_INFO) {
        const workspaceData = event.data?.data as any;
        setWorkspaceInfo(workspaceData || {});

        if (isPanelMode) {
          // 使用 URL 参数中的 chatType，默认为 codebase
          const targetChatType = initialChatType || (ide === IDE.VisualStudio ? 'default' : 'codebase');
          setChatType(targetChatType);
          const currentSessionId = useChatStore.getState().currentSession()?._id;

          if (restoreSessionId) {
            if (currentSessionId === restoreSessionId) {
              console.log(
                `[Panel ${panelId}] Already on session ${restoreSessionId}`,
              );
              return;
            }

            console.log(
              `[Panel ${panelId}] Restoring session ${restoreSessionId}`,
            );
            try {
              await selectSession(restoreSessionId);
              console.log(
                `[Panel ${panelId}] Successfully restored session ${restoreSessionId}`,
              );
            } catch (error) {
              console.error(
                `[Panel ${panelId}] Failed to restore session ${restoreSessionId}:`,
                error,
              );
              // 恢复失败时创建新会话
              await onNewSession();
            }
            return;
          }

          console.log(`[Panel ${panelId}] No restoreSessionId, creating new session`);
          await onNewSession();
          return;
        }

        const workspaceSession = localStorage.getItem('workspace_session');
        const workspaceSessionData = JSON.parse(
          workspaceSession || '{}',
        ) as any;
        if (workspaceSessionData?.sessionId) {
          //判断工作区是否一致
          if (workspaceData?.repoName === workspaceSessionData?.workspaceName) {
            try {
              //设置为仓库智聊
              setChatType('codebase');
              await selectSession(workspaceSessionData?.sessionId);
              localStorage.removeItem('workspace_session');
            } catch (error) {
              console.error('[Debug] 读取工作区会话数据失败:', error);
              // 恢复失败时清除无效的 workspace_session 并创建新会话
              localStorage.removeItem('workspace_session');
              await onNewSession();
            }
          } else {
            // 工作区不一致，清除旧的 workspace_session
            localStorage.removeItem('workspace_session');
          }
        }
      } else if (event.data.type === SubscribeActions.SYNC_WORKSPACE_LIST) {
        const workspaceData = event.data?.data as any;
        setWorkspaceList(
          Array.isArray(workspaceData?.recent) ? workspaceData.recent : [],
        );
      } else if (event.data.type === SubscribeActions.SYNC_MCP_SERVERS) {
        const { servers } = (event.data?.data as any) || {
          servers: [],
        };
        setMCPServers(servers);
      } else if (event.data.type === SubscribeActions.SHOW_MCP_ERROR) {
        setShowMcpError(true);
      } else if (event.data.type === SubscribeActions.NOTIFY_MCP_SERVER_SUCCESS) {
        console.log('event.data', event.data);
        // 全局通知MCP服务成功
        const { message } = event.data?.data as any;
        if (message) {
          // 提取服务器名称并转换为中文名
          // 匹配格式：MCP 服务器 "xxx" 已...
          const match = message.match(/MCP 服务器 "([^"]+)" 已/);
          let displayMessage = message;

          if (match && match[1]) {
            const serverName = match[1];
            const getChineseNameByServerName = useMCPStore.getState().getChineseNameByServerName;

            // 使用 store 提供的方法获取中文名
            const displayName = getChineseNameByServerName(serverName) || serverName;

            // 替换服务器名称，保留原始消息的后半部分（如"已成功删除"、"已成功添加"等）
            displayMessage = message.replace(serverName, displayName);
          }

          toast({
            title: displayMessage,
            status: 'success',
          });
        }
      } else if (event.data.type === SubscribeActions.SAVE_WORKSPACE_SESSION) {
        // 将工作区会话数据存储到 localStorage
        const sessionData = event.data?.data || ({} as any);

        //更新当前会话id
        sessionData.sessionId = currentSession?._id;

        if (sessionData) {
          try {
            localStorage.setItem(
              'workspace_session',
              JSON.stringify(sessionData),
            );
            // console.log('工作区会话数据已保存到 localStorage', sessionData);
          } catch (error) {
            console.error('保存工作区会话数据失败:', error);
          }
        }
      } else if (event.data.type === SubscribeActions.TOGGLE_USER_DASHBOARD) {
        setUserDashboardOpen(!userDashboardOpen);
      } else if (event.data.type === SubscribeActions.SYNC_RULES) {
        setRules(event.data?.data as any || []);
      } else if (event.data.type === SubscribeActions.SYNC_SKILLS) {
        const skillsData = event.data?.data as unknown;
        if (Array.isArray(skillsData)) {
          setSkills(skillsData);
        }
      } else if (event.data.type === SubscribeActions.THEME_CHANGED) {
        // 系统主题改变
        const { themeStyle } = event.data?.data as any;
        if (themeStyle) {
          setSystemTheme(themeStyle as ThemeStyle);
        }
      }
    }
    // 监听 postMessage 消息
    window.addEventListener('message', handleMessage);

    return () => {
      // 移除消息监听器
      window.removeEventListener('message', handleMessage);
    };
  }, [isVsCodeIDE, filterTabs, ide, toast, extensionStore, authStore, updateConfig, accessToken, setWorkspaceInfo, setChatType, selectSession, setWorkspaceList, setMCPServers, currentSession?._id, userDashboardOpen, setCurrentFileAutoAttach, setDisableNewApply, setPlanModeButtonEnabled, setSystemTheme, setTerminalTimeout, setRules, setSkills, activeIndex, postMessage, chatType, initialChatType, isPanelMode, panelId, restoreSessionId, onNewSession, setShowMcpError]);

  React.useEffect(() => {
    const pendingChatType = pendingChatTypeRef.current;
    if (pendingChatType && chatType === pendingChatType) {
      postMessage({
        type: 'WEBVIEW_ACK',
        data: {
          event: 'set_chat_type',
          payload: {
            chatType: pendingChatType,
            success: true,
          },
        },
      });
      pendingChatTypeRef.current = null;
    }
  }, [chatType, postMessage]);

  React.useEffect(() => {
    postMessage({
      type: 'WEBVIEW_ACK',
      data: {
        event: 'app_init',
        payload: {
          success: true,
        },
      },
    });
  }, [postMessage]);

  if (!accessToken && loginLoading) {
    return (
      <Box h="100vh" display="flex" alignItems="center" justifyContent="center">
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
        >
          <Spinner size="md" />
        </Box>
      </Box>
    );
  }

  if (!accessToken) {
    return <Login />;
  }

  if (isPanelMode) {
    return (
      <ErrorBoundary>
        <Box
          minH="100vh"
          className="overflow-y-hidden overflow-x-hidden"
          bg="answerBgColor"
        >
          <Box w="full" h="100vh">
            <CodeChat />
          </Box>
        </Box>
      </ErrorBoundary>
    );
  }

  return (
    // TODO：为了不影响其他的颜色，暂时用这样的方式改一下背景色，等和 ui 同学确定色系之后再统一修改
    <ErrorBoundary>
      <Box
        // minH="100vh"
        minW={`${minWidth}px`}
        h="100vh"
        className="overflow-y-hidden overflow-x-hidden"
        bg="answerBgColor"
        overflow="hidden"
      >
        <FeatureTour />
        <Box w="full">
          <CodeChat />
        </Box>
        <ContextMenu />
        <UserDashboard
          open={userDashboardOpen}
          onClose={() => {
            setUserDashboardOpen(false);
          }}
        />
      </Box>
    </ErrorBoundary>
  );
}

export default App;

function findIndexByTabValue(tabs: TabsProps[], value: string) {
  return tabs.findIndex((t) => {
    return value === t.value && t.selected;
  });
}
