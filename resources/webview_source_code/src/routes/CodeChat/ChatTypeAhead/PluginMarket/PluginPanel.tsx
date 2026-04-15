import { Flex, Text } from '@chakra-ui/react';
import PluginAppList from './PluginList';
import { IDE, useExtensionStore } from '../../../../store/extension';

const PluginPanel = () => {
  const ide = useExtensionStore((state) => state.IDE);
  if (ide === IDE.JetBrains) {
    return (
      <Flex
        w="full"
        minH="120px"
        flexDirection="column"
        p={2}
        gap={2}
        bg="themeBgColor"
        alignItems="center"
        justifyContent="center"
      >
        <Text>敬请期待</Text>
      </Flex>
    );
  }
  return (
    <Flex w="full" flexDirection="column" p={2} gap={2} bg="themeBgColor">
      <PluginAppList></PluginAppList>
    </Flex>
  );
};

export default PluginPanel;
