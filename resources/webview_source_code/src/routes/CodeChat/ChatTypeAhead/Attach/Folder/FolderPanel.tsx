import * as React from 'react';
import { Box, Flex, VStack, Text, Spinner, Grid } from '@chakra-ui/react';
import { TypeAheadModePrefix, TypeAheadSubProps } from '../../const';
import { getListIndex, scrollToFocusItem } from '../../utils';
import TypeAheadRowItem from '../../TypeAheadRowItem';
import { useChatAttach } from '../../../../../store/chat';
import { AttachType } from '../../../../../store/attaches';
import {
  BroadcastActions,
  PostMessageSubscribeType,
  SubscribeActions,
  usePostMessage,
} from '../../../../../PostMessageProvider';
import { FolderItem, AttachFile } from '../../../../../store/chat';
import { debounce } from 'lodash';
import AttachIcon from '../AttachIcon';
import { checkValueOfPressedKeyboard } from '../../../../../utils';
import { useSelectedFolderAttach } from '../Hooks/useSelectFolderAttach';

function FolderSelectorPanel(props: TypeAheadSubProps) {
  const {
    inputValue,
    focusIndex,
    userInputRef,
    mentionKeyword,
    updateOpenState
  } = props;
  const { postMessage } = usePostMessage();
  const listRef = React.useRef<HTMLDivElement>(null);
  const attachs = useChatAttach((state) => state.attachs);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [folderOptions, setFolderOptions] = React.useState<FolderItem[]>([]);
  const selectedFolderHook = useSelectedFolderAttach()
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
        setFolderOptions(files);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const filterFolderOptions = React.useMemo(() => {
    if (!folderOptions.length) return [];
    if (!attachs) return folderOptions;
    const { attachFiles } = attachs as AttachFile;
    const selectedPath = (attachFiles || [])?.map((i) => i.path);
    return folderOptions.filter((file) => {
      return !selectedPath.includes(file.path);
    });
  }, [folderOptions, attachs]);

  const currentIndex = React.useMemo(
    () => getListIndex(filterFolderOptions, focusIndex),
    [focusIndex, filterFolderOptions],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleFetchWrokspaceFolders = React.useCallback(
    debounce((keyword = '') => {
      setLoading(true);
      postMessage({
        type: BroadcastActions.SEARCH_WORKSPACE_PATH,
        data: { keyword, max: 10, type: 'folder' },
      });
    }, 500),
    [postMessage],
  );

  React.useEffect(() => {
    // 如果正在进行Shift多选，跳过搜索触发
    if (isShiftSelectingRef.current) {
      return;
    }

    if (!inputValue) {
      handleFetchWrokspaceFolders('');
    } else {
      handleFetchWrokspaceFolders(mentionKeyword);
    }
  }, [inputValue, handleFetchWrokspaceFolders, mentionKeyword]);


  const handleSelectFolder = React.useCallback(
    (folder: FolderItem, _index: number, event?: React.MouseEvent | React.KeyboardEvent) => {
      // 检查是否按住 Shift 键
      // 优先使用事件中的 shiftKey，如果没有则使用全局键盘状态
      const isShiftPressed = event?.shiftKey ?? shiftKeyPressedRef.current;

      // 如果按Shift，标记为正在进行Shift多选
      if (isShiftPressed) {
        isShiftSelectingRef.current = true;
      }

      // 选择当前目录，总是填充到输入框
      selectedFolderHook.selectFolderAttaches([folder], true, true);

      // Shift键只控制是否关闭弹窗
      if (!isShiftPressed) {
        // 不按Shift：关闭面板
        updateOpenState(false);
      }
      // 按Shift：保持面板打开，可以继续选择其他目录
    },
    [selectedFolderHook, updateOpenState],
  );

  React.useEffect(() => {
    if (listRef.current) {
      scrollToFocusItem(listRef.current, currentIndex);
    }
  }, [currentIndex]);

  React.useEffect(() => {
    const element = userInputRef?.current;
    function addEnterEventLinstener(event: KeyboardEvent) {
      if (checkValueOfPressedKeyboard(event, ['Enter'])) {
        const currentSelectedFolder = filterFolderOptions[currentIndex];
        if (currentSelectedFolder) {
          // 传递键盘事件，以便正确检测Shift键状态
          handleSelectFolder(currentSelectedFolder, currentIndex, event as any);
          event.stopPropagation();
          event.preventDefault();
        }
      }
    }

    element?.addEventListener('keydown', addEnterEventLinstener);
    return () => {
      element?.removeEventListener('keydown', addEnterEventLinstener);
    };
  }, [currentIndex, handleSelectFolder, filterFolderOptions, userInputRef]);

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
          <FolderList
            loading={loading}
            folders={filterFolderOptions}
            currentIndex={currentIndex}
            searchKeyword={inputValue}
            onSelect={handleSelectFolder}
          />
        </VStack>
      </Box>
    </>
  );
}

function FolderList(props: {
  loading: boolean;
  folders: FolderItem[];
  currentIndex: number;
  searchKeyword: string;
  onSelect: (folder: FolderItem, index: number, event?: React.MouseEvent | React.KeyboardEvent) => void;
}) {
  const { loading, folders, currentIndex, onSelect, searchKeyword } = props;
  if (loading) {
    return (
      <Flex w="full" h="full" p={4} justifyContent="center">
        <Spinner size="md" />
      </Flex>
    );
  }

  if (searchKeyword.startsWith(TypeAheadModePrefix.Attach)) {
    if (searchKeyword === TypeAheadModePrefix.Attach && !folders.length) {
      return (
        <Flex w="full" h="100px" alignItems="center" justifyContent="center">
          <Box>请输入文件名搜索更多可引用的工作区文件</Box>
        </Flex>
      );
    } else if (searchKeyword !== TypeAheadModePrefix.Attach && !folders.length) {
      return (
        <Flex w="full" h="100px" justifyContent="center" alignItems="center">
          <Box>无匹配的可引用文件，请检查文件是否存在或新建文件</Box>
        </Flex>
      );
    }
  }

  return folders.map((folder, index) => {
    return (
      <TypeAheadRowItem
        key={folder.path}
        index={index}
        currentIndex={currentIndex}
        onClick={(e) => onSelect(folder, index, e)}
      >
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
            folder.path.endsWith('/')
            ? <AttachIcon attachType={AttachType.Folder} />
            : <AttachIcon attachType={AttachType.File} />
          }
          <Text fontSize="sm" isTruncated>
            {folder.fileName + `（${folder.path}）`}
          </Text>
        </Grid>
      </TypeAheadRowItem>
    );
  });
}

export default FolderSelectorPanel;

