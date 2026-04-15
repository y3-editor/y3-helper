import {
  Tooltip,
  Box,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useMediaQuery,
  Button,
  IconButton,
} from '@chakra-ui/react';
import { useExtensionStore, IDE } from '../../store/extension';
import MemoCodeBlock, {
  CodeBlockProps,
} from '../../components/Markdown/CodeBlock';
import { BroadcastActions, usePostMessage } from '../../PostMessageProvider';
import userReporter from '../../utils/report';
import { ChatMessage } from '../../services';
import { useChatStore, useUserActionStore } from '../../store/chat';
import Icon from '../../components/Icon';
import { FiLogOut, FiCopy, FiPenTool, FiCheck } from 'react-icons/fi';
import { GoFileDiff } from 'react-icons/go';
import {
  countGodeGenerate,
  exportGraphAsPng,
  LANGUAGE_TO_GRAPH_TYPE,
} from '../../utils';
import { CgMoreO } from 'react-icons/cg';
import { MdOutlineFormatIndentDecrease } from 'react-icons/md';
import { BsTerminal } from 'react-icons/bs';
import { useConfigStore, CodeWhiteSpace } from '../../store/config';
import * as React from 'react';
import { SmallScreenWidth } from '../../const';
import { MdOutlinePreview, MdOutlineTerminal, MdExpandMore, MdExpandLess } from 'react-icons/md';
import { FaCode } from 'react-icons/fa6';
import { LuDownload } from 'react-icons/lu';
import { useWorkspaceStore } from '../../store/workspace';
import md5 from 'crypto-js/md5';
import { RxCheckCircled, RxReset } from 'react-icons/rx';
import { diffLines } from 'diff'
import { UserEvent } from '../../types/report';


interface ChatCodeBlockProps extends CodeBlockProps {
  onUpdateCodeBlockMeta?: (codeMeta: ICodeBlockMeta) => void;
  data: {
    message: ChatMessage;
    defaultExpanded?: boolean;
  };
}
export interface ICodeBlockMeta {
  codeBlockId: string
  filePath: string
  searchCodes: string[]
  replacedCodes: string[]
  language: string
}
const SHELL = ['bash', 'zsh', 'powershell'];

const ChartLanguage = ['mermaid', 'plantuml', 'dot', 'graphviz'];

const btn_xs = {
  height: '24px', // 设置按钮高度
  fontSize: '12px', // 设置字体大小
  padding: '2px 4px', // 设置内边距
  fontWeight: 400,
};

const icon_xs = {
  width: '14px',
  height: '14px',
};

