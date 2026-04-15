import * as React from 'react';
import {
  Box,
  Button,
  ButtonProps,
  IconButton,
  IconButtonProps,
  MenuButton,
  Tooltip,
} from '@chakra-ui/react';

interface MiniButtonBaseProps {
  tooltip?: string;
  isActive?: boolean;
}

// 带图标的迷你按钮 Props
interface MiniIconButtonProps
  extends MiniButtonBaseProps,
    Omit<IconButtonProps, 'size'> {
  icon: IconButtonProps['icon'];
}

// 普通迷你按钮 Props（可带 children）
interface MiniTextButtonProps
  extends MiniButtonBaseProps,
    Omit<ButtonProps, 'size'> {
  icon?: never;
}

type MiniButtonProps = MiniIconButtonProps | MiniTextButtonProps;

/**
 * 迷你按钮组件
 * 用于工具栏等需要紧凑布局的场景
 * 尺寸: 16px x 16px，完全无背景透明样式
 * 支持图标按钮（传 icon）和普通按钮（传 children）
 */
const MiniButton = React.forwardRef<HTMLButtonElement, MiniButtonProps>(
  ({ tooltip, isActive, ...props }, ref) => {
    // const { activeTheme } = useTheme();
    // const isLight = activeTheme === 'light';

    const commonStyles = {
      size: 'xs' as const,
      variant: 'unstyled' as const,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      h: '16px',
      minH: '16px',
      p: '0',
      bg: 'transparent',
      border: 'none',
      borderRadius: '2px',
      color: isActive ? '#746cec' : 'text.default',
      _hover: {
        color: '#746cec',
      },
    };

    // 判断是否是图标按钮
    const isIconButton = 'icon' in props && props.icon !== undefined;

    let button: React.ReactElement;

    if (isIconButton) {
      const { icon, ...iconButtonProps } = props as MiniIconButtonProps;
      button = (
        <IconButton
          ref={ref}
          icon={icon}
          w="14px"
          minW="14px"
          {...commonStyles}
          {...iconButtonProps}
        />
      );
    } else {
      const { children, ...buttonProps } = props as MiniTextButtonProps;
      button = (
        <Button
          ref={ref}
          minW="14px"
          px="2px"
          {...commonStyles}
          {...buttonProps}
        >
          {children}
        </Button>
      );
    }

    if (tooltip) {
      return <Tooltip label={tooltip}>{button}</Tooltip>;
    }

    return button;
  }
);

MiniButton.displayName = 'MiniButton';

/**
 * MiniMenuButton Props
 * 用于 Menu 触发器的迷你按钮
 */
interface MiniMenuButtonProps {
  tooltip?: string;
  isActive?: boolean;
  icon?: React.ReactElement;
  children?: React.ReactNode;
  isDisabled?: boolean;
}

/**
 * 迷你菜单按钮组件
 * 专门用于 Chakra UI Menu 组件的触发器
 * 与 MiniButton 保持相同的视觉样式
 */
function MiniMenuButton({
  tooltip,
  isActive,
  icon,
  children,
  isDisabled,
}: MiniMenuButtonProps) {
  const menuButton = (
    <MenuButton
      as={Box}
      display="flex"
      alignItems="center"
      justifyContent="center"
      w="14px"
      h="14px"
      minW="14px"
      minH="14px"
      p="0"
      bg="transparent"
      border="none"
      borderRadius="2px"
      color={isActive ? '#746cec' : 'text.default'}
      cursor={isDisabled ? 'not-allowed' : 'pointer'}
      opacity={isDisabled ? 0.4 : 1}
      _hover={{
        color: '#746cec',
      }}
    >
      {icon || children}
    </MenuButton>
  );

  if (tooltip) {
    return <Tooltip label={tooltip}>{menuButton}</Tooltip>;
  }

  return menuButton;
}

MiniMenuButton.displayName = 'MiniMenuButton';

export default MiniButton;
export { MiniMenuButton };