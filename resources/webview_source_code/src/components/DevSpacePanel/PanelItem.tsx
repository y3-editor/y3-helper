import * as React from 'react';
import { Box } from '@chakra-ui/react';

interface PanelItemProps {
  key?: string | number;
  active: boolean;
  onClick: () => void;
}

function PanelItem(
  props: React.PropsWithChildren<PanelItemProps>,
) {
  const { key, active, onClick } = props;
  return (
    <Box
      data-index={key}
      h="auto"
      pl={4}
      pr={2}
      ml={2}
      mr={3}
      backgroundColor={active ? 'blue.300' : 'listBgColor'}
      color={active ? 'gray.800' : 'text.primary'}
      cursor="pointer"
      borderRadius="md"
      fontWeight="bold"
      _hover={{
        bg: active ? 'blue.300' : 'listBgColor',
      }}
      onClick={onClick}
    >
      {props.children}
    </Box>
  );
}

export default PanelItem;
