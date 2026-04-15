import React from 'react';
import { Select, Props } from 'chakra-react-select';

interface CustomSelectProps extends Props {
  hoverColor?: string;
  checkedColor?: string;
  backgroundColor?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  ...props
}) => {
  return (
    <Select
      {...props}
    />
  );
};

export default CustomSelect;