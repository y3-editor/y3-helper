import {
  useState,
  useEffect,
  useRef,
  useContext,
  EffectCallback,
  DependencyList,
} from 'react';
import CustomTabPanelContext from '../components/CustomTabPanel/contexts/tab-panel';

/**
 * 自定义 Hook：useFirstFocusedEffect
 *
 * 当组件第一次获得焦点时，执行传入的 effect 回调函数。
 *
 * @param {EffectCallback} effect - 要执行的副作用函数。
 * @param {DependencyList} [deps] - 依赖项数组，如果提供，effect 将在这些依赖项变化时重新执行。
 */
function useFirstFocusedEffect(effect: EffectCallback, deps?: DependencyList) {
  const { isFocused } = useContext(CustomTabPanelContext); // 获取焦点状态
  const hasFocusedOnce = useRef(false); // 记录是否已经获得过焦点
  const [isEffectInitialized, setIsEffectInitialized] = useState(false); // 记录 effect 是否已初始化

  useEffect(() => {
    if (isFocused && !hasFocusedOnce.current) {
      hasFocusedOnce.current = true;
      setIsEffectInitialized(true);
    }
  }, [isFocused]);

  useEffect(
    () => {
      if (isEffectInitialized) {
        return effect();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    deps ? [isEffectInitialized, ...deps] : [isEffectInitialized],
  );
}

export default useFirstFocusedEffect;
