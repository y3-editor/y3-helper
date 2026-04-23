import * as React from 'react';
import useService from '../../../hooks/useService';
import { getDocsets } from '../../../services/docsets';
import { useDocsetStore } from '../../../store/docset';
import { DEFAULT_MASKS, useMaskStore } from '../../../store/mask';
import {
  Prompt,
  PromptCategoryType,
  getMaskPrompts,
  getProjectMaskPrompts,
  getUserCategoryId,
  initUser,
} from '../../../services/prompt';
import useFirstFocusedEffect from '../../../hooks/useFirstFocusEffect';
import { useWorkspaceStore } from '../../../store/workspace';
import { ModelMaxTokenType, useChatConfig } from '../../../store/chat-config';
import { getUserModels, IChatModelConfig } from '../../../services/chatModel';
import { useLoadUserQuota } from './Hooks/useLoadUserQuota';

const GlobalDataLoader = () => {
  // docsets
  const initializeUserDocsets = useDocsetStore(
    (state) => state.initializeUserDocsets,
  );
  const { data: docsetData } = useService(getDocsets, []);
  const { repoUrl, repoName } = useWorkspaceStore((state) => state.workspaceInfo);
  const updateCodebaseModelMaxToken = useChatConfig((state) => state.updateCodebaseModelMaxToken);
  const updateModelMaxToken = useChatConfig((state) => state.updateModelMaxToken);

  useLoadUserQuota()

  React.useEffect(() => {
    async function loadFiles() {
      if (!docsetData) {
        return;
      }
      initializeUserDocsets(docsetData);
    }
    loadFiles();
  }, [docsetData, initializeUserDocsets]);
  const [
    devSpaceOptions,
    syncDevSpaceOptions,
    setDevSpace,
  ] = useWorkspaceStore((state) => [
    state.devSpaceOptions,
    state.syncDevSpaceOptions,
    state.setDevSpace,
  ])

  // user prompt
  const updateConfig = useMaskStore((state) => state.updateConfig);

  useFirstFocusedEffect(() => {
    async function initializeUserPromptCategories() {
      await initUser();
      const userCategoryId = await getUserCategoryId();
      updateConfig((config) => {
        config.categoryId = userCategoryId;
      });
    }
    initializeUserPromptCategories();
  }, [updateConfig]);

  // masks
  const syncMaskList = useMaskStore((state) => state.syncMaskList);
  const { data: userMasks } = useService(getMaskPrompts, []);
  const { data: projectMasks } = useService(getProjectMaskPrompts, []);
  React.useEffect(() => {
    const _masks: Prompt[] = [];
    // 系统级别 mask
    for (const mask of DEFAULT_MASKS || []) {
      _masks.push({ ...mask, type: PromptCategoryType._CodeMaker });
    }
    // 项目级别 mask
    for (const mask of projectMasks || []) {
      _masks.push({ ...mask, type: PromptCategoryType.Project });
    }
    // 用户级别 prompt
    for (const mask of userMasks || []) {
      _masks.push({ ...mask, type: PromptCategoryType.User });
    }
    syncMaskList(_masks);
  }, [projectMasks, syncMaskList, userMasks]);

  React.useEffect(() => {
    syncDevSpaceOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    const devSpaceCacheStr = window.localStorage.getItem('devSpaceCache') || '{}';
    const devSpaceCache = JSON.parse(devSpaceCacheStr);
    const cacheDevSpaceId = devSpaceCache[repoName];
    let matchDevSpace: any = null;
    if (cacheDevSpaceId) {
      matchDevSpace = devSpaceOptions.find((item: any) => {
        return item._id === cacheDevSpaceId;
      })
    } else if (repoUrl) {
      matchDevSpace = devSpaceOptions.find((item: any) => {
        if (item.data.repos && item.data.repos.find((repo: any) => {
          if (repo.address) {
            if (repo.paths && repo.paths.length > 0) {
              for (const path of repo.paths) {
                if (path) {
                  const fullPath = `${repo.address}${path}`
                  if (repoUrl.includes(fullPath)) {
                    return true;
                  }
                }
              }
              return false;
            } else {
              return repoUrl.includes(repo.address);
            }
          } else {
            return false;
          }
        })) {
          return true;
        } else {
          return false;
        }
      })
    }
    if (matchDevSpace) {
      try {
        setDevSpace({
          _id: matchDevSpace._id,
          name: matchDevSpace.name,
          project: matchDevSpace.project,
          knowledge_bases: matchDevSpace.data.knowledge_bases,
          codebases: matchDevSpace.data.codebases,
          code_style: matchDevSpace.data.code_styles[0]?.style,
          ignore_paths: matchDevSpace.data.ai_repo_chats[0].ignore_paths,
          allow_paths: matchDevSpace.data.ai_repo_chats[0].allow_paths,
          repos: matchDevSpace.data.repos,
          allow_public_model_access: matchDevSpace.data.allow_public_model_access,
          rules: matchDevSpace.data.rules
        });
      } catch (err) {
        console.error('研发知识格式异常', err);
      }
    }
  }, [devSpaceOptions, repoUrl, repoName, setDevSpace])

  const setChatModels = useChatConfig((state) => state.setChatModels)
  const loadModelRef = React.useRef(false)
  React.useEffect(() => {
    if (loadModelRef.current) return
    loadModelRef.current = true
    getUserModels()
      .then((models) => {
        const modelConfigs: Record<string, IChatModelConfig> = {}
        const maxTokens: Partial<ModelMaxTokenType> = {}
        const codebaseMaxTokens: Partial<ModelMaxTokenType> = {}
        models?.model_configs?.sort((a: IChatModelConfig, b: IChatModelConfig) => b.displayOrder - a.displayOrder)
          ?.forEach((model: IChatModelConfig) => {
            modelConfigs[model.code] = model
            maxTokens[model.code] = model.tokenInfo.maxTokens
            codebaseMaxTokens[model.code] = model.tokenInfo.maxTokensInCodebase
          })
        setChatModels(modelConfigs)
        updateModelMaxToken(maxTokens as ModelMaxTokenType)
        updateCodebaseModelMaxToken(codebaseMaxTokens as ModelMaxTokenType)
      })
      .finally(() => {
        loadModelRef.current = false
      })
  }, [setChatModels, updateCodebaseModelMaxToken, updateModelMaxToken])

  return null;
};

export default GlobalDataLoader;