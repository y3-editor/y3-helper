import React, { useEffect, useMemo, useState } from 'react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  Text,
  Flex,
  Tooltip,
  Box,
  useOutsideClick,
  Portal,
  IconButton,
} from '@chakra-ui/react';
import { useWorkspaceStore } from '../../store/workspace';
// import { useTheme } from '../../ThemeContext';
import { GrBook } from 'react-icons/gr';
import DevSpaceGrid from './DevSpaceGrid';
import CodebaseGrid from './CodebaseGrid';
import RulesGrid from './RulesGrid';
import KnowledgeBaseGrid from './KnowledgeBaseGrid';
import { BsLayers, BsShieldCheck } from "react-icons/bs";
import EventBus from '../../utils/eventbus';
import MiniButton from '../../components/MiniButton';
import Icon from '../../components/Icon';

type TabType = 'devspace' | 'codebase' | 'knowledge' | 'rules';

interface TabConfig {
  key: TabType;
  icon: any;
  title: string;
  description?: string;
}

const tabConfigs: TabConfig[] = [
  {
    key: 'devspace',
    icon: BsLayers,
    title: '研发空间',
    description: '研发空间整合团队多维度知识（代码地图、知识库、Team Rules），为仓库智聊构建完整的项目认知体系，更能理解项目背景、遵循团队规范、洞察业务逻辑'
  },
  // {
  //   key: 'codebase',
  //   icon: BsDiagram3,
  //   title: '代码地图'
  // },
  // {
  //   key: 'knowledge',
  //   icon: BsFileText,
  //   title: '知识库'
  // },
  {
    key: 'rules',
    icon: BsShieldCheck,
    title: 'Rules',
    description: 'Rules为仓库智聊提供系统级、持久化的指令，确保仓库智聊在生成代码、解答问题或辅助开发时，始终遵循统一的标准和背景信息'
  },
];

const DevSpacePanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('devspace');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  // const { activeTheme } = useTheme();
  // const isLight = activeTheme === 'light';
  const devSpace = useWorkspaceStore((state) => state.devSpace);
  const rules = useWorkspaceStore((state) => state.rules);
  const teamRules = useWorkspaceStore((state) => state.teamRules);
  const [isTooltipOpen, setIsTooltipOpen] = React.useState<boolean>(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const timeoutRef = React.useRef<NodeJS.Timeout>();

  // 获取选中项数量
  const selectedCodebases = useWorkspaceStore((state) => state.selectedCodebases);
  const selectedKnowledgeBases = useWorkspaceStore((state) => state.selectedKnowledgeBases);
  const selectedRules = useWorkspaceStore((state) => state.selectedRules);

  const selectedRulesName = useMemo(() => {
    return [
      ...teamRules.map((rule) => rule.name),
      ...rules.filter((rule) => selectedRules.includes(rule.filePath)).map((rule) => rule.name)
    ]
  }, [rules, selectedRules, teamRules])

  useOutsideClick({
    ref: popoverRef,
    handler: (event) => {
      // 检查点击的元素是否在 Modal 内部
      const target = event.target as Element;
      const isClickInModal = target.closest('[data-modal-content]') !== null;

      if (!isClickInModal) {
        setIsOpen(false);
      }
    },
  });

  useEffect(() => {
    EventBus.instance.on('toggleDevSpacePanel', setIsOpen)
    return () => {
      EventBus.instance.off('toggleDevSpacePanel', setIsOpen)
    }
  }, [])

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

  // TODO: 结构待优化
  const displayCurrent = React.useMemo(() => {
    return <Popover
      placement={!devSpace.name ? "top" : "top-start"}
      isOpen={isTooltipOpen && !isOpen}
      onClose={() => setIsTooltipOpen(false)}
    >
      <PopoverTrigger>
        <Box
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          _hover={{
            cursor: 'pointer',
          }}
        >
          <Tooltip label={!devSpace.name && !isOpen ? '研发空间知识' : undefined}>
            <Text
              style={{ marginBottom: 0, transform: 'translateY(-1px)' }}
              _hover={{
                bg: 'none',
                color: '#746cec',
              }}
              className='cursor-pointer'
            >
              <Icon
                as={GrBook}
                size="xxs"
                color={devSpace._id ? "blue.300" : "text.default"}
              />
            </Text>
          </Tooltip>
        </Box>
      </PopoverTrigger>
      <Portal>
        <PopoverContent
          maxW={!devSpace.name ? "120px" : "220px"}
          bg={devSpace.name ? undefined : "transparent"}
          border={devSpace.name ? undefined : "none"}
          boxShadow={devSpace.name ? undefined : "none"}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={(e) => { e.stopPropagation() }}

        >
          <PopoverBody color="text.default" fontSize="12px" bg={devSpace.name ? undefined : "transparent"} p={devSpace.name ? undefined : 0}>
            {
              !isOpen && !!devSpace.name && (
                <Box>
                  <Box mb={1}>【代码地图】</Box>
                  {
                    devSpace.codebases.length
                      ? devSpace.codebases.map((item, index) => {
                        return <Box key={index + item.codebase_name} className="truncate">{index + 1}. {item.codebase_name}</Box>
                      })
                      : <Box>(无)</Box>
                  }
                  <Box my={1}>【知识库】</Box>
                  {
                    devSpace.knowledge_bases.length
                      ? devSpace.knowledge_bases.map((item, index) => {
                        return <Box key={index + item.knowledge_base_name} className="truncate">{index + 1}. {item.knowledge_base_name}</Box>
                      })
                      : <Box>(无)</Box>
                  }
                  <Box my={1}>【Rules】</Box>
                  {
                    selectedRulesName.length
                      ? selectedRulesName.map((rule, index) => {
                        return <Box key={index + rule} className="truncate">{index + 1}. {rule}</Box>
                      })
                      : <Box>(无)</Box>
                  }
                </Box>
              )
            }
          </PopoverBody>
        </PopoverContent>
      </Portal>
    </Popover>
  }, [devSpace._id, devSpace.codebases, devSpace.knowledge_bases, devSpace.name, isOpen, isTooltipOpen, selectedRulesName]);

  return (
    <div ref={popoverRef}>
      <Popover isLazy placement="top-start" isOpen={isOpen}>
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
            onClick={() => setIsOpen(prev => !prev)}
          >
            {displayCurrent}
          </MiniButton>
        </PopoverTrigger>
        <PopoverContent w='480px' maxH="260" maxW="100vw" overflow="hidden" bg="themeBgColor" borderColor="customBorder">
          <PopoverBody display="flex" gap={0} p={0} h="400px">
            <Flex
              flexDirection="column"
              alignItems="center"
              py={4}
              gap={4}
              // bg={isLight ? '' : '#2d2d2d'}
              backgroundColor="themeBgColor"
              flexShrink={0}
              px={2}
            >
              <Flex flexDirection="column" gap={2}>
                {
                  tabConfigs.map((tag) => {
                    // 计算选中项数量
                    let selectedCount = 0;
                    if (tag.key === 'codebase') {
                      selectedCount = selectedCodebases.length;
                    } else if (tag.key === 'knowledge') {
                      selectedCount = selectedKnowledgeBases.length;
                    } else if (tag.key === 'rules') {
                      selectedCount = selectedRules.length + teamRules.length;
                    }
                    return (
                      <Tooltip key={tag.key} label={tag.description}>
                        <Box position="relative">
                          <IconButton
                            fontSize="xl"
                            aria-label="codemaker"
                            colorScheme={
                              tag.key === activeTab
                                ? 'blue'
                                : undefined
                            }
                            bg={
                              tag.key === activeTab
                                ? 'blue.300'
                                : 'buttonBgColor'
                            }
                            border="1px solid"
                            borderColor="customBorder"
                            color={
                              tag.key === activeTab
                                ? 'white'
                                : 'text.primary'
                            }
                            icon={<Icon as={tag.icon} size="md" />}
                            onClick={() => {
                              setActiveTab(tag.key);
                            }}
                          />
                          {/* 气泡显示选中数量 */}
                          {selectedCount > 0 && (
                            <Box
                              position="absolute"
                              top="-6px"
                              right="-6px"
                              bg={tag.key === activeTab ? "white" : "#746cec"}
                              color={tag.key === activeTab ? "#2C2C2C" : "white"}
                              borderRadius="50%"
                              minW="18px"
                              minH="18px"
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                              fontSize="10px"
                              fontWeight="bold"
                              zIndex="1"
                            >
                              {selectedCount}
                            </Box>
                          )}
                        </Box>
                      </Tooltip>
                    );
                  })
                }
              </Flex>
            </Flex>

            <Box flex={1} overflow="hidden" display="flex" flexDirection="column">
              {
                activeTab === 'devspace' && (
                  <DevSpaceGrid />
                )
              }
              {
                activeTab === 'codebase' && (
                  <CodebaseGrid />
                )
              }
              {
                activeTab === 'knowledge' && (
                  <KnowledgeBaseGrid />
                )
              }
              {
                activeTab === 'rules' && (
                  <RulesGrid />
                )
              }
            </Box>
          </PopoverBody>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default DevSpacePanel;
