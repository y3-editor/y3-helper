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
  Collapse,
} from '@chakra-ui/react';
import useService, { mutateService } from '../../../../hooks/useService';
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
import {
  getUserConfig,
  subscribePluginApp,
} from '../../../../services/user-config';

function PluginAppList() {
  const { data, isLoading } = useService(getPlugins, []);

  if (isLoading) {
    return (
      <Flex w="full" h="full" p={4} justifyContent="center">
        <Spinner size="md" />
      </Flex>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Flex w="full" h="full" p={4} justifyContent="center">
        无插件
      </Flex>
    );
  }

  return (
    <>
      <Box h="192px" overflow="scroll">
        <VStack align="stretch" gap="2" overflowY="scroll">
          {data.map((item: any) => (
            <PluginAppRow data={item} key={item._id} />
          ))}
        </VStack>
      </Box>
      <Text
        as={Flex}
        mt={2}
        pl={2}
        color="gray.400"
        fontSize="sm"
        alignItems="center"
        gap={1}
      >
        订阅的插件可以通过 / 快捷指令快速使用
      </Text>
    </>
  );
}

function PluginAppRow(props: { data: PluginApp }) {
  const { data } = props;
  const { postMessage } = usePostMessage();
  const userConfig = useUserConfig((state) => state.config);
  const [isOpen, setIsOpen] = React.useState(false);
  const rowRef = React.useRef<HTMLDivElement>(null);

  const isSubscribed = React.useMemo(() => {
    if (!userConfig?.subscribe_app_tools) {
      return false;
    }
    return userConfig?.subscribe_app_tools.includes(data._id);
  }, [userConfig, data._id]);

  const handleOpenDoc = (url: string) => {
    postMessage({
      type: BroadcastActions.OPEN_IN_BROWSER,
      data: { url },
    });
  };

  const handleSubscribe = async () => {
    const appIds = userConfig?.subscribe_app_tools || [];
    let nextSubscribedApps;
    if (isSubscribed) {
      nextSubscribedApps = appIds?.filter((item) => item !== data._id);
    } else {
      nextSubscribedApps = [...appIds, data._id];
    }
    await subscribePluginApp(nextSubscribedApps);
    mutateService(getUserConfig);
  };

  const toggleExpand = () => {
    if (!isOpen) {
      // 当我们打算展开内容时
      // 确保内容被完全展开后，再滚动到该组件
      setTimeout(() => {
        rowRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 0);
    }
    setIsOpen(!isOpen);
  };

  return (
    <>
      <Box
        ref={rowRef}
        w="full"
        pl={4}
        pr={2}
        py={2}
        cursor="pointer"
        borderRadius="md"
        fontWeight="bold"
        position="relative"
        textAlign="left"
        bg="listBgColor"
        color="text.primary"
      >
        <Grid w="full" gridTemplateColumns="1fr 160px">
          <Grid>
            <Text mb={1} fontSize="14px" isTruncated>
              {data.app_name}
            </Text>
            <Text
              fontSize="12px"
              color="text.default"
              isTruncated
              title={data.app_description}
            >
              {data.app_description}
            </Text>
          </Grid>
          <Flex
            flexDirection="column"
            px={2}
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
            }}
          >
            <Flex width="auto" mb={1} justifyContent="flex-end">
              <Button
                color="white"
                colorScheme="blue"
                size="xs"
                onClick={handleSubscribe}
              >
                {isSubscribed ? '取消订阅' : '订阅'}
              </Button>
              <Button
                size="xs"
                onClick={() => {
                  setIsOpen(!isOpen);
                  toggleExpand();
                }}
                ml="2"
              >
                {isOpen ? '收起指令' : '展开指令'}
              </Button>
            </Flex>
            <Flex justifyContent="flex-end">
              <Text
                fontSize="12px"
                color="text.default"
                isTruncated
                title={data.app_provider}
              >
                {data.app_provider}
              </Text>
              <Divider mx={2} orientation="vertical" color="themeBgColor" />
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
        <Collapse in={isOpen}>
          <hr className="mt-4" />
          {/* <Box w="full" color="white" borderRadius="md" h="116px">
        </Box> */}
          {data?.app_shortcuts?.map((i) => (
            <Box mt="4" key={i._id}>
              <Flex>
                <Text mb={1} fontSize="14px" isTruncated>
                  /{i.name}
                </Text>
              </Flex>
              <Flex pl={4}>
                <Text fontSize="12px" isTruncated color="text.default">
                  {i.description}
                </Text>
              </Flex>
            </Box>
          ))}
        </Collapse>
      </Box>
    </>
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
