import * as React from 'react';
import { Box } from '@chakra-ui/react';

interface TypeAheadRowItemProps {
  index: number;
  currentIndex?: number;
  onClick: (e: React.MouseEvent) => void;
}

function TypeAheadRowItem(
  props: React.PropsWithChildren<TypeAheadRowItemProps>,
) {
  const { index, currentIndex } = props;
  return (
    <Box
      data-index={index}
      w="full"
      h="auto"
      pl={4}
      pr={2}
      backgroundColor={currentIndex === index ? 'blue.300' : 'listBgColor'}
      color={currentIndex === index ? 'gray.800' : 'text.primary'}
      cursor="pointer"
      borderRadius="md"
      fontWeight="bold"
      _hover={{
        bg: currentIndex === index ? 'blue.300' : 'listBgColor',
      }}
      onClick={props.onClick}
    >
      {props.children}
    </Box>
  );
}

export default TypeAheadRowItem;
