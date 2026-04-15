import { useState, useEffect, useRef } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  Box,
  Flex,
  Text,
  Image,
  Icon,
  Switch,
  Tooltip,
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Badge
} from '@chakra-ui/react';
import { SettingsIcon, DownloadIcon, DeleteIcon, ExternalLinkIcon, InfoOutlineIcon } from '@chakra-ui/icons';
import { MCPServer, useMCPStore, BuiltInServer } from '../../store/mcp';
import { BroadcastActions, usePostMessage } from '../../PostMessageProvider';
import mcpIcon from '../../assets/mcp.png';
import { TbFileCode } from 'react-icons/tb';
import MCPServerModal from './MCPServerModal';
import { ThemeStyle, useTheme } from '../../ThemeContext';
import userReporter from '../../utils/report';
import { UserEvent } from '../../types/report';


interface MCPSettingModelProps {
  isOpen: boolean;
  onClose: () => void;
}

// Parameter schema interface from API
interface ParameterSchema {
  type: string;
  description?: string;
  minLength?: number;
  format?: string;
  default?: string | number;
}

interface ParametersSchema {
  type: string;
  properties: { [key: string]: ParameterSchema };
  required: string[];
}

// Parameter configuration interface for different server types
interface ServerParam {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'number';
  placeholder: string;
  required: boolean;
  description?: string;
}

// 将 parameters_schema 转换为 ServerParam[]
const convertParametersSchemaToServerParams = (parametersSchema?: ParametersSchema): ServerParam[] => {
  if (!parametersSchema || !parametersSchema.properties) {
    return [];
  }

  const params: ServerParam[] = [];
  const requiredFields = parametersSchema.required || [];

  Object.entries(parametersSchema.properties).forEach(([key, schema]) => {
    // 跳过 X-Access-Token 和 X-Auth-User 字段，不需要用户填写
    if (key === 'X-Access-Token' || key === 'X-Auth-User') {
      return;
    }

    // 确定参数类型
    let type: 'text' | 'password' | 'url' | 'number' = 'text';
    if (schema.format === 'uri') {
      type = 'url';
    } else if (schema.type === 'number') {
      type = 'number';
    } else if (key.toLowerCase().includes('token') || key.toLowerCase().includes('password')) {
      type = 'password';
    }

    // 生成占位符
    let placeholder = '';
    if (schema.default) {
      placeholder = String(schema.default);
    } else if (type === 'url') {
      placeholder = 'https://example.com';
    } else if (type === 'number') {
      placeholder = '0';
    } else {
      placeholder = `请输入${key}`;
    }

    params.push({
      key,
      label: key,
      type,
      placeholder,
      required: requiredFields.includes(key),
      description: schema.description
    });
  });
  return params;
};

interface ParamConfigForm {
  [key: string]: string | number;
}

