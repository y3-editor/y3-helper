import * as React from 'react';
import { IconType } from 'react-icons';
import { IconProps as ChakraIconProps, Icon } from '@chakra-ui/react';
type IconSize = 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'ml';
type IconProps = ChakraIconProps & {
  as?: IconType;
  size?: IconSize;
};
const CustomIcon = (props: IconProps & { size?: IconSize }) => {
  const { size, w, h, ...rest } = props;

  const sizeProps = React.useMemo(() => {
    // 如果用户传入了自定义 w 或 h，优先使用用户传入的值
    if (w !== undefined || h !== undefined) {
      return {
        w: w ?? '16px',
        h: h ?? '16px',
      };
    }

    switch (size) {
      case 'xxs':
        return {
          w: '12px',
          h: '12px',
        };
      case 'xs':
        return {
          w: '14px',
          h: '14px',
        };
      case 'sm':
        return {
          w: '16px',
          h: '16px',
        };
      case 'md':
        return {
          w: '18px',
          h: '18px',
        };
      case 'ml':
        return {
          w: '20px',
          h: '20px',
        };
      case 'lg':
        return {
          w: '24px',
          h: '24px',
        };
      default:
        return {
          w: '16px',
          h: '16px',
        };
    }
  }, [size, w, h]);

  return <Icon {...rest} {...sizeProps} />;
};

export default CustomIcon;
export { LuMessageSquareTextIcon } from './LuMessageSquareText';