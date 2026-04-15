import React from 'react';
import {
  Box,
  Divider,
  Flex,
  Grid,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  VStack,
  useOutsideClick,
} from '@chakra-ui/react';
import { AddIcon } from '@chakra-ui/icons';
import {
  ChatEditMaskModel,
  ChatNewMaskModel,
  ChatRemoveMaskModel,
} from '../ChatMaskOldSelector/ChatMaskManageModel';
import { TbDotsVertical } from 'react-icons/tb';
import { useChatAttach } from '../../../store/chat';
import { useMaskStore, ChatMask, DEFAULT_MASKS } from '../../../store/mask';
import { AttachType } from '../../../store/attaches';
// import Icon from '../../../components/Icon';
// import { RiArrowDownSLine } from 'react-icons/ri';
import MiniButton from '../../../components/MiniButton';

const ChatMaskOldSelector = () => {
  const [isOpenPopover, setIsOpenPopover] = React.useState(false);
  const [isOpenNewMaskModel, setIsOpenNewMaskModel] = React.useState(false);
  const [isOpenEditMaskModel, setIsOpenEditMaskModel] = React.useState(false);
  const [isOpenRemoveMaskModel, setIsOpenRemoveMaskModel] =
    React.useState(false);
  const [currentHandleMask, setCurrentHandleMask] = React.useState<ChatMask>();
  const mask = useMaskStore((state) => state.currentMask());
  const masks = useMaskStore((state) => state.maskList);
  const changeMask = useMaskStore((state) => state.changeMask);
  const attachs = useChatAttach((state) => state.attachs);

  const popoverRef = React.useRef<HTMLDivElement>(null);

  const handleChangeMask = (mask: ChatMask) => {
    changeMask(mask);
    setIsOpenPopover(false);
  };

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
      setIsOpenPopover(false);
    },
  });

  return (
    <div id="chat-mask-selector" ref={popoverRef}>
      <Popover isLazy placement="top-start" matchWidth isOpen={isOpenPopover}>
        <PopoverTrigger>
          <MiniButton
            // size="xs"
            // rightIcon={
            //   <Icon as={RiArrowDownSLine} size="xs" color="text.default" />
            // }
            onClick={() => setIsOpenPopover((prev) => !prev)}
            isDisabled={
              attachs ? attachs.attachType === AttachType.Docset : false
            }
            // color="text.secondary"
            // bg="none"
            // _hover={{
            //   bg: 'none',
            // }}
            // px="0"
            // fontSize="12px"
            // fontWeight="normal"
          >
            <Text maxW="80px" isTruncated>
              {mask?.name}
            </Text>
          </MiniButton>
        </PopoverTrigger>
        <PopoverContent mx={2}>
          <PopoverBody display="flex" flexDirection="column">
            <VStack
              flex={1}
              align="stretch"
              maxH="calc(100vh - 400px)"
              overflowY="scroll"
            >
              {DEFAULT_MASKS.map((mask) => (
                <SystemMaskItem
                  key={mask._id}
                  mask={mask}
                  onChange={() => handleChangeMask(mask)}
                />
              ))}
              <Divider my={1} />
              {masks.slice(2).map((mask) => (
                <MaskItem
                  key={mask._id}
                  mask={mask}
                  onChange={() => handleChangeMask(mask)}
                  onEdit={(mask) => {
                    setIsOpenEditMaskModel(true);
                    setCurrentHandleMask(mask);
                  }}
                  onRemove={(mask) => {
                    setIsOpenRemoveMaskModel(true);
                    setCurrentHandleMask(mask);
                  }}
                />
              ))}
            </VStack>
            <Flex
              p={2}
              mr={2}
              mt={2}
              fontSize="sm"
              color="blue.400"
              cursor="pointer"
              _hover={{
                bg: 'blue.300',
              }}
              borderRadius="8px"
              onClick={() => setIsOpenNewMaskModel(true)}
            >
              <Box>
                <AddIcon fontSize={8} mr={2} mt={-1} />
                自定义
              </Box>
            </Flex>
          </PopoverBody>
        </PopoverContent>
      </Popover>
      <div>
        <ChatNewMaskModel
          isOpen={isOpenNewMaskModel}
          onClose={() => setIsOpenNewMaskModel(false)}
        />
        {currentHandleMask && (
          <>
            <ChatEditMaskModel
              mask={currentHandleMask}
              isOpen={isOpenEditMaskModel}
              onClose={() => setIsOpenEditMaskModel(false)}
            />
            <ChatRemoveMaskModel
              mask={currentHandleMask}
              isOpen={isOpenRemoveMaskModel}
              onClose={() => setIsOpenRemoveMaskModel(false)}
            />
          </>
        )}
      </div>
    </div>
  );
};

function SystemMaskItem(props: { mask: ChatMask; onChange: () => void }) {
  const { mask, onChange } = props;
  return (
    <Box
      px={2}
      py={1}
      alignItems="center"
      cursor="pointer"
      _hover={{ bg: 'blue.300' }}
      borderRadius="8px"
      onClick={onChange}
    >
      <Grid w="full" gridTemplateColumns="1fr 32px" alignItems="center">
        <Text isTruncated title={mask.name}>
          {mask.name}
        </Text>
      </Grid>
    </Box>
  );
}

function MaskItem(props: {
  mask: ChatMask;
  onChange: () => void;
  onEdit: (mask: ChatMask) => void;
  onRemove: (mask: ChatMask) => void;
}) {
  const { mask, onChange, onEdit, onRemove } = props;

  return (
    <Box
      px={2}
      py={1}
      alignItems="center"
      cursor="pointer"
      _hover={{ bg: 'blue.300' }}
      borderRadius="8px"
      onClick={onChange}
    >
      <Grid w="full" gridTemplateColumns="1fr 32px" alignItems="center">
        <Grid>
          <Text isTruncated title={mask.name}>
            {mask.name}
          </Text>
        </Grid>
        <Grid
          h="auto"
          alignItems="center"
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
          }}
        >
          <Menu isLazy placement="left">
            <MenuButton
              size="sm"
              as={IconButton}
              icon={<TbDotsVertical />}
            ></MenuButton>
            <MenuList minWidth="64px">
              <MenuItem onClick={() => onEdit(mask)}>编辑</MenuItem>
              <MenuItem onClick={() => onRemove(mask)}>删除</MenuItem>
            </MenuList>
          </Menu>
        </Grid>
      </Grid>
    </Box>
  );
}

export default ChatMaskOldSelector;
