import { useState, useEffect } from 'react';
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
} from '@chakra-ui/react';
import CustomSelect from '../../components/CustomSelect';
import { MCPServer } from '../../store/mcp';
import { BroadcastActions, usePostMessage } from '../../PostMessageProvider';

// 自定义MCP服务配置接口
interface CustomServerConfig {
  name: string;
  type: string;
  command: string;
  url?: string;
  headers?: {key: string, value: string}[];
  args: string[];
  env: {key: string, value: string}[];
  autoApprove: boolean;
  disabled: boolean;
  timeout: number | null;
}

interface MCPServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (server: MCPServer) => void;
  editingServer?: MCPServer | null;
  mode: 'add' | 'edit';
}

const MCPServerModal: React.FC<MCPServerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingServer,
  mode
}) => {
  const { postMessage } = usePostMessage();

  // 新增：自定义MCP服务配置相关状态
  const [customServerConfig, setCustomServerConfig] = useState<CustomServerConfig>({
    name: '',
    type: 'stdio',
    command: '',
    url: '',
    headers: [{key: '', value: ''}],
    args: [''],
    env: [{key: '', value: ''}],
    autoApprove: false,
    disabled: false,
    timeout: 60
  });
  const [customServerValidationErrors, setCustomServerValidationErrors] = useState<{[key: string]: string}>({});

  useEffect(() => {
    if (isOpen) {
      // Clear validation errors when opening modal
      setCustomServerValidationErrors({});

      if (mode === 'edit' && editingServer) {
        console.log('editingServer', editingServer);

        // 填充现有服务器数据到配置表单
        const serverConfig = editingServer.config || {};
        const configData = {
          name: editingServer.name || '',
          type: serverConfig.type || 'stdio',
          command: serverConfig.command || '',
          url: serverConfig.url || '',
          headers: serverConfig.headers && typeof serverConfig.headers === 'object' && Object.keys(serverConfig.headers).length > 0 ? Object.entries(serverConfig.headers).map(([key, value]) => ({key, value: String(value)})) : [{key: '', value: ''}],
          args: serverConfig.args && Array.isArray(serverConfig.args) && serverConfig.args.length > 0 ? serverConfig.args : [''],
          env: (() => {
            if (serverConfig.env && Array.isArray(serverConfig.env) && serverConfig.env.length > 0) {
              return serverConfig.env;
            } else if (serverConfig.env && typeof serverConfig.env === 'object') {
              const envEntries = Object.entries(serverConfig.env).map(([key, value]) => ({key, value: String(value)}));
              return envEntries.length > 0 ? envEntries : [{key: '', value: ''}];
            } else {
              return [{key: '', value: ''}];
            }
          })(),
          autoApprove: serverConfig.autoApprove !== undefined ? serverConfig.autoApprove : false,
          disabled: serverConfig.disabled !== undefined ? serverConfig.disabled : false,
          timeout: serverConfig.timeout || 60
        };

        setCustomServerConfig(configData);
      } else {
        // Reset form for add mode - ensure complete clean state
        setCustomServerConfig({
          name: '',
          type: 'stdio',
          command: '',
          url: '',
          headers: [{key: '', value: ''}],
          args: [''],
          env: [{key: '', value: ''}],
          autoApprove: false,
          disabled: false,
          timeout: 60
        });
      }
    }
  }, [isOpen, mode, editingServer]);

  const handleClose = () => {
    onClose();
  };

  // 处理自定义MCP服务配置保存
  const handleCustomServerSave = () => {
    // 验证必填字段
    const errors: {[key: string]: string} = {};

    if (!customServerConfig.name.trim()) {
      errors.name = '名称为必填项';
    }

    if (customServerConfig.type === 'stdio' && !customServerConfig.command.trim()) {
      errors.command = '命令为必填项';
    }

    if ((customServerConfig.type === 'sse' || customServerConfig.type === 'streamableHttp') && !customServerConfig.url?.trim()) {
      errors.url = 'URL为必填项';
    } else if ((customServerConfig.type === 'sse' || customServerConfig.type === 'streamableHttp') && customServerConfig.url?.trim()) {
      // URL格式校验
      try {
        const url = new URL(customServerConfig.url.trim());
        // 检查协议是否为 http 或 https
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          errors.url = 'URL协议必须是 http 或 https';
        }
      } catch (error) {
        errors.url = '请输入有效的URL地址';
      }
    }

    setCustomServerValidationErrors(errors);

    // 如果有验证错误，不执行保存
    if (Object.keys(errors).length > 0) {
      return;
    }

    // 构建MCP服务器对象
    const mcpServer: MCPServer = {
      name: customServerConfig.name,
      status: 'disconnected',
      error: '',
      disabled: customServerConfig.disabled,
      autoApprove: customServerConfig.autoApprove,
      config: {
        type: customServerConfig.type,
        command: customServerConfig.type === 'stdio' ? customServerConfig.command : undefined,
        url: (customServerConfig.type === 'sse' || customServerConfig.type === 'streamableHttp') ? customServerConfig.url : undefined,
        headers: (customServerConfig.type === 'sse' || customServerConfig.type === 'streamableHttp') && customServerConfig.headers ?
          customServerConfig.headers
            .filter(header => header.key.trim() !== '' && header.value.trim() !== '')
            .reduce((acc, header) => ({...acc, [header.key.trim()]: header.value.trim()}), {}) : undefined,
        args: customServerConfig.type === 'stdio' ? customServerConfig.args.filter(arg => arg.trim() !== '') : [],
        env: customServerConfig.type === 'stdio' ? customServerConfig.env.filter(envVar => envVar.key.trim() !== '' || envVar.value.trim() !== '') : [],
        timeout: customServerConfig.timeout || undefined,
        autoApprove: customServerConfig.autoApprove,
        disabled: customServerConfig.disabled
      },
      resources: [],
      resourceTemplates: []
    };

    // 构建发送给后端的数据，格式与MCPServers数组一致
    // 将环境变量从数组格式转换为对象格式 {key: value}
    const envObject: {[key: string]: string} = {};
    if (customServerConfig.type === 'stdio') {
      customServerConfig.env
        .filter(envVar => envVar.key.trim() !== '' && envVar.value.trim() !== '')
        .forEach(envVar => {
          envObject[envVar.key.trim()] = envVar.value.trim();
        });
    }

    // 构建headers对象
    const headersObject: {[key: string]: string} = {};
    if ((customServerConfig.type === 'sse' || customServerConfig.type === 'streamableHttp') && customServerConfig.headers) {
      customServerConfig.headers
        .filter(header => header.key.trim() !== '' && header.value.trim() !== '')
        .forEach(header => {
          headersObject[header.key.trim()] = header.value.trim();
        });
    }

    const serverConfigData = {
      type: customServerConfig.type,
      ...(customServerConfig.type === 'stdio' && { command: customServerConfig.command }),
      ...(customServerConfig.type === 'stdio' && { args: customServerConfig.args}),
      ...(customServerConfig.type === 'stdio' && { env: envObject}),
      ...((customServerConfig.type === 'sse' || customServerConfig.type === 'streamableHttp') && { url: customServerConfig.url }),
      // 如果是 sse 或 streamableHttp 类型，且 headers 不为空则发送，为空时发送空对象表示清除
      ...((customServerConfig.type === 'sse' || customServerConfig.type === 'streamableHttp') && { headers: headersObject }),
      timeout: customServerConfig.timeout,
      autoApprove: customServerConfig.autoApprove,
      disabled: customServerConfig.disabled
    };

    onSave(mcpServer);

    // 通知插件添加或更新MCP服务器
    try {
      if (mode === 'add') {
        postMessage({
          type: BroadcastActions.ADD_MCP_SERVERS,
          data: {
            name: customServerConfig.name,
            ...serverConfigData
          }
        });
      } else {
        postMessage({
          type: BroadcastActions.UPDATE_MCP_SERVERS,
          data: {
            name: customServerConfig.name,
            originalName: editingServer?.name, // 添加原始名称用于标识更新
            ...serverConfigData
          }
        });
      }
    } catch (error) {
      console.error('Failed to notify plugin about MCP server operation:', error);
    }

    handleClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl">
      <ModalOverlay />
      <ModalContent maxH="90vh">
        <ModalHeader>
          {mode === 'add' ? '添加自定义MCP服务' : '配置自定义MCP服务'}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody
          maxH="calc(90vh - 140px)"
          overflowY="auto"
          px={6}
          pb={4}
          position="relative"
          onWheel={(e) => {
            e.stopPropagation();
          }}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#666666 #333333',
          }}
          css={{
            '&::-webkit-scrollbar': {
              width: '8px',
              display: 'block',
            },
            '&::-webkit-scrollbar-track': {
              background: '#333333',
              display: 'block',
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#666666',
              borderRadius: '4px',
              display: 'block',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: '#888888',
            },
          }}
        >
          <FormControl mb={3} isRequired isInvalid={!!customServerValidationErrors.name}>
            <FormLabel fontSize="sm">Name</FormLabel>
            <Input
              size="sm"
              value={customServerConfig.name}
              onChange={(e) => {
                setCustomServerConfig({...customServerConfig, name: e.target.value});
                if (customServerValidationErrors.name) {
                  setCustomServerValidationErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors.name;
                    return newErrors;
                  });
                }
              }}
            />
            {customServerValidationErrors.name && (
              <Text fontSize="sm" color="red.500" mt={1}>
                {customServerValidationErrors.name}
              </Text>
            )}
          </FormControl>

          <FormControl mb={3} isRequired>
            <FormLabel fontSize="sm">Type (MCP服务类型)</FormLabel>
            <CustomSelect
              size="sm"
              value={{ label: customServerConfig.type, value: customServerConfig.type }}
              onChange={(selectedOption: any) => setCustomServerConfig({...customServerConfig, type: selectedOption?.value || 'stdio'})}
              options={[
                { label: 'stdio (标准输入输出)', value: 'stdio' },
                { label: 'sse (Server-Sent Events)', value: 'sse' },
                { label: 'streamableHttp (可流式HTTP)', value: 'streamableHttp' }
              ]}
              hoverColor="#786FFF"
              checkedColor="#786FFF"
              backgroundColor="#1e1e1e"
            />
          </FormControl>

          {/* 根据type类型显示不同的配置字段 */}
          {customServerConfig.type === 'stdio' && (
            <FormControl mb={3} isRequired isInvalid={!!customServerValidationErrors.command}>
              <FormLabel fontSize="sm">Command (用于启动 Server 可执行文件的命令，该命令需要在系统路径中可用，或包含完整路径)</FormLabel>
              <Input
                size="sm"
                value={customServerConfig.command}
                onChange={(e) => {
                  setCustomServerConfig({...customServerConfig, command: e.target.value});
                  if (customServerValidationErrors.command) {
                    setCustomServerValidationErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors.command;
                      return newErrors;
                    });
                  }
                }}
              />
              {customServerValidationErrors.command && (
                <Text fontSize="sm" color="red.500" mt={1}>
                  {customServerValidationErrors.command}
                </Text>
              )}
            </FormControl>
          )}

          {customServerConfig.type === 'stdio' && (
            <FormControl mb={3}>
              <FormLabel fontSize="sm">Args (传递给命令的参数数据组（命令行参数）)</FormLabel>
              {customServerConfig.args.map((arg, index) => (
                <Flex key={`arg-${index}`} mb={2}>
                  <Input
                    size="sm"
                    value={arg}
                    onChange={(e) => {
                      const newArgs = [...customServerConfig.args];
                      newArgs[index] = e.target.value;
                      setCustomServerConfig({...customServerConfig, args: newArgs});
                    }}
                  />
                  <Box ml={2} display="flex" alignItems="center" gap={1}>
                    <Button
                      size="sm"
                      onClick={() => {
                        setCustomServerConfig({
                          ...customServerConfig,
                          args: [...customServerConfig.args, '']
                        });
                      }}
                    >
                      +
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        const newArgs = [...customServerConfig.args];
                        // 如果是最后一个，清空值
                        if (customServerConfig.args.length === 1) {
                          newArgs[index] = '';
                        } else {
                          // 否则删除该项
                          newArgs.splice(index, 1);
                        }
                        setCustomServerConfig({...customServerConfig, args: newArgs});
                      }}
                    >
                      -
                    </Button>
                  </Box>
                </Flex>
              ))}
            </FormControl>
          )}

          {customServerConfig.type === 'stdio' && (
            <FormControl mb={3}>
              <FormLabel fontSize="sm">Env (Server 运行时的环境变量)</FormLabel>
              {customServerConfig.env.map((envVar, index) => (
                <Flex key={`env-${index}`} mb={2}>
                  <Input
                    size="sm"
                    placeholder="环境变量名"
                    value={envVar.key}
                    onChange={(e) => {
                      const newEnv = [...customServerConfig.env];
                      newEnv[index] = {...envVar, key: e.target.value};
                      setCustomServerConfig({...customServerConfig, env: newEnv});
                    }}
                  />
                  <Input
                    size="sm"
                    placeholder="环境变量值"
                    value={envVar.value}
                    onChange={(e) => {
                      const newEnv = [...customServerConfig.env];
                      newEnv[index] = {...envVar, value: e.target.value};
                      setCustomServerConfig({...customServerConfig, env: newEnv});
                    }}
                    ml={2}
                  />
                  <Box ml={2} display="flex" alignItems="center" gap={1}>
                    <Button
                      size="sm"
                      onClick={() => {
                        setCustomServerConfig({
                          ...customServerConfig,
                          env: [...customServerConfig.env, {key: '', value: ''}]
                        });
                      }}
                    >
                      +
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        const newEnv = [...customServerConfig.env];
                        // 如果是最后一个，清空 key 和 value
                        if (customServerConfig.env.length === 1) {
                          newEnv[index] = {key: '', value: ''};
                        } else {
                          // 否则删除该项
                          newEnv.splice(index, 1);
                        }
                        setCustomServerConfig({...customServerConfig, env: newEnv});
                      }}
                    >
                      -
                    </Button>
                  </Box>
                </Flex>
              ))}
            </FormControl>
          )}

          {(customServerConfig.type === 'sse' || customServerConfig.type === 'streamableHttp') && (
            <FormControl mb={3} isRequired isInvalid={!!customServerValidationErrors.url}>
              <FormLabel fontSize="sm">URL (服务器地址)</FormLabel>
              <Input
                size="sm"
                value={customServerConfig.url || ''}
                onChange={(e) => {
                  const urlValue = e.target.value;
                  setCustomServerConfig({...customServerConfig, url: urlValue});

                  // 实时URL格式校验
                  if (urlValue.trim()) {
                    try {
                      const url = new URL(urlValue.trim());
                      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                        setCustomServerValidationErrors(prev => ({
                          ...prev,
                          url: 'URL协议必须是 http 或 https'
                        }));
                      } else {
                        // 清除URL错误
                        setCustomServerValidationErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors.url;
                          return newErrors;
                        });
                      }
                    } catch (error) {
                      setCustomServerValidationErrors(prev => ({
                        ...prev,
                        url: '请输入有效的URL地址'
                      }));
                    }
                  } else {
                    // 如果URL为空，清除错误
                    setCustomServerValidationErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors.url;
                      return newErrors;
                    });
                  }
                }}
                placeholder="https://example.com/mcp"
              />
              {customServerValidationErrors.url && (
                <Text fontSize="sm" color="red.500" mt={1}>
                  {customServerValidationErrors.url}
                </Text>
              )}
            </FormControl>
          )}

          {(customServerConfig.type === 'sse' || customServerConfig.type === 'streamableHttp') && (
            <FormControl mb={3}>
              <FormLabel fontSize="sm">Headers (HTTP请求头，可选)</FormLabel>
              {(customServerConfig.headers && customServerConfig.headers.length > 0 ? customServerConfig.headers : [{key: '', value: ''}]).map((header, index) => {
                const currentHeaders = customServerConfig.headers && customServerConfig.headers.length > 0 ? customServerConfig.headers : [{key: '', value: ''}];

                return (
                  <Flex key={`header-${index}`} mb={2}>
                    <Input
                      size="sm"
                      placeholder="Header名称"
                      value={header.key}
                      onChange={(e) => {
                        const newHeaders = [...currentHeaders];
                        newHeaders[index] = {...header, key: e.target.value};
                        setCustomServerConfig({...customServerConfig, headers: newHeaders});
                      }}
                    />
                    <Input
                      size="sm"
                      placeholder="Header值"
                      value={header.value}
                      onChange={(e) => {
                        const newHeaders = [...currentHeaders];
                        newHeaders[index] = {...header, value: e.target.value};
                        setCustomServerConfig({...customServerConfig, headers: newHeaders});
                      }}
                      ml={2}
                    />
                    <Box ml={2} display="flex" alignItems="center" gap={1}>
                      <Button
                        size="sm"
                        onClick={() => {
                          setCustomServerConfig({
                            ...customServerConfig,
                            headers: [...currentHeaders, {key: '', value: ''}]
                          });
                        }}
                      >
                        +
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          const newHeaders = [...currentHeaders];
                          // 如果是最后一个，清空 key 和 value
                          if (currentHeaders.length === 1) {
                            newHeaders[index] = {key: '', value: ''};
                          } else {
                            // 否则删除该项
                            newHeaders.splice(index, 1);
                          }
                          setCustomServerConfig({...customServerConfig, headers: newHeaders});
                        }}
                      >
                        -
                      </Button>
                    </Box>
                  </Flex>
                );
              })}
            </FormControl>
          )}

          <FormControl mb={3}>
            <FormLabel fontSize="sm">AutoApprove (是否默认允许 Server 的工具调用)</FormLabel>
              <CustomSelect
                size="sm"
                value={{ label: customServerConfig.autoApprove ? "true" : "false", value: customServerConfig.autoApprove ? "true" : "false" }}
                onChange={(selectedOption: any) => setCustomServerConfig({...customServerConfig, autoApprove: selectedOption?.value === "true"})}
                options={[
                  { label: 'false', value: 'false' },
                  { label: 'true', value: 'true' }
                ]}
                hoverColor="#786FFF"
                checkedColor="#786FFF"
                backgroundColor="#1e1e1e"
              />
          </FormControl>



          <FormControl mb={3}>
            <FormLabel fontSize="sm">Disabled (是否禁用 Server)</FormLabel>
            <CustomSelect
              size="sm"
              value={{ label: customServerConfig.disabled ? "true" : "false", value: customServerConfig.disabled ? "true" : "false" }}
              onChange={(selectedOption: any) => setCustomServerConfig({...customServerConfig, disabled: selectedOption?.value === "true"})}
              options={[
                { label: 'false', value: 'false' },
                { label: 'true', value: 'true' }
              ]}
              hoverColor="#786FFF"
              checkedColor="#786FFF"
              backgroundColor="#1e1e1e"
            />
          </FormControl>

          <FormControl mb={3}>
            <FormLabel fontSize="sm">Timeout (工具调用超时时间，单位是秒)</FormLabel>
            <Input
              size="sm"
              type="number"
              value={customServerConfig.timeout || ''}
              onChange={(e) => setCustomServerConfig({...customServerConfig, timeout: parseInt(e.target.value)})}
            />
          </FormControl>
        </ModalBody>

        <ModalFooter>
          <Button mr={3} onClick={handleClose}>
            取消
          </Button>
          <Button colorScheme="blue" onClick={handleCustomServerSave}>
            保存
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default MCPServerModal;
