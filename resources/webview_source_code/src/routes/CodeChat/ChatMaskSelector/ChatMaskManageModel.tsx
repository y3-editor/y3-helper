import * as React from 'react';
import {
  Box,
  Grid,
  Flex,
  IconButton,
  Text,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  Divider,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Button,
  ModalCloseButton,
  RadioGroup,
  Stack,
  Radio,
  TableContainer,
  Table,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
  Link,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  UnorderedList,
  ListItem,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverBody,
} from '@chakra-ui/react';
import { TbChevronLeft } from 'react-icons/tb';
import { useFormik } from 'formik';
import { useChatStreamStore } from '../../../store/chat';
import { ChatMask } from '../../../store/config';
import useCustomToast from '../../../hooks/useCustomToast';
import { RiDeleteBinLine } from 'react-icons/ri';
import { VariableType, useMaskStore } from '../../../store/mask';
import WorkspaceFileSelect from '../../../components/WorkspaceFileSelect';
import PromptCategorySelect from '../../../components/PromptCategorySelect';
import {
  MASK_LABEL,
  Prompt,
  PromptCategoryType,
  createPrompt,
  getMaskPrompts,
  getProjectMaskPrompts,
  removePrompt,
  updatePrompt,
} from '../../../services/prompt';
import {
  CHAT_MAX_TOKENS,
  CHAT_MIN_TOKENS,
  useChatConfig
} from '../../../store/chat-config';
import CodebaseSelect from '../../../components/CodebaseSelect';
import { FileMeta } from '../../../components/WorkspaceFileSelect/WorkspaceFileSelect';
import DocsetSelect from '../../../components/DocsetSelect';
import { toastUserPromptCategoryWithoutInit } from '../../../utils/toast';
import { mutateService } from '../../../hooks/useService';
import { toastErrorMessage } from '../../../utils';
import { BroadcastActions, usePostMessage } from '../../../PostMessageProvider';
import { Select } from 'chakra-react-select';
import { RiArrowDownSLine } from 'react-icons/ri';
import { isNumber } from 'lodash';
import Icon from '../../../components/Icon';
import {
  COMMON_VARIABLE,
  INNER_VARIABLE,
} from '../ChatTypeAhead/Prompt/useUserPrompt';
import CopyButton from '../../../components/CopyButton';
import { MaskSampleFormValue } from '../../../store/chatAction';
import { ChatModel } from '../../../services/chatModel';
interface ChatMaskModelProps {
  isOpen: boolean;
  mask?: Prompt;
  onClose: () => void;
}

const DEFAULT_PROMPT =
  '你是 xxx 助手，能利用 {{%knowledge%}} {{%file%}} {{%codebase%}} 帮助用户实现提出的需求。';
const PROJECT_MASK_MANAGE_DOC_URL = 'https://github.com/user/codemaker';

interface MaskValues {
  name: string;
  prompt: string;
  description: string;
  type: PromptCategoryType;
  categoryId: string;
  model?: ChatModel;
  presence_penalty?: number;
  max_tokens?: number;
  temperature?: number;
  variables: {
    [VariableType.Knowledge]: {
      code: string;
      description: string;
    };
    [VariableType.File]: {
      paths: FileMeta[];
      description: string;
    };
    [VariableType.Codebase]: {
      code: string;
      description: string;
    };
  };
}

const DEFAULT_FORM_VALUES = {
  name: '',
  prompt: DEFAULT_PROMPT,
  description: '',
  type: PromptCategoryType.User,
  categoryId: '',
  model: ChatModel.Claude4Sonnet20250514,
  presence_penalty: 1,
  max_tokens: CHAT_MIN_TOKENS,
  temperature: 0.7,
  variables: {
    [VariableType.Knowledge]: {
      code: '',
      description: '',
    },
    [VariableType.File]: {
      paths: [],
      description: '',
    },
    [VariableType.Codebase]: {
      code: '',
      description: '',
    },
  },
};

export interface ChatNewMaskModelHandle {
  setFormValue: (formValue: MaskSampleFormValue) => void;
}

