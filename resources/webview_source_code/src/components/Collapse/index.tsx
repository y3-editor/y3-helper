import React from 'react';
import { Collapse, Box, CollapseProps } from '@chakra-ui/react';
import { FaAngleRight, FaAngleDown } from 'react-icons/fa6';
import Icon from '../../components/Icon';

interface CustomCollapseProps extends CollapseProps {
  title: string;
  // 受控模式的属性
  isOpen?: boolean;
  onToggle?: () => void;
  // 非受控模式的属性
  defaultIsOpen?: boolean;
}

function CustomCollapse(props: CustomCollapseProps) {
  const {
    title,
    children,
    isOpen: controlledIsOpen,
    onToggle: controlledOnToggle,
    defaultIsOpen = true,
  } = props;
  const [internalIsOpen, setInternalIsOpen] = React.useState(defaultIsOpen);
  const isControlled = controlledIsOpen !== undefined;

  const isCollapsed = isControlled ? controlledIsOpen : internalIsOpen;

  const handleToggle = React.useCallback(() => {
    if (isControlled) {
      if (controlledOnToggle) {
        controlledOnToggle();
      }
    } else {
      setInternalIsOpen(!internalIsOpen);
    }
  }, [isControlled, controlledOnToggle, internalIsOpen]);

  return (
    <>
      <Box
        cursor="pointer"
        display="flex"
        alignItems="center"
        mb="1"
        onClick={handleToggle}
      >
        {isCollapsed ? (
          <Icon as={FaAngleDown} size="xs" />
        ) : (
          <Icon as={FaAngleRight} size="xs" />
        )}
        <span className="ml-1">{title}</span>
      </Box>
      <Collapse in={isCollapsed} animate={false}>
        {children}
      </Collapse>
    </>
  );
}

export default React.memo(CustomCollapse);
