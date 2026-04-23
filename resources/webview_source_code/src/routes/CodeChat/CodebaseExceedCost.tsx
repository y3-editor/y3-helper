import {
  Box,
  Flex,
  Text,
  Image,
  Button,
  VStack,
} from '@chakra-ui/react';
import * as React from 'react';
import CodeMakerLogo from '../../assets/codemaker-logo.png';
import { useChatBillStore } from '../../store/chatBill';
import EventBus, { EBusEvent } from '../../utils/eventbus';
import { usePostMessage } from '../../PostMessageProvider';

/**
 * 仓库智聊积分用尽提示组件
 * 当用户仓库智聊积分超出限额时显示
 */
function CodebaseExceedCost() {
  const billLoading = useChatBillStore(state => state.billLoading)
  const maxCostPerMonth = useChatBillStore(state => state.maxCostPerMonth)

  const { postMessage } = usePostMessage()
  // 刷新限额按钮点击处理
  const handleRefreshLimit = React.useCallback(() => {
    // 可以通过 postMessage 与 IDE 插件通信，让插件处理刷新逻辑
    EventBus.instance.dispatch(EBusEvent.Update_User_Quota)
  }, []);



  return (
    <Box className="py-6 px-6 flex flex-col h-full justify-center max-w-2xl mx-auto">
      {/* Header */}
      <Flex justifyContent="center" alignItems={'flex-start'}>
        <Image
          src={CodeMakerLogo}
          alt="CodeMaker Logo"
          width="28px"
          height="28px"
          mr={1}
        />
        <Text
          color="blue.300"
          fontSize="20px"
          fontWeight="bold"
          lineHeight="1.8"
          bgGradient="linear(to-r, blue.400, purple.400)"
          bgClip="text"
        >
          odeMaker Coding Agent
        </Text>
      </Flex>

      {/* Subtitle */}
      <Text
        color="text.default"
        fontSize="14px"
        mb={6}
        textAlign="center"
      >
        让开发像聊天一样简单！
      </Text>

      {/* Main Content */}
      <VStack spacing={2} align="stretch">
        {/* Greeting */}
        <Text color="text.default" fontSize="14px">
          Hi 同学，
        </Text>

        {/* Limit Exceeded Message */}
        <Text color="text.default" fontSize="14px" lineHeight="1.6">
          您的仓库智聊本月 {maxCostPerMonth * 100} 积分（成本约 {maxCostPerMonth} 元）额度已用完。因 3.0 版本
          上线后需求激增，系统已暂时限制使用权限以兼顾稳定性和成本控制。
        </Text>

        {/* Support Section */}
        <Box mb={5}>
          <Flex alignItems="center" mb={1}>
            <Text fontSize="16px" mr={1}>🚀</Text>
            <Text color="text.default" fontSize="14px" fontWeight="medium">
              如何恢复使用？业务确需？我们全力支持！请：
            </Text>
          </Flex>

          <VStack align="start" spacing={2}>
            <Box color="text.default" fontSize="13px">
              1. 查阅
              <Button
                variant={'link'}
                color="blue.400"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  postMessage({
                    type: "OPEN_IN_BROWSER",
                    data: { url: `https://g.126.fm/01ePpyp` },
                  });
                }}
              >
                《仓库智聊积分申请》
              </Button>
              文档
            </Box>
            <Box color="text.default" fontSize="13px">
              2. 发邮件至主管邮箱：简要说明您的具体应用场景
            </Box>
            <Box color="text.default" fontSize="13px">
              3. 审批通过后：点击
              <Button
                variant={'link'}
                color="blue.400"
                disabled={billLoading}
                onClick={handleRefreshLimit}
              >
                「刷新限额」
              </Button>
              ，即可恢复。
            </Box>
          </VStack>
        </Box>

        {/* Tips Section */}
        <Box>
          <Flex alignItems="center" mb={1}>
            <Text fontSize="16px" mr={1}>💡</Text>
            <Text color="text.default" fontSize="14px" fontWeight="medium">
              高效使用小贴士：
            </Text>
          </Flex>

          <VStack align="start" spacing={2}>
            <Box color="text.default" fontSize="13px">
              1. 选合适模型：不同模型成本差异大。翻译/简单询问等任务，推荐高性价比模型（如 Claude Haiku）。
            </Box>
            <Box color="text.default" fontSize="13px">
              2. 及时开新对话：避免长会话追加提问，历史记录过长会加倍消耗 Token 并降低速度。
            </Box>
            <Box color="text.default" fontSize="13px">
              3. 优化提示词：一次性给出清晰、完整的指令和背景，减少反复纠错浪费额度。
            </Box>
          </VStack>
        </Box>

        {/* Refresh Button */}
        <Box textAlign="center" mt={6} mb={10}>
          <Button
            colorScheme="blue"
            size="sm"
            px={8}
            py={2}
            bgGradient="linear(to-r, blue.400, purple.500)"
            _hover={{
              bgGradient: "linear(to-r, blue.500, purple.600)",
              transform: "translateY(-1px)"
            }}
            _active={{
              transform: "translateY(0)"
            }}
            color={'white'}
            onClick={handleRefreshLimit}
            isLoading={billLoading}
            disabled={billLoading}
          >
            刷新限额
          </Button>
        </Box>
      </VStack>
    </Box>
  );
}

export default CodebaseExceedCost;