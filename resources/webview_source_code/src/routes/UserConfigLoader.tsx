import * as React from 'react';
import { useUserConfig } from '../store/user-config';
import { getUserConfig } from '../services/user-config';
import useService from '../hooks/useService';

const USerConfigLoader = () => {
  const { data: userConfig } = useService(getUserConfig, []);
  const updateUserConfig = useUserConfig((state) => state.update);

  React.useEffect(() => {
    if (userConfig) {
      updateUserConfig(userConfig);
    }
  }, [updateUserConfig, userConfig]);

  return null;
};

export default USerConfigLoader;
