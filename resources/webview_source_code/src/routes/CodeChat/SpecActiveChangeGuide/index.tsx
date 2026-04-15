import * as React from 'react';
import {
  useWorkspaceStore,
  ChangeInfo,
  SpecKitFeatureInfo,
  SpecFramework,
} from '../../../store/workspace';
import { useChatStore } from '../../../store/chat';
import { usePostMessage } from '../../../PostMessageProvider';
import ChangeTabNav from './ChangeTabNav';
import FeatureTabNav from './FeatureTabNav';

/**
 * Spec Mode ActiveChange/Feature 引导组件
 * 在 Spec Coding 模式时显示，支持 OpenSpec 和 SpecKit 两种框架
 *
 * 仅在已选择 Change/Feature 时显示 Tab 导航栏
 */
function SpecActiveChangeGuide() {
  const { postMessage } = usePostMessage();
  const specInfo = useWorkspaceStore((state) => state.specInfo);

  // 从 state 订阅（确保能触发重渲染）
  const activeChangeId = useChatStore((state) => state.activeChangeId);
  const activeFeatureId = useChatStore((state) => state.activeFeatureId);
  const codebaseChatMode = useChatStore((state) => state.codebaseChatMode);
  const chatType = useChatStore((state) => state.chatType);
  const isSpecNavCollapsed = useChatStore((state) => state.isSpecNavCollapsed);
  const setSpecNavCollapsed = useChatStore((state) => state.setSpecNavCollapsed);
  const isSpecFrameworkInitialized = useWorkspaceStore(
    (state) => state.isSpecFrameworkInitialized,
  );

  const isOpenspecInitialized = isSpecFrameworkInitialized(
    SpecFramework.OpenSpec,
  );
  const isSpeckitInitialized = isSpecFrameworkInitialized(
    SpecFramework.SpecKit,
  );

  // 从所有框架中聚合 activeChanges (OpenSpec)
  const activeChanges: ChangeInfo[] = React.useMemo(() => {
    if (!specInfo?.frameworks) return [];
    return specInfo.frameworks.flatMap((f) => f.activeChanges || []);
  }, [specInfo]);

  // 从所有框架中聚合 features (SpecKit)
  const features: SpecKitFeatureInfo[] = React.useMemo(() => {
    if (!specInfo?.frameworks) return [];
    return specInfo.frameworks.flatMap((f) => f.features || []);
  }, [specInfo]);


  // 查找选中的 change (OpenSpec)
  const selectedChange = React.useMemo(() => {
    if (!activeChangeId) return undefined;
    return activeChanges.find((c) => c.id === activeChangeId);
  }, [activeChanges, activeChangeId]);

  // 查找选中的 feature (SpecKit)
  const selectedFeature = React.useMemo(() => {
    if (!activeFeatureId) return undefined;
    return features.find((f) => f.id === activeFeatureId);
  }, [features, activeFeatureId]);

  // 打开文件
  const handleOpenFile = React.useCallback(
    (filePath: string) => {
      postMessage({
        type: 'OPEN_FILE',
        data: { filePath },
      });
    },
    [postMessage],
  );

  // 折叠处理
  const handleCollapse = React.useCallback(() => {
    setSpecNavCollapsed(true);
  }, [setSpecNavCollapsed]);

  // 仅在仓库智聊 + Spec Mode (openspec 或 speckit) 下显示
  if (chatType !== 'codebase') {
    return null;
  }

  // 折叠状态时不渲染
  if (isSpecNavCollapsed) {
    return null;
  }

  // OpenSpec 模式 - 仅在已选择 Change 时显示
  if (
    codebaseChatMode === 'openspec' &&
    isOpenspecInitialized &&
    selectedChange
  ) {
    return (
      <ChangeTabNav
        changeInfo={selectedChange}
        onOpenFile={handleOpenFile}
        onCollapse={handleCollapse}
      />
    );
  }

  // SpecKit 模式 - 仅在已选择 Feature 时显示
  if (
    codebaseChatMode === 'speckit' &&
    isSpeckitInitialized &&
    selectedFeature
  ) {
    return (
      <FeatureTabNav
        featureInfo={selectedFeature}
        onOpenFile={handleOpenFile}
        onCollapse={handleCollapse}
      />
    );
  }

  // 其他情况不显示
  return null;
}

export default SpecActiveChangeGuide;