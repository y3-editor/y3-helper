import { Box, Text, Tooltip, VStack, IconButton } from '@chakra-ui/react';
import { FiMinus } from 'react-icons/fi';
import TaskStatusRadio from '../TaskStatusRadio';
import { TodoItem } from '../../store/workspace/tools/todo';

export default function TodoList(props: {
  todos: ReadonlyArray<TodoItem>;
  showCheckbox?: boolean;
  readOnly?: boolean;
  showStatusLabel?: boolean;
  onToggle?: (index: number) => void;
  onItemClick?: (index: number) => void;
  isItemClickable?: (item: TodoItem, index: number) => boolean;
  onDelete?: (index: number) => void;
}) {
  const {
    todos = [],
    showCheckbox = false,
    readOnly = true,
    onToggle,
    showStatusLabel = false,
    onItemClick,
    isItemClickable,
    onDelete,
  } = props;

  if (todos.length === 0) {
    return (
      <Text textAlign="center" color="gray.500">
        清空所有任务
      </Text>
    );
  }

  return (
    <VStack align="stretch" spacing={1}>
      {todos.map((todo, index) => {
        const isClickable =
          onItemClick &&
          (isItemClickable ? isItemClickable(todo, index) : true);
        return (
          <Box
            key={index}
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            fontSize="sm"
            borderRadius="4px"
            px={1}
            position="relative"
            _hover={{
              '& .delete-btn': {
                opacity: 1,
              },
            }}
          >
            <Box display="flex" alignItems="center" gap={2} flex={1}>
              {showCheckbox ? (
                <Box
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <TaskStatusRadio
                    status={todo.status}
                    readOnly={readOnly}
                    onClick={() => onToggle?.(index)}
                  />
                </Box>
              ) : null}
              <Tooltip label={todo.description || ''}>
                <Box
                  ml="-2"
                  px="1"
                  borderRadius="4px"
                  transition="all 0.2s"
                  cursor={isClickable ? 'text' : 'default'}
                  flex={1}
                  onClick={isClickable ? () => onItemClick?.(index) : undefined}
                  borderWidth="1px"
                  borderStyle="solid"
                  borderColor="transparent"
                  _hover={
                    isClickable
                      ? {
                          bg: 'gray.50',
                          borderColor: 'gray.200',
                        }
                      : {}
                  }
                  _dark={{
                    _hover: isClickable
                      ? {
                          bg: 'gray.700',
                          borderColor: 'gray.600',
                        }
                      : {},
                  }}
                >
                  {todo.title || todo.description || 'Untitled Task'}
                </Box>
              </Tooltip>
            </Box>
            {isClickable && onDelete && (
              <IconButton
                className="delete-btn"
                aria-label="删除"
                size="sm"
                variant="ghost"
                icon={<FiMinus />}
                opacity={0}
                transition="opacity 0.2s"
                p={0}
                m={0}
                minW="auto"
                w="20px"
                h="20px"
                fontSize="14px"
                _hover={{
                  bg: 'red.100',
                  color: 'red.600',
                }}
                _dark={{
                  _hover: {
                    bg: 'red.900',
                    color: 'red.300',
                  },
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(index);
                }}
              />
            )}
            {showStatusLabel ? <Text ml={2}>{todo.status}</Text> : null}
          </Box>
        );
      })}
    </VStack>
  );
}
