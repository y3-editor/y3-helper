import { Box, Flex, Text, VStack, Icon, Code, Button, Link } from "@chakra-ui/react";
import { BsShieldCheck, BsLightningChargeFill, BsFileEarmarkCode } from "react-icons/bs";
import { MdAlternateEmail, MdSync } from "react-icons/md";
import { ThemeStyle, useTheme } from "../../ThemeContext";
import { BiSolidMagicWand } from "react-icons/bi";
import { useChatPromptStore, useChatStreamStore } from "../../store/chat";
import { PromptCategoryType } from "../../services/prompt";
import { RULES_PROMPT } from "../../services/builtInPrompts/rules";
import { TOAST_STREAMING_PREVENT_SUBMIT_ID } from "../../utils/toast";
import useCustomToast from "../../hooks/useCustomToast";
import EventBus from "../../utils/eventbus";
import { usePostMessage } from "../../PostMessageProvider";

export default function RulesGuide() {
  const { activeTheme } = useTheme()
  const { toast } = useCustomToast()
  const updateChatPrompt = useChatPromptStore((state) => state.update);
  const onUserSubmit = useChatStreamStore((state) => state.onUserSubmit);
  const isStreaming = useChatStreamStore((state) => state.isStreaming);
  const isSearching = useChatStreamStore((state) => state.isSearching);
  const isProcessing = useChatStreamStore((state) => state.isProcessing);
  const { postMessage } = usePostMessage();

  return (
    <Box w="full" h="full" p={3} className="space-y-4">
      {/* Header */}
      <Box>
        <Flex alignItems="center" mb={2}>
          <Icon as={BsShieldCheck} color="blue.400" boxSize={4} mr={2} />
          <Text fontSize="sm" fontWeight="bold">Rules 使用指南</Text>
        </Flex>

        <Link
          href="https://github.com/user/codemaker"
          isExternal
          _hover={{ textDecoration: 'none' }}
          onClick={(e) => {
            e.stopPropagation()
            postMessage({
              type: "OPEN_IN_BROWSER",
              data: { url: `https://github.com/user/codemaker` },
            });
          }}
        >
          <Text fontSize="xs" color="text.secondary" lineHeight="1.5">
            Rules 为小助手提供持久化的上下文与规范，确保代码生成始终遵循用户标准与项目背景
            <Text as="span" color="blue.400" ml={1}>使用指南 &rarr;</Text>
          </Text>
        </Link>

      </Box>

      {/* Card 1: Team Rules */}
      <Flex
        bg="whiteAlpha.50"
        p={3}
        borderRadius="md"
        position="relative"
        overflow="hidden"
        alignItems="center"
        gap={3}
        border="1px solid"
        borderColor="whiteAlpha.200"
      >
        <Box position="absolute" top={0} left={0} right={0} bottom={0} bgGradient="linear(to-br, purple.900, transparent)" opacity={0.1} zIndex={0} />

        <Flex
          w={10}
          h={10}
          bg="whiteAlpha.100"
          borderRadius="lg"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
          zIndex={1}
        >
          <Icon as={BiSolidMagicWand} color="blue.300" boxSize={5} />
        </Flex>

        <Box flex={1} zIndex={1}>
          <Flex alignItems="center" mb={1}>
            <Code fontSize="xs" bg="whiteAlpha.200" px={2} mr={2}>/Rules</Code>
            <Text fontSize="xs" fontWeight="bold">指令</Text>
          </Flex>
          <Text fontSize="10px" color="text.secondary" lineHeight="1.4">
            小助手将深度分析当前打开的项目代码，自动提炼并生成适配的 <strong>Project Rules</strong>
          </Text>
        </Box>

        <Button
          size="xs"
          className="animation-breathe"
          bg={'blue.400'}
          color="white"
          _hover={{
            bg: "blue.600",
          }}
          rightIcon={<Icon as={BsLightningChargeFill} />}
          flexShrink={0}
          zIndex={1}
          px={3}
          h={8}
          onClick={(e) => {
            e.stopPropagation()
            // 回复中或者查询中不能重复发送消息
            if (isStreaming || isSearching || isProcessing) {
              toast({
                id: TOAST_STREAMING_PREVENT_SUBMIT_ID,
                title: 'Y3Maker 正在回复中，请稍后再提问',
                position: 'top',
                duration: 1000,
                status: 'warning',
              });
              return;
            }
            const prompt = {
              description: RULES_PROMPT.description,
              name: RULES_PROMPT.name,
              prompt: RULES_PROMPT.prompt,
              _id: `/${RULES_PROMPT.name}`,
              type: PromptCategoryType._CodeMaker,
            }
            updateChatPrompt(prompt);
            onUserSubmit(prompt.prompt, { event: "CodeChat.prompt_custom" }, prompt.prompt)
            EventBus.instance.dispatch('toggleDevSpacePanel', false)
          }}
        >
          一键生成
        </Button>
      </Flex>

      {/* Card 2: File Structure */}
      <Box bg="whiteAlpha.50" p={3} borderRadius="md" border="1px solid" borderColor="whiteAlpha.200" position={'relative'}>
        <Box position="absolute" top={0} left={0} right={0} bottom={0} bgGradient="linear(to-br, purple.900, transparent)" opacity={0.1} zIndex={0} />
        <Text fontSize="xs" fontWeight="bold" mb={2}>规则文件结构 (.mdc)</Text>

        <Flex gap={3}>
          {/* Code Block */}
          <Box flex={1} bg={activeTheme === ThemeStyle.Dark ? 'blackAlpha.500' : 'black'} p={2} borderRadius="md" fontSize="xs" fontFamily="monospace" color="gray.300" lineHeight="1.4">
            <Text color="gray.500">---</Text>
            <Text><Text as="span" color="blue.300">description:</Text> "RPC 服务样板"</Text>
            <Text><Text as="span" color="blue.300">alwaysApply:</Text> <Text as="span" color="orange.300">false</Text></Text>
            <Text><Text as="span" color="blue.300">globs:</Text></Text>
            <Text pl={2}>- "**/*.service.ts"</Text>
            <Text color="gray.500">---</Text>
            <Text mt={1} color="gray.500">&lt;rule&gt;</Text>
            <Text pl={2} color="green.400"># 编写具体的指令...</Text>
            <Text color="gray.500">&lt;/rule&gt;</Text>
          </Box>

          {/* Right Side: Apply Modes */}
          <VStack align="start" spacing={3} flexShrink={0} minW="120px" width={'35%'}>
            <Box>
              <Text fontSize="10px" color="text.secondary" mb={3} transformOrigin="left">生效方式</Text>
              <Flex alignItems="center" role="group" cursor="default">
                <Box
                  w={6} h={6}
                  display="flex" alignItems="center" justifyContent="center"
                  bg="blue.900"
                  borderRadius="md"
                  mr={2}
                  transition="all 0.2s"
                  _groupHover={{ bg: 'blue.500' }}
                >
                  <Icon as={BsLightningChargeFill} color="blue.400" boxSize={3} transition="all 0.2s" _groupHover={{ color: 'white' }} />
                </Box>
                <Box>
                  <Text fontSize="xs" fontWeight="bold" lineHeight="1" transition="all 0.2s" _groupHover={{ color: 'blue.300' }}>始终生效</Text>
                  <Text fontSize="10px" color="gray.500" transform="scale(0.85)" transformOrigin="left">Always Apply</Text>
                </Box>
              </Flex>
            </Box>

            <Flex alignItems="center" role="group" cursor="default">
              <Box
                w={6} h={6}
                display="flex" alignItems="center" justifyContent="center"
                bg="blue.900"
                borderRadius="md"
                mr={2}
                transition="all 0.2s"
                _groupHover={{ bg: 'blue.500' }}
              >
                <Icon as={MdAlternateEmail} color="blue.400" boxSize={3} transition="all 0.2s" _groupHover={{ color: 'white' }} />
              </Box>
              <Box>
                <Text fontSize="xs" fontWeight="bold" lineHeight="1" transition="all 0.2s" _groupHover={{ color: 'blue.300' }}>手动指定</Text>
                <Text fontSize="10px" color="gray.500" transform="scale(0.85)" transformOrigin="left">@Rules</Text>
              </Box>
            </Flex>

            <Flex alignItems="center" role="group" cursor="default">
              <Box
                w={6} h={6}
                display="flex" alignItems="center" justifyContent="center"
                bg="blue.900"
                borderRadius="md"
                mr={2}
                transition="all 0.2s"
                _groupHover={{ bg: 'blue.500' }}
              >
                <Icon as={BsFileEarmarkCode} color="blue.400" boxSize={3} transition="all 0.2s" _groupHover={{ color: 'white' }} />
              </Box>
              <Box>
                <Text fontSize="xs" fontWeight="bold" lineHeight="1" transition="all 0.2s" _groupHover={{ color: 'blue.300' }}>指定文件</Text>
                <Text fontSize="10px" color="gray.500" transform="scale(0.85)" transformOrigin="left">Glob Pattern</Text>
              </Box>
            </Flex>
          </VStack>
        </Flex>
      </Box>

      {/* Footer */}
      <Flex alignItems="start" p={2} bg="whiteAlpha.50" borderRadius="md" border="1px solid" borderColor="whiteAlpha.100" position={'relative'}>
        <Box position="absolute" top={0} left={0} right={0} bottom={0} bgGradient="linear(to-br, purple.900, transparent)" opacity={0.1} zIndex={0} />
        <Icon as={MdSync} color="gray.500" mr={2} mt={0.5} boxSize={3.5} />
        <Text fontSize="xs" lineHeight="1.4">
          兼容 Cursor Rules: <Code fontSize="xs" bg="transparent" color="gray.500" px={0}>.cursor/rules/</Code> 目录下的规则将自动识别。
        </Text>
      </Flex>
      <Box opacity={0}>codemaker rule</Box>
    </Box>
  );
}
