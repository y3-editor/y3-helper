import * as React from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';

interface SectionHeadingProps {
  label: string;
  count: number;
  isDark: boolean;
}

const SectionHeading: React.FC<SectionHeadingProps> = ({
  label,
  count,
  isDark,
}) => (
  <Flex alignItems="center" gap={2} mb={3}>
    <Text
      fontSize="11px"
      fontWeight="600"
      letterSpacing="0.08em"
      textTransform="uppercase"
      color={isDark ? 'gray.500' : 'gray.400'}
    >
      {label}
    </Text>
    <Box
      px={1.5}
      py={0}
      borderRadius="full"
      bg={isDark ? 'rgba(255,255,255,0.08)' : 'gray.100'}
      minW="18px"
      textAlign="center"
    >
      <Text fontSize="10px" color={isDark ? 'gray.400' : 'gray.500'} lineHeight="18px">
        {count}
      </Text>
    </Box>
    <Box flex={1} h="1px" bg={isDark ? 'rgba(255,255,255,0.06)' : 'gray.100'} />
  </Flex>
);

export default SectionHeading;