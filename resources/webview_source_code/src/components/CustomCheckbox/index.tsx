import { Checkbox, CheckboxProps, forwardRef } from '@chakra-ui/react';
import { ThemeStyle, useTheme } from '../../ThemeContext';

/**
 * 自定义Checkbox组件，提供美观的半选状态样式
 * 
 * 使用方式与标准Chakra UI Checkbox相同，但针对isIndeterminate状态进行了样式增强
 * indeterminate状态下显示中间为纯色，周围透明并有边框的样式
 * 
 * @example
 * <CustomCheckbox 
 *   isChecked={true}
 *   isIndeterminate={false}
 *   onChange={handleChange}
 * >
 *   选择项目
 * </CustomCheckbox>
 */
const CustomCheckbox = forwardRef<CheckboxProps, 'input'>((props, ref) => {
  const { activeTheme } = useTheme();
  const isDarkMode = activeTheme === ThemeStyle.Dark;
  
  return (
    <Checkbox
      ref={ref}
      {...props}
      sx={{
        '& > span[data-checked]': {
          bg: '#776FFF', 
          borderColor: '#776FFF',
          corlor: 'transparent',
        },
        '& > span[data-indeterminate]': {
          bg: 'transparent',
          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.16)',
          position: 'relative',
          corlor: 'transparent',
          
          // 中间纯色区域，尺寸较小
          '&::before': {
            content: '""',
            display: 'block',
            position: 'absolute',
            width: '60%',
            height: '60%',
            top: '20%',
            left: '20%',
            bg: '#776FFF',
            borderRadius: '1px',
          },
          
          // 隐藏默认的勾选图标
          '& > svg': {
            display: 'none',
          },

          // hover状态下保持透明背景
          '&:hover': {
            bg: 'transparent',
          },
        },
        ...props.sx
      }}
    />
  );
});

export default CustomCheckbox;