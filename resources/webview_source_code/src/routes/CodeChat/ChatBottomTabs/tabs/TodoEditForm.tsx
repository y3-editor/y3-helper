import { Box, Input, Textarea, Text, VStack } from '@chakra-ui/react';
import type { TodoItem } from '../../../../store/workspace/tools/todo';

interface TodoEditFormProps {
  todo: TodoItem;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}

export default function TodoEditForm({
  todo,
  onTitleChange,
  onDescriptionChange,
}: TodoEditFormProps) {
  return (
    <VStack align="stretch" spacing={2}>
      <Box p={1} borderRadius="4px" bg="transparent">
        {/* <HStack justify="space-between" align="center" mb={2}>
          <Text fontSize="xs" color="text.secondary">
            状态: {todo.status}
          </Text>
        </HStack> */}

        <Text fontSize="xs" color="text.secondary" mb={1}>
          Title
        </Text>
        <Input
          size="sm"
          value={todo.title}
          onChange={(e) => onTitleChange(e.target.value)}
          isDisabled={todo.status === 'completed'}
        />
        <Text fontSize="xs" color="text.secondary" mt={2} mb={1}>
          Description
        </Text>
        <Textarea
          size="sm"
          value={todo.description || ''}
          onChange={(e) => onDescriptionChange(e.target.value)}
          isDisabled={todo.status === 'completed'}
        />
      </Box>
    </VStack>
  );
}