// 非常奇葩的需求，未来可能是个废弃的功能，等以后有时间再优化代码吧
export const ChatNewMaskModel = React.forwardRef(
  (props: ChatMaskModelProps, ref) => {
    const { isOpen, onClose } = props;
    const { postMessage } = usePostMessage();
    const [renderDocsetRow, setRenderDocsetRow] = React.useState(true);
    const [renderFileRow, setRenderFileRow] = React.useState(true);
    const [renderCodebaseRow, setRenderCodebaseRow] = React.useState(true);
    const [loading, setLoading] = React.useState(false);

    const initialRef = React.useRef(false);
    const maskConfig = useMaskStore((state) => state.config);
    const chatModels = useChatConfig((state) => state.chatModels)
    const { toast } = useCustomToast();

    const formik = useFormik<MaskValues>({
      initialValues: DEFAULT_FORM_VALUES,
      validateOnChange: false,
      validateOnBlur: false,
      validate: (values) => {
        const errors: Record<string, string> = {};
        if (!values.name || !values.prompt) {
          errors.name = '请输入模式名称和 prompt 内容';
        }
        if (values.type === PromptCategoryType.Project && !values.categoryId) {
          errors.categoryId = '请选择所属词库';
        }
        if (
          renderCodebaseRow &&
          !values.variables[VariableType.Codebase]?.code
        ) {
          errors.variables = '请选择代码地图';
        }
        if (
          renderFileRow &&
          !values.variables[VariableType.File]?.paths?.length
        ) {
          errors.variables = '请选择本地文件';
        }
        if (
          renderDocsetRow &&
          !values.variables[VariableType.Knowledge]?.code
        ) {
          errors.variables = '请选择数据集';
        }
        for (const args in errors) {
          const error = errors[args];
          toast({
            title: error,
            status: 'error',
            position: 'top',
            isClosable: true,
          });
        }

        return errors;
      },
      onSubmit: async (values) => {
        const { name, prompt } = values;
        const categoryId = (
          values.type === PromptCategoryType.User
            ? maskConfig.categoryId
            : values.categoryId
        ) as string;
        const _variables = { ...values.variables };
        if (!renderDocsetRow) {
          Reflect.deleteProperty(_variables, VariableType.Knowledge);
        }
        if (!renderFileRow) {
          Reflect.deleteProperty(_variables, VariableType.File);
        }
        if (!renderCodebaseRow) {
          Reflect.deleteProperty(_variables, VariableType.Codebase);
        }
        setLoading(true);
        const params: Prompt['extra_parameters'] = {
          model: values.model,
          presence_penalty: Number(values.presence_penalty),
          max_tokens: Number(values.max_tokens),
          temperature: Number(values.temperature),
        };
        await handleCreateMask(categoryId, name, prompt, {
          description: values.description,
          extra_parameters: { ...params, ..._variables },
        });
        setLoading(false);
        handleCloseModel();
      },
    });

    const setFormValue = React.useCallback(
      (formValue: MaskSampleFormValue) => {
        formik.setFieldValue('name', formValue.name);
        formik.setFieldValue('description', formValue.description);
        formik.setFieldValue('prompt', formValue.prompt);
      },
      [formik],
    );

    React.useImperativeHandle(ref, () => ({
      setFormValue: setFormValue,
    }));

    const handleCreateMask = async (
      categoryId: string,
      name: string,
      prompt: string,
      extra: Partial<Prompt>,
    ) => {
      if (!maskConfig.categoryId) {
        toastUserPromptCategoryWithoutInit();
        return;
      }

      try {
        await createPrompt(categoryId, name, prompt, {
          // 标记了 mask 的 label 表示创建的是模式
          labels: [MASK_LABEL],
          ...extra,
        });
        toast({
          title: `用户自定义模式创建成功。 `,
          status: 'success',
          position: 'top',
          isClosable: true,
        });
        if (categoryId === maskConfig.categoryId) {
          mutateService(getMaskPrompts);
        } else {
          mutateService(getProjectMaskPrompts);
        }
      } catch (error) {
        console.error(error);
        toast({
          title: toastErrorMessage(error as Error),
          status: 'error',
          position: 'top',
          isClosable: true,
        });
      }
    };

    const handleValidatePromoptSlot = React.useCallback(() => {
      const prompt = formik.values.prompt;
      const knowledgeRegex = /{{%knowledge%}}/g;
      const fileRegex = /{{%file%}}/g;
      const codebaseRegex = /{{%codebase%}}/g;

      const hasKnowledgeSlot = knowledgeRegex.test(prompt);
      const hasFileSlot = fileRegex.test(prompt);
      const hasCodebaseSlot = codebaseRegex.test(prompt);
      if (!hasKnowledgeSlot) {
        formik.setFieldValue('variables.knowledge', null);
      } else if (
        hasKnowledgeSlot &&
        !formik.values.variables[VariableType.Knowledge]?.code
      ) {
        formik.setFieldValue(
          'variables.knowledge',
          DEFAULT_FORM_VALUES.variables[VariableType.Knowledge],
        );
      }
      if (!hasFileSlot) {
        formik.setFieldValue('variables.file', null);
      } else if (
        hasFileSlot &&
        !formik.values.variables[VariableType.File]?.paths
      ) {
        formik.setFieldValue(
          'variables.file',
          DEFAULT_FORM_VALUES.variables[VariableType.File],
        );
      }
      if (!hasCodebaseSlot) {
        formik.setFieldValue('variables.codebase', null);
      } else if (
        hasCodebaseSlot &&
        !formik.values.variables[VariableType.Codebase]?.code
      ) {
        formik.setFieldValue(
          'variables.codebase',
          DEFAULT_FORM_VALUES.variables[VariableType.Codebase],
        );
      }
      setRenderDocsetRow(hasKnowledgeSlot);
      setRenderFileRow(hasFileSlot);
      setRenderCodebaseRow(hasCodebaseSlot);
    }, [formik]);

    React.useEffect(() => {
      if (!initialRef.current) {
        formik.resetForm();
        handleValidatePromoptSlot();
        initialRef.current = true;
      }
    }, [formik, handleValidatePromoptSlot]);

    const removeSlot = (slot: string) => {
      const prompt = formik.values.prompt;
      const nextPrompt = prompt.replace(`{{%${slot}%}}`, '');
      formik.setFieldValue('prompt', nextPrompt);
    };

    const handleCloseModel = () => {
      formik.resetForm();
      initialRef.current = false;
      onClose();
    };

    const handleOpenPromptDoc = () => {
      postMessage({
        type: BroadcastActions.OPEN_IN_BROWSER,
        data: { url: PROJECT_MASK_MANAGE_DOC_URL },
      });
    };

    return (
      <Modal
        size="full"
        trapFocus={false}
        closeOnEsc={false}
        isOpen={isOpen}
        onClose={handleCloseModel}
        scrollBehavior="inside"
      >
        <form onSubmit={formik.handleSubmit}>
          <ModalOverlay />
          <ModalContent className="chat-typeahead-inner-element">
            <ModalHeader>
              <Flex gap={2} alignItems="center">
                <IconButton
                  aria-label="back"
                  icon={<TbChevronLeft />}
                  mr={2}
                  onClick={handleCloseModel}
                />
                <Text>新建自定义聊天模式</Text>
              </Flex>
            </ModalHeader>
            <Divider size="lg" />
            <ModalBody>
              <Flex py={4} px={0} flexDirection="column" gap={3}>
                <Text>
                  为整个会话增加 Prompt，可以保持 Code Chat 的上下文一致
                </Text>
                <Grid gap={4}>
                  <Box>
                    <FormControl isRequired>
                      <FormLabel>模式名</FormLabel>
                    </FormControl>
                    <Input
                      name="name"
                      value={formik.values.name}
                      onChange={formik.handleChange}
                      onInput={formik.handleChange}
                    />
                  </Box>
                  <Box>
                    <FormControl>
                      <FormLabel>模式简介</FormLabel>
                    </FormControl>
                    <Input
                      name="description"
                      value={formik.values.description}
                      onChange={formik.handleChange}
                      onInput={formik.handleChange}
                    />
                    <Text fontSize="sm" opacity={0.6}>
                      简要说明模式的用途，会展示在模式选项下
                    </Text>
                  </Box>
                  <Box>
                    <FormControl isRequired>
                      <FormLabel>Prompt 内容</FormLabel>
                      <Textarea
                        name="prompt"
                        rows={10}
                        value={formik.values.prompt}
                        onChange={formik.handleChange}
                        onInput={formik.handleChange}
                        onBlur={handleValidatePromoptSlot}
                      />
                    </FormControl>
                    <Text fontSize="sm">
                      <Text opacity={0.6} display="inline">
                        给 Chat 一个上下文语境，如角色、场景、问题背景。支持多种
                      </Text>
                      <Popover>
                        <PopoverTrigger>
                          <Text
                            display="inline"
                            color="blue.200"
                            cursor="pointer"
                          >
                            参数占位符
                          </Text>
                        </PopoverTrigger>
                        <PopoverContent>
                          <PopoverArrow />
                          <PopoverBody width="100%">
                            <PromptVariableTooltip />
                          </PopoverBody>
                        </PopoverContent>
                      </Popover>
                    </Text>
                  </Box>
                  <Box>
                    <FormControl isRequired mt={4}>
                      <FormLabel>Prompt 参数</FormLabel>
                      <Text fontSize="sm" opacity={0.6}>
                        可配置系统参数默认值，并通过 {'{{%参数名%}}'} 引用
                      </Text>
                    </FormControl>
                    <TableContainer my={4} overflowY="unset" overflowX="unset">
                      <Table size="sm">
                        <Thead>
                          <Tr>
                            <Th w="100px" color="white">
                              参数名
                            </Th>
                            <Th color="white">默认值</Th>
                            <Th w="160px" color="white">
                              说明
                            </Th>
                            <Th w="40px" px={0}></Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {renderDocsetRow && (
                            <Tr>
                              <Td>knowledge</Td>
                              <Td>
                                <DocsetSelect
                                  value={
                                    formik.values.variables[
                                      VariableType.Knowledge
                                    ]?.code || ''
                                  }
                                  onChange={(v) =>
                                    formik.setFieldValue(
                                      'variables.knowledge.code',
                                      v,
                                    )
                                  }
                                />
                              </Td>
                              <Td>
                                <Input
                                  name="variables.knowledge.description"
                                  value={
                                    formik.values.variables[
                                      VariableType.Knowledge
                                    ]?.description || ''
                                  }
                                  onChange={formik.handleChange}
                                  onInput={formik.handleChange}
                                />
                              </Td>
                              <Td px={0}>
                                <IconButton
                                  aria-label="删除"
                                  variant="ghost"
                                  icon={<Icon as={RiDeleteBinLine} />}
                                  color="text.default"
                                  onClick={() => {
                                    setRenderDocsetRow(false);
                                    removeSlot(VariableType.Knowledge);
                                  }}
                                />
                              </Td>
                            </Tr>
                          )}
                          {renderFileRow && (
                            <Tr>
                              <Td>file</Td>
                              <Td>
                                <WorkspaceFileSelect
                                  value={
                                    formik.values.variables[VariableType.File]
                                      ?.paths || []
                                  }
                                  onChange={(v) => {
                                    formik.setFieldValue(
                                      'variables.file.paths',
                                      v.map((v) => v),
                                    );
                                  }}
                                />
                              </Td>
                              <Td>
                                <Input
                                  id="variables.file.description"
                                  name="variables.file.description"
                                  value={
                                    formik.values.variables[VariableType.File]
                                      ?.description || ''
                                  }
                                  onChange={formik.handleChange}
                                  onInput={formik.handleChange}
                                />
                              </Td>
                              <Td px={0}>
                                <IconButton
                                  aria-label="删除"
                                  variant="ghost"
                                  icon={<Icon as={RiDeleteBinLine} />}
                                  color="text.default"
                                  onClick={() => {
                                    setRenderFileRow(false);
                                    removeSlot(VariableType.File);
                                  }}
                                />
                              </Td>
                            </Tr>
                          )}
                          {renderCodebaseRow && (
                            <Tr>
                              <Td>codebase</Td>
                              <Td>
                                <CodebaseSelect
                                  value={
                                    formik.values.variables[
                                      VariableType.Codebase
                                    ]?.code || ''
                                  }
                                  onChange={(v) => {
                                    formik.setFieldValue(
                                      'variables.codebase.code',
                                      v?.value || '',
                                    );
                                  }}
                                />
                              </Td>
                              <Td>
                                <Input
                                  name="variables.codebase.description"
                                  value={
                                    formik.values.variables[
                                      VariableType.Codebase
                                    ]?.description || ''
                                  }
                                  onChange={formik.handleChange}
                                  onInput={formik.handleChange}
                                />
                              </Td>
                              <Td px={0}>
                                <IconButton
                                  aria-label="删除"
                                  variant="ghost"
                                  icon={<Icon as={RiDeleteBinLine} />}
                                  color="text.default"
                                  onClick={() => {
                                    setRenderCodebaseRow(false);
                                    removeSlot(VariableType.Codebase);
                                  }}
                                />
                              </Td>
                            </Tr>
                          )}
                        </Tbody>
                      </Table>
                    </TableContainer>
                  </Box>
                  <Box>
                    <FormControl isRequired>
                      <FormLabel>使用权限</FormLabel>
                      <RadioGroup
                        mb={4}
                        name="type"
                        value={formik.values.type}
                        onChange={(value) =>
                          formik.setFieldValue('type', value)
                        }
                      >
                        <Stack direction="row">
                          <Radio value={PromptCategoryType.User}>个人</Radio>
                          <Radio value={PromptCategoryType.Project}>团队</Radio>
                        </Stack>
                      </RadioGroup>
                      {formik.values.type === PromptCategoryType.Project && (
                        <FormControl isRequired>
                          <PromptCategorySelect
                            value={formik.values.categoryId}
                            onChange={(id) =>
                              formik.setFieldValue('categoryId', id)
                            }
                          />
                          <Text fontSize="12px" opacity={0.6}>
                            选择模式归属的仓库，所有仓库成员将拥有使用权限。
                            <Button
                              fontSize="12px"
                              variant="link"
                              colorScheme="blue"
                              onClick={handleOpenPromptDoc}
                            >
                              管理仓库
                            </Button>
                          </Text>
                        </FormControl>
                      )}
                    </FormControl>
                  </Box>
                  <Box>
                    <FormControl>
                      <FormLabel>使用模型</FormLabel>
                      <Select
                        name="model"
                        value={
                          formik.values.model
                            ? {
                              label: chatModels[formik.values.model]?.title,
                              value: formik.values.model,
                            }
                            : undefined
                        }
                        onChange={(v) => {
                          formik.setFieldValue('model', v?.value);
                        }}
                        placeholder="请选择"
                        options={Object.keys(chatModels).map((model) => ({
                          label: chatModels[model].title,
                          value: chatModels[model].code,
                        }))}
                        components={{
                          DropdownIndicator: () => (
                            <div className="mr-4">
                              <Icon
                                as={RiArrowDownSLine}
                                size="xs"
                                color="text.default"
                              />
                            </div>
                          ),
                          IndicatorSeparator: () => null,
                        }}
                      ></Select>
                      <Text fontSize="sm" opacity={0.6}>
                        不同模型会影响回答效果
                      </Text>
                    </FormControl>
                  </Box>
                  <Box>
                    <FormControl>
                      <FormLabel>随机性</FormLabel>
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
                          <SliderThumb boxSize={4} zIndex={0} />
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
                      <Text fontSize="sm" opacity={0.6}>
                        temperature，值越大，回复越随机，大于 1
                        的值可能会导致乱码
                      </Text>
                    </FormControl>
                  </Box>
                  <Box>
                    <FormControl>
                      <FormLabel>话题新鲜度</FormLabel>
                      <Flex gap={4}>
                        <Slider
                          name="presence_penalty"
                          min={-2}
                          max={2}
                          step={0.1}
                          value={formik.values.presence_penalty}
                          onChange={(value) =>
                            formik.setFieldValue(
                              'presence_penalty',
                              Number(value),
                            )
                          }
                        >
                          <SliderTrack>
                            <Box position="relative" right={10} />
                            <SliderFilledTrack />
                          </SliderTrack>
                          <SliderThumb boxSize={4} zIndex={0} />
                        </Slider>
                        <NumberInput
                          min={-2}
                          max={2}
                          step={0.1}
                          maxW="80px"
                          value={formik.values.presence_penalty}
                          onChange={(value) =>
                            formik.setFieldValue(
                              'presence_penalty',
                              Number(value),
                            )
                          }
                        >
                          <NumberInputField pattern="(-)?[0-9]*(.[0-9]+)?" />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                      </Flex>
                      <Text fontSize="sm" opacity={0.6}>
                        present_penalty，值越大，越有可能拓展到新话题
                      </Text>
                    </FormControl>
                  </Box>
                  <Box>
                    <FormControl>
                      <FormLabel>单次回复限制</FormLabel>
                      <Input
                        type="number"
                        name="max_tokens"
                        value={formik.values.max_tokens}
                        onChange={formik.handleChange}
                        onInput={formik.handleChange}
                        placeholder="请输入"
                        min={CHAT_MIN_TOKENS}
                        max={CHAT_MAX_TOKENS}
                      />
                      <Text fontSize="sm" opacity={0.6}>
                        max_token，单次与模型交互所用的最大 Token
                        数，值越大，可输入的 Token 数越少
                      </Text>
                    </FormControl>
                  </Box>
                </Grid>
              </Flex>
            </ModalBody>
            <ModalFooter justifyContent="center" gap={4}>
              <Button
                colorScheme="blue"
                color="white"
                type="submit"
                isLoading={loading}
              >
                新建
              </Button>
              <Button onClick={handleCloseModel}>取消</Button>
            </ModalFooter>
          </ModalContent>
        </form>
      </Modal>
    );
  },
);