const MCPSettingModel: React.FC<MCPSettingModelProps> = ({ isOpen, onClose }) => {
  const { postMessage } = usePostMessage();
  const MCPServers = useMCPStore((state) => state.MCPServers);
  const builtInServers = useMCPStore((state) => state.builtInServers);
  const getMCPServerByName = useMCPStore((state) => state.getMCPServerByName);
  const isMCPServerExists = useMCPStore((state) => state.isMCPServerExists);
  const removeMCPServer = useMCPStore((state) => state.removeMCPServer);
  const getChineseNameByServerName = useMCPStore((state) => state.getChineseNameByServerName);
  const disabledSwitches = useMCPStore((state) => state.disabledSwitches);
  const { activeTheme } = useTheme();

  const [localServers, setLocalServers] = useState<MCPServer[]>([]);
  const [showParamConfig, setShowParamConfig] = useState(false);
  const [selectedBuiltInServer, setSelectedBuiltInServer] = useState<{id: number, name: string} | null>(null);
  const [builtInServerConfigs, setBuiltInServerConfigs] = useState<{[key: number]: ParamConfigForm}>({});
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});

  // 跟踪正在切换状态的服务器，防止UI闪烁
  const [switchingServers, setSwitchingServers] = useState<Set<string>>(new Set());

  // 本地Switch状态，避免切换时的UI跳动
  const [localSwitchStates, setLocalSwitchStates] = useState<{[serverName: string]: boolean}>({});

  // MCPServerModal 相关状态
  const [showMCPServerModal, setShowMCPServerModal] = useState(false);
  const [mcpServerModalMode, setMcpServerModalMode] = useState<'add' | 'edit'>('add');
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);

  // 删除确认弹窗相关状态
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [serverToDelete, setServerToDelete] = useState<string>('');
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // 只显示用户自定义的MCP服务，不显示接口返回的数据
    let serversToUse: MCPServer[] = [];

    if (MCPServers && MCPServers.length > 0) {
      // 过滤掉内置MCP服务，只保留真正的自定义服务
      const builtInServerNames = new Set(builtInServers.map(server => server.name));
      const customServers = MCPServers.filter(server => !builtInServerNames.has(server.name));

      // 去重：保持稳定的顺序，基于服务器名称排序来确保一致性
      const uniqueServersMap = new Map<string, MCPServer>();
      customServers.forEach(server => {
        if (!uniqueServersMap.has(server.name)) {
          uniqueServersMap.set(server.name, server);
        } else {
          // 如果已存在，更新该服务器的信息但保持在Map中的位置
          uniqueServersMap.set(server.name, server);
        }
      });

      // 转换为数组，并按名称排序以确保稳定的顺序
      serversToUse = Array.from(uniqueServersMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }

    setLocalServers(serversToUse);
  }, [MCPServers, builtInServers]);

  // 1. 在参数配置弹窗打开时初始化 builtInServerConfigs
  useEffect(() => {
    if (showParamConfig && selectedBuiltInServer) {
      const server = builtInServers.find(s => s.id === selectedBuiltInServer.id);
      if (server?.parameters_schema) {
        const params = convertParametersSchemaToServerParams(server.parameters_schema);
        const defaultConfig: ParamConfigForm = {};
        params.forEach(param => {
          // 先尝试用 MCPServers 里的已保存值
          let existingValue = null;
          const existingServer = getMCPServerByName(server.name);
          if (existingServer) {
            // 优先从 config.headers 中获取，如果没有则从根级别的 headers 获取
            existingValue = existingServer.config?.headers?.[param.key] || existingServer.headers?.[param.key];
          }
          // 再尝试用 localServers 里的值
          if (existingValue === null || existingValue === undefined) {
            const existingLocalServer = localServers.find(local => local.name === server.name);
            existingValue = existingLocalServer?.config?.headers?.[param.key] || existingLocalServer?.headers?.[param.key];
          }
          if (existingValue !== undefined && existingValue !== null && String(existingValue).trim() !== '') {
            defaultConfig[param.key] = existingValue;
          } else {
            defaultConfig[param.key] = param.type === 'number' ? 0 : '';
          }
        });
        setBuiltInServerConfigs(prev => ({
          ...prev,
          [selectedBuiltInServer.id]: defaultConfig
        }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showParamConfig, selectedBuiltInServer]);

  const handleClose = () => {
    onClose();
  };


  const handleAddServer = () => {
    setMcpServerModalMode('add');
    setEditingServer(null);
    setShowMCPServerModal(true);
  };

  const handleEditServer = (server: MCPServer) => {
    setMcpServerModalMode('edit');
    setEditingServer(server);
    setShowMCPServerModal(true);
  };

  const handleMCPServerSave = (server: MCPServer) => {
    // 只更新全局 MCPServers，让 useEffect 来处理 localServers 的同步
    const setMCPServers = useMCPStore.getState().setMCPServers;
    const currentMCPServers = useMCPStore.getState().MCPServers;

    if (mcpServerModalMode === 'add') {
      // 添加新服务器到全局列表
      const newMCPServers = [...currentMCPServers, server];
      setMCPServers(newMCPServers);
      userReporter.report({
        event: UserEvent.CODE_CHAT_MCP_ADD_CUSTOM_SERVER,
        extends: {
          server,
        }
      });
    } else if (mcpServerModalMode === 'edit') {
      // 更新全局列表中的服务器
      const updatedGlobalServers = [...currentMCPServers];
      const globalIndex = updatedGlobalServers.findIndex(s => s.name === editingServer?.name);
      if (globalIndex >= 0) {
        updatedGlobalServers[globalIndex] = server;
        setMCPServers(updatedGlobalServers);
      }
    }

    setShowMCPServerModal(false);
  };



  // 检查内置服务器是否已经在配置中
  const isBuiltInServerInstalled = (serverId: number): boolean => {
    const builtInServer = builtInServers.find(s => s.id === serverId);
    if (!builtInServer) return false;

    // 如果服务器正在切换状态，强制显示已安装UI，避免闪烁
    if (switchingServers.has(builtInServer.name)) {
      return true;
    }

    // 检查 MCPServers 中是否有该服务器的配置
    return isMCPServerExists(builtInServer.name);
  };

  // 判断内置服务是否已在配置中（用于判断是新增还是编辑）
  const isBuiltInServerInLocal = (server: BuiltInServer) => {
    // 检查 MCPServers 中是否有该服务器的配置
    return isMCPServerExists(server.name);
  };

  // 检查内置服务器是否有需要填写的参数
  const hasConfigurableParams = (serverId: number): boolean => {
    const server = builtInServers.find(s => s.id === serverId);
    if (!server?.parameters_schema) return false;

    const params = convertParametersSchemaToServerParams(server.parameters_schema);
    return params.length > 0;
  };

  // 发送内置服务器配置给后端
  const sendBuiltInServerToBackend = (server: BuiltInServer, action: 'add' | 'update', userConfig?: ParamConfigForm) => {
    // 构建发送给后端的数据，优先使用 server_config，如果没有则使用 server
    let serverData = server?.server_config;

    serverData.name = server.name;

    // 如果有用户配置参数，根据 server_type 判断放入 headers 还是 env
    if (userConfig && Object.keys(userConfig).length > 0) {
      // 确保 serverData 是一个对象
      if (typeof serverData === 'object' && serverData !== null) {
        // 深拷贝 serverData 避免修改原对象
        serverData = JSON.parse(JSON.stringify(serverData));
        // 获取服务器类型
        const serverType = serverData.type || 'stdio';
        // 判断是 remote 类型还是 local 类型
        // remote 类型: sse, streamableHttp
        // local 类型: stdio
        const isRemoteType = serverType === 'sse' || serverType === 'streamableHttp';
        // 根据 server_type 决定将用户配置参数放入 headers 还是 env
        // local 类型放入 env，其他类型（remote 或默认）放入 headers
        const targetField = isRemoteType ? 'headers' : 'env';

        // 确保目标字段存在
        if (!serverData[targetField]) {
          serverData[targetField] = {};
        }

        // 将用户配置的参数合并到目标字段中
        Object.entries(userConfig).forEach(([key, value]) => {
          if (value !== undefined && value !== null && String(value).trim() !== '') {
            serverData[targetField][key] = value;
          }
        });
      }
    }

    // 新增服务器时默认设置为启用状态且上报安装事件
    // if (action === 'add') {
    //   mcpApiRequest.post(`servers/${server.id}/install`);
    //   serverData.disabled = false;
    // }

    // 在发送给插件之前，过滤掉 X-Access-Token 和 X-Auth-User
    if (serverData && serverData.headers) {
      // 深拷贝 serverData 避免修改原对象
      serverData = JSON.parse(JSON.stringify(serverData));

      // 从 headers 中删除 X-Access-Token 和 X-Auth-User
      if (serverData.headers['X-Access-Token']) {
        delete serverData.headers['X-Access-Token'];
      }
      if (serverData.headers['X-Auth-User']) {
        delete serverData.headers['X-Auth-User'];
      }
    }

    postMessage({
      type: action === 'add' ? BroadcastActions.ADD_MCP_SERVERS : BroadcastActions.UPDATE_MCP_SERVERS,
      data: serverData
    });
  };

  // 处理内置服务器安装
  const handleBuiltInServerInstall = (serverId: number) => {
    const server = builtInServers.find(s => s.id === serverId);
    if (!server) return;

    // 如果有可填项，打开参数配置弹窗
    if (hasConfigurableParams(serverId)) {
      setSelectedBuiltInServer({id: server.id, name: server.name});
      setValidationErrors({});
      setShowParamConfig(true);
    } else {
      // 如果没有可填项，直接调用后端方法
      sendBuiltInServerToBackend(server!, 'add');
      userReporter.report({
        event: UserEvent.CODE_CHAT_MCP_INSTALL_BUILTIN_SERVER,
        extends: {
          server,
        },
      });
    }
  };

  // 处理删除MCP服务器（显示确认弹窗）
  const handleRemoveMCPServer = (serverName: string) => {
    setServerToDelete(serverName);
    setIsDeleteAlertOpen(true);
  };

  // 确认删除MCP服务器
  const handleDeleteConfirm = () => {
    if (serverToDelete) {
      // 从全局store中删除服务器
      removeMCPServer(serverToDelete);

      // 通知后端删除MCP服务器
      postMessage({
        type: BroadcastActions.REMOVE_MCP_SERVERS,
        data: { name: serverToDelete }
      });

      // 重置状态
      setIsDeleteAlertOpen(false);
      setServerToDelete('');
    }
  };

  // 获取Switch的显示状态
  const getSwitchCheckedState = (serverName: string): boolean => {
    // 如果正在切换，使用本地状态
    if (switchingServers.has(serverName)) {
      return localSwitchStates[serverName] ?? false;
    }
    // 否则使用全局状态
    const server = getMCPServerByName(serverName);
    return !server?.disabled;
  };
  // 处理MCP服务器开关状态切换
  const handleToggleMCPServer = (serverName: string, isEnabled: boolean) => {
    // 立即更新本地状态，避免UI跳动
    setLocalSwitchStates(prev => ({
      ...prev,
      [serverName]: isEnabled
    }));

    // 添加到正在切换的服务器列表，防止UI闪烁
    setSwitchingServers(prev => new Set(prev).add(serverName));

    const setMCPServers = useMCPStore.getState().setMCPServers;
    const currentMCPServers = useMCPStore.getState().MCPServers;

    // 更新本地状态：isEnabled=true时disabled=false，isEnabled=false时disabled=true
    const updatedServers = currentMCPServers.map(server => {
      if (server.name === serverName) {
        return {
          ...server,
          disabled: !isEnabled,
          config: {
            ...server.config,
            disabled: !isEnabled
          }
        };
      }
      return server;
    });

    setMCPServers(updatedServers);

    // 通知后端更新服务器状态
    const serverData = updatedServers.find(s => s.name === serverName);
    if (serverData) {
      postMessage({
        type: BroadcastActions.UPDATE_MCP_SERVERS,
        data: {
          name: serverName,
          ...serverData.config,
          disabled: !isEnabled
        }
      });
    }

    // 延迟移除切换标记，确保状态稳定
    setTimeout(() => {
      setSwitchingServers(prev => {
        const newSet = new Set(prev);
        newSet.delete(serverName);
        return newSet;
      });
      // 清理本地状态，让组件重新使用全局状态
      setLocalSwitchStates(prev => {
        const newStates = { ...prev };
        delete newStates[serverName];
        return newStates;
      });
    }, 2000); // 200ms 延迟确保状态更新完成
  };



  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="full"
    >
      <ModalOverlay />
      <ModalContent h="100vh" maxH="100vh">
        <ModalHeader>MCP Servers 配置
        {/* <Icon as={TbFileCode} size="sm"
          title="打开配置文件"
          className='ml-2 cursor-pointer text-gray-500 hover:text-blue-500'
            onClick={() => {
              userReporter.report({
              event: UserEvent.CODE_CHAT_MCP_OPEN_CONFIG_FILE
            });
            postMessage({
              type: BroadcastActions.OPEM_MCP_SETTING
            })
            postMessage({
              type: BroadcastActions.OPEN_MCP_SETTING
            })
          }}
        /> */}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody overflowY="auto">
          <Tabs colorScheme="blue">
            <TabList>
              <Tab>已安装</Tab>
              <Tab>更多 MCP</Tab>
            </TabList>

            <TabPanels>
              {/* 第一个 Tab: 已安装的 MCP 服务 */}
              <TabPanel px={0}>
                <Flex alignItems="center" justifyContent="space-between" mb={4}>
                  <Text fontWeight="bold">已安装的 MCP 服务</Text>
                  <Flex alignItems="center" gap={1}>
                    <Icon
                      as={TbFileCode}
                      cursor="pointer"
                      color="#786fff"
                      transition="color 0.2s"
                      _hover={{ color: '#5a4fcf' }}
                      w={5}
                      h={5}
                      title="打开配置文件"
                      onClick={() => {
                        userReporter.report({
                          event: UserEvent.CODE_CHAT_MCP_OPEN_CONFIG_FILE
                        });
                        postMessage({
                          type: BroadcastActions.OPEM_MCP_SETTING
                        })
                        postMessage({
                          type: BroadcastActions.OPEN_MCP_SETTING
                        })
                      }}
                    />
                    <Text
                      fontSize="sm"
                      color="#786fff"
                      cursor="pointer"
                      _hover={{ color: '#5a4fcf' }}
                      onClick={() => {
                        userReporter.report({
                          event: UserEvent.CODE_CHAT_MCP_OPEN_CONFIG_FILE
                        });
                        postMessage({
                          type: BroadcastActions.OPEM_MCP_SETTING
                        })
                        postMessage({
                          type: BroadcastActions.OPEN_MCP_SETTING
                        })
                      }}
                    >
                      打开配置文件
                    </Text>
                  </Flex>
                </Flex>

                {/* 已安装的内置服务器 */}
                {builtInServers.filter(server => isBuiltInServerInstalled(server.id)).map((server) => (
                  <Box
                    key={server.id}
                    mb={4}
                    p={4}
                    borderWidth="1px"
                    borderRadius="md"
                    bg={activeTheme === ThemeStyle.Light ? '#fff' : '#1e1e1e'}
                  >
                    <Flex alignItems="center" justifyContent="space-between">
                      <Flex alignItems="center">
                        <Image src={server.logo || mcpIcon} alt={server.name} w={6} h={6} mr={2} borderRadius="50%" />
                        <Text fontWeight="medium" color={activeTheme === ThemeStyle.Light ? '#222' : undefined}>
                          {server.chinese_name || server.name}
                        </Text>
                        {disabledSwitches.has(server.name) && (
                          <Tooltip
                            label={`根据服务提供方要求，${server.chinese_name || server.name}只能在私有模型下使用`}
                            placement="top"
                          >
                            <InfoOutlineIcon
                              ml={2}
                              color="orange.400"
                              w={4}
                              h={4}
                              cursor="pointer"
                            />
                          </Tooltip>
                        )}
                      </Flex>
                      <Flex gap={3} alignItems="center">
                        <Tooltip
                          label={
                            disabledSwitches.has(server.name)
                              ? `根据服务提供方要求，${server.chinese_name || server.name}只能在私有模型下使用`
                              : !getMCPServerByName(server.name)?.disabled
                              ? "服务已启用"
                              : "服务已禁用"
                          }
                          placement="top"
                        >
                          <Box display="flex" alignItems="center" height="16px">
                            <Switch
                              isChecked={disabledSwitches.has(server.name) ? false : getSwitchCheckedState(server.name)}
                              onChange={(e) => handleToggleMCPServer(server.name, e.target.checked)}
                              disabled={disabledSwitches.has(server.name)}
                              colorScheme="blue"
                              size="md"
                            />
                          </Box>
                        </Tooltip>
                        {hasConfigurableParams(server.id) && (
                          <Tooltip label="配置" placement="top">
                            <Box
                              as={SettingsIcon}
                              cursor="pointer"
                              color="#786fff"
                              transition="color 0.2s"
                              _hover={{ color: '#5a4fcf' }}
                              w={5}
                              h={5}
                              onClick={() => {
                                setSelectedBuiltInServer({id: server.id, name: server.name});
                                setValidationErrors({});
                                setShowParamConfig(true);
                                userReporter.report({
                                  event: UserEvent.CODE_CHAT_MCP_CONFIG_BUTTON,
                                });
                            }}/>
                          </Tooltip>
                        )}
                        <Tooltip label="删除" placement="top">
                          <Box
                            as={DeleteIcon}
                            cursor="pointer"
                            color="#feb2b2"
                            transition="color 0.2s"
                            _hover={{ color: '#f56565' }}
                            w={4}
                            h={4}
                            onClick={() => handleRemoveMCPServer(server.name)}
                          />
                        </Tooltip>
                      </Flex>
                    </Flex>
                  </Box>
                ))}

                {/* 自定义服务器 */}
                {localServers.map((server, index) => (
                  <Box
                    key={index}
                    mb={4}
                    p={4}
                    borderWidth="1px"
                    borderRadius="md"
                    bg={activeTheme === ThemeStyle.Light ? '#fff' : '#1e1e1e'}
                    position="relative"
                  >
                    {/* 左上角标记 */}
                    <Badge
                      position="absolute"
                      top={1}
                      left={1}
                      colorScheme="purple"
                      fontSize="xs"
                    >
                      自定义
                    </Badge>
                    <Flex alignItems="center" justifyContent="space-between" mt={2}>
                      <Flex alignItems="center">
                        <Image src={mcpIcon} alt="MCP" w={6} h={6} mr={2} borderRadius="50%" />
                        <Text fontWeight="medium" color={activeTheme === ThemeStyle.Light ? '#222' : undefined}>
                          {server?.config?.chinese_name || getChineseNameByServerName(server.name) || server.name || `服务器 ${index + 1}`}
                        </Text>
                      </Flex>
                      <Flex gap={3} alignItems="center">
                        <Tooltip
                          label={!server.disabled ? "服务已启用" : "服务已禁用"}
                          placement="top"
                        >
                          <Box display="flex" alignItems="center" height="16px">
                            <Switch
                              isChecked={getSwitchCheckedState(server.name)}
                              onChange={(e) => handleToggleMCPServer(server.name, e.target.checked)}
                              colorScheme="blue"
                              size="md"
                            />
                          </Box>
                        </Tooltip>
                        <Tooltip label="编辑" placement="top">
                          <Box
                            as={SettingsIcon}
                            cursor="pointer"
                            color="#786fff"
                            transition="color 0.2s"
                            _hover={{ color: '#5a4fcf' }}
                            w={5}
                            h={5}
                            onClick={() => {
                              handleEditServer(server)
                              userReporter.report({
                                event: UserEvent.CODE_CHAT_MCP_CONFIG_BUTTON,
                              });
                            }}
                          />
                        </Tooltip>
                        <Tooltip label="删除" placement="top">
                          <Box
                            as={DeleteIcon}
                            cursor="pointer"
                            color="#feb2b2"
                            transition="color 0.2s"
                            _hover={{ color: '#f56565' }}
                            w={4}
                            h={4}
                            onClick={() => handleRemoveMCPServer(server.name)}
                          />
                        </Tooltip>
                      </Flex>
                    </Flex>
                  </Box>
                ))}

                {/* 如果没有已安装的服务 */}
                {builtInServers.filter(server => isBuiltInServerInstalled(server.id)).length === 0 && localServers.length === 0 && (
                  <Box p={4} textAlign="center" color="gray.500">
                    暂无已安装的服务器，请前往"更多MCP服务"选项卡安装
                  </Box>
                )}
              </TabPanel>

              {/* 第二个 Tab: 推荐安装的 MCP 服务 */}
              <TabPanel px={0}>
                <Flex alignItems="center" justifyContent="space-between" mb={4}>
                  <Flex alignItems="center" gap={2}>
                    <Text fontWeight="bold">推荐 MCP 服务</Text>
                    <Text
                      fontSize="sm"
                      color="#786fff"
                      cursor="pointer"
                      _hover={{ color: '#5a4fcf' }}
                      onClick={() => {
                        postMessage({
                          type: BroadcastActions.OPEN_IN_BROWSER,
                          data: { url: 'http://localhost:3001' }
                        });
                      }}
                      display="flex"
                      alignItems="center"
                      gap={1}
                    >
                      更多mcp服务
                      <ExternalLinkIcon w={3} h={3} />
                    </Text>
                  </Flex>
                  <Button
                    colorScheme="blue"
                    size="sm"
                    onClick={handleAddServer}
                    color="white"
                    _hover={{ bg: '#5a4fcf' }}
                  >
                   添加自定义服务
                  </Button>
                </Flex>

                {builtInServers.filter(server => !isBuiltInServerInstalled(server.id)).map((server) => (
                  <Box
                    key={server.id}
                    mb={4}
                    p={4}
                    borderWidth="1px"
                    borderRadius="md"
                    bg={activeTheme === ThemeStyle.Light ? '#fff' : '#1e1e1e'}
                  >
                    <Flex alignItems="center" justifyContent="space-between">
                      <Flex alignItems="center">
                        <Image src={server.logo || mcpIcon} alt={server.name} w={6} h={6} mr={2} borderRadius="50%" />
                        <Text fontWeight="medium" color={activeTheme === ThemeStyle.Light ? '#222' : undefined}>
                          {server.chinese_name || server.name}
                        </Text>
                        {disabledSwitches.has(server.name) && (
                          <Tooltip
                            label={`根据服务提供方要求，${server.chinese_name || server.name}只能在私有模型下使用`}
                            placement="top"
                          >
                            <InfoOutlineIcon
                              ml={2}
                              color="orange.400"
                              w={4}
                              h={4}
                              cursor="pointer"
                            />
                          </Tooltip>
                        )}
                      </Flex>
                      <Button
                        size="sm"
                        colorScheme="blue"
                        variant="outline"
                        leftIcon={<DownloadIcon />}
                        onClick={() => handleBuiltInServerInstall(server.id)}
                      >
                        安装
                      </Button>
                    </Flex>
                  </Box>
                ))}

                {builtInServers.filter(server => !isBuiltInServerInstalled(server.id)).length === 0 && (
                  <Box p={4} textAlign="center" color="gray.500">
                    暂无推荐服务器，所有推荐服务已安装
                  </Box>
                )}
              </TabPanel>
            </TabPanels>
          </Tabs>
        </ModalBody>

        {/* <ModalFooter>
          <Button mr={3} onClick={handleClose}>取消</Button>
          <Button colorScheme="blue" onClick={handleSave}>保存</Button>
        </ModalFooter> */}
      </ModalContent>

      {/* 参数配置弹窗 */}
      <Modal isOpen={showParamConfig} onClose={() => setShowParamConfig(false)} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {selectedBuiltInServer?.name} 参数配置
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedBuiltInServer && (() => {
              const server = builtInServers.find(s => s.id === selectedBuiltInServer.id);
              // 直接用 state
              const config = builtInServerConfigs[selectedBuiltInServer.id] || {};
              const params = server?.parameters_schema ? convertParametersSchemaToServerParams(server.parameters_schema) : [];
              return params.map((param) => (
                <FormControl key={param.key} mb={4} isInvalid={!!validationErrors[param.key]}>
                  <FormLabel>
                    {param.label}
                    {param.required && <Text as="span" color="red.400" ml={1}>*</Text>}
                  </FormLabel>
                  <Input
                    type={param.type === 'password' ? 'password' : param.type === 'number' ? 'number' : 'text'}
                    value={config[param.key] || ''}
                    onChange={(e) => {
                      const value = param.type === 'number' ? Number(e.target.value) : e.target.value;
                      setBuiltInServerConfigs(prev => ({
                        ...prev,
                        [selectedBuiltInServer.id]: {
                          ...config,
                          [param.key]: value
                        }
                      }));
                      // 清除该字段的验证错误
                      if (validationErrors[param.key]) {
                        setValidationErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors[param.key];
                          return newErrors;
                        });
                      }
                    }}
                    placeholder={param.placeholder}
                  />
                  {validationErrors[param.key] && (
                    <Text fontSize="sm" color="red.500" mt={1}>
                      {validationErrors[param.key]}
                    </Text>
                  )}
                  {!validationErrors[param.key] && param.description && (
                    <Text fontSize="sm" color="gray.500" mt={1}>
                      {param.description}
                    </Text>
                  )}
                </FormControl>
              ));
            })()}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setShowParamConfig(false)}>
              取消
            </Button>
            <Button colorScheme="blue" onClick={() => {
              if (!selectedBuiltInServer) return;

              const server = builtInServers.find(s => s.id === selectedBuiltInServer.id);
              const config = builtInServerConfigs[selectedBuiltInServer.id] || {};

              // 参数校验
              const newValidationErrors: {[key: string]: string} = {};

              if (server?.parameters_schema) {
                const params = convertParametersSchemaToServerParams(server.parameters_schema);
                params.forEach(param => {
                  const value = config[param.key];
                  // 检查必需参数
                  if (param.required && (!value || String(value).trim() === '')) {
                    newValidationErrors[param.key] = `${param.label}为必填项`;
                    return;
                  }
                  // 检查URL格式
                  if (param.type === 'url' && value && String(value).trim() !== '') {
                    try {
                      new URL(String(value));
                    } catch {
                      newValidationErrors[param.key] = `请输入有效的URL地址`;
                    }
                  }
                  // 检查数字类型
                  if (param.type === 'number' && value !== '' && value !== 0) {
                    const numValue = Number(value);
                    if (isNaN(numValue) || numValue < 0) {
                      newValidationErrors[param.key] = `请输入有效的正数`;
                    }
                  }
                });
              }
              // 更新验证错误状态
              setValidationErrors(newValidationErrors);
              // 如果有验证错误，不执行保存
              if (Object.keys(newValidationErrors).length > 0) {
                return;
              }
              // 判断是新增还是编辑
              if (server) {
                const isUpdate = isBuiltInServerInLocal(server);
                sendBuiltInServerToBackend(server, isUpdate ? 'update' : 'add', config);
                userReporter.report({
                  event: UserEvent.CODE_CHAT_MCP_INSTALL_BUILTIN_SERVER,
                  extends: {
                    server,
                  },
                });
              }
              setShowParamConfig(false);
            }}>
              确认
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* MCPServerModal 组件 */}
      <MCPServerModal
        isOpen={showMCPServerModal}
        onClose={() => setShowMCPServerModal(false)}
        onSave={handleMCPServerSave}
        editingServer={editingServer}
        mode={mcpServerModalMode}
      />

      {/* 删除确认弹窗 */}
      <AlertDialog
        isOpen={isDeleteAlertOpen}
        leastDestructiveRef={cancelRef}
        onClose={() => setIsDeleteAlertOpen(false)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              删除MCP服务器
            </AlertDialogHeader>

            <AlertDialogBody>
              确认要删除服务器 "{getChineseNameByServerName(serverToDelete) || serverToDelete}" 吗？此操作不可恢复。
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button
                ref={cancelRef}
                onClick={() => setIsDeleteAlertOpen(false)}
              >
                取消
              </Button>
              <Button
                colorScheme="red"
                onClick={handleDeleteConfirm}
                ml={3}
              >
                删除
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Modal>
  );
};

export default MCPSettingModel;
