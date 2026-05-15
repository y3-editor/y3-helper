import { useEffect, useState } from 'react';
import {
  Text,
  Box,
  Flex,
  Icon,
  Tooltip,
  Collapse,
} from '@chakra-ui/react';
import { FaAngleDown, FaAngleRight } from 'react-icons/fa';
import { AiOutlineQuestionCircle } from 'react-icons/ai';
import SelectWithTooltip, { SelectOption } from '../../components/SelectWithTooltip';
import { useChatConfig, getModelConfigByUseModel } from '../../store/chat-config';
import { ChatModel } from '../../services/chatModel';
import { getLocalStorage, setLocalStorage } from '../../utils/storage';
import { LuMessageSquareTextIcon } from '../../components/Icon';

const COLLAPSE_KEY = 'codechat-compression-collapse-config';

// 压缩策略值 —— 把 (enable, useMainModel) 两个布尔合成一个下拉值
type CompressStrategy = 'off' | 'flash' | 'main';

const TOOL_OFFLOAD_OPTIONS: SelectOption[] = [
  { value: 'on', label: '启用（默认）' },
  { value: 'off', label: '关闭' },
];

interface IProps {
  disabled?: boolean;
}

/**
 * 从 (enable, useMainModel) 推导当前的压缩策略值。
 * enable=false 时不管 useMainModel 是什么,都算"关闭"。
 */
const deriveStrategy = (
  enable: boolean,
  useMainModel: boolean,
): CompressStrategy => {
  if (!enable) return 'off';
  return useMainModel ? 'main' : 'flash';
};

const CompressionConfigCollapse = ({ disabled = false }: IProps) => {
  const [isCollapsed, setIsCollapsed] = useState(!!getLocalStorage(COLLAPSE_KEY));
  const compressConfig = useChatConfig((state) => state.compressConfig);
  const setCompressConfig = useChatConfig((state) => state.setMemoryConfig);
  const chatModels = useChatConfig((state) => state.chatModels);
  const currentModel = useChatConfig((state) => state.config.model);
  const enableToolResultOffload = useChatConfig(
    (state) => state.enableToolResultOffload,
  );
  const setEnableToolResultOffload = useChatConfig(
    (state) => state.setEnableToolResultOffload,
  );
  const toolResultOffloadSupported = useChatConfig(
    (state) => state.toolResultOffloadSupported,
  );

  // 两种情况不渲染"Gemini 3 Flash"选项 —— 跑到 triggerCompression 时会自动走主模型:
  //   1. 后端 chatModels 里没有 Gemini3Flash(测试环境/未来下线)
  //   2. 当前主模型是私有化模型 —— Flash 是公网模型,私有化场景不允许外泄上下文
  // 注意:线上后台给新模型生成的 code 是"标题-时间戳"(如 "Gemini 3 Flash-1770286002971"),
  // 不能直接用 chatModels[ChatModel.Gemini3Flash] 按 code 查,必须按 useModel 反查。
  const currentModelConfig = chatModels?.[currentModel];
  const hasFlashConfig = !!getModelConfigByUseModel(ChatModel.Gemini3Flash);
  const flashSelectable = hasFlashConfig && !currentModelConfig?.isPrivate;

  // 切到不支持 Flash 的场景(如私有化模型)后,若用户原本选的是 Flash,
  // 自动回退到"跟随主模型"。避免下拉值落到被移除的 flash 选项上,
  // 也避免静默地让"已启用的压缩"实际上不生效。
  //   - enable=false(原本关闭)     → 不动,继续关闭
  //   - useMainModel=true(跟随主模型) → 不动
  //   - useMainModel=false(Flash)   → 切到跟随主模型
  useEffect(() => {
    if (
      !flashSelectable &&
      compressConfig.enable &&
      !compressConfig.useMainModel
    ) {
      setCompressConfig({ useMainModel: true });
    }
  }, [
    flashSelectable,
    compressConfig.enable,
    compressConfig.useMainModel,
    setCompressConfig,
  ]);

  // Hook 必须无条件调用 —— 早退只能放在所有 Hook 之后
  if (!compressConfig.visible) return null;

  const strategyOptions: SelectOption[] = [
    { value: 'off', label: '关闭' },
    ...(flashSelectable
      ? [{ value: 'flash', label: 'Gemini 3 Flash（默认）' }]
      : []),
    { value: 'main', label: '跟随主模型' },
  ];

  const currentStrategy = deriveStrategy(
    compressConfig.enable,
    compressConfig.useMainModel,
  );
  // 兜底:Flash 被禁用但状态尚未被上面的 useEffect 同步时,
  // 下拉显示值先视作 main,避免出现"请选择"的空白态。
  const displayStrategy: CompressStrategy =
    !flashSelectable && currentStrategy === 'flash' ? 'main' : currentStrategy;

  const handleStrategyChange = (value: string) => {
    const next = value as CompressStrategy;
    if (next === 'off') {
      setCompressConfig({ enable: false });
    } else if (next === 'flash') {
      setCompressConfig({ enable: true, useMainModel: false });
    } else {
      setCompressConfig({ enable: true, useMainModel: true });
    }
  };

  return (
    <>
      <Flex
        alignItems="center"
        userSelect="none"
        cursor="pointer"
        fontSize="small"
        onClick={() => {
          setLocalStorage(COLLAPSE_KEY, !isCollapsed);
          setIsCollapsed(!isCollapsed);
        }}
      >
        <LuMessageSquareTextIcon w="16px" h="16px" />
        <Text marginLeft={2} fontSize={12}>
          Memory 工具
        </Text>
        <Tooltip
          label="当上下文窗口占用达到100%时，自动进行内容压缩生成memory，增强仓库智聊对上下文的记忆能力"
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

      <Collapse in={!isCollapsed} animate={false}>
        {/* 子项 1：压缩策略 */}
        <Box marginLeft={4} position="relative">
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
              justifyContent="space-between"
              alignItems="center"
              width="full"
            >
              <Box fontSize={12} display="flex" alignItems="center">
                <Text fontSize="12px">压缩策略</Text>
              </Box>
              <Box display="flex" alignItems="center">
                <SelectWithTooltip
                  size="xs"
                  width="160px"
                  options={strategyOptions}
                  value={displayStrategy}
                  isDisabled={disabled}
                  onChange={(e) => handleStrategyChange(e.target.value)}
                />
              </Box>
            </Flex>
          </Flex>
        </Box>

        {/* 子项 2：Tool Output 落盘（插件支持才渲染） */}
        {toolResultOffloadSupported && (
          <Box marginLeft={4} position="relative">
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
                justifyContent="space-between"
                alignItems="center"
                width="full"
              >
                <Box fontSize={12} display="flex" alignItems="center">
                  <Text fontSize="12px">Tool Output 落盘</Text>
                  <Tooltip
                    label="开启后,超长工具输出会落盘并在上下文中用引用替代,减少 token 占用"
                    placement="top"
                  >
                    <Box
                      display="inline-flex"
                      alignItems="center"
                      ml={1}
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
                </Box>
                <Box display="flex" alignItems="center">
                  <SelectWithTooltip
                    size="xs"
                    width="120px"
                    options={TOOL_OFFLOAD_OPTIONS}
                    value={enableToolResultOffload ? 'on' : 'off'}
                    isDisabled={disabled}
                    onChange={(e) => {
                      setEnableToolResultOffload(e.target.value === 'on');
                    }}
                  />
                </Box>
              </Flex>
            </Flex>
          </Box>
        )}
      </Collapse>
    </>
  );
};

export default CompressionConfigCollapse;