export function ChatEditMaskModel(props: Required<ChatMaskModelProps>) {
  const { isOpen, mask, onClose } = props;

  const { postMessage } = usePostMessage();
  const [renderDocsetRow, setRenderDocsetRow] = React.useState(true);
  const [renderFileRow, setRenderFileRow] = React.useState(true);
  const [renderCodebaseRow, setRenderCodebaseRow] = React.useState(true);
  const changeMask = useMaskStore((state) => state.changeMask);
  const chatModels = useChatConfig((state) => state.chatModels)
  const [loading, setLoading] = React.useState(false);

  const { toast } = useCustomToast();
  const initialRef = React.useRef(false);

  const formik = useFormik<MaskValues>({
    initialValues: {
      name: mask.name,
      prompt: mask.prompt,
      description: mask.description || '',
      type: mask.type || PromptCategoryType.User,
      categoryId: mask.category_id || '',
      model: mask.extra_parameters?.model || ChatModel.Claude4Sonnet20250514,
      presence_penalty: mask.extra_parameters?.presence_penalty || 0,
      max_tokens: mask.extra_parameters?.max_tokens || CHAT_MIN_TOKENS,
      temperature: isNumber(mask.extra_parameters?.temperature)
        ? mask.extra_parameters?.temperature
        : 0.7,
      variables: {
        [VariableType.Knowledge]: mask.extra_parameters?.knowledge || {
          code: '',
          description: '',
        },
        [VariableType.File]: mask.extra_parameters?.file || {
          paths: [],
          description: '',
        },
        [VariableType.Codebase]: mask.extra_parameters?.codebase || {
          code: '',
          description: '',
        },
      },
    },
    validateOnChange: false,
    validateOnBlur: false,
    validate: (values) => {
      const errors: Record<string, string> = {};
      if (!values.name || !values.prompt) {
        errors.name = '请输入模式名称和 prompt 内容';
      }
      if (values.type === PromptCategoryType.Project && !values.categoryId) {
        errors.categoryId = '请选择所属词库';
      }
      if (renderCodebaseRow && !values.variables[VariableType.Codebase]?.code) {
        errors.variables = '请选择代码地图';
      }
      if (
        renderFileRow &&
        !values.variables[VariableType.File]?.paths?.length
      ) {
        errors.variables = '请选择本地文件';
      }
      if (renderDocsetRow && !values.variables[VariableType.Knowledge]?.code) {
        errors.variables = '请选择数据集';
      }
      for (const args in errors) {
        const error = errors[args];
        toast({
          title: error,
          status: 'error',
          position: 'top',
          isClosable: true,
        });
      }

      return errors;
    },
    onSubmit: async (values) => {
      setLoading(true);
      const { name, prompt } = values;
      const params = {
        model: values.model,
        presence_penalty: Number(values.presence_penalty),
        max_tokens: Number(values.max_tokens),
        temperature: Number(values.temperature),
        ...values.variables,
      };
      await handleUpdateMask(
        mask.category_id as string,
        mask._id,
        name,
        prompt,
        {
          description: values.description,
          extra_parameters: params,
        },
      );
      setLoading(false);
      handleCloseModel();
    },
  });

  const handleUpdateMask = async (
    categoryId: string,
    prompt_id: string,
    name: string,
    prompt: string,
    extra: Partial<Prompt>,
  ) => {
    try {
      const mask = await updatePrompt(
        categoryId,
        prompt_id,
        name,
        prompt,
        extra,
      );
      toast({
        title: `用户自定义模式更新成功。 `,
        status: 'success',
        position: 'top',
        isClosable: true,
      });
      mutateService(getProjectMaskPrompts);
      mutateService(getMaskPrompts);
      changeMask(mask);
    } catch (error) {
      console.error(error);
      toast({
        title: toastErrorMessage(error as Error),
        status: 'error',
        position: 'top',
        isClosable: true,
      });
    }
  };

  const handleValidatePromoptSlot = React.useCallback(() => {
    const prompt = formik.values.prompt;
    const knowledgeRegex = /{{%knowledge%}}/g;
    const fileRegex = /{{%file%}}/g;
    const codebaseRegex = /{{%codebase%}}/g;

    const hasKnowledgeSlot = knowledgeRegex.test(prompt);
    const hasFileSlot = fileRegex.test(prompt);
    const hasCodebaseSlot = codebaseRegex.test(prompt);
    if (!hasKnowledgeSlot) {
      formik.setFieldValue('variables.knowledge', null);
    } else if (
      hasKnowledgeSlot &&
      !formik.values.variables[VariableType.Knowledge]?.code
    ) {
      formik.setFieldValue(
        'variables.knowledge',
        DEFAULT_FORM_VALUES.variables[VariableType.Knowledge],
      );
    }
    if (!hasFileSlot) {
      formik.setFieldValue('variables.file', null);
    } else if (
      hasFileSlot &&
      !formik.values.variables[VariableType.File]?.paths
    ) {
      formik.setFieldValue(
        'variables.file',
        DEFAULT_FORM_VALUES.variables[VariableType.File],
      );
    }
    if (!hasCodebaseSlot) {
      formik.setFieldValue('variables.codebase', null);
    } else if (
      hasCodebaseSlot &&
      !formik.values.variables[VariableType.Codebase]?.code
    ) {
      formik.setFieldValue(
        'variables.codebase',
        DEFAULT_FORM_VALUES.variables[VariableType.Codebase],
      );
    }
    setRenderDocsetRow(hasKnowledgeSlot);
    setRenderFileRow(hasFileSlot);
    setRenderCodebaseRow(hasCodebaseSlot);
  }, [formik]);

  React.useEffect(() => {
    if (!initialRef.current) {
      formik.resetForm();
      handleValidatePromoptSlot();
      initialRef.current = true;
    }
  }, [formik, handleValidatePromoptSlot]);

  const removeSlot = (slot: string) => {
    const prompt = formik.values.prompt;
    const nextPrompt = prompt.replace(`{{%${slot}%}}`, '');
    formik.setFieldValue('prompt', nextPrompt);
  };

  const handleCloseModel = () => {
    formik.resetForm();
    initialRef.current = false;
    onClose();
  };

  const handleOpenPromptDoc = () => {
    postMessage({
      type: BroadcastActions.OPEN_IN_BROWSER,
      data: { url: PROJECT_MASK_MANAGE_DOC_URL },
    });
  };

  return (
    <Modal
      size="full"
      trapFocus={false}
      isOpen={isOpen}
      closeOnEsc={false}
      onClose={handleCloseModel}
      scrollBehavior="inside"
    >
      <form onSubmit={formik.handleSubmit}>
        <ModalOverlay />
        <ModalContent className="chat-typeahead-inner-element">
          <ModalHeader>
            <Flex gap={2} alignItems="center">
              <IconButton
                aria-label="back"
                icon={<TbChevronLeft />}
                mr={2}
                onClick={handleCloseModel}
              />
              <Text>修改自定义聊天模式</Text>
            </Flex>
          </ModalHeader>
          <Divider size="lg" />
          <ModalBody>
            <Flex py={4} px={0} flexDirection="column" gap={3}>
              <Text>
                为整个会话增加 Prompt，可以保持 Code Chat 的上下文一致
              </Text>
              <Grid gap={4}>
                <Box>
                  <FormControl isRequired>
                    <FormLabel>模式名</FormLabel>
                  </FormControl>
                  <Input
                    name="name"
                    value={formik.values.name}
                    onChange={formik.handleChange}
                    onInput={formik.handleChange}
                  />
                </Box>
                <Box>
                  <FormControl>
                    <FormLabel>模式简介</FormLabel>
                  </FormControl>
                  <Input
                    name="description"
                    value={formik.values.description}
                    onChange={formik.handleChange}
                    onInput={formik.handleChange}
                  />
                  <Text fontSize="sm" opacity={0.6}>
                    简要说明模式的用途，会展示在模式选项下
                  </Text>
                </Box>
                <Box>
                  <FormControl isRequired>
                    <FormLabel>Prompt 内容</FormLabel>
                    <Textarea
                      name="prompt"
                      rows={10}
                      value={formik.values.prompt}
                      onChange={formik.handleChange}
                      onInput={formik.handleChange}
                      onBlur={handleValidatePromoptSlot}
                    />
                  </FormControl>
                  <Text fontSize="sm">
                    <Text opacity={0.6} display="inline">
                      给 Chat 一个上下文语境，如角色、场景、问题背景。支持多种
                    </Text>
                    <Popover>
                      <PopoverTrigger>
                        <Text
                          display="inline"
                          color="blue.200"
                          cursor="pointer"
                        >
                          参数占位符
                        </Text>
                      </PopoverTrigger>
                      <PopoverContent minW="480px">
                        <PopoverArrow />
                        <PopoverBody width="100%">
                          <PromptVariableTooltip />
                        </PopoverBody>
                      </PopoverContent>
                    </Popover>
                  </Text>
                </Box>
                <Box>
                  <FormControl isRequired mt={4}>
                    <FormLabel>Prompt 参数</FormLabel>
                    <Text fontSize="sm" opacity={0.6}>
                      可配置系统参数默认值，并通过 {'{{%参数名%}}'} 引用
                    </Text>
                  </FormControl>
                  <TableContainer my={4} overflowY="unset" overflowX="unset">
                    <Table size="sm">
                      <Thead>
                        <Tr>
                          <Th color="white">参数名</Th>
                          <Th color="white">默认值</Th>
                          <Th w="160px" color="white">
                            说明
                          </Th>
                          <Th px={0}></Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {renderDocsetRow && (
                          <Tr>
                            <Td>knowledge</Td>
                            <Td>
                              <DocsetSelect
                                value={
                                  formik.values.variables[
                                    VariableType.Knowledge
                                  ]?.code || ''
                                }
                                onChange={(v) =>
                                  formik.setFieldValue(
                                    'variables.knowledge.code',
                                    v,
                                  )
                                }
                              />
                            </Td>
                            <Td>
                              <Input
                                name="variables.knowledge.description"
                                value={
                                  formik.values.variables[
                                    VariableType.Knowledge
                                  ]?.description || ''
                                }
                                onChange={formik.handleChange}
                                onInput={formik.handleChange}
                              />
                            </Td>
                            <Td px={0}>
                              <IconButton
                                aria-label="删除"
                                variant="ghost"
                                icon={<Icon as={RiDeleteBinLine} />}
                                color="text.default"
                                onClick={() => {
                                  setRenderDocsetRow(false);
                                  removeSlot(VariableType.Knowledge);
                                }}
                              />
                            </Td>
                          </Tr>
                        )}
                        {renderFileRow && (
                          <Tr>
                            <Td>file</Td>
                            <Td>
                              <WorkspaceFileSelect
                                value={
                                  formik.values.variables[VariableType.File]
                                    ?.paths || []
                                }
                                onChange={(v) => {
                                  formik.setFieldValue(
                                    'variables.file.paths',
                                    v.map((v) => v),
                                  );
                                }}
                              />
                            </Td>
                            <Td>
                              <Input
                                id="variables.file.description"
                                name="variables.file.description"
                                value={
                                  formik.values.variables[VariableType.File]
                                    ?.description || ''
                                }
                                onChange={formik.handleChange}
                                onInput={formik.handleChange}
                              />
                            </Td>
                            <Td px={0}>
                              <IconButton
                                aria-label="删除"
                                variant="ghost"
                                icon={<Icon as={RiDeleteBinLine} />}
                                color="text.default"
                                onClick={() => {
                                  setRenderFileRow(false);
                                  removeSlot(VariableType.File);
                                }}
                              />
                            </Td>
                          </Tr>
                        )}
                        {renderCodebaseRow && (
                          <Tr>
                            <Td>codebase</Td>
                            <Td>
                              <CodebaseSelect
                                value={
                                  formik.values.variables[VariableType.Codebase]
                                    ?.code || ''
                                }
                                onChange={(v) => {
                                  formik.setFieldValue(
                                    'variables.codebase.code',
                                    v?.value || '',
                                  );
                                }}
                              />
                            </Td>
                            <Td>
                              <Input
                                name="variables.codebase.description"
                                value={
                                  formik.values.variables[VariableType.Codebase]
                                    ?.description || ''
                                }
                                onChange={formik.handleChange}
                                onInput={formik.handleChange}
                              />
                            </Td>
                            <Td px={0}>
                              <IconButton
                                aria-label="删除"
                                variant="ghost"
                                icon={<Icon as={RiDeleteBinLine} />}
                                color="text.default"
                                onClick={() => {
                                  setRenderCodebaseRow(false);
                                  removeSlot(VariableType.Codebase);
                                }}
                              />
                            </Td>
                          </Tr>
                        )}
                      </Tbody>
                    </Table>
                  </TableContainer>
                </Box>
                <Box>
                  <FormControl isRequired>
                    <FormLabel>使用权限</FormLabel>
                    <RadioGroup
                      mb={4}
                      name="type"
                      isDisabled
                      value={formik.values.type}
                      onChange={(value) => formik.setFieldValue('type', value)}
                    >
                      <Stack direction="row">
                        <Radio value={PromptCategoryType.User}>个人</Radio>
                        <Radio value={PromptCategoryType.Project}>团队</Radio>
                      </Stack>
                    </RadioGroup>
                    {formik.values.type === PromptCategoryType.Project && (
                      <FormControl isRequired>
                        <PromptCategorySelect
                          isDisabled
                          value={formik.values.categoryId}
                          onChange={(id) =>
                            formik.setFieldValue('categoryId', id)
                          }
                        />
                        <Text fontSize="12px" opacity={0.6}>
                          选择模式归属的仓库，所有仓库成员将拥有使用权限。
                          <Button
                            fontSize="12px"
                            variant="link"
                            colorScheme="blue"
                            onClick={handleOpenPromptDoc}
                          >
                            管理仓库
                          </Button>
                        </Text>
                      </FormControl>
                    )}
                  </FormControl>
                </Box>
                <Box>
                  <FormControl>
                    <FormLabel>使用模型</FormLabel>
                    <Select
                      name="model"
                      value={
                        formik.values.model
                          ? {
                            label: chatModels[formik.values.model].title,
                            value: formik.values.model,
                          }
                          : undefined
                      }
                      onChange={(v) => {
                        formik.setFieldValue('model', v?.value);
                      }}
                      placeholder="请选择"
                      options={Object.keys(chatModels).map((model) => ({
                        label: chatModels[model].title,
                        value: chatModels[model].code,
                      }))}
                      components={{
                        DropdownIndicator: () => (
                          <div className="mr-4">
                            <Icon
                              as={RiArrowDownSLine}
                              size="xs"
                              color="text.default"
                            />
                          </div>
                        ),
                        IndicatorSeparator: () => null,
                      }}
                    ></Select>
                    <Text fontSize="sm" opacity={0.6}>
                      不同模型会影响回答效果，未设置时默认使用当前用户全局 Chat
                      配置
                    </Text>
                  </FormControl>
                </Box>
                <Box>
                  <FormControl>
                    <FormLabel>随机性</FormLabel>
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
                        <SliderThumb boxSize={4} zIndex={0} />
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
                    <Text fontSize="sm" opacity={0.6}>
                      temperature，值越大，回复越随机，大于 1 的值可能会导致乱码
                    </Text>
                  </FormControl>
                </Box>
                <Box>
                  <FormControl>
                    <FormLabel>话题新鲜度</FormLabel>
                    <Flex gap={4}>
                      <Slider
                        name="presence_penalty"
                        min={-2}
                        max={2}
                        step={0.1}
                        value={formik.values.presence_penalty}
                        onChange={(value) =>
                          formik.setFieldValue(
                            'presence_penalty',
                            Number(value),
                          )
                        }
                      >
                        <SliderTrack>
                          <Box position="relative" right={10} />
                          <SliderFilledTrack />
                        </SliderTrack>
                        <SliderThumb boxSize={4} zIndex={0} />
                      </Slider>
                      <NumberInput
                        min={-2}
                        max={2}
                        step={0.1}
                        maxW="80px"
                        value={formik.values.presence_penalty}
                        onChange={(value) =>
                          formik.setFieldValue(
                            'presence_penalty',
                            Number(value),
                          )
                        }
                      >
                        <NumberInputField pattern="(-)?[0-9]*(.[0-9]+)?" />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </Flex>
                    <Text fontSize="sm" opacity={0.6}>
                      present_penalty，值越大，越有可能拓展到新话题
                    </Text>
                  </FormControl>
                </Box>
                <Box>
                  <FormControl>
                    <FormLabel>单次回复限制</FormLabel>
                    <Input
                      type="number"
                      name="max_tokens"
                      value={formik.values.max_tokens}
                      onChange={formik.handleChange}
                      onInput={formik.handleChange}
                      placeholder="请输入"
                      min={CHAT_MIN_TOKENS}
                      max={CHAT_MAX_TOKENS}
                    />
                    <Text fontSize="sm" opacity={0.6}>
                      max_token，单次与模型交互所用的最大 Token
                      数，值越大，可输入的 Token 数越少
                    </Text>
                  </FormControl>
                </Box>
              </Grid>
            </Flex>
          </ModalBody>
          <ModalFooter justifyContent="center" gap={4}>
            <Button
              colorScheme="blue"
              color="white"
              type="submit"
              isLoading={loading}
            >
              保存
            </Button>
            <Button onClick={handleCloseModel}>取消</Button>
          </ModalFooter>
        </ModalContent>
      </form>
    </Modal>
  );
}

