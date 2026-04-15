import * as React from 'react';
import { IDE, useExtensionStore } from '../../store/extension';
import JetBrainsShortcuts from './JetBrains';
import VisualStudioCodeShortcuts from './VisualStudioCode';
import NetworkDiagnostic from './NetworkDiagnostic';
import { Select } from 'chakra-react-select';
import {
  getModelList,
  CodeMakerModel,
  updateUserConfig,
} from '../../services/codeManager';
import { BroadcastActions, usePostMessage } from '../../PostMessageProvider';
import userReporter from '../../utils/report';
import {
  Flex,
  Text,
  Avatar,
  Box,
  useMediaQuery,
  Button,
  Tooltip,
  RadioGroup,
  Stack,
  Radio,
} from '@chakra-ui/react';
import CodeMakerLogo from '../../assets/codemaker-logo.png';
import Icon from '../../components/Icon';
import { RiArrowDownSLine } from 'react-icons/ri';
import VisualStudioShortcuts from './VisualStudio';
// import { proxyRequest } from '../../services/common';
import { getErrorMessage } from '../../utils';
import { useUserConfig } from '../../store/user-config';
import useService, { mutateService } from '../../hooks/useService';
import { getUserConfig } from '../../services/user-config';
import { SmallScreenWidth } from '../../const';
import TabMenu from '../../components/TabMenu';
import { useTheme, ThemeStyle } from '../../ThemeContext';
import { CODEMAKER_THEME_PREFERENCE_KEY } from '../../ThemeProvider';
import { toastError } from '../../services/error';
import { createDebouncedToast } from '../../components/CustomToast/debounceToast';
import { proxyRequest } from '../../services/common';
import { UserEvent } from '../../types/report';

const debouncedToast = createDebouncedToast();

enum ModelType {
  Customized = '定制模型',
  General = '通用模型',
}

interface OptionValue {
  label: string;
  value: string;
}

