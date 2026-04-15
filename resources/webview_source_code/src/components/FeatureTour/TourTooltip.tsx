import { Box, Button, Flex, Text, Progress } from '@chakra-ui/react';
import type { TooltipRenderProps } from 'react-joyride';

/**
 * 自定义引导 Tooltip 组件
 * 基于 Chakra UI 实现，与项目整体风格保持一致
 */
function TourTooltip(props: TooltipRenderProps) {
  const {
    continuous,
    index,
    size,
    step,
    backProps,
    primaryProps,
    tooltipProps,
  } = props;


  const progress = ((index + 1) / size) * 100;

  return (
    <Box
      {...tooltipProps}
      bg="gray.800"
      color="white"
      borderRadius="md"
      boxShadow="xl"
      maxW="320px"
      p={4}
    >
      {/* 头部：步骤进度 */}
      <Flex justify="flex-start" align="center" mb={2}>
        <Text fontSize="xs" color="gray.400">
          {index + 1} / {size}
        </Text>
      </Flex>

      {/* 进度条 */}
      <Progress
        value={progress}
        size="xs"
        colorScheme="blue"
        borderRadius="full"
        mb={3}
      />

      {/* 标题（可选） */}
      {step.title && (
        <Text fontWeight="bold" fontSize="md" mb={2}>
          {step.title}
        </Text>
      )}

      {/* 内容 - 支持文本、图片、JSX 等 ReactNode */}
      <Box
        fontSize="sm"
        mb={4}
        sx={{
          '& img': {
            maxWidth: '100%',
            borderRadius: 'md',
            mt: 2,
          },
          '& p': {
            mb: 2,
          },
        }}
      >
        {step.content}
      </Box>

      {/* 操作按钮 */}
      <Flex justify="flex-end" align="center" gap={2}>
        {index > 0 && (
          <Button
            size="sm"
            variant="outline"
            colorScheme="blue"
            {...backProps}
          >
            上一步
          </Button>
        )}
        {continuous && (
          <Button size="sm" colorScheme="blue" {...primaryProps}>
            {index === size - 1 ? '完成' : '下一步'}
          </Button>
        )}
      </Flex>
    </Box>
  );
}

export default TourTooltip;