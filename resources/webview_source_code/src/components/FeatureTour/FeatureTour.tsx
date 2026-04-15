import * as React from 'react';
import Joyride, { CallBackProps, STATUS, EVENTS, ACTIONS } from 'react-joyride';
import { useTourStore } from './useTourStore';
import { tourRegistry } from './tours';
import { useConfigStore } from '../../store/config';
import TourTooltip from './TourTooltip';
import type { TourStep } from './tours/types';

/**
 * 功能引导主组件
 * 全局挂载，根据 activeTour 状态显示对应的引导
 */
function FeatureTour() {
  const { activeTour, currentStepIndex, stopTour, setStepIndex, completeTour, pauseTour } =
    useTourStore();
  const currentTab = useConfigStore((state) => state.config.currentTab);

  const tourConfig = activeTour ? tourRegistry[activeTour] : null;

  // 根据 showWhen 条件过滤出当前环境适用的步骤
  const filteredSteps = React.useMemo(() => {
    if (!tourConfig) return [];
    return tourConfig.steps.filter((step) => {
      const tourStep = step as TourStep;
      if (tourStep.showWhen) {
        return tourStep.showWhen();
      }
      return true;
    });
  }, [tourConfig]);

  // 追踪上一个步骤索引，用于检测步骤变化
  const prevStepIndexRef = React.useRef<number>(-1);

  // 监听 Tab 切换，当 Tab 与引导的 activePageRoute 不匹配时暂停引导
  React.useEffect(() => {
    if (!activeTour || !tourConfig) {
      return;
    }

    // 如果引导配置了 activePageRoute，检查当前 Tab 是否匹配
    if (tourConfig.activePageRoute) {
      const isOnCorrectPage = currentTab === tourConfig.activePageRoute;
      if (!isOnCorrectPage) {
        // Tab 不匹配，暂停引导
        pauseTour();
      }
    }
  }, [activeTour, tourConfig, currentTab, pauseTour]);

  // 当步骤变化时触发 onStepEnter 回调
  React.useEffect(() => {
    if (!tourConfig || currentStepIndex === prevStepIndexRef.current) {
      return;
    }

    const currentStep = filteredSteps[currentStepIndex] as
      | TourStep
      | undefined;
    if (currentStep?.onStepEnter) {
      currentStep.onStepEnter(currentStepIndex);
    }

    prevStepIndexRef.current = currentStepIndex;
  }, [tourConfig, currentStepIndex]);

  // 重置 prevStepIndexRef 当 tour 变化时
  React.useEffect(() => {
    if (!activeTour) {
      prevStepIndexRef.current = -1;
    }
  }, [activeTour]);

  const handleCallback = React.useCallback(
    (data: CallBackProps) => {
      const { status, action, index, type } = data;

      // 处理步骤切换（受控模式下需要手动更新 stepIndex）
      if (type === EVENTS.STEP_AFTER) {
        // 点击"下一步"时，更新步骤索引（index 是当前步骤，需要 +1）
        if (action === ACTIONS.NEXT) {
          // 触发当前步骤的 onStepComplete 回调
          const currentStep = filteredSteps[index] as TourStep | undefined;
          if (currentStep?.onStepComplete) {
            currentStep.onStepComplete(index);
          }
          setStepIndex(index + 1);
        }
      }

      // 处理"上一步"
      if (type === EVENTS.STEP_AFTER && action === ACTIONS.PREV) {
        setStepIndex(index - 1);
      }

      // 处理完成或跳过
      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        if (activeTour && tourConfig) {
          completeTour(activeTour, tourConfig.version);
        } else {
          stopTour();
        }
      }

      // 处理关闭按钮
      if (action === ACTIONS.CLOSE) {
        stopTour();
      }
    },
    [activeTour, tourConfig, filteredSteps, stopTour, setStepIndex, completeTour]
  );

  if (!tourConfig || filteredSteps.length === 0) {
    return null;
  }

  return (
    <Joyride
      steps={filteredSteps}
      run={true}
      stepIndex={currentStepIndex}
      continuous
      showProgress
      showSkipButton={false}
      hideCloseButton
      scrollToFirstStep
      disableOverlayClose
      // 禁用 Joyride 的滚动父元素修复，避免其修改 overflow 属性导致布局问题
      disableScrollParentFix={true}
      // 禁用 Joyride 的自动滚动行为，避免其修改页面滚动状态
      disableScrolling={true}
      tooltipComponent={TourTooltip}
      callback={handleCallback}
      floaterProps={{
        disableAnimation: true,
      }}
      styles={{
        options: {
          arrowColor: '#1A202C', // Chakra gray.800
          overlayColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 10000,
        },
        ...tourConfig.styles,
      }}
    />
  );
}

export default FeatureTour;