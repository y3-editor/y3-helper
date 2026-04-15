import React, { useState, useRef } from 'react';
import {
  Box,
  Tooltip,
  useOutsideClick,
  Text,
  Flex,
  Icon,
  Portal,
} from '@chakra-ui/react';
import { ChevronDownIcon } from '@chakra-ui/icons';
import { TbSparkles } from 'react-icons/tb';

export interface SelectOption {
  value: string;
  label: string;
  tooltip?: string;
  tooltipTitle?: string;
}

interface SelectWithTooltipProps {
  options: SelectOption[];
  value?: string;
  onChange?: (e: { target: { value: string } }) => void;
  isDisabled?: boolean;
  isTrulyDisabled?: boolean; // 新增：是否是真正的禁用状态（而非用户关闭）
  showIcon?: boolean;
  size?: string;
  width?: string;
}

const SelectWithTooltip: React.FC<SelectWithTooltipProps> = ({
  options,
  value,
  onChange,
  isDisabled = false,
  isTrulyDisabled = false,
  showIcon = true,
  width = '90px',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useOutsideClick({
    ref: popoverRef,
    handler: () => setIsOpen(false)
  });

  // 当下拉菜单打开时，计算位置
  React.useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      // 如果下方空间不足150px且上方空间更多，则向上展开
      if (spaceBelow < 150 && spaceAbove > spaceBelow) {
        setDropdownStyle({
          position: 'fixed',
          bottom: `${window.innerHeight - rect.top + 4}px`,
          left: `${rect.left}px`,
          width: `${rect.width}px`,
        });
      } else {
        setDropdownStyle({
          position: 'fixed',
          top: `${rect.bottom + 4}px`,
          left: `${rect.left}px`,
          width: `${rect.width}px`,
        });
      }
    }
  }, [isOpen]);

  // 打开下拉菜单
  const handleToggle = () => {
    if (isDisabled) return;
    setIsOpen(!isOpen);
  };

  // Get the current selected option
  const currentOption = options.find(opt => opt.value === value);

  // Determine text color based on value - 只保留字体颜色
  const getTextColor = () => {
    if (value === 'auto') return '#786FFF'; // blue.300
    if (value === 'on') return '#22c55e'; // green-500
    if (value === 'off') {
      // 禁用带透明度，关闭用默认色
      return isTrulyDisabled ? 'rgba(113, 128, 150, 0.6)' : 'inherit'; // gray.500 with opacity : inherit
    }
    if (isDisabled) return '#a0aec0'; // gray.400
    return 'inherit';
  };

  const handleSelect = (optionValue: string) => {
    if (isDisabled) return;
    setIsOpen(false);
    if (onChange) {
      onChange({ target: { value: optionValue } });
    }
  };

  return (
    <Box ref={containerRef} position="relative" display="inline-block" width={width}>
      <Tooltip
        label={
          currentOption?.tooltip ? (
            <Box>
              {currentOption?.tooltipTitle && (
                <Flex alignItems="center" mb={1}>
                  <Icon as={TbSparkles} w="14px" h="14px" mr={1} color="#a78bfa" />
                  <Text fontSize="12px" fontWeight="600" color="white">
                    {currentOption.tooltipTitle}
                  </Text>
                </Flex>
              )}
              <Text fontSize="12px" color="rgba(255, 255, 255, 0.9)">
                {currentOption.tooltip}
              </Text>
            </Box>
          ) : undefined
        }
        placement="top"
        hasArrow
        bg="#1a1a1a"
        color="white"
        borderRadius="md"
        px={3}
        py={2}
        isDisabled={!currentOption?.tooltip}
      >
        <Box
          position="relative"
          cursor={isDisabled ? 'not-allowed' : 'pointer'}
          onClick={handleToggle}
          sx={{
            paddingLeft: '8px',
            paddingRight: showIcon ? '18px' : '8px',
            paddingY: '2px',
            textAlign: 'center',
            color: getTextColor(),
            borderWidth: '1px',
            borderStyle: 'solid',
            borderRadius: 'md',
            transition: 'all 0.2s',
            fontSize: '12px',
            fontWeight: value === 'auto' || value === 'on' ? '500' : 'normal',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {currentOption?.label || '选择'}
          {showIcon && (
            <Box
              position="absolute"
              right="6px"
              top="50%"
              pointerEvents="none"
              display="flex"
              alignItems="center"
              transition="transform 0.2s"
              sx={{
                transform: isOpen ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)',
              }}
            >
              <ChevronDownIcon color={isDisabled ? '#a0aec0' : getTextColor()} w="12px" h="12px" />
            </Box>
          )}
        </Box>
      </Tooltip>

      {/* Dropdown menu */}
      {isOpen && !isDisabled && (
        <Portal appendToParentPortal={true}>
          <Box
            ref={popoverRef}
            sx={dropdownStyle}
            bg="#2C2C2C"
            borderRadius="md"
            boxShadow="0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)"
            zIndex={1500}
            overflow="hidden"
            border="1px solid"
            borderColor="#3A3A3A"
          >
            {options.map((option) => {
              // const isSelected = option.value === value;
              const getOptionHoverTextColor = () => {
                if (option.value === 'auto') return '#63B3ED';
                if (option.value === 'on') return '#22c55e';
                return '#a0aec0';
              };

              return (
                <Tooltip
                  key={option.value}
                  label={
                    option.tooltip ? (
                      <Box>
                        {option.tooltipTitle && (
                          <Flex alignItems="center" mb={1}>
                            <Icon as={TbSparkles} w="14px" h="14px" mr={1} color="#a78bfa" />
                            <Text fontSize="12px" fontWeight="600" color="white">
                              {option.tooltipTitle}
                            </Text>
                          </Flex>
                        )}
                        <Text fontSize="12px" color="rgba(255, 255, 255, 0.9)">
                          {option.tooltip}
                        </Text>
                      </Box>
                    ) : undefined
                  }
                  placement="right"
                  hasArrow
                  bg="#1a1a1a"
                  color="white"
                  borderRadius="md"
                  px={3}
                  py={2}
                  isDisabled={!option.tooltip}
                >
                  <Box
                    px="8px"
                    py="4px"
                    cursor="pointer"
                    fontSize="12px"
                    textAlign="center"
                    bg="transparent"
                    color="#a0aec0"
                    fontWeight="normal"
                    transition="all 0.2s ease"
                    whiteSpace="nowrap"
                    borderBottom="1px solid"
                    borderColor="#3A3A3A"
                    _last={{
                      borderBottom: 'none',
                    }}
                    data-target={'selectOption'}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSelect(option.value);
                    }}
                    _hover={{
                      color: getOptionHoverTextColor(),
                      fontWeight: '500',
                    }}
                  >
                    {option.label}
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
        </Portal>
      )}
    </Box>
  );
};

export default SelectWithTooltip;