export default function ChatCodeBlock(props: ChatCodeBlockProps) {
  const { language, value, data, metaData, onUpdateCodeBlockMeta } = props;
  const [fileChange, setFileChange] = React.useState<ICodeBlockMeta>()
  const [showChart, setshowChart] = React.useState(ChartLanguage.includes(language));
  const { message, defaultExpanded } = data;
  const realValue = React.useMemo(() => {
    return value.replace(/__CM__/g, '')
  }, [value])

  // 判断HTML是否完整（以<!DOCTYPE html>或<html>开头，以</html>结尾）
  const isCompleteHtml = React.useMemo(() => {
    if (language !== 'html') return false;
    const trimmedValue = realValue.trim();
    return (trimmedValue.startsWith('<!DOCTYPE html>') || trimmedValue.startsWith('<html>')) &&
           trimmedValue.endsWith('</html>');
  }, [language, realValue]);
  // console.log('isCompleteHtml', isCompleteHtml, realValue);

  const [configStore, updateConfig] = useConfigStore((state) => [
    state.config,
    state.updateConfig,
  ]);
  const [isSmallScreen] = useMediaQuery(SmallScreenWidth);
  const currentSession = useChatStore((state) => state.currentSession());
  // TODO: 目前代码比较挫，后续再优化这个逻辑
  const [ide, appVersion] = useExtensionStore((state) => [
    state.IDE,
    state.appVersion,
  ]);
  const [chatType] = useChatStore((state) => [
    state.chatType
  ]);
  const [
    createdFilePaths,
    appliedCodeBlocks,
  ] = useUserActionStore((state) => [
    state.createdFilePaths,
    state.appliedCodeBlocks,
  ]);
  const { postMessage } = usePostMessage();
  const isVsCodeIDE = ide === IDE.VisualStudioCode;
  const isJetBrainsIDE = ide === IDE.JetBrains;
  const isVisualStudioIDE = ide === IDE.VisualStudio;
  const workspaceInfo = useWorkspaceStore((state) => state.workspaceInfo);

  // 代码块唯一标识目前只在智聊中使用，由于md5值计算比较消耗性能，不建议全部代码块生成唯一标识
  const codeBlockId = React.useMemo(() => {
    if (chatType === 'codebase' && defaultExpanded) {
      return md5(realValue).toString()
    }
    return ''
  }, [realValue, chatType, defaultExpanded])

  const showMore = React.useMemo(() => {
    if (ide === IDE.JetBrains) {
      return !appVersion?.includes('2020');
    } else {
      return true;
    }
  }, [appVersion, ide]);

  const hasAppliedCode = React.useMemo(() => {
    if (chatType === 'codebase' && defaultExpanded) {
      return (appliedCodeBlocks[data?.message?.id||'']||[]).includes(codeBlockId)
    }
    return false
  }, [chatType, defaultExpanded, appliedCodeBlocks, data?.message?.id, codeBlockId])

  const copyToClipboard = React.useCallback(
    (text: string) => {
      const {
        generate_lines,
        generate_chars
      } = countGodeGenerate(text);
      userReporter.report({
        event: UserEvent.CODE_CHAT_COPY,
        extends: {
          session_id: currentSession?._id,
          message_id: message.id,
          generate_lines,
          generate_chars,
          repoUrl: workspaceInfo.repoUrl,
          repoName: workspaceInfo.repoName,
          chat_type: chatType
        },
      });
      postMessage({
        type: BroadcastActions.CODE_CHAT_COPY_CODE,
        data: {
          session_id: currentSession?._id,
          message_id: message.id,
          generate_lines: generate_lines,
          generate_chars: generate_chars,
          content: text,
          chat_type: chatType
        }
      })
      postMessage({
        type: BroadcastActions.COPY_TO_CLIPBOARD,
        data: text,
      });
    },
    [currentSession?._id, postMessage, message.id, workspaceInfo.repoName, workspaceInfo.repoUrl, chatType],
  );

  const insertToEditor = React.useCallback(
    (text: string) => {
      userReporter.report({
        event: UserEvent.CODE_CHAT_CODE_INSERT,
        extends: {
          session_id: currentSession?._id,
          message_id: message.id,
          repoUrl: workspaceInfo.repoUrl,
          repoName: workspaceInfo.repoName,
          chat_type: chatType,
          ...countGodeGenerate(text),
        },
      });
      postMessage({
        type: BroadcastActions.INSERT_TO_EDITOR,
        data: text,
      });
    },
    [currentSession?._id, postMessage, message.id, workspaceInfo.repoName, workspaceInfo.repoUrl, chatType],
  );

  const insertWithDiff = React.useCallback(
    (text: string) => {
      userReporter.report({
        event: UserEvent.CODE_CHAT_CODE_MERGE,
        extends: {
          session_id: currentSession?._id,
          message_id: message.id,
          repoUrl: workspaceInfo.repoUrl,
          repoName: workspaceInfo.repoName,
          chat_type: chatType,
          ...countGodeGenerate(text),
        },
      });
      postMessage({
        type: BroadcastActions.INSERT_WITH_DIFF,
        data: text,
      });
    },
    [currentSession?._id, postMessage, message.id, workspaceInfo.repoName, workspaceInfo.repoUrl, chatType],
  );

  const createFileAndInsertCode = React.useCallback(
    (language: string, text: string, filePath?: string) => {
      postMessage({
        type: BroadcastActions.CREATE_FILE_AND_INSERT_CODE,
        data: {
          language,
          content: text,
          filePath,
        },
      });
    },
    [postMessage],
  );

  const insertOrRunTerminal = React.useCallback(
    (text: string, execute: boolean) => {
      postMessage({
        type: BroadcastActions.INSERT_TERMINAL,
        data: {
          content: text,
          execute,
        },
      });
    },
    [postMessage],
  );

  const handleChangeConfig = React.useCallback(() => {
    updateConfig((config) => {
      const newCodeWhiteSpace =
        configStore.codeWhiteSpace === CodeWhiteSpace.Wrap
          ? CodeWhiteSpace.NoWrap
          : CodeWhiteSpace.Wrap;
      config.codeWhiteSpace = newCodeWhiteSpace;
    });
  }, [updateConfig, configStore.codeWhiteSpace]);


  const [searchCodes, replacedCodes] = React.useMemo(() => {
    if (realValue.includes('<<<<<<< SEARCH') && realValue.includes('>>>>>>> REPLACE')) {
      const lines = realValue.split('\n');
      const searchCodes: string[] = [];
      const replacedCodes: string[] = [];
      let i = 0;

      while (i < lines.length) {
        if (lines[i].includes('<<<<<<< SEARCH')) {
          const searchStart = i + 1;
          const searchEnd = lines.findIndex((line, index) => index > i && line?.trim?.() === '=======');
          const replaceEnd = lines.findIndex((line, index) => index > searchEnd && line.includes('>>>>>>> REPLACE'));

          if (searchEnd !== -1 && replaceEnd !== -1) {
            searchCodes.push(lines.slice(searchStart, searchEnd).join('\n'));
            replacedCodes.push(lines.slice(searchEnd + 1, replaceEnd).join('\n'));
            i = replaceEnd + 1;
          } else {
            break;
          }
        } else {
          i++;
        }
      }
      return [searchCodes, replacedCodes];
    } else {
      return [[realValue], []];
    }
  }, [realValue]);

  const hasApplyScene = React.useMemo(() => {
    return (isVsCodeIDE || isJetBrainsIDE) && data.defaultExpanded && searchCodes.length && replacedCodes.length > 0
  }, [data.defaultExpanded, isVsCodeIDE, isJetBrainsIDE, replacedCodes.length, searchCodes.length])

  const changedLines = React.useMemo(() => {
    const lines = { add: 0, delete: 0 }
    if (!hasApplyScene) return lines
    const diffInfo = diffLines(searchCodes.join('\n'), replacedCodes.join('\n'))
    diffInfo.forEach(d => {
      if (d.added) {
        lines.add += (d.count || 0)
      } else if (d.removed) {
        lines.delete += (d.count || 0)
      }
    })
    return lines
  }, [hasApplyScene, replacedCodes, searchCodes])

  const onApplyChange = React.useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (searchCodes && replacedCodes && metaData?.filePath && message?.id) {
      postMessage({
        type: BroadcastActions.APPLY_SINGLE_CHANGES,
        data: {
          type: 'apply',
          diffId: codeBlockId,
          codeBlockIds: [codeBlockId],
          fileChange: {[codeBlockId]: {
            searchCodes: searchCodes,
            replacedCodes: replacedCodes,
            createdFilePaths: createdFilePaths[message.id||''] || [],
            language: language,
            filePath: metaData.filePath,
            codeBlockId: codeBlockId,
            messageId: message?.id,
          }}
        },
      });
    }
  }, [searchCodes, replacedCodes, metaData?.filePath, message.id, postMessage, codeBlockId, createdFilePaths, language])

  const onPreviewDiff = React.useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (searchCodes && replacedCodes && metaData?.filePath) {
      postMessage({
        type: BroadcastActions.PREVIEW_DIFF_CODE,
        data: {
          diffId: codeBlockId,
          searchCodes: searchCodes,
          replacedCodes: replacedCodes,
          createdFilePaths: createdFilePaths[message.id||''] || [],
          language: language,
          messageId: message?.id || '',
          filePath: metaData.filePath,
          codeBlockId: codeBlockId,
          fileChange: {[codeBlockId]: {
            ...fileChange,
            messageId: message?.id,
            createdFilePaths: createdFilePaths[message?.id||''],
          }}
        },
      });
    }
  }, [codeBlockId, createdFilePaths, fileChange, language, message.id, metaData?.filePath, postMessage, replacedCodes, searchCodes])

  const pretrimValue = React.useCallback((val: string) => {
    const lines = val.split('\n')
    const newLines: string[] = []
    lines.forEach(line => {
      if (!['<<<<<<< SEARCH', '=======', '>>>>>>> REPLACE'].some(s => line.includes(s))) {
        newLines.push(line)
      }
    })
    return newLines.join('\n')
  }, [])

  const displayedValue = replacedCodes.join('\n......\n') || pretrimValue(realValue);
  const actionButtons = React.useMemo(() => {
    return (
      <>
        {!isSmallScreen ? (
          <>
            {
              language === 'html' && isCompleteHtml ? (
                <Tooltip label="预览HTML">
                  <Button
                    variant="ghost"
                    aria-label="HTML预览"
                    size="sm"
                    sx={btn_xs}
                    onClick={() => {
                      postMessage({
                        type: BroadcastActions.OPEN_HTML,
                        data: realValue,
                      });
                      userReporter.report({
                        event: UserEvent.CODE_CHAT_HTML_PREVIEW,
                        extends: {
                          session_id: currentSession?._id,
                          message_id: message.id,
                        },
                      });
                    }
                    }
                    color="text.default"
                  >
                    <Icon as={MdOutlinePreview} size="sm" mr={1.5} />
                    预览HTML
                  </Button>
                </Tooltip>
              ) : null
            }
            {(ChartLanguage.includes(language)) && (
              <Tooltip label={showChart ? '代码' : '预览'}>
                {!showChart ? (
                  <Button
                    variant="ghost"
                    aria-label="Mermaid"
                    size="sm"
                    sx={btn_xs}
                    onClick={() => {
                      setshowChart(true);
                      userReporter.report({
                        event: UserEvent[`CODE_CHAT_${language.toUpperCase()}_PREVIEW` as keyof typeof UserEvent],
                        extends: {
                          session_id: currentSession?._id,
                          message_id: message.id,
                        },
                      });
                    }}
                    color="text.default"
                  >
                    <Icon as={MdOutlinePreview} size="sm" mr={1.5} />
                    预览
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      aria-label="Mermaid"
                      size="sm"
                      sx={btn_xs}
                      onClick={() => {
                        setshowChart(false);
                      }}
                      color="text.default"
                    >
                      <Icon as={FaCode} size="sm" mr={1.5} />
                      代码
                    </Button>
                    {!isVisualStudioIDE && (
                      <Button
                        variant="ghost"
                        aria-label="Chart"
                        size="sm"
                        sx={btn_xs}
                        onClick={() => {
                          const graphType = LANGUAGE_TO_GRAPH_TYPE[language];
                          if (graphType) {
                            exportGraphAsPng({
                              type: graphType,
                              chart: realValue
                            });
                          }
                        }}
                        color="text.default"
                      >
                        <Icon as={LuDownload} size="sm" mr={1.5} />
                        下载
                      </Button>
                    )}
                  </>
                )}
              </Tooltip>
            )}
            {showChart && !isVisualStudioIDE && ((language === 'dot' && isVsCodeIDE) || language !== 'dot') &&  (
              <Tooltip label={'调试'}>
                <Button
                  variant="ghost"
                  aria-label="Mermaid"
                  size="sm"
                  sx={btn_xs}
                  onClick={() => {
                    if (language === 'mermaid') {
                      postMessage({
                        type: BroadcastActions.OPEN_MERMAID,
                        data: realValue,
                      });
                      userReporter.report({
                        event: UserEvent.CODE_CHAT_MERMAID_TESTING,
                        extends: {
                          session_id: currentSession?._id,
                          message_id: message.id,
                        },
                      });
                    } else if (language === 'plantuml') {
                      postMessage({
                        type: BroadcastActions.OPEN_PLANTUML,
                        data: realValue,
                      });
                      userReporter.report({
                        event: UserEvent.CODE_CHAT_PLANTUML_TESTING,
                        extends: {
                          session_id: currentSession?._id,
                          message_id: message.id,
                        },
                      });
                    } else if (language === 'dot') {
                      postMessage({
                        type: BroadcastActions.OPEN_GRAPHVIZ,
                        data: realValue,
                      });
                      userReporter.report({
                        event: UserEvent.CODE_CHAT_GRAPHVIZ_TESTING,
                        extends: {
                          session_id: currentSession?._id,
                          message_id: message.id,
                        },
                      });
                    }
                  }}
                  color="text.default"
                >
                  <Icon
                    as={MdOutlineTerminal}
                    sx={icon_xs}
                    size="sm"
                    mr={1.5}
                  />
                  调试
                </Button>
              </Tooltip>
            )}
            {!showChart && (
              <>
                {hasAppliedCode && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      sx={btn_xs}
                      onClick={() => {
                        postMessage({
                          type: BroadcastActions.APPLY_SINGLE_CHANGES,
                          data: {
                            type: 'revert',
                            codeBlockIds: [codeBlockId],
                            fileChange: {[codeBlockId]: {
                              ...fileChange,
                              messageId: message?.id,
                              createdFilePaths: createdFilePaths[message?.id||''],
                            }}
                          },
                        });
                      }}
                    >
                      <Icon as={RxReset} sx={icon_xs} size="sm" mr={1.5}  color="red.400"/>
                      撤销修改
                    </Button>
                  </>
                )}
                <Tooltip label="查看diff">
                  <Button
                    hidden={!hasApplyScene || hasAppliedCode}
                    variant="ghost"
                    aria-label="查看diff"
                    size="sm"
                    sx={btn_xs}
                    onClick={onPreviewDiff}
                    color="text.default"
                  >
                    <Icon as={FiPenTool} sx={icon_xs} size="sm" mr={1.5} />
                    查看diff
                  </Button>
                </Tooltip>
                <Tooltip label="应用修改">
                  <Button
                    hidden={!hasApplyScene || hasAppliedCode}
                    variant="ghost"
                    aria-label="应用修改"
                    size="sm"
                    sx={btn_xs}
                    onClick={onApplyChange}
                  >
                    <Icon as={FiCheck} color="green.400" sx={icon_xs} size="sm" mr={1.5} />
                    应用修改
                  </Button>
                </Tooltip>
                <Tooltip label="复制">
                  <Button
                    hidden={!!hasApplyScene}
                    variant="ghost"
                    aria-label="复制"
                    size="sm"
                    sx={btn_xs}
                    onClick={() => copyToClipboard(displayedValue)}
                    color="text.default"
                  >
                    <Icon as={FiCopy} sx={icon_xs} size="sm" mr={1.5} />
                    复制
                  </Button>
                </Tooltip>
                {isVsCodeIDE && language && SHELL.includes(language) && (
                  <Tooltip label="在终端中运行">
                    <Button
                      variant="ghost"
                      size="sm"
                      sx={btn_xs}
                      aria-label="在终端中运行"
                      onClick={() => insertOrRunTerminal(displayedValue, true)}
                      color="text.default"
                    >
                      <Icon as={MdOutlineTerminal} size="sm" mr={1.5} />
                      调试
                    </Button>
                  </Tooltip>
                )}
                <Tooltip label="插入">
                  <Button
                    variant="ghost"
                    hidden={!!hasApplyScene}
                    size="sm"
                    sx={btn_xs}
                    aria-label="插入到编辑器中"
                    onClick={() => insertToEditor(displayedValue)}
                    color="text.default"
                  >
                    <Icon as={FiLogOut} sx={icon_xs} size="sm" mr={1.5} />
                    插入
                  </Button>
                </Tooltip>
              </>
            )}
          </>
        ) : null}
        {showMore && (
          <Menu>
            <Tooltip label="更多操作">
              <MenuButton>
                <Button
                  variant="ghost"
                  aria-label="更多"
                  size="sm"
                  sx={btn_xs}
                  color="text.default"
                >
                  <Icon as={CgMoreO} sx={icon_xs} size="sm" mr={1.5} />
                  更多
                </Button>
              </MenuButton>
            </Tooltip>
            <MenuList>
              <MenuItem
                hidden={!hasApplyScene && !isSmallScreen}
                onClick={() => copyToClipboard(displayedValue)}
              >
                <Icon
                  as={FiCopy}
                  size="sm"
                  className="mt-[-4px] mr-1"
                />
                复制
              </MenuItem>
              <MenuItem
                hidden={!(isVsCodeIDE && language && SHELL.includes(language) && isSmallScreen)}
                onClick={() => insertOrRunTerminal(displayedValue, true)}
              >
                <Icon

                  size="sm"
                  className="mt-[-4px] mr-1"
                />
                在终端中运行
              </MenuItem>
              <MenuItem
                hidden={(!isSmallScreen && !hasApplyScene)}
                onClick={() => insertToEditor(displayedValue)}>
                <Icon
                  as={FiLogOut}
                  size="sm"
                  className="mt-[-4px] mr-1"
                />
                插入
              </MenuItem>
              {isSmallScreen ? (
                <>
                  {
                    // 语言为HTML且是VSCode时，才显示预览按钮
                    language === 'html' && isCompleteHtml ? (
                      <MenuItem
                        onClick={() => {
                          postMessage({
                            type: BroadcastActions.OPEN_HTML,
                            data: realValue,
                          })
                          userReporter.report({
                            event: UserEvent.CODE_CHAT_HTML_PREVIEW,
                            extends: {
                              session_id: currentSession?._id,
                              message_id: message.id,
                            },
                          });
                        }}
                        color="text.default"
                      >
                        <Icon as={MdOutlinePreview} size="sm" mr={1.5} />
                        预览HTML
                      </MenuItem>
                    ) : null
                  }
                  {(ChartLanguage.includes(language)) && (
                    <>
                      {!showChart ? (
                        <MenuItem
                          onClick={() => {
                            setshowChart(true);
                            userReporter.report({
                              event: UserEvent[`CODE_CHAT_${language.toUpperCase()}_PREVIEW` as keyof typeof UserEvent],
                              extends: {
                                session_id: currentSession?._id,
                                message_id: message.id,
                              },
                            });
                          }}
                          color="text.default"
                        >
                          <Icon as={MdOutlinePreview} size="sm" mr={1.5} />
                          预览
                        </MenuItem>
                      ) : (
                        <>
                          {!isVisualStudioIDE && (
                            <MenuItem
                              onClick={() => {
                                const graphType = LANGUAGE_TO_GRAPH_TYPE[language];
                                if (graphType) {
                                  exportGraphAsPng({
                                    type: graphType,
                                    chart: realValue
                                  });
                                }
                              }}
                            >
                              <Icon as={LuDownload} size="sm" mr={1.5} />
                              下载
                            </MenuItem>
                          )}
                          <MenuItem
                            onClick={() => {
                              setshowChart(false);
                            }}
                          >
                            <Icon as={FaCode} size="sm" mr={1.5} />
                            代码
                          </MenuItem>
                        </>
                      )}
                    </>
                  )}
                  {showChart && !isVisualStudioIDE && ((language === 'dot' && isVsCodeIDE) || language !== 'dot') &&  (
                    <MenuItem
                      onClick={() => {
                        if (language === 'mermaid') {
                          postMessage({
                            type: BroadcastActions.OPEN_MERMAID,
                            data: realValue,
                          });
                          userReporter.report({
                            event: UserEvent.CODE_CHAT_MERMAID_TESTING,
                            extends: {
                              session_id: currentSession?._id,
                              message_id: message.id,
                            },
                          });
                        } else if (language === 'plantuml') {
                          postMessage({
                            type: BroadcastActions.OPEN_PLANTUML,
                            data: realValue,
                          });
                          userReporter.report({
                            event: UserEvent.CODE_CHAT_PLANTUML_TESTING,
                            extends: {
                              session_id: currentSession?._id,
                              message_id: message.id,
                            },
                          });
                        } else if (language === 'dot') {
                          postMessage({
                            type: BroadcastActions.OPEN_GRAPHVIZ,
                            data: realValue,
                          });
                          userReporter.report({
                            event: UserEvent.CODE_CHAT_GRAPHVIZ_TESTING,
                            extends: {
                              session_id: currentSession?._id,
                              message_id: message.id,
                            },
                          });
                        }
                      }}
                    >
                      <Icon
                        as={MdOutlineTerminal}
                        sx={icon_xs}
                        size="sm"
                        mr={1.5}
                      />
                      调试
                    </MenuItem>
                    // </Tooltip>
                  )}
                </>
              ) : null}
              {isVsCodeIDE ? (
                <>
                  <MenuItem onClick={() => insertWithDiff(displayedValue)}>
                    <Icon
                      as={GoFileDiff}
                      size="sm"
                      className="mt-[-4px] mr-1"
                    />
                    与代码块合并
                  </MenuItem>
                  <MenuItem
                    onClick={() =>
                      createFileAndInsertCode(
                        language,
                        displayedValue,
                        metaData?.filePath,
                      )
                    }
                  >
                    <Icon as={FiLogOut} size="sm" className="mt-[-4px] mr-1" />
                    插入到新文件
                  </MenuItem>
                  <MenuItem onClick={() => insertOrRunTerminal(displayedValue, false)}>
                    <Icon
                      as={BsTerminal}
                      size="sm"
                      className="mt-[-4px] mr-1"
                    />
                    在终端中运行
                  </MenuItem>
                </>
              ) : null}
              <MenuItem onClick={() => handleChangeConfig()}>
                <Icon
                  as={MdOutlineFormatIndentDecrease}
                  size="sm"
                  className="mt-[-4px] mr-1"
                />
                {configStore.codeWhiteSpace === CodeWhiteSpace.Wrap
                  ? '不换行展示'
                  : '自动换行展示'}
              </MenuItem>
            </MenuList>
          </Menu>
        )}
      </>
    );
  }, [
    isSmallScreen,
    language,
    showChart,
    isVisualStudioIDE,
    isVsCodeIDE,
    hasAppliedCode,
    hasApplyScene,
    showMore,
    configStore.codeWhiteSpace,
    currentSession?._id,
    message.id,
    realValue,
    codeBlockId,
    metaData?.filePath,
    displayedValue,
    createdFilePaths,
    fileChange,
    postMessage,
    isCompleteHtml,
    copyToClipboard,
    createFileAndInsertCode,
    handleChangeConfig,
    insertOrRunTerminal,
    insertToEditor,
    insertWithDiff,
    onApplyChange,
    onPreviewDiff,
  ]);

  let filename = '';
  if (metaData?.filePath) {
    filename = metaData.filePath.replace(/\\/g, '/').split('/').slice(-1)[0];
  }

  React.useEffect(() => {
    if (hasApplyScene) {
      let realPath = metaData?.filePath || ''
      if (workspaceInfo.workspace && realPath.includes(workspaceInfo.workspace)) {
        realPath = realPath.replace(workspaceInfo.workspace, '')
      }
      realPath = realPath.replace(/^(\/|\\)/, '').replace(/^(\/|\\)/, '')
      const newFileChange = {
        codeBlockId: codeBlockId,
        filePath: realPath,
        searchCodes,
        replacedCodes,
        language,
      }
      setFileChange(newFileChange)
      onUpdateCodeBlockMeta?.(newFileChange)
    }
  }, [codeBlockId, hasApplyScene, language, metaData?.filePath, onUpdateCodeBlockMeta, replacedCodes, searchCodes, workspaceInfo.workspace])

  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded ?? true);

  return (
    <Box bg="answerBgColor">
      <Box
        h="28px"
        display="flex"
        alignItems="center"
        px="2"
        bg="answerBgColor"
        border="1px"
        borderColor="customBorder"
        borderTopRadius="8px"
        color="text.default"
        fontSize="12px"
      >
      <Box display="flex" alignItems="center" minW="0" flex="1" overflow="hidden">
        <IconButton
          aria-label="展开/折叠"
          size="md"
          variant="link"
          icon={isExpanded ? <MdExpandLess /> : <MdExpandMore />}
          onClick={() => setIsExpanded(!isExpanded)}
          minW="18px"
          h="24px"
          p={0}
          flexShrink={0}
        />
        {
          metaData?.filePath
            ? <Tooltip label={metaData.filePath}>
                <Box
                  className="inline-block cursor-pointer truncate"
                  color="blue.300"
                  onClick={(e: any) => {
                    e.stopPropagation();
                    postMessage({
                      type: 'OPEN_FILE',
                      data: {
                        filePath: metaData.filePath,
                        code: displayedValue,
                      },
                    });
                  }}
                  minW="0"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                >
                  {filename}
                </Box>
            </Tooltip>
            : <span className="text-sm truncate" title={language}>{language}</span>
        }
        {
          hasApplyScene && !hasAppliedCode && (
            <Box marginLeft={2} display={'flex'} flexShrink={0}>
              <Box color={'green.500'} hidden={!changedLines.add} fontWeight={700} fontSize={12}>+{changedLines.add}</Box>
              <Box color={'red.600'} hidden={!changedLines.delete} marginLeft={1} fontWeight={700} fontSize={12}>-{changedLines.delete}</Box>
            </Box>
          )
        }
        {
          hasApplyScene && hasAppliedCode && (
            <Box color={'green.500'} display={'flex'} alignItems={'center'} ml={2} flexShrink={0}>
              <Icon as={RxCheckCircled} />
              <Box fontSize={12} ml={1}>已应用</Box>
            </Box>
          )
        }
        </Box>
        <div className="flex items-center ml-auto" style={{ flexShrink: 0 }}>{actionButtons}</div>
      </Box>
      {isExpanded && (
        <MemoCodeBlock
          language={language}
          value={displayedValue}
          collapsable={true}
          defaultExpanded={defaultExpanded}
          codeWhiteSpace={configStore.codeWhiteSpace}
          actionButton={actionButtons}
          showChart={showChart}
          metaData={metaData}
        />
      )}
    </Box>
  );
}
