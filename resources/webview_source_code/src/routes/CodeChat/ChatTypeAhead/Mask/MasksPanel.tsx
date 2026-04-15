import * as React from 'react';
import {
  Flex,
  VStack,
  Grid,
  IconButton,
  Tooltip,
  Text,
} from '@chakra-ui/react';
import { TbPlus } from 'react-icons/tb';
import { LuAirplay, LuBox, LuUser } from 'react-icons/lu';
import {
  Prompt,
  PromptCategoryType,
  maskTypeNameMap,
} from '../../../../services/prompt';
import Icon from '../../../../components/Icon';
import MaskList from './MaskList';
import {
  ChatEditMaskModel,
  ChatNewMaskModel,
  ChatNewMaskModelHandle,
  ChatRemoveMaskModel,
} from '../../ChatMaskSelector/ChatMaskManageModel';
import { TypeAheadSubProps } from '../const';
import { useMaskStore } from '../../../../store/mask';
import {
  MaskSampleFormValue,
  useChatActionStore,
} from '../../../../store/chatAction';

function MasksPanel(
  props: TypeAheadSubProps & {
    focusedType: PromptCategoryType | undefined;
  },
) {
  const { focusedType } = props;
  const [maskType, setMaskType] = React.useState<
    PromptCategoryType | undefined
  >(focusedType || undefined);
  const [isOpenNewMaskModel, setIsOpenNewMaskModel] = React.useState(false);
  const [currentHandleMask, setCurrentHandleMask] = React.useState<Prompt>();
  const [isOpenEditMaskModel, setIsOpenEditMaskModel] = React.useState(false);
  const [isOpenRemoveMaskModel, setIsOpenRemoveMaskModel] =
    React.useState(false);
  const promptsBodyRef = React.useRef<HTMLDivElement>(null);
  const masks = useMaskStore((state) => state.maskList);

  const setCustomMaskSampleCallback = useChatActionStore(
    (state) => state.setCustomMaskSampleCallback,
  );
  const newMaskModelRef = React.useRef<ChatNewMaskModelHandle>(null);

  const renderMasks = React.useMemo(() => {
    if (!masks) {
      return [];
    }

    let _masks = masks;
    if (maskType) {
      _masks = masks.filter((item) => item.type === maskType);
    }

    return _masks;
  }, [maskType, masks]);

  const handleEditPrompt = (prompt: Prompt) => {
    setCurrentHandleMask(prompt);
    setIsOpenEditMaskModel(true);
  };

  const handleRemovePrompt = (prompt: Prompt) => {
    setCurrentHandleMask(prompt);
    setIsOpenRemoveMaskModel(true);
  };

  const handleChangeMaskType = (type: PromptCategoryType) => {
    if (maskType === type) {
      setMaskType(undefined);
    } else {
      setMaskType(type);
    }
  };

  const triggerCustomMaskSample = React.useCallback(
    (formValue: MaskSampleFormValue) => {
      setIsOpenNewMaskModel(true);
      setCurrentHandleMask(undefined);
      setTimeout(() => {
        if (newMaskModelRef.current) {
          newMaskModelRef.current.setFormValue({
            ...formValue,
          });
        }
      });
    },
    [],
  );

  React.useEffect(() => {
    setCustomMaskSampleCallback(triggerCustomMaskSample);
  }, [triggerCustomMaskSample, setCustomMaskSampleCallback]);

  return (
    <>
      <Flex
        flexDirection="column"
        justifyContent="space-between"
        p={2}
        gap={2}
        backgroundColor="themeBgColor"
      >
        <Flex flexDirection="column" gap={2}>
          <Tooltip label="公共" placement="right">
            <IconButton
              fontSize="xl"
              aria-label="codemaker"
              colorScheme={
                maskType === PromptCategoryType._CodeMaker ? 'blue' : undefined
              }
              color={
                maskType === PromptCategoryType._CodeMaker
                  ? 'white'
                  : 'text.primary'
              }
              border="1px solid"
              borderColor="customBorder"
              bg={
                maskType === PromptCategoryType._CodeMaker
                  ? 'blue.300'
                  : 'buttonBgColor'
              }
              icon={<Icon as={LuAirplay} size="md" />}
              onClick={() =>
                handleChangeMaskType(PromptCategoryType._CodeMaker)
              }
            />
          </Tooltip>
          <Tooltip label="团队" placement="right">
            <IconButton
              fontSize="xl"
              aria-label="project"
              colorScheme={
                maskType === PromptCategoryType.Project ? 'blue' : undefined
              }
              color={
                maskType === PromptCategoryType.Project
                  ? 'white'
                  : 'text.primary'
              }
              border="1px solid"
              borderColor="customBorder"
              bg={
                maskType === PromptCategoryType.Project
                  ? 'blue.300'
                  : 'buttonBgColor'
              }
              icon={<Icon as={LuBox} size="md" />}
              onClick={() => handleChangeMaskType(PromptCategoryType.Project)}
            />
          </Tooltip>
          <Tooltip label="我的" placement="right">
            <IconButton
              fontSize="xl"
              aria-label="user"
              colorScheme={
                maskType === PromptCategoryType.User ? 'blue' : undefined
              }
              color={
                maskType === PromptCategoryType.User ? 'white' : 'text.primary'
              }
              border="1px solid"
              borderColor="customBorder"
              bg={
                maskType === PromptCategoryType.User
                  ? 'blue.300'
                  : 'buttonBgColor'
              }
              icon={<Icon as={LuUser} size="md" />}
              onClick={() => handleChangeMaskType(PromptCategoryType.User)}
            />
          </Tooltip>
        </Flex>
        <Flex>
          <Tooltip label="自定义模式" placement="right">
            <IconButton
              fontSize="xl"
              aria-label="add"
              icon={<Icon as={TbPlus} size="md" />}
              border="1px solid"
              borderColor="customBorder"
              bg="buttonBgColor"
              onClick={() => {
                setIsOpenNewMaskModel(true);
                setCurrentHandleMask(undefined);
              }}
            />
          </Tooltip>
        </Flex>
      </Flex>
      <Grid
        w="full"
        p={2}
        h="256px"
        gridTemplateRows="auto 1fr"
        backgroundColor="themeBgColor"
      >
        {maskType && (
          <Flex mb={2} placeContent="space-between">
            <Text p={1} pb={2} fontSize="sm">
              {maskTypeNameMap[maskType]}
            </Text>
          </Flex>
        )}
        <VStack
          pr={2}
          align="stretch"
          gap="2"
          minH="80px"
          overflowY="scroll"
          ref={promptsBodyRef}
        >
          <MaskList
            {...props}
            loading={false}
            prompts={renderMasks}
            onEdit={handleEditPrompt}
            onRemove={handleRemovePrompt}
          />
        </VStack>
      </Grid>
      <ChatNewMaskModel
        ref={newMaskModelRef}
        isOpen={isOpenNewMaskModel}
        onClose={() => setIsOpenNewMaskModel(false)}
      />
      {currentHandleMask && (
        <>
          <ChatEditMaskModel
            key={currentHandleMask._id}
            mask={currentHandleMask}
            isOpen={isOpenEditMaskModel}
            onClose={() => {
              setIsOpenEditMaskModel(false);
              setCurrentHandleMask(undefined);
            }}
          />
          <ChatRemoveMaskModel
            mask={currentHandleMask}
            isOpen={isOpenRemoveMaskModel}
            onClose={() => {
              setIsOpenRemoveMaskModel(false);
              setCurrentHandleMask(undefined);
            }}
          />
        </>
      )}
    </>
  );
}

export default MasksPanel;
