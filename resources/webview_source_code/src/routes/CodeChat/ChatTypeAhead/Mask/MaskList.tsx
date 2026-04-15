import {
  Flex,
  Spinner,
  Box,
  Text,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Grid,
  Tooltip,
} from '@chakra-ui/react';
import { TbDotsVertical } from 'react-icons/tb';
import { Prompt, PromptCategoryType } from '../../../../services/prompt';
import TypeAheadRowItem from '../TypeAheadRowItem';
import { useMaskStore } from '../../../../store/mask';
import { TypeAheadSubProps } from '../const';

type MaskListProps = TypeAheadSubProps & {
  loading: boolean;
  prompts: Prompt[];
  onEdit: (mask: Prompt) => void;
  onRemove: (mask: Prompt) => void;
};

function MaskList(props: MaskListProps) {
  const { loading, prompts, onEdit, onRemove, updateOpenState } = props;
  const changeMask = useMaskStore((state) => state.changeMask);
  const handleChangeMask = (mask: Prompt) => {
    changeMask(mask);
    updateOpenState(false);
  };

  if (loading) {
    return (
      <Flex w="full" h="full" p={4} justifyContent="center">
        <Spinner size="md" />
      </Flex>
    );
  }

  if (prompts.length === 0) {
    return (
      <Flex w="full" h="full" p={4} justifyContent="center">
        无自定义的模式
      </Flex>
    );
  }

  return prompts.map((item, index) => {
    return (
      <TypeAheadRowItem
        key={item._id}
        index={index}
        onClick={() => handleChangeMask(item)}
      >
        <Box
          position="relative"
          textAlign="left"
          w="full"
          h="full"
          py={2}
          color="text.primary"
        >
          {item.type !== PromptCategoryType._CodeMaker ? (
            <CustomMask
              key={index}
              prompt={item}
              onEdit={onEdit}
              onRemove={onRemove}
            />
          ) : (
            <Box gap={1}>
              <Text fontSize="14px" isTruncated>
                {item.name}
              </Text>
              <Tooltip label={item.description}>
                <Text fontSize="12px" opacity="0.6" isTruncated>
                  {item.description}
                </Text>
              </Tooltip>
            </Box>
          )}
        </Box>
      </TypeAheadRowItem>
    );
  });
}

function CustomMask(props: {
  prompt: Prompt;
  onEdit: (prompt: Prompt) => void;
  onRemove: (prompt: Prompt) => void;
}) {
  const { prompt, onEdit, onRemove } = props;

  return (
    <Grid w="full" gridTemplateColumns="1fr 40px">
      <Grid gap={1}>
        <Text fontSize="14px" isTruncated>
          {prompt.name}
        </Text>
        <Text fontSize="12px" opacity="0.6" isTruncated>
          {prompt.description}
        </Text>
      </Grid>
      <Grid
        px={2}
        alignItems="center"
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
        }}
      >
        <Menu isLazy placement="left" boundary="scrollParent">
          <MenuButton
            size="sm"
            as={IconButton}
            icon={<TbDotsVertical />}
          ></MenuButton>
          <MenuList minWidth="64px">
            <MenuItem onClick={() => onEdit(prompt)}>编辑</MenuItem>
            <MenuItem onClick={() => onRemove(prompt)}>删除</MenuItem>
          </MenuList>
        </Menu>
      </Grid>
    </Grid>
  );
}

export default MaskList;
