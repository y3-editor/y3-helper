import * as React from 'react';
import { Box, Flex, Tooltip, Icon } from '@chakra-ui/react';
import { AiOutlineQuestionCircle } from 'react-icons/ai';
import { formatTokenCount } from '../../utils/consumedTokensCalculator';

/**
 * Token 分布项数据结构
 */
export interface TokenBreakdownItem {
  name: string;
  tokens: number;
  percentage: number;
  color: string;
  tooltip?: string;
}

/**
 * Token 分布维度的统一颜色配置
 */
export const TOKEN_BREAKDOWN_COLORS: Record<string, string> = {
  'System prompt': '#94a3b8',
  'System tools': '#60a5fa',
  'Messages': '#34d399',
  'Read Cache': '#a78bfa',
  'Mcp tokens': '#fb7185',
  'Skill tokens': '#fbbf24',
  'Rule tokens': '#fdba74',
  'Free space': '#999',
};

/**
 * 格式化百分比
 */
export function formatPercentage(percentage: number): string {
  return `${percentage.toFixed(1)}%`;
}

/**
 * Token 分布单行组件，结构复用 ChatConsumeTokenPanel 的 TokenRow
 */
export function TokenBreakdownItemRow({
  item,
}: {
  item: TokenBreakdownItem;
  isDark: boolean;
}) {
  const pct = item.percentage.toFixed(1);
  return (
    <Flex alignItems="center" gap={2} py={0.5} justifyContent="space-between">
      {/* 左侧：色块 + 标签 */}
      <Flex alignItems="center" gap={2} flex={1} minW={0}>
        <Box w="10px" h="10px" borderRadius="2px" flexShrink={0} bg={item.color} />
        <Flex
          fontSize="xs"
          whiteSpace="nowrap"
          alignItems="center"
          gap={1}
        >
          <Box as="span" color="text.primary" style={{ fontFamily: 'monospace' }}>{item.name}</Box>
          {item.tooltip && (
            <Tooltip label={item.tooltip}>
              <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '2px', lineHeight: 1 }}>
                <Icon
                  as={AiOutlineQuestionCircle}
                  size="sm"
                  style={{ zoom: 0.9 }}
                />
              </span>
            </Tooltip>
          )}
        </Flex>
      </Flex>
      {/* 右侧：数值 + 百分比 */}
      <Flex
        fontSize="xs"
        fontFamily="mono"
        whiteSpace="nowrap"
        alignItems="center"
        gap={1}
        flexShrink={0}
      >
        <Box as="span"
        fontWeight={600}
          // style={{
          //   fontWeight: 600,
          //   color: isDark ? '#E0E0E0' : '#111',
          // }}
          color="text.primary"
        >
          {formatTokenCount(item.tokens)}
        </Box>
        <Box
          as="span"
          style={{
            display: 'inline-block',
            width: '44px',
            textAlign: 'right',
          }}
          color="text.default"
        >
          ({pct}%)
        </Box>
      </Flex>
    </Flex>
  );
}

interface TokenBreakdownPanelProps {
  items: TokenBreakdownItem[];
  isDark: boolean;
  /** 可选标题，显示在列表上方 */
  title?: React.ReactNode;
}

/**
 * Token 分布列表面板（不含 Popover 壳，由调用方自行包裹）
 */
function TokenBreakdownPanel({ items, isDark, title }: TokenBreakdownPanelProps) {
  if (!items.length) return null;

  return (
    <Flex direction="column" gap={1}>
      {title && (
        <span
          style={{
            fontSize: '12px',
            color: isDark ? '#AAAAAA' : '#555',
            marginBottom: '8px',
            fontWeight: 500,
          }}
        >
          {title}
        </span>
      )}
      {items.map((item) => (
        <TokenBreakdownItemRow key={item.name} item={item} isDark={isDark} />
      ))}
    </Flex>
  );
}


export default TokenBreakdownPanel;
