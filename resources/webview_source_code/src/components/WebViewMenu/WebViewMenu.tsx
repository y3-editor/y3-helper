import * as React from 'react';
import {
  IconButton,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  useOutsideClick,
  VStack,
  Box,
} from '@chakra-ui/react';
import { BroadcastActions, usePostMessage } from '../../PostMessageProvider';
import Icon from '../Icon';
import { TbDotsVertical } from 'react-icons/tb';
import { VscNewFile } from 'react-icons/vsc';
import TabsMenu from '../TabMenu';
import { IDE, useExtensionStore } from '../../store/extension';

const WebViewMenu = () => {
  const { postMessage } = usePostMessage();
  const [isOpen, setIsOpen] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const ide = useExtensionStore((state) => state.IDE);
  useOutsideClick({
    ref: popoverRef,
    handler: (e) => {
      if (
        popoverRef &&
        popoverRef.current &&
        popoverRef.current.contains(e.target as Node)
      ) {
        return;
      }
      setIsOpen(false);
    },
  });

  return (
    <Box ref={popoverRef}>
      <Popover placement="bottom" closeOnBlur={true} isOpen={isOpen} isLazy>
        <PopoverTrigger>
          <IconButton
            variant="ghost"
            aria-label="更多"
            size="xs"
            icon={<Icon as={TbDotsVertical} size="sm" />}
            color="text.default"
            onClick={() => setIsOpen((prev) => !prev)}
          />
        </PopoverTrigger>
        <PopoverContent w="160px">
          <PopoverBody w="160px" fontSize="12px">
            <VStack align="stretch" w="full">
              {ide == IDE.VisualStudioCode ? (
                <Box
                  w="full"
                  cursor="pointer"
                  px={1}
                  _hover={{ bg: 'blue.300' }}
                  borderRadius="4px"
                  alignItems="center"
                  onClick={() => {
                    postMessage({
                      type: BroadcastActions.OPEN_WEBVIEW_IN_NEW_WINDOW,
                    });
                  }}
                  color="text.default"
                >
                  <Icon as={VscNewFile} size="sm" className="mt-[-2px]" />
                  在编辑器中打开聊天
                </Box>
              ) : null}

              <Box
                w="full"
                cursor="pointer"
                px={1}
                _hover={{ bg: 'blue.300' }}
                borderRadius="4px"
                alignItems="center"
                color="text.default"
              >
                <Box display="flex">
                  <TabsMenu />
                </Box>
              </Box>
            </VStack>
          </PopoverBody>
        </PopoverContent>
      </Popover>
    </Box>
  );
};

export default WebViewMenu;
