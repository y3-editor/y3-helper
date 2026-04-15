import * as React from 'react';
import { Flex, Text, Box, VStack, Grid, Tooltip } from '@chakra-ui/react';
import { getListIndex, scrollToFocusItem } from '../utils';
import { TypeAheadSubProps, TypeAheadModePrefix } from '../const';
import DocsetSelectorPanel from './Docset/DocsetPanel';
import CodeBaseSelectorPanel from './CodeBase/CodeBasePanel';
import TypeAheadRowItem from '../TypeAheadRowItem';
import UploadImagePanel from './UploadImagePanel/UploadImagePanel';
import NetworkModelPanel from './NetworkModel/NetworkModelPanel';
import { TbChevronRight } from 'react-icons/tb';
import FileSelectorPanel from './File/FilePanel';
import { IDE, useExtensionStore } from '../../../../store/extension';
import { AttachType } from '../../../../store/attaches';
import {
  BroadcastActions,
  usePostMessage,
  PostMessageSubscribeType,
  SubscribeActions,
} from '../../../../PostMessageProvider';
import { FileItem, useChatAttach, useChatStore, FolderItem } from '../../../../store/chat';
import { GroupValue } from './CodeBase/useCodeBase';
import { nanoid } from 'nanoid';
import AttachIcon from './AttachIcon';
import {
  Docset,
  DocsetOptions,
  DocsetType,
  DocsetItem,
} from '../../../../services/docsets';
import useFirstFocusedEffect from '../../../../hooks/useFirstFocusEffect';
import FolderSelectorPanel from './Folder/FolderPanel';
import EventBus, { EBusEvent } from '../../../../utils/eventbus';
import { useSelecteFileAttach } from './Hooks/useSelectFileAttach';
import { useSelectedFolderAttach } from './Hooks/useSelectFolderAttach';
import { useSelectDocsetAttach } from './Hooks/useSelectDocsetAttach';
import { useSelectCodebaseAttach } from './Hooks/useSelectCodebaseAttach';
import { useChatConfig } from '../../../../store/chat-config';
import RuleSelectorPanel from './Rule/RulePanel';

// 暂时改名为 DEFAULT_ATTACH_OPTIONS，下面根据ide调整选项
const DEFAULT_ATTACH_OPTIONS = [
  // {
  //   _id: AttachType.NetworkModel,
  //   key: '联网',
  // },
  {
    _id: AttachType.File,
    key: '文件',
  }
];

const CODEBASE_ATTACH_OPTIONS = [
  {
    _id: AttachType.File,
    key: '文件',
  },
  {
    _id: AttachType.Folder,
    key: '目录',
  },
  {
    _id: AttachType.Problems,
    key: '问题',
  },
  {
    _id: AttachType.Rules,
    key: 'Rules'
  }
];

const IMAGE_OPTION = {
  _id: AttachType.ImageUrl,
  key: '图片',
};

interface AttachOption {
  label: string;
  value: string;
  type: AttachType;
  tags?: string[];
  _id: string;
  mentionKeyword?: string;
  parent?: DocsetItem[];
  isActive?: boolean
  [key: string]: unknown;
}

