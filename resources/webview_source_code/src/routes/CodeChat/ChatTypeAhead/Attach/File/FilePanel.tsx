import * as React from 'react';
import { Box, Flex, VStack, Text, Spinner, Grid, Tooltip } from '@chakra-ui/react';
import { TypeAheadModePrefix, TypeAheadSubProps } from '../../const';
import { getListIndex, scrollToFocusItem } from '../../utils';
import TypeAheadRowItem from '../../TypeAheadRowItem';
import { useChatAttach, useChatStore } from '../../../../../store/chat';
import { AttachType } from '../../../../../store/attaches';
import {
  BroadcastActions,
  PostMessageSubscribeType,
  SubscribeActions,
  usePostMessage,
} from '../../../../../PostMessageProvider';
import { FileItem, AttachFile, IMultiAttachment } from '../../../../../store/chat';
import { debounce } from 'lodash';
import AttachIcon from '../AttachIcon';
import AttachActionBar from '../AttachActionBar';
import { checkValueOfPressedKeyboard } from '../../../../../utils';
import { useChatConfig } from '../../../../../store/chat-config';
import { useAuthStore } from '../../../../../store/auth';
import { toastError } from '../../../../../services/error';
import { useSelecteFileAttach } from '../Hooks/useSelectFileAttach';

