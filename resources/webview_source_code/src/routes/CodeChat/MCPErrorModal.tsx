import React from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Box,
  Text,
  VStack,
  HStack,
  Divider,
} from '@chakra-ui/react';
import { useMCPStore } from '../../store/mcp';
import { ThemeStyle, useTheme } from '../../ThemeContext';

const MCPErrorModal: React.FC = () => {
  const { showMcpError, setShowMcpError, MCPServers } = useMCPStore();
  const { activeTheme } = useTheme();
  const isLightMode = activeTheme === ThemeStyle.Light;

  // 筛选出有错误的服务器
  const serversWithErrors = MCPServers.filter(server => server.error && server.error.trim() !== '');

  const handleClose = () => {
    setShowMcpError(false);
  };

  return (
    <Modal isOpen={showMcpError} onClose={handleClose} size="lg">
      <ModalOverlay />
      <ModalContent maxH="80vh">
        <ModalHeader>MCP 服务错误</ModalHeader>
        <ModalCloseButton />
        <ModalBody
          maxH="calc(80vh - 140px)"
          overflowY="auto"
          px={6}
          pb={4}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: isLightMode ? '#cccccc #f0f0f0' : '#666666 #333333',
          }}
          css={{
            '&::-webkit-scrollbar': {
              width: '8px',
              display: 'block',
            },
            '&::-webkit-scrollbar-track': {
              background: isLightMode ? '#f0f0f0' : '#333333',
              display: 'block',
            },
            '&::-webkit-scrollbar-thumb': {
              background: isLightMode ? '#cccccc' : '#666666',
              borderRadius: '4px',
              display: 'block',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: isLightMode ? '#b0b0b0' : '#888888',
            },
          }}
        >
          {serversWithErrors.length === 0 ? (
            <Box py={8} textAlign="center">
              <Text color={isLightMode ? 'gray.600' : 'gray.500'}>暂无 MCP 服务错误</Text>
            </Box>
          ) : (
            <VStack spacing={4} align="stretch">
              {serversWithErrors.map((server, index) => (
                <Box key={`error-${server.name}-${index}`}>
                  <VStack align="stretch" spacing={2}>
                    <HStack>
                      <Text fontWeight="bold" fontSize="md">
                        {server.name}
                      </Text>
                      {server.status && (
                        <Text fontSize="xs" color={isLightMode ? 'gray.600' : 'gray.500'}>
                          ({server.status})
                        </Text>
                      )}
                    </HStack>
                    <Box
                      bg={isLightMode ? 'red.50' : 'red.900'}
                      borderRadius="md"
                      p={3}
                      borderLeft="4px solid"
                      borderColor={isLightMode ? 'red.400' : 'red.500'}
                    >
                      <Text
                        fontSize="sm"
                        color={isLightMode ? 'red.800' : 'red.100'}
                        whiteSpace="pre-wrap"
                      >
                        {server.error}
                      </Text>
                    </Box>
                  </VStack>
                  {index < serversWithErrors.length - 1 && <Divider mt={4} />}
                </Box>
              ))}
            </VStack>
          )}
        </ModalBody>

        <ModalFooter>
          <Button onClick={handleClose}>关闭</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default MCPErrorModal;
