import { useCheckbox, chakra, Image, UseCheckboxProps } from '@chakra-ui/react';
import { ThemeStyle, useTheme } from '../../ThemeContext';

// 导入选中和未选中状态的图像
// 这些图片需要放在 src/assets 目录下
import checkedIcon from '../../assets/checkbox-checked.svg';
import uncheckedDarkIcon from '../../assets/checkbox-unchecked-dark.svg';
import uncheckedLightIcon from '../../assets/checkbox-unchecked-light.svg';

interface CircularCheckboxProps extends UseCheckboxProps {
    label?: string;
}

const CircularCheckbox = (props: CircularCheckboxProps | undefined) => {
  const { state, getInputProps, getCheckboxProps, getLabelProps, htmlProps } = useCheckbox(props);
  const { activeTheme } = useTheme();
  
  // 根据主题选择合适的未选中图标
  const uncheckedIcon = activeTheme === ThemeStyle.Light ? uncheckedLightIcon : uncheckedDarkIcon;
  
  return (
    <chakra.label {...htmlProps} className="flex items-center space-x-1 cursor-pointer">
      <input {...getInputProps()} hidden />
      <div
        {...getCheckboxProps()}
        className="flex justify-center items-center w-6 h-6"
      >
        <Image 
          src={state.isChecked ? checkedIcon : uncheckedIcon} 
          alt={state.isChecked ? "Checked" : "Unchecked"} 
          width="16px" 
          height="16px"
        />
      </div>
      <chakra.span {...getLabelProps()}>{props?.label}</chakra.span>
    </chakra.label>
  );
};

export default CircularCheckbox;