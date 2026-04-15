import * as React from 'react';
import { useMaskStore } from '../../store/mask';
import {
  getUserCategoryId,
  initUser,
} from '../../services/prompt';
import useFirstFocusedEffect from '../../hooks/useFirstFocusEffect';
import { useWorkspaceStore } from '../../store/workspace';
import { useChatConfig } from '../../store/chat-config';

const GlobalDataLoader = () => {
  const { repoUrl, repoName } = useWorkspaceStore((state) => state.workspaceInfo);
  const updateCodebaseModelMaxToken = useChatConfig((state) => state.updateCodebaseModelMaxToken);
  const updateModelMaxToken = useChatConfig((state) => state.updateModelMaxToken);

  const [
    devSpaceOptions,
    setDevSpace,
  ] = useWorkspaceStore((state) => [
    state.devSpaceOptions,
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
  }, [setChatModels, updateCodebaseModelMaxToken, updateModelMaxToken])

  return null;
};

export default GlobalDataLoader;
