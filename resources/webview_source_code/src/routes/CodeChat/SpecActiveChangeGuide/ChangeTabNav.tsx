import * as React from 'react';
import {
  Flex,
  Text,
  useColorModeValue,
  Center,
  IconButton,
  Tooltip,
  Box
} from '@chakra-ui/react';
// import { VscChromeClose } from 'react-icons/vsc';
import type { ChangeInfo } from '../../../store/workspace';
// import { TfiMenuAlt } from 'react-icons/tfi';
// import Icon from '../../../components/Icon';
import { useTheme, ThemeStyle } from '../../../ThemeContext';
import { IoIosInformationCircleOutline } from 'react-icons/io';
import { useChatStore } from '../../../store/chat';
interface TabItem {
  key: string;
  label: string;
  index: number;
  filePath?: string;
}

interface ChangeTabNavProps {
  changeInfo: ChangeInfo;
  onOpenFile: (filePath: string) => void;
  onCollapse: () => void;
}

/**
 * Change Tab 导航组件
 * 显示 [1] Proposal [2] Spec [3] Design [4] Tasks 四个 Tab
 * Tab 等宽铺开，无底色、无分割线
 */
function ChangeTabNav({
  changeInfo,
  onOpenFile,
  // onCollapse,
}: ChangeTabNavProps) {
  const activeColor = useColorModeValue('blue.300', 'blue.300');
  const disabledColor = useColorModeValue('gray.400', 'gray.500');
  const indexBorderColor = useColorModeValue('gray.300', 'gray.500');
  const { activeTheme } = useTheme();
  const isLight = activeTheme === ThemeStyle.Light;
  const codebaseChatMode = useChatStore((state) => state.codebaseChatMode);
  const activeChangeId = useChatStore((state) => state.activeChangeId);
  const activeFeatureId = useChatStore((state) => state.activeFeatureId);
  

  // 构建 Tab 列表
  const tabs: TabItem[] = React.useMemo(() => {
    return [
      {
        key: 'proposal',
        label: 'Proposal',
        index: 1,
        filePath: changeInfo.proposalFile?.path,
      },
      {
        key: 'spec',
        label: 'Spec',
        index: 2,
        filePath: changeInfo.specFiles?.[0]?.path,
      },
      {
        key: 'design',
        label: 'Design',
        index: 3,
        filePath: changeInfo.designFile?.path,
      },
      {
        key: 'tasks',
        label: 'Tasks',
        index: 4,
        filePath: changeInfo.tasksFile?.path,
      },
    ];
  }, [changeInfo]);

  const handleTabClick = React.useCallback(
    (tab: TabItem) => {
      if (tab.filePath) {
        onOpenFile(tab.filePath);
      }
    },
    [onOpenFile],
  );

  return (
    <Flex
      p="1"
      align="center"
      bg={isLight ? 'gray.50' : 'rgba(255, 255, 255, 0.05)'}
    >
      {/* Tab 导航 - 等分宽度 */}
      <Flex flex={1}>
        {tabs.map((tab) => {
          const isDisabled = !tab.filePath;
          const tabColor = isDisabled ? disabledColor : activeColor;
          return (
            <Flex
              key={tab.key}
              flex={1}
              align="center"
              justify="center"
              gap={1.5}
              // py={1}
              cursor={isDisabled ? 'not-allowed' : 'pointer'}
              opacity={isDisabled ? 0.5 : 1}
              _hover={isDisabled ? undefined : { opacity: 0.8 }}
              onClick={() => !isDisabled && handleTabClick(tab)}
              transition="opacity 0.15s"
            >
              {/* 序号 - 正方形边框 */}
              <Center
                w="12px"
                h="12px"
                border="1px solid"
                borderColor={isDisabled ? indexBorderColor : tabColor}
                borderRadius="3px"
                flexShrink={0}
              >
                <Text
                  fontSize="xs"
                  // fontWeight="bold"
                  color={tabColor}
                  lineHeight={1}
                >
                  {tab.index}
                </Text>
              </Center>
              {/* Tab 名称 */}
              <Text
                fontSize="sm"
                // fontWeight="bold"
                color={tabColor}
                whiteSpace="nowrap"
              >
                {tab.label}
              </Text>
            </Flex>
          );
        })}
      </Flex>
      {/* 折叠按钮 */}
      <Tooltip
        label={
          <Box>
            <Box>Feature: {activeFeatureId || activeChangeId}</Box>
            <Box>SpecType: {codebaseChatMode}</Box>
          </Box>
        }
        placement="bottom"
      >
        <IconButton
          aria-label="查看详细"
          icon={<IoIosInformationCircleOutline size={14} />}
          size="xs"
          variant="ghost"
          color={disabledColor}
          _hover={{ color: activeColor }}
          // onClick={onCollapse}
          ml={1}
        />
      </Tooltip>
    </Flex>
  );
}

export default ChangeTabNav;