function AttachSelectorPanel(props: TypeAheadSubProps) {
  const { focusIndex, userInputRef, resetIndex, uploadImgRef, inputValue, updateOpenState, mentionKeyword } =
    props;
  const [attachType, setAttachType] = React.useState<AttachType>();
  const ide = useExtensionStore((state) => state.IDE);
  // const config = useChatConfig((state) => state.config);
  const [showGlobalSearch, setShowGlobalSearch] = React.useState(false);
  const { postMessage } = usePostMessage();
  const [fileOptions, setFileOptions] = React.useState<FileItem[]>([]);
  const [filterGlobalOption, setFilterGlobalOption] = React.useState<
    AttachOption[]
  >([]);
  const listRef = React.useRef<HTMLDivElement>(null);
  const attachs = useChatAttach((state) => state.attachs);
  const updateAttach = useChatAttach((state) => state.update);
  const chatType = useChatStore((state) => state.chatType);

  const selectFileHook = useSelecteFileAttach()
  const selectFolderHook = useSelectedFolderAttach()
  const selectDocsetHook = useSelectDocsetAttach()
  const selectCodebaseHook = useSelectCodebaseAttach()

  const enableCodeMapSearch = useChatConfig(state => state.enableCodeMapSearch)
  const enableKnowledgeLibSearch = useChatConfig(state => state.enableKnowledgeLibSearch)

  const options = React.useMemo(() => {
    let _options = [...DEFAULT_ATTACH_OPTIONS];
    if (chatType === 'codebase') {
      _options = CODEBASE_ATTACH_OPTIONS.filter(i => {
        if (![AttachType.Problems, AttachType.CodeBase, AttachType.Docset].includes(i._id)) {
          return true
        } else if (
          (i._id === AttachType.Problems && ide === IDE.VisualStudioCode) ||
          (i._id === AttachType.CodeBase && enableCodeMapSearch) ||
          (i._id === AttachType.Docset && enableKnowledgeLibSearch)
        ) {
          return true
        }
        return false
      })
    } else if (ide === IDE.VisualStudio) {
      _options.pop();
    }
    return _options;
  }, [chatType, ide, enableCodeMapSearch, enableKnowledgeLibSearch]);

  // const currentIndex = getListIndex(options, focusIndex);

  useFirstFocusedEffect(() => {
    postMessage({
      type: BroadcastActions.GET_WORKSPACE_FILES,
      data: { keyword: '', max: 8 },
    });
  }, [postMessage]);

  React.useEffect(() => {
    async function handleMessage(
      event: MessageEvent<PostMessageSubscribeType>,
    ) {
      const eventData = event.data as any;
      if (eventData?.type === SubscribeActions.WORKSPACE_FILES) {
        const files = eventData.data || [];
        setFileOptions(files);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const searchKeyword = React.useMemo(() => {
    return mentionKeyword || ''
  }, [mentionKeyword]);

  React.useEffect(() => {
    if (searchKeyword && !attachType) {
      if (chatType === 'codebase' && [IDE.VisualStudioCode, IDE.JetBrains].includes(ide as IDE)) {
        postMessage({
          type: BroadcastActions.SEARCH_WORKSPACE_PATH,
          data: { keyword: searchKeyword, max: 10 },
        });
      } else {
        postMessage({
          type: BroadcastActions.GET_WORKSPACE_FILES,
          data: { keyword: searchKeyword, max: 8 },
        });
      }
    }
  }, [searchKeyword, attachType, chatType, ide, postMessage])

  const globalOptions = React.useMemo(() => {
    const allOptions: AttachOption[] = [];
    fileOptions.forEach((file) => {
      allOptions.push({
        ...file,
        label: file.path,
        value: file.path,
        type: file.path.endsWith('/') ? AttachType.Folder : AttachType.File,
        _id: nanoid(),
      });
    });

    return allOptions;
  }, [fileOptions]);

  const currentIndex = React.useMemo(() => {
    if (searchKeyword) {
      return getListIndex(filterGlobalOption, focusIndex);
    }
    if (!attachType && showGlobalSearch) {
      return getListIndex(globalOptions, focusIndex);
    }
    return getListIndex(options, focusIndex);
  }, [
    focusIndex,
    globalOptions,
    attachType,
    showGlobalSearch,
    options,
    searchKeyword,
    filterGlobalOption,
  ]);

  React.useEffect(() => {
    if (listRef.current) {
      scrollToFocusItem(listRef.current, currentIndex);
    }
  }, [currentIndex]);

  React.useEffect(() => {
    if (searchKeyword) {
      setShowGlobalSearch(true);
      const lowercaseKeyword = searchKeyword.toLowerCase();
      const filterOptions: AttachOption[] = [];
      if (chatType === 'codebase') {
        globalOptions.flatMap((option) => {
          const isMatch = option.label.toLowerCase().includes(lowercaseKeyword);
          if (isMatch && [AttachType.File, AttachType.Folder, AttachType.CodeBase, AttachType.Docset].includes(option.type)) {
            if (option?.isActive) {
              option.tags = ['当前']
            }
            filterOptions.push(option);
          }
        });
      } else {
        globalOptions.flatMap((option) => {
          const isMatch = option.label.toLowerCase().includes(lowercaseKeyword);
          if (isMatch) {
            // Docset 是多层级的，需要特殊处理
            if (option.type === AttachType.Docset) {
              const { docsetType } = option as unknown as DocsetOptions;
              if (docsetType !== DocsetType.Folder) {
                filterOptions.push(option);
              }
            } else if (option?.isActive) {
              filterOptions.unshift(option);
            } else {
              filterOptions.push(option);
            }
          }
        });
      }
      resetIndex(0);
      setFilterGlobalOption(filterOptions);
    } else {
      setShowGlobalSearch(false);
    }
  }, [inputValue, globalOptions, resetIndex, searchKeyword, chatType]);

  // 移除指令信息
  const removeMentionKeyword = React.useCallback((attachOption: AttachOption) => {
    // 注意：Problems类型需要特殊处理，不应该跳过清理逻辑
    if ([AttachType.File, AttachType.Folder].includes(attachOption.type)) {
      return
    }
    if (userInputRef.current) {
      const { selectionStart = 0, value = '' } = userInputRef.current
      // 找指令
      const includedMentionText = value.slice(0, selectionStart)
      let mentionCursor = -1
      for (let i = 0; i < includedMentionText.length; i++) {
        if ([
          TypeAheadModePrefix.Attach,
          TypeAheadModePrefix.Prompt
        ].includes(includedMentionText[i] as TypeAheadModePrefix)) {
          mentionCursor = i
        }
      }
      if (mentionCursor>=0) {
        const newValue = value.slice(0, mentionCursor) + value.slice(selectionStart, value.length)
        userInputRef.current.value = newValue;
      }
      userInputRef.current.dispatchEvent(
        new Event('input', { bubbles: true }),
      );
      userInputRef.current?.setSelectionRange?.(mentionCursor, mentionCursor);
      userInputRef.current.focus();
    }
  }, [userInputRef])

  const handleSelectAttach = React.useCallback(
    (attachOption: AttachOption) => {
      switch (attachOption.type) {
        case AttachType.File: {
          const fileValues = attachOption as unknown as FileItem;
          const file = {
            fileName: fileValues.fileName,
            path: fileValues.path,
            content: fileValues.content,
          } as FileItem;
          selectFileHook.selectFileAttaches([file])
          break;
        }
        case AttachType.Folder: {
          const folderValues = attachOption as unknown as FolderItem;
          const folder = {
            fileName: folderValues.fileName,
            path: folderValues.path,
            content: folderValues.content,
          } as FolderItem;
          selectFolderHook.selectFolderAttaches([folder])
          break;
        }
        case AttachType.Docset: {
          // Docset 是有多层级的，假如有 children 字段，那么就需要下钻
          const docsetValue = attachOption as unknown as DocsetItem;
          if (docsetValue?.children?.length) {
            const docsetOptions = docsetValue?.children.map((i) => ({
              ...i,
              value: i.name,
              type: AttachType.Docset,
            }));
            setFilterGlobalOption(docsetOptions);
            resetIndex(0);
            return;
          }
          if (docsetValue?.parent) {
            delete docsetValue.parent;
          }
          selectDocsetHook.selectDocsetAttaches([docsetValue as Docset])
          break;
        }

        case AttachType.CodeBase: {
          selectCodebaseHook.selecteCodebaseAttaches([attachOption as GroupValue])
          break;
        }

        default:
          return;
      }
      removeMentionKeyword(attachOption)
      resetIndex(0);
      updateOpenState(false);
    },
    [removeMentionKeyword, resetIndex, updateOpenState, selectFileHook, selectFolderHook, selectDocsetHook, selectCodebaseHook],
  );

  const handleToBack = React.useCallback(() => {
    if (attachType === AttachType.File || attachType === AttachType.CodeBase) {
      setAttachType(undefined);
      updateAttach(undefined);
      return;
    }

    if (attachType === AttachType.Docset && attachs)
      if (!attachType && showGlobalSearch) {
        const currentAttach = filterGlobalOption[currentIndex];
        if (currentAttach.type === AttachType.Docset) {
          if (currentAttach?.parent) {
            const docsetOptions = currentAttach?.parent.map((i) => ({
              ...i,
              value: i.name,
              type: AttachType.Docset,
            }));
            setFilterGlobalOption(docsetOptions);
            resetIndex(0);
          }
        }
      }
  }, [
    currentIndex,
    filterGlobalOption,
    resetIndex,
    attachType,
    showGlobalSearch,
    attachs,
    updateAttach,
  ]);

  // 仓库智能下，选择不同附件
  const handleRepoAttachClick = React.useCallback((type: AttachType) => {
    if (chatType === 'codebase') {
      if (attachs?.attachType !== AttachType.MultiAttachment) {
        updateAttach(undefined)
      }
      if (type === AttachType.Problems) {
        EventBus.instance.dispatch(EBusEvent.Mention_Select, {
          type: AttachType.Problems
        })

        // 延迟执行清理和关闭操作，确保在onMentionSelect执行完成后
        setTimeout(() => {
          resetIndex(0);
          updateOpenState(false);
        }, 10);
      }
    }
  }, [chatType, attachs, updateAttach, resetIndex, updateOpenState])

  React.useEffect(() => {
    const element = userInputRef?.current;
    function addEnterEventLinstener(event: KeyboardEvent) {
      // 拦截 Enter 事件，触发 attachType 选择
      switch (event.code || event.key) {
        case 'Enter':
          // // 目前只支持问题区域 后续拓展时，抽成独立方法
          if (!attachType && showGlobalSearch) {
            const currentAttach = filterGlobalOption[currentIndex];
            handleSelectAttach(currentAttach);
            return;
          }
          if (!attachType) {
            const selectedAttach = options[currentIndex];
            setAttachType(selectedAttach._id);
            // 每次选择的时候，更新一下index
            resetIndex(0);
            event.stopPropagation();
            event.preventDefault();
            if (selectedAttach._id === IMAGE_OPTION._id) {
              uploadImgRef.current?.handleUpload();
            }
            handleRepoAttachClick(selectedAttach._id);
          }

          break;
        case 'ArrowLeft':
          if (event.shiftKey) {
            handleToBack();
          }
          break;
        default:
          break;
      }
    }

    element?.addEventListener('keydown', addEnterEventLinstener);
    return () => {
      element?.removeEventListener('keydown', addEnterEventLinstener);
    };
  }, [
    attachType,
    currentIndex,
    userInputRef,
    resetIndex,
    options,
    uploadImgRef,
    showGlobalSearch,
    globalOptions,
    filterGlobalOption,
    handleSelectAttach,
    // updateAttach,
    handleToBack,
    handleRepoAttachClick,
  ]);

  if (!attachType && showGlobalSearch) {
    if (!filterGlobalOption?.length) {
      return (
        <Flex
          w="full"
          h="full"
          p={4}
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          gap={2}
          bg="themeBgColor"
        >
          <Box>No Data</Box>
        </Flex>
      );
    }
    return (
      <Box flex={1} w="100%" p={2} bg="themeBgColor">
        <VStack
          pr={2}
          align="stretch"
          maxH="calc(100vh - 400px)"
          minH="80px"
          overflowY="scroll"
          ref={listRef}
          scrollBehavior="smooth"
        >
          {filterGlobalOption?.map((option, index) => {
            return (
              <TypeAheadRowItem
                key={option._id}
                index={index}
                currentIndex={currentIndex}
                onClick={() => {
                  handleSelectAttach(option);
                }}
              >
                <Grid
                  position="relative"
                  textAlign="left"
                  w="full"
                  h="full"
                  py={2}
                  color={currentIndex === index ? 'white' : 'text.primary'}
                  display={'flex'}
                >
                  <Tooltip label={option.label}>
                    <Grid display="flex" alignItems="center" gap="2" isTruncated>
                      <AttachIcon attachType={option.type} />
                      <Text fontSize="sm" isTruncated flex={1}>
                        {option.label}
                      </Text>
                    </Grid>
                  </Tooltip>
                  {/* {(option?.tags || [])
                    .filter((tag) => tag !== CODEMAKER_TAG)
                    .filter((tag) => !tag.startsWith(LABEL_TAG))
                    .map((tag, tagIndex) => (
                      <Box
                        key={tagIndex}
                        display="inline-flex"
                        alignItems="center"
                        justifyContent="center"
                        ml="2"
                        px="2"
                        borderRadius="md"
                        borderWidth="1px"
                        fontSize="xs"
                        h="20px"
                        color={currentIndex === index ? 'white' : 'blue.300'}
                        borderColor={
                          currentIndex === index ? 'white' : 'blue.300'
                        }
                      >
                        {tag}
                      </Box>
                    ))} */}
                </Grid>
              </TypeAheadRowItem>
            );
          })}
        </VStack>
      </Box>
    );
  }

  if (!attachType) {
    return (
      <>
        <Flex
          w="full"
          flexDirection="column"
          p={2}
          gap={2}
          backgroundColor="themeBgColor"
        >
          {options.map((option, index) => (
            <TypeAheadRowItem
              key={option._id}
              index={index}
              currentIndex={currentIndex}
              onClick={() => {
                handleRepoAttachClick(option._id)
                userInputRef.current?.focus()
                if (option._id === IMAGE_OPTION._id) {
                  uploadImgRef.current?.handleUpload();
                }
                setAttachType(option._id);
              }}
            >
              <Flex
                position="relative"
                w="full"
                h="full"
                py={2}
                placeContent="space-between"
                alignItems="center"
                color={currentIndex === index ? 'white' : 'text.primary'}
              >
                <Box display="flex" alignItems="center" gap="2">
                  <AttachIcon attachType={option._id} />
                  <Text isTruncated>{option.key}</Text>
                </Box>

                <TbChevronRight />
              </Flex>
            </TypeAheadRowItem>
          ))}
          <Box>
            <Text fontSize="xs" color="text.default">
              输入关键字进行检索
            </Text>
          </Box>
        </Flex>
      </>
    );
  }

  if (attachType === AttachType.Docset) {
    return (
      <DocsetSelectorPanel
        {...props}
        resetAttachType={() => setAttachType(undefined)}
      />
    );
  }
  if (attachType === AttachType.CodeBase) {
    return (
      <CodeBaseSelectorPanel
        {...props}
        resetAttachType={() => setAttachType(undefined)}
      />
    );
  }
  if (attachType === AttachType.File) {
    return (
      <FileSelectorPanel
        {...props}
        resetAttachType={() => setAttachType(undefined)}
      />
    );
  }
  if (attachType === AttachType.Folder) {
    return (
      <FolderSelectorPanel
        {...props}
        resetAttachType={() => setAttachType(undefined)}
      />
    );
  }
  if (attachType === AttachType.ImageUrl) {
    return <UploadImagePanel {...props} />;
  }
  if (attachType === AttachType.NetworkModel) {
    return <NetworkModelPanel {...props} />;
  }
  if (attachType === AttachType.Rules) {
    return (
      <RuleSelectorPanel
        {...props}
        resetAttachType={() => setAttachType(undefined)}
      />
    )
  }

  return null;
}

export default AttachSelectorPanel;
