import { MouseEvent, useState, useMemo } from 'react';
import {
  Text, Box, Flex,
  IconButton, Icon,
  Tooltip,
  Input,
  InputGroup,
  InputRightElement,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Button,
  useDisclosure,
} from '@chakra-ui/react';
import SelectWithTooltip from '../../components/SelectWithTooltip';
import { usePostMessage } from '../../PostMessageProvider';
import { AiOutlineQuestionCircle } from 'react-icons/ai';
import { BiBookBookmark } from 'react-icons/bi';
import { FaPlus, FaChevronDown, FaCheck } from 'react-icons/fa6';
import { useWorkspaceStore } from '../../store/workspace';
import { MdOutlineClear } from 'react-icons/md';
import { useChatConfig } from '../../store/chat-config';


const toggleOptions = [
  {
    value: 'off',
    label: '关闭',
  },
  {
    value: 'on',
    label: '启用',
  }
]

const getDevspaceTooltip = (item: any) => {
  if (!item) return '';
  const parts: string[] = [];

  if (item.data?.codebases?.length > 0) {
    parts.push('【关联代码表】');
    item.data.codebases.forEach((codebase: any) => {
      parts.push(`  ${codebase.codebase_name}`);
    });
  }

  if (item.data?.knowledge_bases?.length > 0) {
    parts.push('【关联知识库】');
    item.data.knowledge_bases.forEach((kb: any) => {
      parts.push(`  ${kb.knowledge_base_name}`);
    });
  }

  if (item.data?.rules?.length > 0) {
    parts.push('【Rules】');
    item.data.rules.forEach((rule: any) => {
      parts.push(`  ${rule.name}`);
    });
  }
  return parts.join('\n');
};

