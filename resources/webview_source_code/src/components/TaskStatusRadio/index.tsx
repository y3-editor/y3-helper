import { Box, Icon } from '@chakra-ui/react';
import { FiCircle } from 'react-icons/fi';
import { SVGProps } from 'react';
import { TodoItem } from '../../store/workspace/tools/todo';

interface TaskStatusRadioProps {
  status: TodoItem['status'];
  readOnly?: boolean;
  onClick?: () => void;
}

// 1/4圆图标组件
const QuarterCircleIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="10" fill="none" />
    <path 
      d="M12 12 L12 2 A10 10 0 0 1 22 12 Z" 
      fill="currentColor" 
      stroke="none"
    />
  </svg>
);

// 带勾选的圆圈图标
const CheckCircleIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="10" fill="none" />
    <path 
      d="M8 12l3 3l5-6" 
      strokeWidth="2.5"
    />
  </svg>
);

export default function TaskStatusRadio({ status, readOnly = false, onClick }: TaskStatusRadioProps) {
  const getStatusConfig = (currentStatus: TodoItem['status']) => {
    switch (currentStatus) {
      case 'completed':
        return {
          icon: CheckCircleIcon,
          color: 'blue.300',
        };
      case 'in_progress':
        return {
          icon: QuarterCircleIcon,
          color: 'blue.300',
        };
      case 'pending':
      default:
        return {
          icon: FiCircle,
          color: 'blue.300',
        };
    }
  };

  const handleClick = () => {
    if (readOnly || !onClick) return;
    onClick();
  };

  const config = getStatusConfig(status);

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      width="20px"
      height="20px"
      cursor={readOnly ? 'default' : 'pointer'}
      opacity={readOnly ? 0.6 : 1}
      onClick={handleClick}
      transition="all 0.2s"
      _hover={!readOnly ? {
        transform: 'scale(1.1)',
        opacity: 0.8
      } : {}}
    >
      <Icon
        as={config.icon}
        color={config.color}
        boxSize="18px"
      />
    </Box>
  );
}