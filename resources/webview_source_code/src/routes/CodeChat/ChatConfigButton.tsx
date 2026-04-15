import React from 'react';
import {
  Flex,
  Box,
  Button,
  Text,
  FormControl,
  FormLabel,
  Grid,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Tooltip,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  // Checkbox,
} from '@chakra-ui/react';
// import { RiSettings2Line } from 'react-icons/ri';
import { useChatConfig, CHAT_MAX_TOKENS, CHAT_MIN_TOKENS } from '../../store/chat-config';
import { useFormik } from 'formik';
import { useConfigStore } from '../../store/config';
import Icon from '../../components/Icon';
// import { useTheme } from '../../ThemeContext';
import MiniButton from '../../components/MiniButton';
import { CiSettings } from "react-icons/ci";

interface FormValue {
  temperature: number;
  max_tokens: number;
  presence_penalty: number;
  context_count: number;
}

function ChatConfigButton() {
  const [isOpen, setIsOpen] = React.useState(false);
  const chatConfig = useChatConfig((state) => state.config);
  const update = useChatConfig((state) => state.update);
  const [config, updateConfig] = useConfigStore((state) => [
    state.config,
    state.updateConfig,
  ]);
  // const { activeTheme } = useTheme();
  // const isLight = activeTheme === 'light';

  const formik = useFormik<FormValue>({
    initialValues: {
      temperature: chatConfig.temperature,
      max_tokens: chatConfig.max_tokens,
      presence_penalty: chatConfig.presence_penalty,
      context_count: config.historyMessageCount,
    },
    onSubmit: (values) => {
      update((config) => {
        config.temperature = values.temperature;
        config.max_tokens = values.max_tokens;
        config.presence_penalty = values.presence_penalty;
      });
      updateConfig((config) => {
        config.historyMessageCount = values.context_count;
      });
      setIsOpen(false);
    },
  });

  const handleOpen = () => {
    setIsOpen(true);
    formik.resetForm({
      values: {
        temperature: chatConfig.temperature,
        max_tokens: chatConfig.max_tokens,
        presence_penalty: chatConfig.presence_penalty,
        context_count: config.historyMessageCount,
      },
    });
  };
  const handleClose = () => {
    formik.resetForm();
    setIsOpen(false);
  };

  return (
    <>
      <Tooltip label="Chat 配置">
        <MiniButton
          aria-label="Chat 配置"
          // size="xs"
          icon={<Icon as={CiSettings}  size='sm' />}
          onClick={handleOpen}
          // bg={isLight ? '#F2F2F2' : '#2C2C2C'}
          // color="text.secondary"
          // w="28px"
          // h="28px"
          // minW="28px"
          // minH="28px"
          // p="0"
          // _hover={{
          //   bg: isLight ? '#F2F2F2' : '#2C2C2C',
          //   color: '#746cec'
          // }}
        />
      </Tooltip>
      <Modal
        id="chat-config"
        isCentered
        scrollBehavior="inside"
        isOpen={isOpen}
        onClose={handleClose}
        autoFocus={false}
        trapFocus={false}
      >
        <ModalOverlay />
        <ModalContent>
          <form onSubmit={formik.handleSubmit}>
            <ModalHeader fontSize="lg">Chat 配置</ModalHeader>
            <ModalCloseButton />
            <ModalBody as={Grid} gap={4} maxH="60vh" overflowY="auto">
              <FormControl>
                <FormLabel>
                  <Text>随机性</Text>
                  <Text fontSize="12px" opacity={0.6}>
                    temperature，值越大，回复越随机，大于 1 的值可能会导致乱码
                  </Text>
                </FormLabel>
                <Flex gap={4}>
                  <Slider
                    name="presence_penalty"
                    min={0}
                    max={2}
                    step={0.1}
                    value={formik.values.temperature}
                    onChange={(value) =>
                      formik.setFieldValue('temperature', Number(value))
                    }
                  >
                    <SliderTrack>
                      <Box position="relative" right={10} />
                      <SliderFilledTrack />
                    </SliderTrack>
                    <SliderThumb boxSize={4} />
                  </Slider>
                  <NumberInput
                    min={0}
                    max={2}
                    step={0.1}
                    maxW="80px"
                    value={formik.values.temperature}
                    onChange={(value) =>
                      formik.setFieldValue('temperature', Number(value))
                    }
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </Flex>
              </FormControl>
              
              <FormControl>
                <FormLabel>
                  <Text>单次回复限制</Text>
                  <Text fontSize="12px" opacity={0.6}>
                    max_token，单次与模型交互所用的最大 Token
                    数，值越大，可输入的 Token 数越少
                  </Text>
                </FormLabel>
                <Input
                  type="number"
                  name="max_tokens"
                  value={formik.values.max_tokens}
                  onChange={formik.handleChange}
                  min={CHAT_MIN_TOKENS}
                  max={CHAT_MAX_TOKENS}
                />
              </FormControl>
              
              <FormControl>
                <FormLabel>
                  <Text>话题新鲜度</Text>
                  <Text fontSize="12px" opacity={0.6}>
                    present_penalty，值越大，越有可能拓展到新话题
                  </Text>
                </FormLabel>
                <Flex gap={4}>
                  <Slider
                    name="presence_penalty"
                    min={-2}
                    max={2}
                    step={0.1}
                    value={formik.values.presence_penalty}
                    onChange={(value) =>
                      formik.setFieldValue('presence_penalty', Number(value))
                    }
                  >
                    <SliderTrack>
                      <Box position="relative" right={10} />
                      <SliderFilledTrack />
                    </SliderTrack>
                    <SliderThumb boxSize={4} />
                  </Slider>
                  <NumberInput
                    min={-2}
                    max={2}
                    step={0.1}
                    maxW="80px"
                    value={formik.values.presence_penalty}
                    onChange={(value) =>
                      formik.setFieldValue('presence_penalty', Number(value))
                    }
                  >
                    <NumberInputField pattern="(-)?[0-9]*(.[0-9]+)?" />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </Flex>
              </FormControl>
              
              <FormControl>
                <FormLabel>
                  <Text>附带历史消息数</Text>
                  <Text fontSize="12px" opacity={0.6}>
                    每次请求携带的历史消息数
                  </Text>
                </FormLabel>
                <Input
                  type="number"
                  name="context_count"
                  value={formik.values.context_count}
                  onChange={formik.handleChange}
                  min={0}
                />
              </FormControl>
            </ModalBody>
            
            <ModalFooter gap={2}>
              <Button colorScheme="blue" color="white" type="submit" size="sm">
                保存
              </Button>
              <Button size="sm" onClick={handleClose}>
                取消
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}

export default ChatConfigButton;
