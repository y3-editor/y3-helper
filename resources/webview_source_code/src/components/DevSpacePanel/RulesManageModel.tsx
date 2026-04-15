import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
  Text,
  Box,
  Flex,
  Select,
  IconButton,
  Input,
} from '@chakra-ui/react';
import { FiEdit, FiTrash2 } from 'react-icons/fi';
import { TbChevronLeft } from 'react-icons/tb';
import { useWorkspaceStore } from '../../store/workspace';
import TagInput from '../TagInput';
import { BroadcastActions, usePostMessage } from '../../PostMessageProvider';
import { SOURCE_TAG } from './RulesGrid';

interface RulesManageModelProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface RulesManageModelHandle {
  handleAddRule: () => void;
}

const effectiveTypeOptions = [
  { value: 'always', label: '始终生效' },
  { value: 'manual', label: '手动指定' },
  { value: 'file', label: '指定文件' },
];

const RulesManageModel = React.forwardRef((props: RulesManageModelProps, ref) => {
  const { isOpen, onClose } = props;
  const rules = useWorkspaceStore((state) => state.rules);
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { postMessage } = usePostMessage();

  // 当开始添加规则时聚焦输入框
  useEffect(() => {
    if (isAddingRule && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAddingRule]);

  const handleEffectiveTypeChange = (filePath: string, newType: string) => {
    // 找到对应的规则
    const rule = rules.find(r => r.filePath === filePath);
    if (!rule) return;

    // 根据新的生效方式更新规则
    const updatedRule = { ...rule };
    
    switch (newType) {
      case 'always':
        updatedRule.metaData = {
          ...rule.metaData,
          alwaysApply: true
        };
        delete updatedRule.metaData.globs;
        break;
      case 'manual':
        updatedRule.metaData = {
          ...rule.metaData,
          alwaysApply: false
        };
        delete updatedRule.metaData.globs;
        break;
      case 'file':
        updatedRule.metaData = {
          ...rule.metaData,
          alwaysApply: false,
          globs: []
        };
        break;
    }

    // 发送更新消息
    postMessage({
      type: BroadcastActions.UPDATE_RULE,
      data: updatedRule
    });
  };

  const handleAddRule = () => {
    setIsAddingRule(true);
    setNewRuleName('');
  };

  React.useImperativeHandle(ref, () => ({
    handleAddRule: handleAddRule,
  }));

  const handleCreateRule = () => {
    const filename = newRuleName.trim();
    if (filename) {
      postMessage({
        type: BroadcastActions.CREATE_NEW_RULE,
        data: {
          filename
        },
      });
      // 重置状态
      setIsAddingRule(false);
      setNewRuleName('');
    }
  };

  const handleCancelAdd = () => {
    setIsAddingRule(false);
    setNewRuleName('');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateRule();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelAdd();
    }
  };

  const handleEditRule = (filePath: string) => {
    postMessage({
      type: 'OPEN_FILE',
      data: {
        filePath
      }
    })
  };

  const handleDeleteRule = (filePath: string) => {
    // 找到对应的规则
    const rule = rules.find(r => r.filePath === filePath);
    if (!rule) return;

    // 发送删除消息 - 将规则标记为删除状态或发送删除指令
    postMessage({
      type: BroadcastActions.DELETE_RULE,
      data: {
        filePath
      }
    });
  };

  const handleGlobsChange = (filePath: string, globs: string[]) => {
    // 找到对应的规则
    const rule = rules.find(r => r.filePath === filePath);
    if (!rule) return;

    // 更新规则的 globs 配置
    const updatedRule = {
      ...rule,
      metaData: {
        ...rule.metaData,
        globs: globs
      }
    };

    // 发送更新消息
    postMessage({
      type: BroadcastActions.UPDATE_RULE,
      data: updatedRule
    });
  };

  return (
    <Modal
      size="full"
      trapFocus={false}
      closeOnEsc={false}
      isOpen={isOpen}
      onClose={onClose}
      scrollBehavior="inside"
    >
      <ModalOverlay />
      <ModalContent
        color="text.primary" 
        onClick={(e) => e.stopPropagation()}
        data-modal-content
      >
        <ModalHeader
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          borderBottom="1px solid"
          borderColor="customBorder"
          pb={4}
        >
          <IconButton
            aria-label="back"
            icon={<TbChevronLeft />}
            mr={2}
            onClick={onClose}
          />
          <Text>
            Rules配置
          </Text>
          <Button
            size="sm"
            variant="link"
            fontSize="14px"
            color="blue.400"
            fontWeight="normal"
            p={2}
            h="auto"
            ml='auto'
            onClick={handleAddRule}
          >
            + 新建Rules
          </Button>
        </ModalHeader>

        {/* 固定表头 */}
        <Flex
          py={3}
          px={6}
          borderBottom="1px solid"
          borderColor="customBorder"
          bg="themeBgColor"
          position="sticky"
          top={0}
          zIndex={1}
          onClick={(e) => e.stopPropagation()}
        >
          <Box flex="1" fontSize="sm" fontWeight="medium" color="text.secondary">
            Rules
          </Box>
          <Box flex="1" fontSize="sm" fontWeight="medium" color="text.secondary">
            生效方式
          </Box>
          <Box w="80px" fontSize="sm" fontWeight="medium" color="text.secondary">
            操作
          </Box>
        </Flex>

        <ModalBody p={0} overflowY="auto" flex="1">
          {/* 规则列表 */}
          {rules.map((rule) => {
            const effectiveType = rule.metaData.alwaysApply ? 'always' : Array.isArray(rule.metaData?.globs) ? 'file' : 'manual';
            const isCodeMakerRule = (rule.metaData.source || 'codemaker') === 'codemaker';
            return (
              <Box key={rule.filePath}>
                <Flex
                  py={4}
                  px={6}
                  borderBottom={effectiveType === 'file' ? "none" : "1px solid"}
                  borderColor="customBorder"
                  alignItems="center"
                >
                  {/* 规则名称和标签 */}
                  <Box flex="1" minW="0">
                    <Box>
                      <Text 
                        fontSize="14px" 
                        fontWeight="500"
                        overflow="hidden"
                        textOverflow="ellipsis"
                        whiteSpace="nowrap"
                        lineHeight="1.2"
                      >
                        {rule.name}
                      </Text>
                      <Box mt="1">
                        <Box
                          display="inline-flex"
                          alignItems="center"
                          justifyContent="center"
                          px="2"
                          borderRadius="md"
                          borderWidth="1px"
                          fontSize="xs"
                          h="18px"
                          color='blue.300'
                          borderColor='blue.300'
                        >
                          <Text
                            overflow="hidden"
                            textOverflow="ellipsis"
                            whiteSpace="nowrap"
                          >
                            {SOURCE_TAG[rule.metaData.source || 'codemaker'] || 'Y3Maker'}
                          </Text>
                        </Box>
                      </Box>
                    </Box>
                  </Box>

                  {/* 生效方式 */}
                  <Box flex="1">
                    {isCodeMakerRule ? (
                      <Select
                        value={effectiveType}
                        onChange={(e) => handleEffectiveTypeChange(rule.filePath, e.target.value)}
                        size="sm"
                        maxW="150px"
                        borderColor="customBorder"
                        bg="themeBgColor"
                        color="text.primary"
                      >
                        {effectiveTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Text
                        fontSize="sm"
                        color="text.secondary"
                        px={3}
                        py={2}
                      >
                        {effectiveTypeOptions.find(opt => opt.value === effectiveType)?.label || '未知'}
                      </Text>
                    )}
                  </Box>

                  {/* 操作按钮 */}
                  <Box w="80px">
                    <Flex>
                      <IconButton
                        aria-label="编辑"
                        icon={<FiEdit />}
                        size="md"
                        variant="ghost"
                        onClick={() => handleEditRule(rule.filePath)}
                      />
                      {isCodeMakerRule && (
                        <IconButton
                          aria-label="删除"
                          icon={<FiTrash2 />}
                          size="md"
                          variant="ghost"
                          onClick={() => handleDeleteRule(rule.filePath)}
                        />
                      )}
                    </Flex>
                  </Box>
                </Flex>
                
                {/* 文件模式时显示 TagInput - 统一使用 TagInput 组件 */}
                {effectiveType === 'file' && (
                  <Box 
                    px={6} 
                    pb={4} 
                    borderBottom="1px solid" 
                    borderColor="customBorder"
                  >
                    <TagInput
                      value={rule.metaData?.globs || []}
                      onChange={isCodeMakerRule ? (globs) => handleGlobsChange(rule.filePath, globs) : undefined}
                      placeholder={isCodeMakerRule ? "输入文件匹配模式，如 **/*.ts，回车确认" : "无文件匹配模式"}
                      size="sm"
                      disabled={!isCodeMakerRule}
                    />
                  </Box>
                )}
              </Box>
            );
          })}

          {/* 新增规则输入框 */}
          {isAddingRule && (
            <Flex
              py={4}
              px={6}
              borderBottom="1px solid"
              borderColor="customBorder"
              alignItems="center"
            >
              {/* 规则名称输入框 */}
              <Flex alignItems="center" flex="1">
                <Input
                  ref={inputRef}
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  onBlur={()=> {handleCancelAdd()}}
                  onKeyDown={handleInputKeyDown}
                  placeholder="新建规则，请输入 rules 文件名（如 component），Enter 确认"
                  size="sm"
                  fontSize="sm"
                  borderColor="customBorder"
                  _focus={{
                    borderColor: "blue.400",
                    boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)",
                  }}
                />
              </Flex>
            </Flex>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
});

export default RulesManageModel;