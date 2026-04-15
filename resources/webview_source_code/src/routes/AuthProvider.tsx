import * as React from 'react';
import { updateContexts as updateWebToolsContexts, hub as webToolsHub } from '@dep305/codemaker-web-tools';

import { validate } from '../services/auth';
import { useAuthStore } from '../store/auth';
import { useChatConfig } from '../store/chat-config';
import { useChatApplyStore } from '../store/chatApply';
import { useExtensionStore } from '../store/extension';

export default function AuthProvider() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const setUsername = useAuthStore((state) => state.setUsername);
  const setDisplayName = useAuthStore((state) => state.setDisplayName);
  const ide = useExtensionStore((state) => state.IDE);
  const setAuthExtends = useAuthStore((state) => state.setAuthExtends);
  const setMemoryConfig = useChatConfig((state) => state.setMemoryConfig);
  const chatModels = useChatConfig((state) => state.chatModels);

  const setEnableNewApply = useChatApplyStore((state) => state.setEnableNewApply);
  const disableNewApply = useChatApplyStore((state) => state.disableNewApply);
  const pluginVersion = useExtensionStore((state) => state.codeMakerVersion) || '';
  const setPkgNamespace = useAuthStore((state) => state.setPkgNamespace);

  React.useEffect(() => {
    async function effect() {
      if (!accessToken) {
        return;
      }
      const data = await validate();
      if (data.user_info) {
        const {
          nickname,
          display_name
        } = data.user_info;
        if (nickname) {
          setUsername(nickname);
        }
        if (display_name) {
          setDisplayName(display_name);
        }
      }
      setAuthExtends({
        department: data.department,
        department_code: data.department_code,
        c_unrestrict: data.c_unrestrict
      });
      setPkgNamespace(data.pkg_namespace);
      setMemoryConfig({
        visible: !!data.codebase_compress,
      });
      const newApplyVersion = true
      setEnableNewApply(!disableNewApply && data.new_apply_enable && newApplyVersion);
      if (data.track_enable) {
        updateWebToolsContexts({ enabled: true });
        webToolsHub.configureScope((scope) => {
          const context = {
            gateway: data.gateway,
            code_generate_model: data.code_generate_model,
            code_review_url: data.code_review_proxy,
            code_lint_url: data.code_lint_proxy,
            code_search_url: data.code_search,
            department: data.department,
            department_code: data.department_code,
            pkg_namespace: data.pkg_namespace,
          }
          scope.setExtras(context);
          scope.setTag("source", "web-ui");
          updateWebToolsContexts(context);
        });
      } else {
        updateWebToolsContexts({ enabled: false });
      }

    }
    effect();
  }, [chatModels, setAuthExtends, accessToken, ide, disableNewApply, pluginVersion, setEnableNewApply, setMemoryConfig, setPkgNamespace, setUsername, setDisplayName]);

  return null;
}
