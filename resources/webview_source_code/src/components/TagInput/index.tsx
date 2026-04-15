import {
  Box,
  Input,
  Tag,
  TagLabel,
  TagCloseButton,
  Wrap,
  WrapItem,
  VStack
} from '@chakra-ui/react';
import { useState, KeyboardEvent } from 'react';

interface TagInputProps {
  value?: string[];
  onChange?: (tags: string[]) => void;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export default function TagInput({ 
  value, 
  onChange, 
  placeholder = "输入后按回车添加",
  size = "md",
  disabled = false
}: TagInputProps) {
  const [internalTags, setInternalTags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');

  const tags = value !== undefined ? value : internalTags;

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    
    if (['Enter', 'Tab'].includes(e.key) && inputValue.trim()) {
      e.preventDefault();
      const newTag = inputValue.trim();
      if (!tags.includes(newTag)) {
        const newTags = [...tags, newTag];
        if (onChange) {
          onChange(newTags);
        } else {
          setInternalTags(newTags);
        }
      }
      setInputValue('');
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      // 当输入框为空且有 tags 时，按 backspace 删除最后一个 tag
      e.preventDefault();
      const newTags = tags.slice(0, -1);
      if (onChange) {
        onChange(newTags);
      } else {
        setInternalTags(newTags);
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    if (disabled) return;
    
    const newTags = tags.filter(tag => tag !== tagToRemove);
    if (onChange) {
      onChange(newTags);
    } else {
      setInternalTags(newTags);
    }
  };

  const getInputSize = () => {
    switch (size) {
      case 'sm': return { fontSize: 'sm', minH: '32px' };
      case 'lg': return { fontSize: 'lg', minH: '48px' };
      default: return { fontSize: 'md', minH: '40px' };
    }
  };

  const getTagSize = () => {
    switch (size) {
      case 'sm': return 'sm';
      case 'lg': return 'lg';
      default: return 'md';
    }
  };

  const inputStyles = getInputSize();

  return (
    <VStack align="stretch" spacing={2}>
      <Box
        border="1px"
        borderColor="customBorder"
        borderRadius="md"
        p={2}
        minH={inputStyles.minH}
        _focusWithin={disabled ? {} : { borderColor: "blue.400" }}
        bg={disabled ? "gray.50" : "themeBgColor"}
        _dark={{
          bg: disabled ? "gray.700" : undefined
        }}
        opacity={disabled ? 0.6 : 1}
        cursor={disabled ? "not-allowed" : "default"}
      >
        <Wrap spacing={2}>
          {tags.map((tag) => (
            <WrapItem key={tag}>
              <Tag size={getTagSize()} variant="solid" colorScheme={disabled ? "gray" : "blue"}>
                <TagLabel>{tag}</TagLabel>
                {!disabled && (
                  <TagCloseButton onClick={() => removeTag(tag)} />
                )}
              </Tag>
            </WrapItem>
          ))}
          {!disabled && (
            <WrapItem flex={1} minW="120px">
              <Input
                variant="unstyled"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                fontSize={inputStyles.fontSize}
                color="text.primary"
                _placeholder={{ color: "text.muted" }}
              />
            </WrapItem>
          )}
        </Wrap>
      </Box>
    </VStack>
  );
}