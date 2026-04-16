import { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Box,
  Flex,
  Text,
  Switch,
  Tooltip,
  IconButton,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Button,
  Badge,
  Input,
  InputGroup,
  InputLeftElement,
} from '@chakra-ui/react';
import { DeleteIcon, SearchIcon } from '@chakra-ui/icons';
import * as React from 'react';
import { useSkillsStore, getSkillSourceLabel } from '../../store/skills';
import { ThemeStyle, useTheme } from '../../ThemeContext';
import { BroadcastActions, usePostMessage } from '../../PostMessageProvider';
import useCustomToast from '../../hooks/useCustomToast';

interface SkillSettingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SkillSettingModal: React.FC<SkillSettingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { postMessage } = usePostMessage();
  const { toast } = useCustomToast();
  const skills = useSkillsStore((state) => state.skills);
  const skillConfigs = useSkillsStore((state) => state.skillConfigs);
  const setSkillConfig = useSkillsStore((state) => state.setSkillConfig);
  const { activeTheme } = useTheme();

  // 删除确认弹窗相关状态
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [skillToDelete, setSkillToDelete] = useState<{ name: string; hubSkillId?: string } | null>(null);
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  // 搜索关键词状态
  const [searchKeyword, setSearchKeyword] = useState('');

  // 文件导入的 ref
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleToggleSkill = (skillName: string, isEnabled: boolean) => {
    const disabled = !isEnabled;
    setSkillConfig(skillName, { disabled });
    postMessage({
      type: BroadcastActions.UPDATE_SKILL_CONFIG,
      data: { name: skillName, disabled },
    });
  };

  const handleRemoveSkill = (skillName: string, hubSkillId?: string) => {
    setSkillToDelete({ name: skillName, hubSkillId });
    setIsDeleteAlertOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (skillToDelete) {
      postMessage({
        type: BroadcastActions.REMOVE_SKILL,
        data: { name: skillToDelete.name, hubSkillId: skillToDelete.hubSkillId }
      });
      setIsDeleteAlertOpen(false);
      setSkillToDelete(null);
    }
  };

  // 点击导入 Skill 按钮
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // 处理文件选择
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isMd = file.name.endsWith('.md');
    const isZip = file.name.endsWith('.zip');

    if (!isMd && !isZip) {
      toast({
        title: '仅支持导入 .md 或 .zip 文件',
        status: 'error',
        duration: 3000,
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      if (!arrayBuffer) {
        toast({
          title: '读取文件内容为空',
          status: 'error',
          duration: 3000,
        });
        return;
      }

      // 转换为 Base64
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64 = btoa(binary);

      postMessage({
        type: BroadcastActions.UPLOAD_SKILL,
        data: {
          fileName: file.name,
          fileContent: base64,
          fileType: isZip ? 'zip' : 'md',
        },
      });

      toast({
        title: isZip ? '正在导入 Skill 压缩包...' : '正在导入 Skill...',
        status: 'info',
        duration: 1000,
      });
    };

    reader.onerror = () => {
      toast({
        title: '读取文件失败',
        status: 'error',
        duration: 3000,
      });
    };

    reader.readAsArrayBuffer(file);
  };

  const handleClose = () => {
    onClose();
  };

  const isDark = activeTheme !== ThemeStyle.Light;
  const cardBg = isDark ? '#1e1e1e' : '#fff';

  // 处理 Skill 安装/更新结果
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, data } = event.data;

      if (type === 'INSTALL_BUILTIN_SKILL_RESULT') {
        const { success, skillName, error, isUpdate } = data || {};

        if (isOpen && success && isUpdate) {
          toast({
            title: '更新成功',
            description: `Skill "${skillName}" 已更新`,
            status: 'success',
            duration: 3000,
          });
        } else if (isOpen && !success && isUpdate) {
          toast({
            title: '更新失败',
            description: error || '未知错误',
            status: 'error',
            duration: 3000,
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [toast, postMessage, isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="full">
      <ModalOverlay />
      <ModalContent h="100vh" maxH="100vh">
        <ModalHeader>Skills 配置</ModalHeader>
        <ModalCloseButton />
        <ModalBody overflowY="auto">
          {/* 导入 Skill 按钮 + 隐藏的文件输入框 */}
          <Flex alignItems="center" justifyContent="flex-end" mb={4}>
            <Button
              size="sm"
              colorScheme="blue"
              color="white"
              _hover={{ bg: '#5a4fcf' }}
              onClick={handleUploadClick}
            >
              导入 Skill
            </Button>
          </Flex>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.zip"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {/* 已安装的 Skills */}
          <Flex alignItems="center" justifyContent="space-between" mb={4}>
            <Text fontSize="sm" color="gray.500">
              已检测到的本地 Skills（共 {skills.length} 个）
            </Text>
            <Flex alignItems="center" gap={3}>
              <InputGroup size="sm" w="200px" bg={cardBg}>
                <InputLeftElement pointerEvents="none">
                  <SearchIcon color="gray.400" />
                </InputLeftElement>
                <Input
                  placeholder="搜索 Skill"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  borderRadius="md"
                />
              </InputGroup>
            </Flex>
          </Flex>

          {(() => {
            const filteredSkills = skills.filter((skill) => {
              if (!searchKeyword.trim()) return true;
              const keyword = searchKeyword.toLowerCase();
              const displayName = (skill.display_name || skill.name).toLowerCase();
              const skillName = skill.name.toLowerCase();
              const description = (skill.description_cn || skill.description || '').toLowerCase();
              return displayName.includes(keyword) || skillName.includes(keyword) || description.includes(keyword);
            });

            if (skills.length === 0) {
              return (
                <Box p={4} textAlign="center" color="gray.500">
                  暂未扫描到 Skill，请在支持的目录下添加 Skill 文件
                </Box>
              );
            }

            if (filteredSkills.length === 0) {
              return (
                <Box p={4} textAlign="center" color="gray.500">
                  未找到匹配的 Skill
                </Box>
              );
            }

            return filteredSkills.map((skill) => {
              const config = skillConfigs[skill.name];
              const isEnabled = !config?.disabled;
              const sourceLabel = getSkillSourceLabel(skill.source);
              const isBuiltin = skill.name === 'skill-creator';
              const subLabel = isBuiltin ? 'System Built-in' : `${sourceLabel}/${skill.name}`;
              return (
                <Box
                  key={skill.name}
                  mb={3}
                  p={4}
                  borderWidth="1px"
                  borderRadius="md"
                  bg={cardBg}
                >
                  <Flex alignItems="center" justifyContent="space-between">
                    {/* 左侧：名称 + 来源路径 */}
                    <Box flex={1} minW={0}>
                      <Flex alignItems="center" gap={2}>
                        <Text
                          fontWeight="medium"
                          fontSize="md"
                          color={isDark ? '#e0e0e0' : '#222'}
                          title={skill.description_cn || skill.description}
                        >
                          {skill.display_name || skill.name}
                        </Text>
                        {isBuiltin && (
                          <Badge
                            fontSize="10px"
                            px={1.5}
                            py={0.5}
                            borderRadius="sm"
                            colorScheme="gray"
                            textTransform="none"
                            fontWeight="normal"
                          >
                            Built-in
                          </Badge>
                        )}
                      </Flex>
                      <Text
                        fontSize="xs"
                        color="gray.500"
                        mt={0.5}
                        noOfLines={1}
                        title={subLabel}
                        wordBreak="break-word"
                      >
                        {subLabel}
                      </Text>
                    </Box>

                    {/* 右侧：开关 + 删除 */}
                    <Flex gap={2} alignItems="center" flexShrink={0} ml={3}>
                      <Tooltip
                        label={isEnabled ? 'Skill 已启用' : 'Skill 已禁用'}
                        placement="top"
                      >
                        <Box display="flex" alignItems="center">
                          <Switch
                            isChecked={isEnabled}
                            onChange={(e) => handleToggleSkill(skill.name, e.target.checked)}
                            colorScheme="blue"
                            size="md"
                          />
                        </Box>
                      </Tooltip>
                      <Tooltip label="删除" placement="top">
                        <IconButton
                          aria-label="删除 Skill"
                          icon={<DeleteIcon />}
                          size="sm"
                          variant="ghost"
                          colorScheme="red"
                          onClick={() =>
                            handleRemoveSkill(skill.name, skill.hubSkillId)
                          }
                        />
                      </Tooltip>
                    </Flex>
                  </Flex>
                </Box>
              );
            });
          })()}
        </ModalBody>
      </ModalContent>

      {/* 删除确认弹窗 */}
      <AlertDialog
        isOpen={isDeleteAlertOpen}
        leastDestructiveRef={cancelRef}
        onClose={() => setIsDeleteAlertOpen(false)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              删除 Skill
            </AlertDialogHeader>

            <AlertDialogBody>
              确认要删除 Skill "{skillToDelete?.name}" 吗？此操作将删除本地文件，不可恢复。
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setIsDeleteAlertOpen(false)}>
                取消
              </Button>
              <Button colorScheme="red" onClick={handleDeleteConfirm} ml={3}>
                删除
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Modal>
  );
};

export default SkillSettingModal;