export function ChatRemoveMaskModel(props: Required<ChatMaskModelProps>) {
  const { isOpen, mask, onClose } = props;
  const maskConfig = useMaskStore((state) => state.config);
  const { toast } = useCustomToast();
  const handleRemoveMask = async (id: string) => {
    if (!maskConfig.categoryId) {
      toastUserPromptCategoryWithoutInit();
      return;
    }
    try {
      await removePrompt(maskConfig.categoryId, id);
      toast({
        title: `用户自定义模式删除成功。 `,
        status: 'success',
        position: 'top',
        isClosable: true,
      });
      mutateService(getMaskPrompts);
      mutateService(getProjectMaskPrompts);
    } catch (error) {
      console.error(error);
      toast({
        title: toastErrorMessage(error as Error),
        status: 'error',
        position: 'top',
        isClosable: true,
      });
    }
  };

  const handleSubmit = async () => {
    await handleRemoveMask(mask._id);
    onClose();
  };

  return (
    <Modal size="full" trapFocus={false} isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent className="chat-typeahead-inner-element">
        <ModalHeader>
          <Flex gap={2} alignItems="center">
            <IconButton
              aria-label="back"
              icon={<TbChevronLeft />}
              mr={2}
              onClick={onClose}
            />
            <Text>删除自定义聊天模式</Text>
          </Flex>
        </ModalHeader>
        <Divider size="lg" />
        <ModalBody>
          <Flex py={4} flexDirection="column" gap={6}>
            <Text>确定删除该模式吗？</Text>
            <Flex gap={2}>
              <Button colorScheme="blue" color="white" onClick={handleSubmit}>
                确定
              </Button>
              <Button onClick={onClose}>取消</Button>
            </Flex>
          </Flex>
        </ModalBody>
        <ModalFooter justifyContent="center" gap={4}></ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export function ChatConfirmMaksModel(props: {
  isOpen: boolean;
  mask: ChatMask;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { mask, isOpen, onConfirm, onClose } = props;
  const isStreaming = useChatStreamStore((state) => state.isStreaming);
  const isSearching = useChatStreamStore((state) => state.isSearching);
  const streamingState = isStreaming || isSearching;

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>切换聊天模式</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {streamingState && 'Y3Maker 正在回复中, '}
          确定{streamingState && '中止回复并'}切换为{' '}
          <strong>{mask.name}</strong> 吗？
        </ModalBody>

        <ModalFooter>
          <Button colorScheme="blue" mr={3} onClick={onConfirm}>
            确定
          </Button>
          <Button onClick={onClose}>取消</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function PromptVariableTooltip() {
  const CODEBASE_DOC_URL = 'https://github.com/user/codemaker';
  const BRAINMAKER_DOC_URL = 'https://github.com/user/codemaker';
  const { postMessage } = usePostMessage();

  const handleOpenDocUrl = (url: string) => {
    postMessage({
      type: BroadcastActions.OPEN_IN_BROWSER,
      data: { url },
    });
  };

  return (
    <Box>
      <UnorderedList>
        <ListItem>
          <CopyButton content={COMMON_VARIABLE.code}>
            <code>{COMMON_VARIABLE.code}</code>
          </CopyButton>
          : 引用所选代码作为上下文
        </ListItem>
        <ListItem>
          <CopyButton content={COMMON_VARIABLE.knowledge}>
            <code>{COMMON_VARIABLE.knowledge}</code>
          </CopyButton>
          : 引用所选 Brainmaker 数据集检索片段作为上下文，
          <Link
            color="blue.200"
            onClick={() => handleOpenDocUrl(BRAINMAKER_DOC_URL)}
          >
            了解BrainMaker
          </Link>
        </ListItem>
        <ListItem>
          <CopyButton content={COMMON_VARIABLE.file}>
            <code>{COMMON_VARIABLE.file}</code>
          </CopyButton>
          : 引用所选本地文件内容作为上下文
        </ListItem>
        <ListItem>
          <CopyButton content={COMMON_VARIABLE.codebase}>
            <code>{COMMON_VARIABLE.codebase}</code>
          </CopyButton>
          : 引用所选代码地图搜索出来的Top5片段内容作为上 下文，
          <Link
            color="blue.200"
            onClick={() => handleOpenDocUrl(CODEBASE_DOC_URL)}
          >
            了解Codebase
          </Link>
        </ListItem>
        <ListItem>
          <CopyButton content={INNER_VARIABLE.__USER__}>
            <code>{INNER_VARIABLE.__USER__}</code>
          </CopyButton>
          : 获取当前用户名
        </ListItem>
        <ListItem>
          <CopyButton content={INNER_VARIABLE.__DATETIME__}>
            <code>{INNER_VARIABLE.__DATETIME__}</code>
          </CopyButton>
          : 获取prompt执行时的系统时间，如 2024-01-01 10:00:00
        </ListItem>
      </UnorderedList>
    </Box>
  );
}
