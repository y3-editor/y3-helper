import { IconButton, Tooltip, Text, Box } from '@chakra-ui/react';
import { IoIosReturnLeft } from 'react-icons/io';
import Icon from '../../../../components/Icon';

interface AttachActionBarProps {
  onBack?: () => void;
  type?: string;
}
const AttachActionBar = (props: AttachActionBarProps) => {
  const { type } = props;
  return (
    <Box display="flex" alignItems="center" gap={2}>
      <Tooltip label="返回上一层">
        <IconButton
          size="xs"
          icon={<Icon as={IoIosReturnLeft} size="xs" />}
          aria-label="返回"
          onClick={props.onBack}
        ></IconButton>
      </Tooltip>
      <Text fontSize="xs" color="text.default">
        Enter进入下层，Shift+左键返回上层；{
          type === 'file' && '默认显示工作区打开的文件，'
        }输入关键字进行检索
      </Text>
    </Box>
  );
};

export default AttachActionBar;
