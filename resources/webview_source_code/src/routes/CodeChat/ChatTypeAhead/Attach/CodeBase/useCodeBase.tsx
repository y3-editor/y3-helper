import * as React from 'react';
import { useExtensionStore } from '../../../../../store/extension';
import { usePostMessage } from '../../../../../PostMessageProvider';
import { CodeSearchConfigOption } from '../../../../../services/search';
export interface SearchOptionValues {
  code: string;
  branch: string;
  topk: number;
}

export const ALL_BRANCH_OPTION = 'ALL';
export const DEFAULT_SEARCH_SETTINGS = {
  code: 'code',
  branch: ALL_BRANCH_OPTION,
  topk: 10,
};

export interface GroupValue {
  label: string;
  value: string;
  branches?: string[];
  codemaker_public?: boolean;
  repoUrl?: string;
}

export interface CodeGroup {
  label: string;
  options: GroupValue[];
}

enum CodeGroupType {
  Common = '公共',
  Project = '项目',
}
const DEFAULT_CODE_OPTIONS = [
  { label: CodeGroupType.Common, options: [] },
  { label: CodeGroupType.Project, options: [] },
];

function useCodeBase(keyword = '') {
  const { postMessage } = usePostMessage();
  const [loading, setLoading] = React.useState(false);
  const isMhxy = useExtensionStore((state) => state.isMhxy);
  const [codeOptions, setCodeOptions] =
    React.useState<CodeGroup[]>(DEFAULT_CODE_OPTIONS);
  const loadCodebaseTimeRef = React.useRef(0)

  const getCodeOptions = React.useCallback(() => {
    if (Date.now() - loadCodebaseTimeRef.current < 1000) return
    loadCodebaseTimeRef.current = Date.now()
    setLoading(true);
    if (isMhxy) {
      setCodeOptions([
        {
          label: CodeGroupType.Project,
          options: [{ label: 'code', value: 'code' }],
        },
      ]);
      setLoading(false);
    } else {
      postMessage({
        type: 'GET_CODE_SEARCH_LIST_CONTEXT',
        data: {
          keyword
        }
      });
    }
  }, [isMhxy, keyword, postMessage]);

  React.useEffect(() => {
    getCodeOptions();
  }, [getCodeOptions]);

  React.useEffect(() => {
    function getCodeSearchDataSets(event: any) {
      if (event.data.type === 'CODE_SEARCH_LIST_CONTEXT') {
        setLoading(false);
        const data = event.data.data.items as CodeSearchConfigOption[];
        if (!data) {
          setCodeOptions(DEFAULT_CODE_OPTIONS);
          return;
        }
        const projectGroup: GroupValue[] = [];
        const commonGroup: GroupValue[] = [];

        for (const item of data) {
          const group = {
            label: item?.name || item.code,
            value: item.code,
            branches: Array.isArray(item.branches) ? item.branches : [],
            codemaker_public: item.codemaker_public,
            repoUrl: item?.urls?.[0] || '',
          };
          if (item.is_public) {
            commonGroup.push(group);
          } else {
            projectGroup.push(group);
          }
        }

        setCodeOptions((prev) => [
          { ...prev[0], options: commonGroup },
          { ...prev[1], options: projectGroup },
        ]);
      }
    }
    window.addEventListener('message', getCodeSearchDataSets);

    return () => {
      window.removeEventListener('message', getCodeSearchDataSets);
    };
  }, []);

  return {
    codeOptions,
    loading,
  };
}

export default useCodeBase;
