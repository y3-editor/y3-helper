import * as React from 'react';
import {
  Flex,
  Spinner,
  Box,
  Text,
  Grid,
  VStack,
  Button,
  Divider,
} from '@chakra-ui/react';
import useService from '../../../../hooks/useService';
import {
  PluginApp,
  PluginAppRunner,
  getPlugins,
} from '../../../../services/plugin';
import {
  BroadcastActions,
  usePostMessage,
} from '../../../../PostMessageProvider';
import { useUserConfig } from '../../../../store/user-config';
import { useAuthStore } from '../../../../store/auth';
import { useExtensionStore } from '../../../../store/extension';

const G18_WHITELIST = [
  'ljfn0337',
  'gzxiebo',
  'gzzsh',
  'bangshaoshi',
  'zzln1107',
  'gzwangmeilin',
  'zengxiangfeng',
  'huangyukun',
  'huangyawei',
  'huangting02',
  'weimengqiang',
  'huangyabin',
  'jiangzengming',
  'huangzhenye',
  'wanli01',
  'denglaixian',
  'zhaoshengchen',
  'dongyang02',
  'liuyu16',
  'majianhang',
  'gzzhouy2014',
  'songhuilu',
  'yangmaoning',
  'wangfengyi01',
  'wuyanhui',
  'chenruncheng',
  'chenpeng08',
  'shendawei',
  'zhouxinhui',
  'gzlvcan',
  'chenzhifeng01',
  'lifaxiang',
  'yujiaqi01',
  'yuanlipeng',
  'yuruihao',
];

function PluginAppList() {
  const { data, isLoading } = useService(getPlugins, []);
  const userConfig = useUserConfig((state) => state.config);
  const generateModelCode =
    useExtensionStore.getState().generateModelCode || '';
  const authExtends = useAuthStore((state) => state.authExtends);
  const username = useAuthStore((state) => state.username);
  const pluginApps = React.useMemo(() => {
    if (!data) {
      return [];
    }
    const apps = [];

    for (const item of data) {
      // TODO: 暂时 hardcode g18lua 插件仅能给 g18 项目同学订阅和使用
      if (item.app_id.includes('g18_lua')) {
        if (username && G18_WHITELIST.includes(username)) {
          void 0;
        } else if (
          authExtends.department_code !==
            'hudongyuleshiyequn-menghuanshiyebu-taitangongzuoshi-G18' &&
          generateModelCode !== 'office.g18.es'
        ) {
          continue;
        }
      }
      if (item.app_id === 'ada') {
        if (
          !authExtends.department_code.startsWith(
            'yanxuanshiyebu-jishuzhongxin',
          )
        ) {
          continue;
        }
      }
      apps.push(item);
    }
    return apps;
  }, [authExtends.department_code, data, generateModelCode, username]);

  const filteredPluginApps = React.useMemo(() => {
    if (!userConfig?.subscribe_app_tools) {
      return [];
    }
    return pluginApps.filter((item) =>
      userConfig.subscribe_app_tools.includes(item._id),
    );
  }, [pluginApps, userConfig]);

  if (isLoading) {
    return (
      <Flex w="full" h="full" p={4} justifyContent="center">
        <Spinner size="md" />
      </Flex>
    );
  }

  if (!filteredPluginApps || filteredPluginApps.length === 0) {
    return (
      <Flex w="full" h="full" p={4} justifyContent="center">
        无插件
      </Flex>
    );
  }

  return (
    <>
      <VStack pr={2} align="stretch" gap="2" minH="80px" overflowY="scroll">
        {filteredPluginApps.map((item) => (
          <PluginAppRow data={item} key={item._id} />
        ))}
      </VStack>
      <Text
        as={Flex}
        mt={2}
        pl={2}
        color="gray.400"
        fontSize="sm"
        alignItems="center"
        gap={1}
        flexShrink={0}
      >
        订阅的插件可以通过 / 快捷指令快速使用
      </Text>
    </>
  );
}

function PluginAppRow(props: { data: PluginApp }) {
  const { data } = props;
  const { postMessage } = usePostMessage();

  const handleOpenDoc = (url: string) => {
    postMessage({
      type: BroadcastActions.OPEN_IN_BROWSER,
      data: { url },
    });
  };

  return (
    <Box
      w="full"
      h="auto"
      pl={4}
      pr={2}
      py={2}
      backgroundColor="whiteAlpha.200"
      color="white"
      cursor="pointer"
      borderRadius="md"
      fontWeight="bold"
      position="relative"
      textAlign="left"
    >
      <Grid w="full" gridTemplateColumns="1fr 160px">
        <Grid>
          <Text mb={1} fontSize="14px" isTruncated>
            {data.app_name} (
            {data.app_shortcuts
              .map((shortcut) => `/${shortcut.name}`)
              .join(',')}
            )
          </Text>
          <Text
            fontSize="12px"
            opacity="0.6"
            isTruncated
            title={data.app_description}
          >
            {data.app_description}
          </Text>
        </Grid>
        <Flex
          flexDirection="column"
          px={2}
          color="white"
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
          }}
        >
          <Flex width="auto" mb={1} justifyContent="flex-end">
            {/* <Button
              color="white"
              colorScheme="blue"
              size="xs"
              onClick={handleSubscribe}
            >
              {isSubscribed ? '取消订阅' : '订阅'}
            </Button> */}
          </Flex>
          <Flex justifyContent="flex-end">
            <Text
              fontSize="12px"
              opacity="0.6"
              isTruncated
              title={data.app_provider}
            >
              {data.app_provider}
            </Text>
            <Divider mx={2} orientation="vertical" />
            <Button
              size="xs"
              opacity="0.8"
              variant="link"
              onClick={() => handleOpenDoc(data.app_doc)}
            >
              文档
            </Button>
          </Flex>
        </Flex>
      </Grid>
    </Box>
  );
}

export function PluginShortcutRow(props: { data: PluginAppRunner }) {
  const { app_shortcut: data } = props.data;

  return (
    <Grid w="full" gridTemplateColumns="1fr 40px">
      <Grid>
        <Text mb={1} fontSize="14px" isTruncated>
          / {data.name}
        </Text>
        <Text
          fontSize="12px"
          opacity="0.6"
          isTruncated
          title={data.description}
        >
          {data.description}
        </Text>
      </Grid>
      {/* <Flex
        flexDirection="column"
        px={2}
        color="white"
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
        }}
      >
        <Flex width="auto" mb={1} justifyContent="flex-end"></Flex>
        <Flex justifyContent="flex-end">
          <Text fontSize="12px" opacity="0.6" isTruncated title={data.action}>
            {data.action}
          </Text>
          <Divider mx={2} orientation="vertical" />
          <Button size="xs" opacity="0.8" variant="link">
            文档
          </Button>
        </Flex>
      </Flex> */}
    </Grid>
  );
}

export default PluginAppList;
