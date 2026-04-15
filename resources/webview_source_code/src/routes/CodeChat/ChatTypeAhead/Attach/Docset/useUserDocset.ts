import { useMemo } from 'react';
import {
  BroadcastActions,
  usePostMessage,
} from '../../../../../PostMessageProvider';
import useService from '../../../../../hooks/useService';
import { getDocsets, getOfficeDocsets } from '../../../../../services/docsets';

const BRAINMAKER_DOCSETS_MANAGE_URL = 'http://localhost:3001';
const BRAINMAKER_DOCSETS_HELP_URL = 'https://github.com/user/codemaker';

interface UseUserDocsetOptions {
  excludeFiles: boolean;
}

function useUserDocset(
  options: UseUserDocsetOptions = {
    excludeFiles: true,
  },
) {
  const { postMessage } = usePostMessage();

  // 获取 IDC 数据
  const { data: idcData, isValidating: isValidatingIdc } = useService(
    getDocsets,
    [{ exclude_files: options.excludeFiles }],
    {
      revalidateOnFocus: true,
    },
  );

  // 获取 Office 数据
  const { data: officeData, isValidating: isValidatingOffice } = useService(
    getOfficeDocsets,
    [],
    {
      revalidateOnFocus: true,
    },
  );

  // 合并数据
  const mergedData = useMemo(() => {
    if (idcData || officeData) {
      return [...(idcData || []), ...(officeData || [])];
    }
    return undefined;
  }, [idcData, officeData]);

  const handleOpenBrainmakerManageWebsite = () => {
    postMessage({
      type: BroadcastActions.OPEN_IN_BROWSER,
      data: { url: BRAINMAKER_DOCSETS_MANAGE_URL },
    });
  };

  const handleOpenBrainmakerHelpWebsite = () => {
    postMessage({
      type: BroadcastActions.OPEN_IN_BROWSER,
      data: { url: BRAINMAKER_DOCSETS_HELP_URL },
    });
  };

  return {
    loading: isValidatingIdc || isValidatingOffice,
    docsets: mergedData,
    handleOpenBrainmakerManageWebsite,
    handleOpenBrainmakerHelpWebsite,
  };
}

export default useUserDocset;