function FileSelectorPanel(props: TypeAheadSubProps) {
  const {
    inputValue,
    focusIndex,
    userInputRef,
    mentionKeyword,
    updateOpenState,
    resetAttachType,
  } = props;
  const { postMessage } = usePostMessage();
  const listRef = React.useRef<HTMLDivElement>(null);
  const attachs = useChatAttach((state) => state.attachs);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [fileOptions, setFileOptions] = React.useState<FileItem[]>([]);
  const chatType = useChatStore((state) => state.chatType);
  const chatModels = useChatConfig((state) => state.chatModels);

  const selectedFileHook = useSelecteFileAttach()
  const [model] = useChatConfig(state => [state.config.model]);
  const [c_unrestrict] = useAuthStore(state => [state.authExtends.c_unrestrict]);
  const shiftKeyPressedRef = React.useRef<boolean>(false);
  const isShiftSelectingRef = React.useRef<boolean>(false); // 标记是否正在Shift多选

  // 监听全局 Shift 键状态
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        shiftKeyPressedRef.current = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        shiftKeyPressedRef.current = false;
        // Shift键释放时，重置多选标记
        isShiftSelectingRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  React.useEffect(() => {
    async function handleMessage(
      event: MessageEvent<PostMessageSubscribeType>,
    ) {
      const eventData = event.data as any;
      if (eventData?.type === SubscribeActions.WORKSPACE_FILES) {
        setLoading(false);
        const files = eventData.data || [];
        setFileOptions(files);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const filterFileOptions = React.useMemo(() => {
    if (!fileOptions.length) return [];
    if (!attachs) return fileOptions;

    const { attachFiles } = attachs as AttachFile;
    let selectedPath: string[] = [];
    if (attachFiles && Array.isArray(attachFiles)) {
      selectedPath = attachFiles.map((i) => i.path);
    } else if (attachs.attachType === AttachType.MultiAttachment) {
      // 从 MultiAttachment 的 dataSource 中提取已选中的文件路径
      // 只过滤掉 isCurrent 为 true 的文件，这些是通过其他方式添加的附件
      const multiAttach = attachs as IMultiAttachment;
      selectedPath = multiAttach.dataSource
        .filter((item) => item.attachType === AttachType.File && (item as FileItem).isCurrent)
        .map((item) => (item as FileItem).path);
    }
    return fileOptions.filter((file) => {
      return !selectedPath.includes(file.path);
    });
  }, [fileOptions, attachs]);

  const currentIndex = React.useMemo(
    () => getListIndex(filterFileOptions, focusIndex),
    [focusIndex, filterFileOptions],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleFetchWrokspaceFiles = React.useCallback(
    debounce((keyword = '') => {
      if (chatType === 'codebase') {
        setLoading(true);
        postMessage({
          type: BroadcastActions.SEARCH_WORKSPACE_PATH,
          data: { keyword, max: 10, type: 'file' },
        });
      } else {
        setLoading(true);
        postMessage({
          type: BroadcastActions.GET_WORKSPACE_FILES,
          data: { keyword, max: 8 },
        });
      }
    }, 500),
    [postMessage, chatType],
  );

  React.useEffect(() => {
    // 如果正在进行Shift多选，跳过搜索触发
    if (isShiftSelectingRef.current) {
      return;
    }

    if (!inputValue) {
      handleFetchWrokspaceFiles('');
    } else {
      handleFetchWrokspaceFiles(mentionKeyword);
    }
  }, [inputValue, handleFetchWrokspaceFiles, mentionKeyword]);


  const handleSelectFile = React.useCallback(
    (file: FileItem, _index: number, event?: React.MouseEvent | React.KeyboardEvent) => {
      const fileExt = file.fileName ? file.fileName.split('.').pop() : '';
      if ((fileExt === 'c' || fileExt === 'h') && !c_unrestrict && !chatModels[model]?.isPrivate) {
        toastError('出于安全考虑，该文件仅支持在私有部署模型上发送');
        return;
      }

      // 检查是否按住 Shift 键
      // 优先使用事件中的 shiftKey，如果没有则使用全局键盘状态
      const isShiftPressed = event?.shiftKey ?? shiftKeyPressedRef.current;

      // 如果按Shift，标记为正在进行Shift多选
      if (isShiftPressed) {
        isShiftSelectingRef.current = true;
      }

      // 选择当前文件，总是填充到输入框
      selectedFileHook.selectFileAttaches([file], true, true);

      // Shift键只控制是否关闭弹窗
      if (!isShiftPressed) {
        // 不按Shift：关闭面板
        updateOpenState(false);
      }
      // 按Shift：保持面板打开，可以继续选择其他文件
    },
    [c_unrestrict, chatModels, model, selectedFileHook, updateOpenState],
  );

  React.useEffect(() => {
    if (listRef.current) {
      scrollToFocusItem(listRef.current, currentIndex);
    }
  }, [currentIndex, c_unrestrict, model]);

  React.useEffect(() => {
    const element = userInputRef?.current;
    function addEnterEventLinstener(event: KeyboardEvent) {
      if (checkValueOfPressedKeyboard(event, ['Enter'])) {
        const currentSelectedFile = filterFileOptions[currentIndex];
        if (currentSelectedFile) {
          // 传递键盘事件，以便正确检测Shift键状态
          handleSelectFile(currentSelectedFile, currentIndex, event as any);
          event.stopPropagation();
          event.preventDefault();
        }
      }
    }

    element?.addEventListener('keydown', addEnterEventLinstener);
    return () => {
      element?.removeEventListener('keydown', addEnterEventLinstener);
    };
  }, [currentIndex, handleSelectFile, filterFileOptions, userInputRef]);

  return (
    <>
      <Box flex={1} w="100%" p={2} bg="themeBgColor">
        <VStack
          pr={2}
          align="stretch"
          maxH="calc(100vh - 400px)"
          minH="80px"
          overflowY="scroll"
          ref={listRef}
        >
          <FileList
            loading={loading}
            files={filterFileOptions}
            currentIndex={currentIndex}
            searchKeyword={mentionKeyword}
            onSelect={handleSelectFile}
          />
        </VStack>
        {
          chatType !== 'codebase' ? (
            <Box className="mt-2">
              <AttachActionBar onBack={resetAttachType} type="file" />
            </Box>
          ) : (
            <Text className="mt-2" fontSize="xs" color="text.default">
              默认显示工作区打开的文件，输入关键字进行检索
            </Text>
          )
        }
      </Box>
    </>
  );
}

function FileList(props: {
  loading: boolean;
  files: FileItem[];
  currentIndex: number;
  searchKeyword: string;
  onSelect: (file: FileItem, index: number, event?: React.MouseEvent | React.KeyboardEvent) => void;
}) {
  const { loading, files, currentIndex, onSelect, searchKeyword } = props;
  if (loading) {
    return (
      <Flex w="full" h="full" p={4} justifyContent="center">
        <Spinner size="md" />
      </Flex>
    );
  }

  if (searchKeyword.startsWith(TypeAheadModePrefix.Attach)) {
    if (searchKeyword === TypeAheadModePrefix.Attach && !files.length) {
      return (
        <Flex w="full" h="100px" alignItems="center" justifyContent="center">
          <Box>请输入文件名搜索更多可引用的工作区文件</Box>
        </Flex>
      );
    } else if (searchKeyword !== TypeAheadModePrefix.Attach && !files.length) {
      return (
        <Flex w="full" h="100px" justifyContent="center" alignItems="center">
          <Box>无匹配的可引用文件，请检查文件是否存在或新建文件</Box>
        </Flex>
      );
    }
  }

  return files.map((file, index) => {
    return (
      <TypeAheadRowItem
        key={file.path}
        index={index}
        currentIndex={currentIndex}
        onClick={(e) => onSelect(file, index, e)}
      >
        <Tooltip label={file.path} placement='top'>
          <Grid
            position="relative"
            textAlign="left"
            w="full"
            h="full"
            py={2}
            color={currentIndex === index ? 'white' : 'text.primary'}
            display="flex"
            alignItems="center"
            gap="2"
          >
            {
              file.path.endsWith('/')
                ? <AttachIcon attachType={AttachType.Folder} />
                : <AttachIcon attachType={AttachType.File} />
            }
            <Text fontSize="sm" isTruncated>
              {file.fileName + `（${file.path}）`}
            </Text>
            {
              file?.isActive && (
                <Text
                  border={'1px solid #fff'}
                  borderRadius={'4px'}
                  padding={'2px 4px'}
                  whiteSpace={'nowrap'}
                  fontSize={12}
                  color={'text.primary'}
                >
                  当前
                </Text>
              )
            }
          </Grid>
        </Tooltip>
      </TypeAheadRowItem>
    );
  });
}

export default FileSelectorPanel;
