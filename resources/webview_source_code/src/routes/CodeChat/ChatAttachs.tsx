import { Tag, TagCloseButton, TagLabel, Tooltip, Box } from '@chakra-ui/react';
import { useChatAttach, CodeBase, IMultiAttachment, FileItem, RuleItem } from '../../store/chat';
import { Docset, Docsets } from '../../services/docsets';
import { AttachType } from '../../store/attaches';
import * as React from 'react';
import { VariableType, useMaskStore } from '../../store/mask';
import useResizeObserver from '../../hooks/useResizeObserver';
import { useSelectDocsetAttach } from './ChatTypeAhead/Attach/Hooks/useSelectDocsetAttach';
import { useSelectCodebaseAttach } from './ChatTypeAhead/Attach/Hooks/useSelectCodebaseAttach';
import { useSelecteFileAttach } from './ChatTypeAhead/Attach/Hooks/useSelectFileAttach';
import { useSelectRuleAttach } from './ChatTypeAhead/Attach/Hooks/useSelectRuleAttach';

function ChatAttachs() {
  const maskVariables = useMaskStore((state) => state.config.variables);
  const attachs = useChatAttach((state) => state.attachs);
  const update = useChatAttach((state) => state.update);

  const [containerRef, containerRect] = useResizeObserver();
  const removeAttachs = React.useCallback(() => {
    update(undefined);
  }, [update]);
  const selectFileHook = useSelecteFileAttach();
  const selectDocsetHook = useSelectDocsetAttach();
  const selectCodebaseHook = useSelectCodebaseAttach();
  const selectRuleHook = useSelectRuleAttach();

  const attachNode = React.useMemo(() => {
    if (!attachs) return null;
    switch (attachs.attachType) {
      case AttachType.Docset: {
        const docsets = (attachs as Docsets).docsets;
        return (
          <Box display="flex" gap="2" w="full">
            {docsets.map((docset) => (
              <Tooltip label={`知识库: ${docset.name}`} key={docset._id} placement='top'>
                <Tag
                  variant="solid"
                  size="md"
                  px={2}
                  py={1}
                  key={docset._id}
                  fontSize="12px"
                >
                  <TagLabel isTruncated>
                    <span style={{ zoom: .8 }}>知识库：</span>
                    <span>{docset.name}</span>
                  </TagLabel>
                  <TagCloseButton onClick={() => selectDocsetHook.removeDocsetAttaches([docset._id])} />
                </Tag>
              </Tooltip>
            ))}
          </Box>
        );
      }
      case AttachType.CodeBase: {
        const { label, collection } = attachs as CodeBase;
        if (maskVariables[VariableType.Codebase]) {
          return null;
        }
        return (
          <Tooltip label={`代码地图：${label}`}>
            <Tag
              variant="solid"
              size="md"
              px={2}
              py={1}
              key={collection}
              fontSize="12px"
            >
              <TagLabel isTruncated>
                <span style={{ zoom: .7 }}>代码地图：</span>
                <span>{label}</span>
              </TagLabel>
              <TagCloseButton onClick={removeAttachs} />
            </Tag>
          </Tooltip>
        );
      }
      case AttachType.MultiAttachment: {
        const { dataSource } = attachs as IMultiAttachment;
        return (
          <Box display="flex" gap="2" w="full">
            {
              dataSource.map((item: any, index: number) => {
                if (item.attachType === AttachType.File && item?.isCurrent) {
                  const file = item as FileItem;
                  return (
                    <Tooltip label={`文件：${file.path}`} key={file.path + index}>
                      <Tag
                        variant="solid"
                        size="md"
                        px={2}
                        py={1}
                        key={file.path}
                        maxW="140px"
                      >
                        <TagLabel isTruncated>文件：{file.fileName}</TagLabel>
                        <TagCloseButton
                          onClick={() => {
                            selectFileHook.removeFileAttaches([item])
                          }}
                        />
                      </Tag>
                    </Tooltip>
                  )
                } else if (item.attachType === AttachType.Docset) {
                  const docset = item as Docset;
                  return (
                    <Tooltip label={`知识库：${docset.name}`} key={docset._id + index}>
                      <Tag
                        variant="solid"
                        size="md"
                        px={2}
                        py={1}
                        key={docset._id}
                        maxW="140px"
                      >
                        <TagLabel isTruncated>
                          <span>知识库：</span>
                          <span>{docset.name}</span>
                        </TagLabel>
                        <TagCloseButton
                          onClick={() => {
                            selectDocsetHook.removeDocsetAttaches([docset._id])
                          }}
                        />
                      </Tag>
                    </Tooltip>
                  );
                } else if (item.attachType === AttachType.CodeBase) {
                  const { label, collection } = item as CodeBase
                  if (maskVariables[VariableType.Codebase]) return null
                  return (
                    <Tag
                      variant="solid"
                      size="md"
                      px={2}
                      py={1}
                      key={collection + index}
                      fontSize="12px"
                    >
                      <Tooltip label={`代码地图：${label}`}>
                        <TagLabel isTruncated>
                          <span>代码地图：</span>
                          <span>{label}</span>
                        </TagLabel>
                      </Tooltip>
                      <TagCloseButton onClick={() => selectCodebaseHook.removeCodebaseAttaches([item])} />
                    </Tag>
                  );
                } else if (item.attachType === AttachType.Rules) {
                  const { name, filePath } = item as RuleItem;
                  return (
                    <Tag
                      variant="solid"
                      size="md"
                      px={2}
                      py={1}
                      key={filePath + index}
                      fontSize="12px"
                    >
                      <Tooltip label={`Rules：${name}`}>
                        <TagLabel isTruncated>
                          <span>Rules：</span>
                          <span>{name}</span>
                        </TagLabel>
                      </Tooltip>
                      <TagCloseButton onClick={() => selectRuleHook.removeRuleAttaches([item])} />
                    </Tag>
                  );
                }
              })
            }
          </Box>
        );
      }
      default: {
        return null;
      }
    }
  }, [attachs, maskVariables, removeAttachs, selectCodebaseHook, selectDocsetHook, selectFileHook, update]);

  if (!attachs) {
    return null;
  }

  const ExcludeListExcludingPadding = [
    AttachType.NetworkModel,
    AttachType.ImageUrl,
    AttachType.KnowledgeAugmentation,
    AttachType.MultiAttachment,
  ];

  return (
    <Box
      mb={ExcludeListExcludingPadding.includes(attachs.attachType) ? '0' : '2'}
      ref={containerRef}
    >
      {containerRect.width ? (
        <Box
          style={{
            width: containerRect.width - 24,
          }}
        >
          {attachNode}
        </Box>
      ) : null}
    </Box>
  );
}

export default ChatAttachs;