const IDC = 'idc';
export default function Help() {
  const [isSmallScreen] = useMediaQuery(SmallScreenWidth);
  const extensionStore = useExtensionStore();
  const { postMessage } = usePostMessage();
  const [selectedModel, setSelectedModel] = React.useState({
    label: '',
    value: '',
  });
  const { activeTheme, switchTheme } = useTheme();

  // 从 localStorage 读取用户的主题偏好设置
  const [themePreference, setThemePreference] = React.useState<ThemeStyle>(() => {
    const saved = localStorage.getItem(CODEMAKER_THEME_PREFERENCE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved) as ThemeStyle;
      } catch {
        return ThemeStyle.Dark;
      }
    }
    return ThemeStyle.Dark;
  });

  const { data: modelList, isLoading } = useService(getModelList, {
    revalidateOnFocus: true,
  });
  const userConfig = useUserConfig((state) => state.config);
  const [uploadingLog, setUploadingLog] = React.useState(false);

  const handlePostMessage = React.useCallback((event: MessageEvent) => {
    const message = event.data;
    switch (message.type) {
      case 'VALIDATE': {
        mutateService(getModelList);
        mutateService(getUserConfig);
        break;
      }
      case 'UPLOAD_LOG_RESULT': {
        setUploadingLog(false);
        const { error } = message.data;
        if (error) {
          toastError(error);
        } else {
          debouncedToast({
            title: '日志上传成功',
            status: 'info',
            duration: 3000,
            isClosable: true,
            position: 'top',
          });
        }
        break;
      }
    }
  }, []);

  const openExtensionSetting = React.useCallback(() => {
    postMessage({
      type: 'OPEN_EXTENSION_SETTING',
    });
  }, [postMessage]);

  const openCheckUpdate = React.useCallback(() => {
    postMessage({
      type: 'OPEN_CHECK_UPDATE',
    });
  }, [postMessage]);

  const uploadLog = React.useCallback(() => {
    setUploadingLog(true);
    postMessage({
      type: 'UPLOAD_LOG',
    });
  }, [postMessage]);

  const openInBrowser = React.useCallback(
    (url: string) => {
      postMessage({
        type: 'OPEN_IN_BROWSER',
        data: {
          url,
        },
      });
    },
    [postMessage],
  );

  const openOnboarding = React.useCallback(() => {
    postMessage({
      type: 'OPEN_ON_BOARDING',
    });
  }, [postMessage]);

  React.useEffect(() => {
    window.addEventListener('message', handlePostMessage);
    return () => {
      window.removeEventListener('message', handlePostMessage);
    };
  }, [handlePostMessage]);

  React.useEffect(() => {
    const currentModel = modelList?.find(
      (i) => i._id === userConfig?.using_mapper_id,
    );
    if (currentModel) {
      setSelectedModel({
        label: currentModel.name,
        value: currentModel._id || '',
      });
    }
  }, [modelList, userConfig]);

  const modelOptions = React.useMemo(() => {
    if (!modelList?.length) return [];
    const customModel: OptionValue[] = [];
    const generalModel: OptionValue[] = [];
    modelList.forEach((model) => {
      const group = {
        label: model.name || '',
        value: model._id || '',
      };
      if (model.is_customized) {
        customModel.push(group);
      } else {
        generalModel.push(group);
      }
    });
    return [
      {
        label: ModelType.General,
        options: generalModel,
      },
      {
        label: ModelType.Customized,
        options: customModel,
      },
    ];
  }, [modelList]);

  const updateConfig = React.useCallback(
    async (updateConfig: CodeMakerModel) => {
      if (!updateConfig._id) return;
      try {
        // 规则如下：
        // 1. 如果发现 gateway_name 不等于 idc 的，先更新 office 的
        // 2. 如果失败了则有一下几种可能
        //    2.1 没有在办公网络的环境下切换，网络不通
        //    2.2 可能是 office 环境数据库找不到对应的模型、则接口返回 404
        // 3. 如果更新成功了，则再更新 idc 环境
        if (updateConfig?.gateway_name !== IDC && updateConfig?.gateway) {
          await proxyRequest({
            requestUrl: `${updateConfig?.gateway}/api/v1/user_config`,
            requestData: {
              mapper_id: updateConfig._id,
              mapper_type: updateConfig.mapper_type!,
              dep: updateConfig.dep!,
              code: updateConfig.code!,
            },
          });
        }
        await updateUserConfig({
          mapper_id: updateConfig._id,
          mapper_type: updateConfig.mapper_type!,
          dep: updateConfig.dep!,
          code: updateConfig.code!,
        });
        userReporter.report({
          event: UserEvent.HELP_SWITCH_MODEL,
          extends: {
            model: `${updateConfig?.name}-${updateConfig.code}`,
          },
        });
        postMessage({
          type: BroadcastActions.UPDATE_GATEWAY,
        });
        mutateService(getModelList);
        mutateService(getUserConfig);
      } catch (error) {
        userReporter.batchReport(
          [
            {
              event: UserEvent.SWITCH_MODEL_ERROR,
              extends: {
                model: `${updateConfig?.name}-${updateConfig.code}`,
                gateway: updateConfig?.gateway || '',
                gateway_name: updateConfig?.gateway_name || '',
                message: getErrorMessage(error),
              },
            },
          ],
          true,
        );
      }
    },
    [postMessage],
  );

  return (
    <Box w="full" h="calc(100vh - 74px)" px="4" pt="4">
      <Box
        h="full"
        w="full"
        overflowY="scroll"
        css={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        }}
      >
        <Flex justifyContent="left">
          <Avatar w="24px" h="24px" src={CodeMakerLogo} />
          <Text fontSize="20px" fontWeight="bold">
            odeMaker 一站式智能研发工作台
          </Text>
        </Flex>
        <Text color="text.default">{extensionStore.codeMakerVersion}</Text>
        <Box
          my="6"
          display="flex"
          alignItems="start"
          flexWrap={isSmallScreen ? 'wrap' : 'nowrap'}
        >
          <Text fontSize="16px" fontWeight="bold" minW="72px" mr="4">
            补全模型
          </Text>
          <Box mt={isSmallScreen ? '4' : '0'}>
            <Select
              inputId="chakra-react-select-model"
              isDisabled={isLoading}
              value={selectedModel}
              className={`flex-grow-0 min-w-[200px] ${
                activeTheme === ThemeStyle.Light ? 'border-zinc-300' : ''
              }`}
              components={{
                DropdownIndicator: () => (
                  <div className="mr-4">
                    <Icon
                      as={RiArrowDownSLine}
                      size="xs"
                      color="text.default"
                    />
                  </div>
                ),
                IndicatorSeparator: () => null,
              }}
              // menuIsOpen
              isLoading={isLoading}
              onChange={(v) => {
                if (!v) return;
                const current = modelList?.find((m) => m._id === v.value);
                if (!current) return;
                void updateConfig(current);
              }}
              formatGroupLabel={(group) => (
                <Box color="text.muted" p="0">
                  {group.label}
                </Box>
              )}
              options={modelOptions}
            />
          </Box>
        </Box>
        <Box
          my="6"
          alignItems="start"
          display="flex"
          flexWrap={isSmallScreen ? 'wrap' : 'nowrap'}
        >
          <Text fontSize="16px" fontWeight="bold" minW="72px" mr="4">
            主题颜色
          </Text>
          <Box>
            <RadioGroup
              onChange={(v) => {
                const newTheme = v as ThemeStyle;
                setThemePreference(newTheme);
                switchTheme(newTheme);
              }}
              value={themePreference}
            >
              <Stack direction="row">
                <Radio value={ThemeStyle.Light}>浅色</Radio>
                <Radio value={ThemeStyle.Dark}>深色</Radio>
                <Radio value={ThemeStyle.System}>跟随系统</Radio>
              </Stack>
            </RadioGroup>
          </Box>
        </Box>
        <GridLine />
        <Box
          my="6"
          alignItems="start"
          display="flex"
          flexWrap={isSmallScreen ? 'wrap' : 'nowrap'}
        >
          <Text fontSize="16px" fontWeight="bold" minW="72px" mr="4">
            功能模块
          </Text>
          <Box>
            <TabMenu />
            <Box
              mt="6"
              alignItems="center"
              display="flex"
              flexWrap={isSmallScreen ? 'wrap' : 'nowrap'}
            >
              {extensionStore.IDE !== IDE.VisualStudio && (
                <Button
                  color="white"
                  borderRadius="16px"
                  colorScheme="blue.300"
                  bg="blue.300"
                  onClick={openExtensionSetting}
                  w="126px"
                  h="32px"
                  // mr="6"
                  fontSize="12px"
                >
                  更多配置修改
                </Button>
              )}
              <Button
                color="white"
                borderRadius="16px"
                colorScheme="blue.300"
                bg="blue.300"
                onClick={openCheckUpdate}
                w="126px"
                h="32px"
                mr="6"
                ml="4"
                fontSize="12px"
              >
                检查更新
              </Button>
              {extensionStore.IDE === IDE.JetBrains && (
                <Tooltip label="部分系统可能出现输入框无法输入中文的问题，可以在插件配置中关闭 JCEF OSR 解决">
                  <Box
                    color="blue.300"
                    _hover={{
                      cursor: 'pointer',
                    }}
                    onClick={openExtensionSetting}
                  >
                    一键解决 Chat 无法输入中文的问题
                  </Box>
                </Tooltip>
              )}
            </Box>
          </Box>
        </Box>

        <GridLine />
        {extensionStore.IDE === IDE.VisualStudioCode && (
          <VisualStudioCodeShortcuts />
        )}
        {extensionStore.IDE === IDE.JetBrains && <JetBrainsShortcuts />}
        {extensionStore.IDE === IDE.VisualStudio && <VisualStudioShortcuts />}

        {/* 网络诊断模块 */}
        {extensionStore.IDE === IDE.VisualStudioCode && (
          <>
            <GridLine />
            <NetworkDiagnostic />
          </>
        )}

        <GridLine />
        <Box my="6" display="flex" flexWrap={isSmallScreen ? 'wrap' : 'nowrap'}>
          <Text fontSize="16px" fontWeight="bold" minW="72px" mr="4">
            功能指引
          </Text>
          <Box mt={isSmallScreen ? '4' : '0'}>
            <Box display="flex" alignItems="center" mt="1">
              <Text fontSize="14px" fontWeight="bold" mr="4" minW="126px">
                用户群
              </Text>
              <Text isTruncated>000000</Text>
            </Box>
            <Box display="flex" mt="2">
              <Text fontSize="14px" fontWeight="bold" mr="4" minW="126px">
                服务助手
              </Text>
              <Text>support@example.com</Text>
            </Box>
            {(extensionStore.IDE === IDE.VisualStudioCode ||
              extensionStore.IDE === IDE.JetBrains) && (
              <Button
                color="white"
                borderRadius="16px"
                colorScheme="blue.300"
                bg="blue.300"
                mt="6"
                mr="4"
                onClick={openOnboarding}
                w="96px"
                h="32px"
                fontSize="12px"
              >
                新手引导
              </Button>
            )}
            <Button
              color="white"
              borderRadius="16px"
              colorScheme="blue.300"
              bg="blue.300"
              mt="6"
              onClick={() => {
                openInBrowser('https://github.com/user/codemaker');
              }}
              w="96px"
              h="32px"
              fontSize="12px"
            >
              用户文档
            </Button>
          </Box>
        </Box>

        <GridLine />
        <Box
          my="6"
          alignItems="center"
          display="flex"
          flexWrap={isSmallScreen ? 'wrap' : 'nowrap'}
        >
          <Text fontSize="16px" fontWeight="bold" minW="72px" mr="4">
            上报日志
          </Text>
          {extensionStore.IDE !== IDE.VisualStudio && (
            <Button
              color="white"
              borderRadius="16px"
              colorScheme="blue.300"
              bg="blue.300"
              onClick={uploadLog}
              w="126px"
              h="32px"
              mr="6"
              fontSize="12px"
              isLoading={uploadingLog}
            >
              上报日志
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function GridLine() {
  const { activeTheme } = useTheme();
  return (
    <Box
      w="full"
      h="1px"
      bg={activeTheme === ThemeStyle.Dark ? 'gray.600' : 'gray.400'}
      opacity="0.8"
    ></Box>
  );
}
