import { Box, Flex, useMediaQuery } from '@chakra-ui/react';
import Icon from '../Icon';
import { FaCircleCheck } from 'react-icons/fa6';
import { useConfigStore } from '../../store/config';
import { SmallScreenWidth } from '../../const';

const TabMenu = () => {
  const [isSmallScreen] = useMediaQuery(SmallScreenWidth);
  const [tabs, updateConfig] = useConfigStore((state) => [
    state.config.tabs,
    state.updateConfig,
  ]);

  const updateTabs = (currentTab: string) => {
    updateConfig((state) => {
      state.tabs = state.tabs.map((i) => {
        if (i.value === currentTab) {
          return {
            ...i,
            selected: !i.selected,
          };
        }
        return i;
      });
    });
  };

  return (
    <Box
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <Flex gap="4" flexWrap="wrap">
        {tabs
          .filter((i) => i.value !== 'help' && !i.disabled)
          .map((tab) => (
            <Box
              key={tab.value}
              onClick={() => {
                updateTabs(tab.value);
              }}
              display="flex"
              alignItems="center"
              mt={isSmallScreen ? '4' : '0'}
              cursor="pointer"
            >
              <Icon
                as={FaCircleCheck}
                className="mr-2"
                size="xs"
                color={tab.selected ? 'green.400' : 'text.default'}
              />
              {tab.label}
            </Box>
          ))}
      </Flex>
    </Box>
  );
};

export default TabMenu;
