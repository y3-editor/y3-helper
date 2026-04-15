import React, { useEffect, useState } from 'react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  Text,
  Tooltip,
  Box,
  useOutsideClick,
} from '@chakra-ui/react';
import { useWorkspaceStore } from '../../store/workspace';
import RulesGrid from './RulesGrid';
import EventBus from '../../utils/eventbus';
import MiniButton from '../../components/MiniButton';


const RulesPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  // const { activeTheme } = useTheme();
  // const isLight = activeTheme === 'light';
  const [isTooltipOpen, setIsTooltipOpen] = React.useState<boolean>(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const timeoutRef = React.useRef<NodeJS.Timeout>();

  const selectedRules = useWorkspaceStore((state) => state.selectedRules);


  useOutsideClick({
    ref: popoverRef,
    handler: (event) => {
      // 检查点击的元素是否在 Modal 内部
      const target = event.target as Element;
      const isClickInModal = target.closest('[data-modal-content]') !== null;

      if (!isClickInModal) {
        setIsOpen(false);
      }
    },
  });

  useEffect(() => {
    EventBus.instance.on('toggleDevSpacePanel', setIsOpen)
    return () => {
      EventBus.instance.off('toggleDevSpacePanel', setIsOpen)
    }
  }, [])

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsTooltipOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsTooltipOpen(false);
    }, 300);
  };

  // TODO: 结构待优化
  const displayCurrent = React.useMemo(() => {
    return <Popover
      placement={"top"}
      isOpen={isTooltipOpen && !isOpen}
      onClose={() => setIsTooltipOpen(false)}
    >
      <PopoverTrigger>
        <Box
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          _hover={{
            cursor: 'pointer',
          }}
        >
          <Tooltip label={'自定义Rules'}>
            <Text
              style={{ marginBottom: 0, transform: 'translateY(-1px)' }}
              _hover={{
                bg: 'none',
                color: '#746cec',
              }}
              className='cursor-pointer'
            >
              <Box color={selectedRules?.length ? "blue.300" : "text.default"}>
                <svg className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="14352" width="20" height="20" fill="currentColor"><path d="M768 128a128 128 0 0 1 128 128v512a128 128 0 0 1-128 128H256a128 128 0 0 1-128-128V256a128 128 0 0 1 128-128h512z m0 64H256a64 64 0 0 0-63.701333 57.856L192 256v512a64 64 0 0 0 57.856 63.701333L256 832h512a64 64 0 0 0 63.701333-57.856L832 768V256a64 64 0 0 0-57.856-63.701333L768 192z" p-id="14353"></path><path d="M330.666667 394.666667m-53.333334 0a53.333333 53.333333 0 1 0 106.666667 0 53.333333 53.333333 0 1 0-106.666667 0Z" p-id="14354"></path><path d="M426.666667 362.666667m32 0l256 0q32 0 32 32l0 0q0 32-32 32l-256 0q-32 0-32-32l0 0q0-32 32-32Z" p-id="14355"></path><path d="M330.666667 629.333333m-53.333334 0a53.333333 53.333333 0 1 0 106.666667 0 53.333333 53.333333 0 1 0-106.666667 0Z" p-id="14356"></path><path d="M426.666667 597.333333m32 0l256 0q32 0 32 32l0 0q0 32-32 32l-256 0q-32 0-32-32l0 0q0-32 32-32Z" p-id="14357"></path></svg>
              </Box>
            </Text>
          </Tooltip>
        </Box>
      </PopoverTrigger>
    </Popover>
  }, [isOpen, isTooltipOpen, selectedRules?.length]);

  return (
    <div ref={popoverRef}>
      <Popover isLazy placement="top-start" isOpen={isOpen}>
        <PopoverTrigger>
          <MiniButton
            onClick={() => setIsOpen(prev => !prev)}
          >
            {displayCurrent}
          </MiniButton>
        </PopoverTrigger>
        <PopoverContent w='450px' maxH="260" maxW="100vw" overflow="hidden" borderColor="customBorder">
          <PopoverBody display="flex" gap={0} p={0} h="400px">
            <RulesGrid />
          </PopoverBody>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default RulesPanel;
