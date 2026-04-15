import { useEffect, useRef, useState } from 'react';
import {
  Text, Box, Flex,
  IconButton, Icon,
  Tooltip,
  Collapse,
  Spinner
} from '@chakra-ui/react';
import SelectWithTooltip, { SelectOption } from '../../components/SelectWithTooltip';
import { MCPServer, useMCPStore } from '../../store/mcp';
import { BroadcastActions, usePostMessage } from '../../PostMessageProvider';

import userReporter from '../../utils/report';
import { UserEvent } from '../../types/report';
import { FaAngleDown, FaAngleRight, FaAngleUp, FaCheckCircle, FaTimesCircle, FaCircle } from 'react-icons/fa';
import { IoSettingsOutline } from 'react-icons/io5';
import { MdAutorenew } from 'react-icons/md';
import { getLocalStorage, setLocalStorage } from '../../utils/storage';
import { AiOutlineQuestionCircle } from 'react-icons/ai';
import { TbFileCode } from 'react-icons/tb';

const MCP_STATUS = {
  'connected': '已连接',
  'disconnected': '未连接',
  'connecting': '正在连接'
}

const STATUS_COLOR = {
  'connected': 'green.500',
  'disconnected': 'red.500',
  'connecting': 'yellow.500'
}

type TMCPStatusKey = keyof typeof MCP_STATUS

interface IProps {
  setMcpSettingOpen: (open: boolean) => void;
}

const maxPendingTime = 1000 * 10
const collapseKey = 'codechat-mcp-collapse-config'
const loadMoreKey = 'codechat-mcp-load-more-config'

const getStatusIcon = (status: string, disabled: boolean) => {
  if (disabled) return FaTimesCircle;
  switch (status) {
    case 'connected':
      return FaCheckCircle;
    case 'disconnected':
      return FaTimesCircle;
    case 'connecting':
      return FaCircle;
    default:
      return FaCircle;
  }
};

