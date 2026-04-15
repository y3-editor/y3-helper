import React from 'react';
import whyDidYouRender from '@welldone-software/why-did-you-render';

if (process.env.NODE_ENV === 'development') {
  const wdyrStats = {
    counts: {} as Record<string, number>,
    startTime: Date.now()
  };

  const defaultNotifier = (info: any) => {
    const componentName = info.displayName || 'Unknown';
    const stats = wdyrStats;
    stats.counts[componentName] = (stats.counts[componentName] || 0) + 1;
  };

  whyDidYouRender(React, {
    trackAllPureComponents: true,
    trackHooks: true,
    logOwnerReasons: true,
    collapseGroups: false,
    // // 追踪所有组件（包括非纯组件）
    // include: [/.*/],  // 匹配所有组件名
    // // 排除第三方库的内部组件
    // exclude: [
    //   /^Insertion/,        // Emotion 内部组件
    //   /^EmotionCssPropInternal/,
    //   /^Styled\(/,         // Emotion styled 组件，如 Styled(div), Styled(span)
    //   /^styled\./,         // styled.div, styled.span 等
    //   /^Portal/,           // Chakra UI Portal
    //   /^Popover/,          // Chakra UI Popover 内部组件
    //   /^Modal/,            // Chakra UI Modal 内部组件
    //   /^Drawer/,           // Chakra UI Drawer 内部组件
    //   /^Tooltip/,          // Chakra UI Tooltip 内部组件
    //   /^Menu/,             // Chakra UI Menu 内部组件
    //   /^Connect/,          // React-Redux
    //   /^RouterProvider/,   // React Router
    //   /^SWRConfig/,        // SWR
    //   /^Context/,          // 各种 Context Provider
    //   /^ForwardRef/,       // React forwardRef 包装
    //   /^Memo\(/,           // React.memo 包装
    // ],
    logOnDifferentValues: false,  // 只记录不必要的重渲染
    notifier: (info: any) => {
      defaultNotifier(info);
      if (whyDidYouRender.defaultNotifier) {
        whyDidYouRender.defaultNotifier(info);
      }
    },
  });

  const showWdyrStats = function (top = 20) {
    const stats = wdyrStats;
    const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
    const sorted = Object.entries(stats.counts)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, top);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`WDYR 统计报告 (运行时间: ${elapsed}s)`);
    console.log('═══════════════════════════════════════════════════════');

    if (sorted.length === 0) {
      console.log('暂无数据');
    } else {
      console.table(
        sorted.map(([name, count]: [string, number], index: number) => ({
          '排名': index + 1,
          '组件名': name,
          '重渲染次数': count,
          '平均频率': `${(count / (parseFloat(elapsed) || 1)).toFixed(2)}/s`
        }))
      );

      const total = Object.values(stats.counts).reduce((a, b) => a + b, 0);
      console.log(`\n总计: ${total} 次重渲染, ${Object.keys(stats.counts).length} 个组件`);
    }

    console.log('═══════════════════════════════════════════════════════\n');
  };

  setInterval(() => {
    showWdyrStats(10);
  }, 60000);
}