const DevspaceCollapse = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { postMessage } = usePostMessage();

  const devSpace = useWorkspaceStore((state) => state.devSpace);
  const devspaceOptions = useWorkspaceStore((state) => state.devSpaceOptions);
  const setDevSpace = useWorkspaceStore((state) => state.setDevSpace);

  const enableDevspaceConfig = useChatConfig((state) => state.enableDevspaceConfig);
  const setEnableDevspaceConfig = useChatConfig((state) => state.setEnableDevspaceConfig);

  // 过滤研发空间选项
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return devspaceOptions;
    return devspaceOptions.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.project.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [devspaceOptions, searchTerm]);

  const currentDevspaceTooltip = useMemo(() => {
    const item = devspaceOptions.find((item) => item._id === devSpace._id);
    return getDevspaceTooltip(item);
  }, [devSpace?._id, devspaceOptions]);

  // 处理启用/关闭研发空间
  const handleToggleDevSpace = (value: string) => {
    if (value === 'off') {
      // 禁用研发空间
      setEnableDevspaceConfig(false);
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
        rules: [],
      });
    } else {
      // 启用研发空间，但不选择具体项目，等待用户从下拉框选择
      setEnableDevspaceConfig(true);
    }
  };

  // 处理下拉选择研发空间
  const handleSelectDevspace = (id: string) => {
    const selectedSpace = devspaceOptions.find(item => item._id === id);
    if (selectedSpace) {
      setDevSpace({
        _id: selectedSpace._id,
        name: selectedSpace.name,
        project: selectedSpace.project,
        knowledge_bases: selectedSpace.data?.knowledge_bases || [],
        codebases: selectedSpace.data?.codebases || [],
        code_style: selectedSpace.data?.code_styles?.[0]?.style || '',
        ignore_paths: selectedSpace.data?.ai_repo_chats?.[0]?.ignore_paths || [],
        allow_paths: selectedSpace.data?.ai_repo_chats?.[0]?.allow_paths || [],
        repos: selectedSpace.data?.repos || [],
        rules: selectedSpace.data?.rules || [],
      });
    }
  };

  return (
    <Box mb={2}>
      <Flex display={'flex'} justifyContent={'space-between'} alignItems={'center'} fontSize={'small'}>
        <Flex
          display={'flex'}
          alignItems={'center'}
          userSelect={'none'}
          cursor={'pointer'}
        >
          <BiBookBookmark size={16} />
          <Text marginLeft={2} fontSize={12}>研发知识集</Text>
          <Tooltip label="整合项目代码地图、知识库与Rules，让仓库智聊具备对项目的深度理解能力" placement="top">
            <Box display="inline-flex" alignItems="center" ml={1} mr={2} cursor="help">
              <Icon as={AiOutlineQuestionCircle} w="14px" h="14px" color="gray.500" />
            </Box>
          </Tooltip>
          <Tooltip label="添加研发空间">
            <IconButton
              size={'sm'}
              height={'20px'}
              aria-label="添加研发空间"
              icon={<Icon as={FaPlus} fontSize={'14px'} />}
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                postMessage({
                  type: "OPEN_IN_BROWSER",
                  data: { url: `https://github.com/user/codemaker` },
                });
              }}
              bg="none"
              color="text.default"
            />
          </Tooltip>
        </Flex>
        <Flex alignItems={'center'} gap={1}>
          <SelectWithTooltip
            size="xs"
            width="90px"
            options={toggleOptions}
            value={enableDevspaceConfig ? 'on' : 'off'}
            onChange={(e) => {
              handleToggleDevSpace(e.target.value);
            }}
          />
        </Flex>
      </Flex>
      {enableDevspaceConfig && (
        <Box mt={2}>
          <Menu isOpen={isOpen} onClose={onClose} onOpen={onOpen} isLazy>
            <Tooltip
              label={
                <Box whiteSpace="pre-line" fontSize="12px">
                  {currentDevspaceTooltip}
                </Box>
              }
              placement="top"
              hasArrow
              isDisabled={!devSpace._id || isOpen}
              color="gray.800"
              px={3}
              py={2}
              borderRadius="md"
            >
              <MenuButton
                as={Button}
                size="xs"
                width="100%"
                rightIcon={<Icon as={FaChevronDown} />}
                fontSize="12px"
                fontWeight="normal"
                textAlign="left"
                border="1px solid"
                borderColor="#3A3A3A"
                py={'14px'}
                bg={'theme.default'}
                justifyContent="space-between"
              >
                <Text isTruncated>
                  {devSpace._id ? devSpace.name : '选择研发空间'}
                </Text>
              </MenuButton>
            </Tooltip>
            <MenuList zIndex={1000} maxH="300px" overflowY="auto" p={0} width={'300px'}>
              <Box py={2}>
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((item) => {
                    const tooltipContent = getDevspaceTooltip(item);
                    return (
                      <Tooltip
                        key={item._id}
                        label={<Box whiteSpace="pre-line" fontSize="12px">{tooltipContent}</Box>}
                        placement="top"
                        hasArrow
                        openDelay={500}
                        color="gray.800"
                        isDisabled={!tooltipContent}
                      >
                        <MenuItem
                          onClick={() => {
                            handleSelectDevspace(item._id);
                            onClose();
                            setSearchTerm('');
                          }}
                          fontSize="12px"
                          py={2}
                          px={3}
                          display="flex"
                          alignItems="center"
                          justifyContent="space-between"
                        >
                          <Box flex={1} overflow="hidden">
                            <Text fontWeight="medium" isTruncated>{item.name}</Text>
                          </Box>
                          {devSpace._id === item._id && (
                            <Icon as={FaCheck} color="blue.500" ml={2} />
                          )}
                        </MenuItem>
                      </Tooltip>
                    );
                  })
                ) : (
                  <Box px={3} py={2} fontSize="12px" color="gray.500" textAlign="center">
                    未找到匹配的研发空间
                  </Box>
                )}
              </Box>
              <Box px={2} py={2} position="sticky" bottom={0} bg="inherit" zIndex={1}>
                <InputGroup size="xs">
                  <Input
                    py={3}
                    placeholder="搜索研发空间..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                  {searchTerm && (
                    <InputRightElement>
                      <Icon
                        as={MdOutlineClear}
                        cursor="pointer"
                        color="gray.500"
                        onClick={() => setSearchTerm('')}
                      />
                    </InputRightElement>
                  )}
                </InputGroup>
              </Box>
            </MenuList>
          </Menu>
        </Box>
      )}
    </Box>
  );
};

export default DevspaceCollapse;
