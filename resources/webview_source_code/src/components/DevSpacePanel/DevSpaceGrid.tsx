import { MouseEvent } from 'react'
import { Box, Button, Flex, Text, Grid, VStack, Icon, Tooltip } from "@chakra-ui/react";
import { CheckIcon } from "@chakra-ui/icons";
import { useWorkspaceStore } from "../../store/workspace";
import PanelItem from "./PanelItem";
import { usePostMessage } from "../../PostMessageProvider";
import { LuRuler, LuSearchCode } from "react-icons/lu";
import { FiBookOpen } from "react-icons/fi";

export default function DevSpaceGrid() {
  const devSpace = useWorkspaceStore((state) => state.devSpace);
  const devspaceOptions = useWorkspaceStore((state) => state.devSpaceOptions);
  const setDevSpace = useWorkspaceStore((state) => state.setDevSpace);

  const { postMessage } = usePostMessage();

  // const displayedOptions = useMemo(() => {
  //   if (devSpace) {
  //     const result = devspaceOptions.filter(option => option._id !== devSpace._id);
  //     const matchDevSpace = devspaceOptions.find(option => option._id === devSpace._id);
  //     if (matchDevSpace) {
  //       result.unshift(matchDevSpace);
  //     }
  //     return result;
  //   } else {
  //     return devspaceOptions;
  //   }
  // }, [devspaceOptions, devSpace])

  return <Flex
    w="full"
    flexDirection={'column'}
    h="260"
    bg="themeBgColor"
    color="text.primary"
  >
    <Flex my={3} placeContent="space-between" alignItems="center" h={'24px'} pl={2} pr={6}>
      <Text fontSize="sm" color="text.primary"  >
        研发知识集
      </Text>
      <Button
        size="sm"
        variant="link"
        color="blue.400"
        fontWeight="600"
        onClick={(e: MouseEvent) => {
          e.stopPropagation();
          postMessage({
            type: "OPEN_IN_BROWSER",
            data: { url: `https://github.com/user/codemaker` },
          });
        }}
        _hover={{ textDecoration: 'none', opacity: 0.8 }}
      >
        +  新建知识集
      </Button>
    </Flex>
    <Box position="relative" overflow="hidden" flex="1">
      <VStack
        pr={2}
        align="stretch"
        gap="2"
        h="full"
        overflowY="auto"
        pb="60px"
      >
        {devspaceOptions.map((item, index) => {
          return <PanelItem
            key={index}
            active={devSpace?._id === item._id}
            onClick={() => {
              if (devSpace?._id === item._id) {
                setDevSpace({
                  _id: '',
                  name: '',
                  project: '',
                  knowledge_bases: [],
                  codebases: [],
                  code_style: '',
                  ignore_paths: [],
                  allow_paths: [],
                  repos: [],
                  allow_public_model_access: false,
                  rules: []
                });
              } else {
                setDevSpace({
                  _id: item._id,
                  name: item.name,
                  project: item.project,
                  knowledge_bases: item.data?.knowledge_bases || [],
                  codebases: item.data?.codebases || [],
                  code_style: item.data?.code_styles?.[0]?.style || '',
                  ignore_paths: item.data?.ai_repo_chats?.[0].ignore_paths || [],
                  allow_paths: item.data?.ai_repo_chats?.[0].allow_paths || [],
                  repos: item.data?.repos || [],
                  allow_public_model_access: item.data?.allow_public_model_access || false,
                  rules: item.data?.rules || []
                });
              }
            }}
          >
            <Box
              position="relative"
              textAlign="left"
              w="full"
              h="full"
              py={2}
              color="text.secondary"
            >
              <Grid>
                <Flex mb={1} isTruncated alignItems="center">
                  <Text fontSize="14px" isTruncated>
                    {item.name}
                  </Text>
                  {devSpace?._id === item._id && (
                    <CheckIcon ml="auto" fontSize="14px" flexShrink={0} />
                  )}
                </Flex>
                <Flex fontSize="12px" opacity="0.6" gap={4}>
                  {
                    !!item.data.codebases.length && (
                      <Tooltip placement="top" label={
                        <Box>
                          <Box>【代码地图】</Box>
                          {
                            item.data.codebases.map((item) => <Box>{item.codebase_name}</Box>)
                          }
                        </Box>
                      }>
                        <Box>
                          <Icon
                            as={LuSearchCode}
                            w="12px"
                            h="12px"
                            color="text.default"
                            mr={1}
                          />
                          {item.data.codebases.length}
                        </Box>
                      </Tooltip>
                    )
                  }
                  {
                    !!item.data.knowledge_bases.length && (
                      <Tooltip placement="top" label={
                        <Box>
                          <Box>【知识库】</Box>
                          {
                            item.data.knowledge_bases.map((item) => <Box>{item.knowledge_base_name}</Box>)
                          }
                        </Box>
                      }>
                        <Box>
                          <Icon
                            as={FiBookOpen}
                            w="12px"
                            h="12px"
                            color="text.default"
                            mr={1}
                          />
                          {item.data.knowledge_bases.length}
                        </Box>
                      </Tooltip>
                    )
                  }
                  {
                    !!item.data.code_styles.length && (
                      <Tooltip placement="top" label={<Box>
                        <Box>【Rules】</Box>
                        <Box>team rules</Box>
                      </Box>}>
                        <Box>
                          <Icon
                            as={LuRuler}
                            w="12px"
                            h="12px"
                            color="text.default"
                          />
                        </Box>
                      </Tooltip>
                    )
                  }
                </Flex>
              </Grid>
            </Box>
          </PanelItem>
        })}
      </VStack>
      <Flex
        width={'full'}
        position="absolute"
        bottom={0}
        left={0}
        right={0}
        h="36px"
        align="center"
        justify="flex-end"
        alignItems={'center'}
        px={4}
        bg="themeBgColor"
        // bg={activeTheme === ThemeStyle.Dark ? 'blackAlpha.600' : 'whiteAlpha.800'}
        // backdropFilter="blur(5px)"
        borderTop="1px solid"
        borderColor="whiteAlpha.100"
        zIndex={2}
      >
        <Text
          as={Flex}
          pl={2}
          color="text.secondary"
          fontSize="xs"
          // opacity={.4}
          marginRight={'auto'}
          hidden={!devspaceOptions.length}
          alignItems="center"
          gap={1}
        >
          点击选中/取消选中
        </Text>
      </Flex>
    </Box>
  </Flex>
}
