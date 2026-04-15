import { Box } from '@chakra-ui/react';
function NavKeyboardShortcut(props: {
  label: string;
  value: string;
  onClick?: () => void;
}) {
  const { label, value, onClick } = props;
  return (
    <Box minH="8" display="flex" alignItems="center" flexWrap="wrap" gap="4">
      <Box mr="6" minW="126px">
        {label}
      </Box>
      <Box
        w="200px"
        minH="8"
        pl="4"
        display="flex"
        alignItems="center"
        border="1px solid rgba(255, 255, 255, 0.1)"
        bg="themeBgColor"
        borderRadius="8px"
        color="text.default"
        onClick={() => {
          if (onClick) {
            onClick();
          }
        }}
        _hover={{
          cursor: 'pointer',
        }}
      >
        {value}
      </Box>
    </Box>
  );
}

export default NavKeyboardShortcut;
