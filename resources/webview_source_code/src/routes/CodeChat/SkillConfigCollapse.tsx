import { useState } from 'react';
import {
  Text,
  Box,
  Flex,
  IconButton,
  Icon,
  Tooltip,
  Collapse,
} from '@chakra-ui/react';
import SelectWithTooltip, {
  SelectOption,
} from '../../components/SelectWithTooltip';
import { useSkillsStore } from '../../store/skills';
import { FaAngleDown, FaAngleRight, FaAngleUp, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { IoSettingsOutline } from 'react-icons/io5';
import { TbWand } from 'react-icons/tb';
import { AiOutlineQuestionCircle } from 'react-icons/ai';
import { getLocalStorage, setLocalStorage } from '../../utils/storage';
import userReporter from '../../utils/report';
import { UserEvent } from '../../types/report';
import { BroadcastActions, usePostMessage } from '../../PostMessageProvider';

const collapseKey = 'codechat-skill-collapse-config';
const loadMoreKey = 'codechat-skill-load-more-config';

interface IProps {
  setSkillSettingOpen: (open: boolean) => void;
}

const SkillConfigCollapse = (props: IProps) => {
  const { setSkillSettingOpen } = props;
  const [isCollapsed, setIsCollapsed] = useState(
    !!getLocalStorage(collapseKey)
  );
  const [showAllSkills, setShowAllSkills] = useState(
    !!getLocalStorage(loadMoreKey)
  );

  const skills = useSkillsStore((state) => state.skills);
  const skillConfigs = useSkillsStore((state) => state.skillConfigs);
  const setSkillConfig = useSkillsStore((state) => state.setSkillConfig);
  const { postMessage } = usePostMessage();

  return (
    <>
      <Flex
        display={'flex'}
        justifyContent={'space-between'}
        alignItems={'center'}
        fontSize={'small'}
      >
        <Flex
          display={'flex'}
          alignItems={'center'}
          userSelect={'none'}
          cursor={'pointer'}
          onClick={() => {
            setLocalStorage(collapseKey, !isCollapsed);
            setIsCollapsed(!isCollapsed);
          }}
        >
          <TbWand size={16} />
          <Text marginLeft={2} fontSize={12}>
            Skills 工具
          </Text>
          <Tooltip
            label="加载本地 Skills 文件，根据需求自动匹配并激活对应的专业指导，支持 ~/.y3maker/skills、.y3maker/skills、~/.claude/skills、.claude/skills、~/.codemaker/skills、.codemaker/skills、~/.agents/skills、.agents/skills 目录"
            placement="top"
          >
            <Box
              display="inline-flex"
              alignItems="center"
              ml={1}
              mr={2}
              cursor="help"
            >
              <Icon
                as={AiOutlineQuestionCircle}
                w="14px"
                h="14px"
                color="gray.500"
              />
            </Box>
          </Tooltip>
          <Icon as={isCollapsed ? FaAngleRight : FaAngleDown} size="xs" />
        </Flex>
        <Box>
          <Tooltip label="配置 Skills">
            <IconButton
              size={'sm'}
              height={'20px'}
              aria-label="配置 Skills"
              className="ml-auto"
              icon={<Icon as={IoSettingsOutline} fontSize={'16px'} />}
              onClick={() => {
                setSkillSettingOpen(true);
                userReporter.report({
                  event: UserEvent.CODE_CHAT_SKILL_MANAGE_PANEL,
                });
              }}
              bg="none"
              color="text.default"
            />
          </Tooltip>
        </Box>
      </Flex>
      <Collapse in={!isCollapsed} animate={false}>
        {skills.length ? (
          (showAllSkills ? skills : skills.slice(0, 3)).map((skill, index) => {
            const config = skillConfigs[skill.name];
            const isDisabled = config?.disabled ?? false;

            return (
              <Box key={skill.name + index} marginLeft={4} position={'relative'}>
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
                  <Flex
                    justifyContent={'space-between'}
                    alignItems={'center'}
                    width={'full'}
                  >
                  <Flex
                    mr="1"
                    width={'75%'}
                    wrap={'wrap'}
                    wordBreak={'break-all'}
                    alignItems={'center'}
                  >
                    <Flex alignItems={'center'} gap={1}>
                      <Tooltip
                        label={isDisabled ? '已关闭' : '已启用'}
                        placement="top"
                      >
                        <Box display="flex" alignItems="center">
                          <Icon
                            as={isDisabled ? FaTimesCircle : FaCheckCircle}
                            color={isDisabled ? 'inherit' : 'green.500'}
                            w="12px"
                            h="12px"
                          />
                        </Box>
                      </Tooltip>
                      <Text
                        color={isDisabled ? 'inherit' : 'green.500'}
                        lineHeight="1"
                        fontSize={'xs'}
                        title={skill.description}
                      >
                        {skill.display_name || skill.name}
                      </Text>
                    </Flex>
                  </Flex>
                    <Flex
                      textAlign={'right'}
                      position={'relative'}
                      justifyContent={'flex-end'}
                    >
                      <SelectWithTooltip
                        size="xs"
                        width="90px"
                        options={
                          [
                            {
                              value: 'off',
                              label: '关闭',
                              tooltipTitle: '关闭 Skill',
                              tooltip: '关闭该 Skill，智聊过程中不会调用此 Skill',
                            },
                            {
                              value: 'on',
                              label: '启用',
                              tooltipTitle: '启用 Skill',
                              tooltip: '在智聊过程中启用此 Skill',
                            },
                          ] as SelectOption[]
                        }
                        value={isDisabled ? 'off' : 'on'}
                        onChange={(e) => {
                          const value = e.target.value;
                          const disabled = value === 'off';
                          // 状态未变化时不执行后续逻辑
                          if (disabled === isDisabled) return;
                          setSkillConfig(skill.name, { disabled });
                          postMessage({
                            type: BroadcastActions.UPDATE_SKILL_CONFIG,
                            data: { name: skill.name, disabled },
                          });
                        }}
                      />
                    </Flex>
                  </Flex>
                </Flex>
              </Box>
            );
          })
        ) : (
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
              当前未接入任何 Skills，可以打开配置安装
            </Box>
          </Box>
        )}
        {/* 添加"更多"按钮，当 Skills 数量超过3个且未显示全部时显示 */}
        {skills.length > 3 && !showAllSkills && (
          <Flex
            marginLeft={4}
            justifyContent="center"
            color="blue.500"
            fontSize="sm"
            cursor="pointer"
            onClick={() => {
              setLocalStorage(loadMoreKey, true);
              setShowAllSkills(true);
            }}
            userSelect="none"
          >
            <Text>更多</Text>
            <Icon as={FaAngleDown} ml={1} />
          </Flex>
        )}
        {/* 添加"收起"按钮，当显示全部 Skills 且数量超过3个时显示 */}
        {skills.length > 3 && showAllSkills && (
          <Flex
            marginLeft={4}
            justifyContent="center"
            color="blue.500"
            fontSize="sm"
            cursor="pointer"
            onClick={() => {
              setLocalStorage(loadMoreKey, false);
              setShowAllSkills(false);
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

export default SkillConfigCollapse;
