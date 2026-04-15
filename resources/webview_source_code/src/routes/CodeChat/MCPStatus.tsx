import React, { useState } from 'react';
import {
  Text, Popover, PopoverTrigger, Portal, PopoverContent, PopoverBody,
  PopoverHeader, Button, Box, Flex, Divider, PopoverFooter,
  IconButton, Icon, useDisclosure, Modal, ModalOverlay, ModalContent,
  ModalCloseButton, ModalBody,
  ModalHeader,
  ModalFooter,
  Tooltip
} from '@chakra-ui/react';
import MCPSettingModel from './MCPSettingModel';
// import { ThemeStyle } from '../../ThemeContext';
import { MCPServer, useMCPStore } from '../../store/mcp';
import { BroadcastActions, usePostMessage } from '../../PostMessageProvider';
import { TbRefresh } from 'react-icons/tb';
import { useTheme } from '../../ThemeContext';

import userReporter from '../../utils/report';
import { UserEvent } from '../../types/report';

const MCP_STATUS: any = {
  'connected': '已连接',
  'disconnected': '未连接',
  'connecting': '正在连接'
}

const STATUS_COLOR: any = {
  'connected': 'green.500',
  'disconnected': 'red.500',
  'connecting': 'yellow.500'
}

const MCPStatus = () => {
  const { activeTheme } = useTheme();
  const isLight = activeTheme === 'light';
  const MCPServers = useMCPStore((state) => state.MCPServers);
  const builtInServers = useMCPStore((state) => state.builtInServers);
  const disabledSwitches = useMCPStore((state) => state.disabledSwitches);
  const getChineseNameByServerName = useMCPStore((state) => state.getChineseNameByServerName);
  const { isOpen: isErrorOpen, onOpen: onErrorOpen, onClose: onErrorClose } = useDisclosure();
  const { isOpen: isSettingOpen, onOpen: onSettingOpen, onClose: onSettingClose } = useDisclosure();
  const [ currentServer, setCurrentServer] = useState<MCPServer|null>(null);
  const { postMessage } = usePostMessage();

  // 获取当前服务器的中文名称
  const currentServerDisplayName = React.useMemo(() => {
    if (!currentServer?.name) return '';
    const builtInServer = builtInServers.find(bis => bis.name === currentServer.name);
    return currentServer.config?.chinese_name
      || getChineseNameByServerName(currentServer.name)
      || builtInServer?.chinese_name
      || currentServer.name;
  }, [currentServer, builtInServers, getChineseNameByServerName]);

  return (
    <>
    <MCPSettingModel isOpen={isSettingOpen} onClose={onSettingClose} />
    <Modal isOpen={isErrorOpen} onClose={() => {
      setCurrentServer(null);
      onErrorClose();
    }} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{currentServerDisplayName}</ModalHeader>
          <ModalCloseButton />
          <ModalBody maxH={'300px'} overflowY={'auto'}>
            {currentServer?.error}
          </ModalBody>
          <ModalFooter>
            <Button onClick={onErrorClose}>
              关闭
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Popover onClose={close} placement='top'>
        <PopoverTrigger>
          <Box
            bg={isLight ? '#F2F2F2' : '#2C2C2C'}
            w="28px"
            h="28px"
            minW="28px"
            minH="28px"
            borderRadius="4px"
            color="text.secondary"
            _hover={{
              bg: isLight ? '#F2F2F2' : '#2C2C2C',
              filter: 'brightness(1.2)',
              color: '#746cec',
            }}
            className='cursor-pointer'
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Tooltip label="配置MCP">
              <svg
                width="16"
                height="16"
                viewBox="0 0 1024 1024"
                fill="currentColor"
                // style={{ filter: 'invert(1)' }}
              >
                <path d="M623.93327 77.956139a102.527551 102.527551 0 0 0-51.199776 26.047886L133.887414 524.994183a42.559814 42.559814 0 0 1-57.727747 0.447998 36.927838 36.927838 0 0 1-0.447998-54.399762L514.557749 50.052261c16.639927-15.99993 50.30378-40.575822 95.487582-47.93579 48.255789-7.807966 102.91155 5.183977 154.687323 54.84776 48.767787 46.847795 56.511753 99.455565 50.047781 141.823379 44.799804-6.207973 99.775563 1.919992 149.119348 49.279785 52.60777 50.431779 66.17571 102.463552 57.663748 148.223351-7.999965 43.007812-34.36785 74.559674-50.43178 89.919607l-387.646304 371.902373 104.703542 100.47956a36.927838 36.927838 0 0 1-0.511998 54.399762 42.559814 42.559814 0 0 1-57.599748-0.511998L497.277824 885.120608a36.927838 36.927838 0 0 1 0-54.015764l415.806181-398.846255c9.919957-9.535958 24.191894-27.51988 28.223877-49.279785 3.519985-18.815918 0.511998-46.399797-35.455845-80.959645-31.871861-30.527866-63.743721-31.359863-90.047606-24.959891a147.903353 147.903353 0 0 0-44.991803 19.455915l-1.023996 0.639997-344.318493 330.366555a42.559814 42.559814 0 0 1-57.599748 0.447998 36.927838 36.927838 0 0 1-0.511998-54.399762l343.934495-329.982557 0.511998-0.767996a143.871371 143.871371 0 0 0 20.223911-44.607805c6.719971-26.623884 5.311977-57.791747-25.407888-87.295618-34.687848-33.279854-63.039724-36.159842-82.687639-32.959856z m47.99979 67.199706a36.927838 36.927838 0 0 1 0.447998 54.399762l-344.318493 330.238555a98.111571 98.111571 0 0 0-6.91197 10.623954c-5.055978 8.575962-10.815953 20.47991-14.335937 33.983851-6.78397 25.855887-5.759975 57.08775 26.239885 87.807616 31.871861 30.527866 63.807721 31.359863 90.111606 24.959891a148.159352 148.159352 0 0 0 45.951799-20.159912l344.318493-330.238555a42.559814 42.559814 0 0 1 57.663748-0.511998 36.927838 36.927838 0 0 1 0.511998 54.399762l-346.494484 332.414546a40.255824 40.255824 0 0 1-3.647984 3.071986l-25.471889-30.079868 25.471889 30.079868-0.128 0.064-0.191999 0.127999-0.447998 0.383999-1.407994 1.023995-4.60798 3.135986a232.190984 232.190984 0 0 1-71.359688 30.911865c-47.615792 11.39195-111.679511 8.767962-168.383263-45.6318-56.575752-54.271763-59.135741-115.199496-47.359793-160.191299a211.199076 211.199076 0 0 1 35.263846-72.447683l1.087995-1.343995 0.319999-0.447998 0.191999-0.191999s0.064-0.127999 32.319859 23.423898l-32.255859-23.551897a39.167829 39.167829 0 0 1 3.199986-3.455985l346.494484-332.350546a42.559814 42.559814 0 0 1 57.663748-0.447998z" />
              </svg>
            </Tooltip>
          </Box>
        </PopoverTrigger>
      <Portal>
        <PopoverContent minWidth={200} maxWidth={250}>
          <PopoverHeader>
            <Flex alignItems='center' justifyContent='center'>
              <Text>MCP 服务器状态</Text>
              <IconButton
                aria-label="重启"
                className='ml-auto'
                icon={<Icon as={TbRefresh} size="sm" />}
                onClick={() => {
                  postMessage({
                    type: BroadcastActions.RESTART_MCP_SERVERS
                  })
                }}
                bg="none"
                color="text.default"
              />
            </Flex>
          </PopoverHeader>
          <PopoverBody
            maxHeight={'500px'}
            overflowY={'auto'}
            padding={4}
            className="show-scrollbar"
            sx={{
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(121, 121, 121, 0.4) !important',
              },
              '&::-webkit-scrollbar-thumb:hover': {
                backgroundColor: 'rgba(121, 121, 121, 0.6) !important',
              }
            }}
          >
            {
              MCPServers.length
              ? MCPServers.map((server, index) => {
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

                // 检查是否在 disabledSwitches 中
                const isInDisabledSwitches = disabledSwitches.has(server.name);

                return (
                  <Box key={serverName + index}>
                    <Flex mb={2} flexWrap="nowrap">
                      <Tooltip
                        label={isInDisabledSwitches ? `根据服务提供方要求，${displayName}只能在私有模型下使用` : ''}
                        placement="top"
                        hasArrow
                        isDisabled={!isInDisabledSwitches}
                      >
                        <Box display="inline-block">
                          <Text
                            mr="1"
                            color={isInDisabledSwitches ? 'gray.500' : 'default'}
                            // cursor={isInDisabledSwitches ? 'help' : 'default'}
                          >
                            {index+1}. {displayName}
                          </Text>
                        </Box>
                      </Tooltip>
                      <Text
                        color={server.disabled ? 'gray.500' : STATUS_COLOR[server.status] || 'gray.500'}
                        whiteSpace="nowrap"
                      >
                        ({server.disabled ? '已禁用' : (MCP_STATUS[server.status] || '未知状态')})
                      </Text>
                    </Flex>
                    {
                      server.error && (
                        <Box maxH={'80px'} overflowY={'auto'} cursor={'pointer'} onClick={()=>{
                          setCurrentServer(server);
                          onErrorOpen();
                        }}>
                          <Text>{server.error}</Text>
                        </Box>
                      )
                    }
                    {
                      index !== MCPServers.length -1 && (
                        <Divider h="1px !important" my={2}/>
                      )
                    }
                  </Box>
                )
              })
              : <Text>当前未接入任何 MCP Server，可以打开配置文件进行配置</Text>
            }
          </PopoverBody>
          <PopoverFooter>
          <Flex alignItems='center' justifyContent='center'>
              <Button
                size="sm"
                width="100px"
                onClick={() => {
                  onSettingOpen();
                  userReporter.report({
                    event: UserEvent.CODE_CHAT_MCP_MANAGE_PANEL,
                  });
                }}
              >
                配置
              </Button>
            </Flex>
          </PopoverFooter>
        </PopoverContent>
      </Portal>
    </Popover>
    </>
  );
};

export default MCPStatus;
