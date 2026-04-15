import {
  Box,
  Text,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  VStack,
  useOutsideClick,
  Portal,
  Divider,
  Icon,
  Tooltip,
} from '@chakra-ui/react';
import React from 'react';
import { useWorkspaceStore } from '../../store/workspace';
import { usePostMessage } from '../../PostMessageProvider';
import { GrBook } from 'react-icons/gr';
import {
  AiOutlinePlus,
  AiOutlineSetting,
  AiOutlineQuestionCircle,
} from 'react-icons/ai';
import MiniButton from '../../components/MiniButton';
function DevSpaceSelect() {
  const [isEdit, setIsEdit] = React.useState<boolean>(false);
  const [isTooltipOpen, setIsTooltipOpen] = React.useState<boolean>(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const timeoutRef = React.useRef<NodeJS.Timeout>();
  const { postMessage } = usePostMessage();
  const [
    devSpace,
    devSpaceOptions,
    workspaceInfo,
    setDevSpace,
    syncDevSpaceOptions,
  ] = useWorkspaceStore((state) => [
    state.devSpace,
    state.devSpaceOptions,
    state.workspaceInfo,
    state.setDevSpace,
    state.syncDevSpaceOptions,
  ]);

  useOutsideClick({
    ref: popoverRef,
    handler: () => setIsEdit(false),
  });

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsTooltipOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsTooltipOpen(false);
    }, 300);
  };

  const onDevSpaceChange = (devSpaceId: string) => {
    // 缓存关联代码地图
    const devSpaceCacheStr =
      window.localStorage.getItem('devSpaceCache') || '{}';
    const devSpaceCache = JSON.parse(devSpaceCacheStr);
    if (devSpaceId) {
      const matchDevSpace = devSpaceOptions.find(
        (item) => item._id === devSpaceId,
      );
      if (matchDevSpace) {
        setDevSpace({
          _id: matchDevSpace._id,
          name: matchDevSpace.name,
          project: matchDevSpace.project,
          knowledge_bases: matchDevSpace.data.knowledge_bases,
          codebases: matchDevSpace.data.codebases,
          code_style: matchDevSpace.data.code_styles[0]?.style,
          ignore_paths: matchDevSpace.data.ai_repo_chats[0].ignore_paths,
          allow_paths: matchDevSpace.data.ai_repo_chats[0].allow_paths,
          repos: matchDevSpace.data.repos,
          allow_public_model_access:
            matchDevSpace.data.allow_public_model_access || false,
          rules: matchDevSpace.data.rules || [],
        });
        devSpaceCache[workspaceInfo.repoName] = matchDevSpace._id;
      }
    } else {
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
        rules: [],
      });
      devSpaceCache[workspaceInfo.repoName] = '';
    }
    window.localStorage.setItem('devSpaceCache', JSON.stringify(devSpaceCache));
    setIsEdit(false);
    setIsTooltipOpen(false);
  };

  const displayCurrent = React.useMemo(() => {
    return (
      <Popover
        placement={!devSpace.name ? 'top' : 'top-start'}
        isOpen={isTooltipOpen && !isEdit}
        onClose={() => setIsTooltipOpen(false)}
        onOpen={() => {
          syncDevSpaceOptions();
        }}
      >
        <PopoverTrigger>
          <Box
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            _hover={{
              cursor: 'pointer',
            }}
          >
            <Tooltip
              label={!devSpace.name && !isEdit ? '知识集与Rules' : undefined}
            >
              <Text
                // color={activeTheme === ThemeStyle.Light ? '#000000cc' : '#ccccccef'}
                // fontSize={12}
                style={{ marginBottom: 0, transform: 'translateY(-1px)' }}
                _hover={{
                  bg: 'none',
                  color: '#746cec',
                }}
                className="cursor-pointer"
              >
                {/* {
                devSpace.name
                  ? `研发知识集: ${devSpace.name}`
                  : '研发知识集'
              } */}
                <Icon
                  as={GrBook}
                  w="16px"
                  h="16px"
                  color={devSpace._id ? 'blue.300' : 'text.default'}
                />
              </Text>
            </Tooltip>
          </Box>
        </PopoverTrigger>
        <Portal>
          <PopoverContent
            maxW={!devSpace.name ? '120px' : '220px'}
            bg={devSpace.name ? undefined : 'transparent'}
            border={devSpace.name ? undefined : 'none'}
            boxShadow={devSpace.name ? undefined : 'none'}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <PopoverBody
              color="text.default"
              fontSize="12px"
              bg={devSpace.name ? undefined : 'transparent'}
              p={devSpace.name ? undefined : 0}
            >
              {!isEdit && !!devSpace.name && (
                <Box>
                  <Box mb={1}>【关联代码地图】</Box>
                  {devSpace.codebases.length ? (
                    devSpace.codebases.map((item) => (
                      <Box>{item.codebase_name}</Box>
                    ))
                  ) : (
                    <Box>(无)</Box>
                  )}
                  <Box my={1}>【关联知识库】</Box>
                  {devSpace.knowledge_bases.length ? (
                    devSpace.knowledge_bases.map((item) => (
                      <Box>{item.knowledge_base_name}</Box>
                    ))
                  ) : (
                    <Box>(无)</Box>
                  )}
                </Box>
              )}
              {/* {!isEdit && !devSpace.name && (
                <Box display={'flex'} justifyContent={'center'} alignItems={'center'}>
                    <Button
                      size="sm"
                      style={{
                        backgroundColor: '#f9fafb',
                        color: '#1e3a8a',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 16px',
                        fontSize: '12px',
                        fontWeight: '500',
                        boxShadow: 'none'
                      }}
                      _hover={{
                        backgroundColor: '#f3f4f6',
                      }}
                      _active={{
                        backgroundColor: '#e5e7eb',
                      }}
                    >
                      知识集与Rules
                    </Button>
                </Box>
               )
              } */}
            </PopoverBody>
          </PopoverContent>
        </Portal>
      </Popover>
    );
  }, [devSpace, isEdit, isTooltipOpen, syncDevSpaceOptions]);

  return (
    <div id="chat-model-selector" ref={popoverRef}>
      <Popover isLazy placement="top" isOpen={isEdit}>
        <PopoverTrigger>
          <MiniButton
            // size="sm"
            // color="text.secondary"
            // bg={isLight ? '#F2F2F2' : '#2C2C2C'}
            // w="28px"
            // h="28px"
            // minW="28px"
            // minH="28px"
            // p="0"
            // _hover={{
            //   bg: isLight ? '#F2F2F2' : '#2C2C2C',
            //   color: '#746cec',
            // }}
            // fontSize="12px"
            // fontWeight="normal"
            onClick={() => setIsEdit((prev) => !prev)}
          >
            {displayCurrent}
          </MiniButton>
        </PopoverTrigger>
        <PopoverContent w={'240px'} maxH="400px">
          <PopoverBody p={0}>
            <Box
              maxH="300px"
              overflowY="auto"
              css={{
                '&::-webkit-scrollbar': {
                  width: '6px',
                },
                '&::-webkit-scrollbar-track': {
                  background: 'transparent',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: '#cbd5e0',
                  borderRadius: '3px',
                },
                '&::-webkit-scrollbar-thumb:hover': {
                  background: '#a0aec0',
                },
              }}
            >
              <VStack align="stretch" spacing={0}>
                {devSpaceOptions.map((option) => (
                  <Box
                    px={3}
                    py={2}
                    alignItems="center"
                    cursor="pointer"
                    _hover={{ bg: '#746cec' }}
                    bg={devSpace._id === option._id ? '#746cec' : 'transparent'}
                    key={option._id}
                    onClick={() => {
                      if (devSpace._id !== option._id) {
                        onDevSpaceChange(option._id);
                      } else {
                        onDevSpaceChange('');
                      }
                    }}
                    borderRadius="4px"
                    mx={2}
                    my={1}
                  >
                    <Text isTruncated fontSize="13px">
                      {option.name}
                    </Text>
                  </Box>
                ))}
              </VStack>
            </Box>
            <Divider my={2} />
            <Box px={3} pb={2}>
              <Box
                // px={2}
                // py={2}
                alignItems="center"
                cursor="pointer"
                color="#746cec"
                // _hover={{ bg: 'rgba(116, 108, 236, 0.1)' }}
                onClick={() => {
                  postMessage({
                    type: 'OPEN_IN_BROWSER',
                    data: {
                      url: `http://localhost:3001`,
                    },
                  });
                }}
                borderRadius="4px"
              >
                <Box display="flex" alignItems="center">
                  <Box display="flex" alignItems="center">
                    <Icon
                      as={AiOutlinePlus}
                      color="#746cec"
                      mr={2}
                      boxSize={5}
                    />
                    <Text fontSize="14px" color="#746cec">
                      新建知识集
                    </Text>
                  </Box>
                  {/* <Tooltip label="创建新的研发知识集"> */}
                  <Icon
                    as={AiOutlineQuestionCircle}
                    onClick={(e) => {
                      e.stopPropagation();
                      postMessage({
                        type: 'OPEN_IN_BROWSER',
                        data: { url: `https://github.com/user/codemaker` },
                      });
                    }}
                    ml={2}
                    color="gray.400"
                    boxSize={5}
                  />
                  {/* </Tooltip> */}
                </Box>
              </Box>
            </Box>
            <Divider my={2} />
            <Box px={3} pb={2}>
              <Box
                // px={2}
                // py={2}
                alignItems="center"
                cursor="pointer"
                color="#746cec"
                // _hover={{ bg: 'rgba(116, 108, 236, 0.1)' }}
                onClick={() => {
                  postMessage({
                    type: 'OPEN_OR_CREATE_SDETTING',
                  });
                  //重起一个名字
                  postMessage({
                    type: 'EDIT_CODEBASE_RULES',
                  });
                }}
                borderRadius="4px"
              >
                <Box display="flex" alignItems="center">
                  <Box display="flex" alignItems="center">
                    <Icon
                      as={AiOutlineSetting}
                      color="#746cec"
                      mr={2}
                      boxSize={5}
                    />
                    <Text fontSize="14px" color="#746cec">
                      配置本地Rules
                    </Text>
                  </Box>
                  {/* <Tooltip label="配置本地代码规则"> */}
                  <Icon
                    as={AiOutlineQuestionCircle}
                    onClick={(e) => {
                      e.stopPropagation();
                      postMessage({
                        type: 'OPEN_IN_BROWSER',
                        data: { url: `https://github.com/user/codemaker` },
                      });
                    }}
                    ml={2}
                    color="gray.400"
                    boxSize={5}
                  />
                  {/* </Tooltip> */}
                </Box>
              </Box>
            </Box>
          </PopoverBody>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default DevSpaceSelect;
