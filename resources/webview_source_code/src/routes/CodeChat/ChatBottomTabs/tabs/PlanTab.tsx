import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  VStack,
  useDisclosure,
} from '@chakra-ui/react';
import TodoList from '../../../../components/TodoList';
import TodoEditForm from './TodoEditForm';
import ConfirmDialog from '../../../../components/ConfirmDialog';
import { FiCheck, FiX, FiPlus, FiTrash2 } from 'react-icons/fi';
import { usePlanEditing } from '../../../../hooks/usePlanEditing';
import type { DockTabHelpers } from '../../../../types/dock-tabs';

export type PlanTabApi = {
  isEditing: boolean;
};

const PlanTab = forwardRef<PlanTabApi, DockTabHelpers>(
  function PlanTab(props, ref) {
    const { setActions, triggerUpdate, expanded, setExpanded } = props;
    const curTriggerUpdate = useRef(triggerUpdate);
    const curSetActions = useRef(setActions);
    curTriggerUpdate.current = triggerUpdate;
    curSetActions.current = setActions;

    const {
      todos,
      editingItemId,
      editingItem,
      isEditing,
      startEditing,
      saveChanges,
      cancelEditing,
      updateDraftTitle,
      updateDraftDesc,
      quickToggleStatus,
      addNewTodo,
      deleteTodo,
      clearAllTodos,
    } = usePlanEditing();

    const { isOpen, onOpen, onClose } = useDisclosure();

    // 确保面板展开的辅助函数
    const ensureExpanded = useCallback(() => {
      if (!expanded) {
        setExpanded(true);
      }
    }, [expanded, setExpanded]);

    // 包装后的操作函数
    const handleAddNewTodo = useCallback(() => {
      ensureExpanded();
      addNewTodo();
    }, [addNewTodo, ensureExpanded]);

    const handleOpenClearDialog = useCallback(() => {
      ensureExpanded();
      onOpen();
    }, [ensureExpanded, onOpen]);

    const handleDeleteTodo = (id: number) => {
      ensureExpanded();
      deleteTodo(id);
    };

    useImperativeHandle(
      ref,
      () => ({
        isEditing,
      }),
      [isEditing],
    );

    const actionsNode = useMemo(() => {
      if (isEditing) {
        // 编辑状态：显示保存和取消按钮
        return (
          <Box display="flex" alignItems="center" gap={1}>
            <Tooltip label="保存">
              <IconButton
                aria-label="保存编辑"
                size="sm"
                variant="ghost"
                icon={<FiCheck />}
                p={0}
                m={0}
                minW="auto"
                w="24px"
                h="24px"
                onClick={saveChanges}
              />
            </Tooltip>
            <Tooltip label="取消">
              <IconButton
                aria-label="取消编辑"
                size="sm"
                variant="ghost"
                icon={<FiX />}
                p={0}
                m={0}
                minW="auto"
                w="24px"
                h="24px"
                onClick={cancelEditing}
              />
            </Tooltip>
          </Box>
        );
      } else {
        // 非编辑状态：显示新增按钮和清空按钮
        return (
          <Box display="flex" alignItems="center" gap={1}>
            <Tooltip label="新增">
              <IconButton
                aria-label="新增"
                bg="whiteAlpha.100"
                _hover={{
                  bg: 'whiteAlpha.200',
                }}
                size="sm"
                variant="ghost"
                icon={<FiPlus />}
                p={0}
                m={0}
                minW="auto"
                w="24px"
                h="24px"
                onClick={handleAddNewTodo}
              />
            </Tooltip>
            {todos.length > 0 && (
              <Tooltip label="清空">
                <IconButton
                  aria-label="清空"
                  bg="whiteAlpha.100"
                  _hover={{
                    bg: 'whiteAlpha.200',
                  }}
                  size="sm"
                  variant="ghost"
                  icon={<FiTrash2 />}
                  p={0}
                  m={0}
                  minW="auto"
                  w="24px"
                  h="24px"
                  onClick={handleOpenClearDialog}
                />
              </Tooltip>
            )}
          </Box>
        );
      }
    }, [
      cancelEditing,
      handleAddNewTodo,
      handleOpenClearDialog,
      isEditing,
      saveChanges,
      todos.length,
    ]);

    useEffect(() => {
      curSetActions.current?.(actionsNode);
    }, [actionsNode]);

    // 当 isEditing 状态变化时，通知父组件更新
    useEffect(() => {
      curTriggerUpdate.current?.();
    }, [isEditing]);

    return (
      <>
        <VStack align="stretch" spacing={2} p={1}>
          {todos && todos.length > 0 && !editingItem && (
            <TodoList
              todos={todos}
              showCheckbox
              readOnly={false}
              onToggle={quickToggleStatus}
              onItemClick={startEditing}
              isItemClickable={(item) => item.status !== 'completed'}
              onDelete={handleDeleteTodo}
            />
          )}
          {editingItem && editingItemId !== null && (
            <TodoEditForm
              todo={editingItem}
              onTitleChange={(value) => updateDraftTitle(editingItemId, value)}
              onDescriptionChange={(value) =>
                updateDraftDesc(editingItemId, value)
              }
            />
          )}
        </VStack>

        <ConfirmDialog
          isOpen={isOpen}
          onClose={onClose}
          onConfirm={clearAllTodos}
          title="清空 Plans"
          message="您确定要清空所有 Plans 吗？此操作不可撤销。"
          confirmText="确认清空"
          cancelText="取消"
          confirmColorScheme="red"
        />
      </>
    );
  },
);

export default PlanTab;
