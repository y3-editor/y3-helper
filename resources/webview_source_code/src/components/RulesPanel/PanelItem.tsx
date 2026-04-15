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
      backgroundColor={active ? '#6B6CFF' : 'itemBgColor'}
      color={active ? 'white' : 'text.primary'}
      cursor="pointer"
      borderRadius="md"
      fontWeight="bold"
      _hover={{
        bg: active ? '#6B6CFF' : 'itemBgColor',
      }}
      onClick={onClick}
    >
      {props.children}
    </Box>
  );
}

export default PanelItem;