const MCPConfigCollapse = (props: IProps) => {
  const { setMcpSettingOpen } = props;
  const [cacheMCpServers, setCacheMCPServers] = useState<MCPServer[]>([]); // 缓存MCPServers，避免频繁更新渲染视图
  const [isCollapsed, setIsCollapsed] = useState(!!getLocalStorage(collapseKey));
  const [mcpServerLoadings, setMcpServerLoadings] = useState<Record<string, boolean>>({})
  const [showAllServers, setShowAllServers] = useState(!!getLocalStorage(loadMoreKey)); // 新增状态，控制是否显示所有服务器
  const MCPServers = useMCPStore((state) => state.MCPServers);
  const builtInServers = useMCPStore((state) => state.builtInServers);
  const disabledSwitches = useMCPStore((state) => state.disabledSwitches);
  const getChineseNameByServerName = useMCPStore((state) => state.getChineseNameByServerName);
  const { postMessage } = usePostMessage();
  const mcpReferenceMapRef = useRef<Map<string, MCPServer>>(new Map());

  useEffect(() => {
    // 更新策略, 只有mcpReferenceRef中没有的server或者MCPServer已有的服务才会被更新到cacheMCpServers中
    const newServers: MCPServer[] = [];
    const existisingServerIndexMap: Map<string, number> = new Map()
    let targetIndex = -1
    mcpReferenceMapRef.current.forEach((server) => {
      if (MCPServers.some(s => s.name === server.name)) {
        ++targetIndex
        newServers.push(server)
        existisingServerIndexMap.set(server.name, targetIndex)
      }
    });
    MCPServers.forEach(server => {
      const exisitIndex = existisingServerIndexMap.get(server.name)
      if (typeof exisitIndex === 'number' && exisitIndex >= 0) {
        newServers[exisitIndex] = server;
        setMcpServerLoadings(prev => ({ ...prev, [server.name]: false }))
      } else if (!mcpReferenceMapRef.current.has(server.name)) {
        newServers.push(server);
      }
      mcpReferenceMapRef.current.set(server.name, server);
    })
    setCacheMCPServers(newServers);
  }, [MCPServers])

  return (
    <>
      <Flex display={'flex'} justifyContent={'space-between'} alignItems={'center'} fontSize={'small'}>
        <Flex
          display={'flex'}
          alignItems={'center'}
          userSelect={'none'}
          cursor={'pointer'}
          onClick={() => {
            setLocalStorage(collapseKey, !isCollapsed);
            setIsCollapsed(!isCollapsed)
          }}
        >
          <svg
            width="16"
            height={'full'}
            viewBox="0 0 1024 1024"
            fill="currentColor"
          >
            <path d="M623.93327 77.956139a102.527551 102.527551 0 0 0-51.199776 26.047886L133.887414 524.994183a42.559814 42.559814 0 0 1-57.727747 0.447998 36.927838 36.927838 0 0 1-0.447998-54.399762L514.557749 50.052261c16.639927-15.99993 50.30378-40.575822 95.487582-47.93579 48.255789-7.807966 102.91155 5.183977 154.687323 54.84776 48.767787 46.847795 56.511753 99.455565 50.047781 141.823379 44.799804-6.207973 99.775563 1.919992 149.119348 49.279785 52.60777 50.431779 66.17571 102.463552 57.663748 148.223351-7.999965 43.007812-34.36785 74.559674-50.43178 89.919607l-387.646304 371.902373 104.703542 100.47956a36.927838 36.927838 0 0 1-0.511998 54.399762 42.559814 42.559814 0 0 1-57.599748-0.511998L497.277824 885.120608a36.927838 36.927838 0 0 1 0-54.015764l415.806181-398.846255c9.919957-9.535958 24.191894-27.51988 28.223877-49.279785 3.519985-18.815918 0.511998-46.399797-35.455845-80.959645-31.871861-30.527866-63.743721-31.359863-90.047606-24.959891a147.903353 147.903353 0 0 0-44.991803 19.455915l-1.023996 0.639997-344.318493 330.366555a42.559814 42.559814 0 0 1-57.599748 0.447998 36.927838 36.927838 0 0 1-0.511998-54.399762l343.934495-329.982557 0.511998-0.767996a143.871371 143.871371 0 0 0 20.223911-44.607805c6.719971-26.623884 5.311977-57.791747-25.407888-87.295618-34.687848-33.279854-63.039724-36.159842-82.687639-32.959856z m47.99979 67.199706a36.927838 36.927838 0 0 1 0.447998 54.399762l-344.318493 330.238555a98.111571 98.111571 0 0 0-6.91197 10.623954c-5.055978 8.575962-10.815953 20.47991-14.335937 33.983851-6.78397 25.855887-5.759975 57.08775 26.239885 87.807616 31.871861 30.527866 63.807721 31.359863 90.111606 24.959891a148.159352 148.159352 0 0 0 45.951799-20.159912l344.318493-330.238555a42.559814 42.559814 0 0 1 57.663748-0.511998 36.927838 36.927838 0 0 1 0.511998 54.399762l-346.494484 332.414546a40.255824 40.255824 0 0 1-3.647984 3.071986l-25.471889-30.079868 25.471889 30.079868-0.128 0.064-0.191999 0.127999-0.447998 0.383999-1.407994 1.023995-4.60798 3.135986a232.190984 232.190984 0 0 1-71.359688 30.911865c-47.615792 11.39195-111.679511 8.767962-168.383263-45.6318-56.575752-54.271763-59.135741-115.199496-47.359793-160.191299a211.199076 211.199076 0 0 1 35.263846-72.447683l1.087995-1.343995 0.319999-0.447998 0.191999-0.191999s0.064-0.127999 32.319859 23.423898l-32.255859-23.551897a39.167829 39.167829 0 0 1 3.199986-3.455985l346.494484-332.350546a42.559814 42.559814 0 0 1 57.663748-0.447998z" />
          </svg>
          <Text marginLeft={2} fontSize={12}>MCP Server</Text>
          <Tooltip label="通过MCP Server将跨平台操作/数据统一到对话入口，点击 配置 按钮可安装更多推荐或自定义MCP" placement="top">
            <Box display="inline-flex" alignItems="center" ml={1} mr={2} cursor="help">
              <Icon as={AiOutlineQuestionCircle} w="14px" h="14px" color="gray.500" />
            </Box>
          </Tooltip>
          <Icon as={isCollapsed ? FaAngleRight : FaAngleDown} size="xs" />
        </Flex>
        <Box>
          <Tooltip label="重启MCP服务">
            <IconButton
              size={'sm'}
              height={'20px'}
              aria-label="重启"
              className='ml-auto'
              icon={<Icon as={MdAutorenew} fontSize={'16px'} />}
              onClick={() => {
                const getLoadings = (enable: boolean) => {
                  const obj: Record<string, boolean> = {}
                  mcpReferenceMapRef.current.forEach(i => {
                    obj[i.name] = enable
                  })
                  return obj
                }
                setMcpServerLoadings(getLoadings(true))
                postMessage({
                  type: BroadcastActions.RESTART_MCP_SERVERS
                })
                setTimeout(() => {
                  setMcpServerLoadings(getLoadings(false))
                }, maxPendingTime)
              }}
              bg="none"
              color="text.default"
            />
          </Tooltip>
          <Tooltip label="MCP Server 配置文件">
            <IconButton
              size={'sm'}
              height={'20px'}
              aria-label="打开配置文件"
              className='ml-auto'
              icon={<Icon as={TbFileCode} fontSize={'16px'} />}
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
              bg="none"
              color="text.default"
            />
          </Tooltip>
          <Tooltip label="配置MCP服务">
            <IconButton
              size={'sm'}
              height={'20px'}
              aria-label="配置MCP服务"
              className='ml-auto'
              icon={<Icon as={IoSettingsOutline} fontSize={'16px'} />}
              onClick={() => {
                setMcpSettingOpen(true)
                userReporter.report({
                  event: UserEvent.CODE_CHAT_MCP_MANAGE_PANEL,
                });
              }}
              bg="none"
              color="text.default"
            />
          </Tooltip>
        </Box>
      </Flex>
      <Collapse in={!isCollapsed} animate={false}>
        {
          cacheMCpServers.length
            ? (showAllServers ? cacheMCpServers : cacheMCpServers.slice(0, 3)).map((server, index) => {
              let serverName = server.name || '';
              serverName = serverName.replace('\\', '/');
              serverName = serverName.split('/').slice(-1)[0];

              // 查找中文名称的优先级：
              // 1. server.config.chinese_name (本地配置)
              // 2. nameMappings (API 返回的权限数据)
              // 3. builtInServer.chinese_name (内置服务器配置)
              // 4. serverName (服务器名称)
              const builtInServer = builtInServers.find(bis => bis.name === server.name);
              const displayName = server.config?.chinese_name
                || getChineseNameByServerName(server.name)
                || builtInServer?.chinese_name
                || serverName;

              // 调试信息
              const isSwitchDisabled = mcpServerLoadings[server.name] || disabledSwitches.has(server.name);
              const shouldShowTooltip = disabledSwitches.has(server.name) || !!server.error;
              return (

                <Box
                  key={serverName + index}
                  marginLeft={4}
                  position={'relative'}
                >
                  <Flex
                    paddingLeft={1}
                    paddingBottom={2}
                    _before={{
                      content: '""',
                      position: 'absolute',
                      left: '-10px',
                      top: '-60%',
                      width: '8px',
                      height: '100%',
                      borderLeft: '1px solid #797979',
                      borderBottom: '1px solid #797979',
                    }}
                  >
                    <Flex justifyContent={'space-between'} alignItems={'center'} width={'full'}>
                      <Flex
                        mr="1"
                        width={'75%'}
                        wrap={'wrap'}
                        wordBreak={'break-all'}
                        alignItems={'center'}
                      >
                        <Tooltip label={disabledSwitches.has(server.name) ? `根据服务提供方要求， ${displayName}只能在私有模型下使用` : server.error} placement="top" hasArrow hidden={!shouldShowTooltip}>
                          <Flex alignItems={'center'} gap={1}>
                            <Tooltip
                              label={disabledSwitches.has(server.name) ? '已禁用' : server.config?.disabled ? '已关闭' : (MCP_STATUS[server.status as TMCPStatusKey] || '未知状态')}
                              placement="top"
                            >
                              <Box display="flex" alignItems="center">
                                <Icon
                                  as={getStatusIcon(server.status, !!server.config?.disabled)}
                                  color={disabledSwitches.has(server.name) ? 'gray.500' : (server.config?.disabled ? 'inherit' : STATUS_COLOR[server.status as TMCPStatusKey] || 'gray.500')}
                                  w="12px"
                                  h="12px"
                                />
                              </Box>
                            </Tooltip>
                            <Text
                              color={disabledSwitches.has(server.name) ? 'gray.500' : (server.config?.disabled ? 'inherit' : STATUS_COLOR[server.status as TMCPStatusKey] || 'inherit')}
                              lineHeight="1"
                              fontSize={"xs"}
                            >
                              {displayName}
                            </Text>
                          </Flex>
                        </Tooltip>
                      </Flex>
                      <Flex
                        textAlign={'right'}
                        position={'relative'}
                        justifyContent={'flex-end'}
                      >
                        <SelectWithTooltip
                          size="xs"
                          width="90px"
                          options={[
                            {
                              value: 'off', label: disabledSwitches.has(server.name) ? '禁用' : '关闭',
                              tooltipTitle: disabledSwitches.has(server.name) ? '已禁用' : '关闭服务',
                              tooltip: disabledSwitches.has(server.name)
                                ? '根据服务提供方要求，当前服务只能在私有模型下使用，已被强制禁用'
                                : '关闭该MCP服务，智聊过程中不会调用此服务'
                            },
                            {
                              value: 'on', label: '启用',
                              tooltipTitle: '启用服务',
                              tooltip: '在智聊过程中启用此MCP服务，手动确认请求与参数'
                            },
                            {
                              value: 'auto',
                              label: '启用(Auto)',
                              tooltipTitle: '自动模式',
                              tooltip: '智聊过程将自动调用MCP，无需手动确认请求与参数'
                            }
                          ] as SelectOption[]}
                          value={
                            disabledSwitches.has(server.name)
                              ? 'off'  // 真正被禁用的服务
                              : server.config?.disabled
                                ? 'off'  // 用户手动关闭的服务
                                : server.config?.autoApprove
                                  ? 'auto'
                                  : 'on'
                          }
                          isDisabled={isSwitchDisabled}
                          isTrulyDisabled={disabledSwitches.has(server.name)}
                          onChange={(e) => {
                            const value = e.target.value;
                            const isDisabled = value === 'off';
                            const isAuto = value === 'auto';

                            postMessage({
                              type: BroadcastActions.UPDATE_MCP_SERVERS,
                              data: {
                                name: serverName,
                                ...server.config,
                                disabled: isDisabled,
                                autoApprove: isAuto
                              }
                            });

                            setMcpServerLoadings((prev) => ({
                              ...prev,
                              [server.name]: true
                            }));

                            setTimeout(() => {
                              setMcpServerLoadings((prev) => ({
                                ...prev,
                                [server.name]: false
                              }));
                            }, maxPendingTime);
                          }}
                        />
                        <Spinner
                          hidden={!mcpServerLoadings[server.name]}
                          marginLeft={'auto'}
                          marginRight={'10px'}
                          marginTop={1} color={'#8e8e8e'}
                          size={'xs'}
                          pos="absolute"
                          inset="0"
                          bg="bg/120"
                        />
                      </Flex>
                    </Flex>
                  </Flex>
                </Box>
              )
            })
            : (
              <Box marginLeft={4} position={'relative'}>
                <Box
                  _before={{
                    content: '""',
                    position: 'absolute',
                    left: '-10px',
                    top: '-60%',
                    width: '8px',
                    height: '100%',
                    borderLeft: '1px solid #797979',
                    borderBottom: '1px solid #797979',
                  }}
                  fontSize={'sm'}
                >
                  当前未接入任何 MCP Server，可以打开配置文件进行配置
                </Box>
              </Box>
            )
        }
        {/* 添加"更多"按钮，当服务器数量超过3个且未显示全部时显示 */}
        {cacheMCpServers.length > 3 && !showAllServers && (
          <Flex
            marginLeft={4}
            justifyContent="center"
            color="blue.500"
            fontSize="sm"
            cursor="pointer"
            onClick={() => {
              setLocalStorage(loadMoreKey, true);
              setShowAllServers(true)
            }}
            userSelect="none"
          >
            <Text>更多</Text>
            <Icon as={FaAngleDown} ml={1} />
          </Flex>
        )}
        {/* 添加"收起"按钮，当显示全部服务器且数量超过3个时显示 */}
        {cacheMCpServers.length > 3 && showAllServers && (
          <Flex
            marginLeft={4}
            justifyContent="center"
            color="blue.500"
            fontSize="sm"
            cursor="pointer"
            onClick={() => {
              setLocalStorage(loadMoreKey, false);
              setShowAllServers(false)
            }}
            userSelect="none"
          >
            <Text>收起</Text>
            <Icon as={FaAngleUp} ml={1} />
          </Flex>
        )}
      </Collapse>
    </>
  );
};

export default MCPConfigCollapse;
