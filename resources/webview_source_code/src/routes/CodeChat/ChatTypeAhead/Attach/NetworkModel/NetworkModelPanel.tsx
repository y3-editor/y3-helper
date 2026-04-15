import * as React from 'react';
import { TypeAheadModePrefix, TypeAheadSubProps } from '../../const';
import { useChatAttach } from '../../../../../store/chat';
import { AttachType } from '../../../../../store/attaches';
import { usePluginApp } from '../../../../../store/plugin-app';
import { ChatModel } from '../../../../../services/chatModel';

const NetworkModelPanel = (props: TypeAheadSubProps) => {
  const { userInputRef } = props;
  const updateAttach = useChatAttach((state) => state.update);
  const updatePluginAppRunner = usePluginApp((state) => state.update);
  React.useEffect(() => {
    updateAttach({
      attachType: AttachType.NetworkModel,
      model: ChatModel.Gemini2,
    });
    updatePluginAppRunner(undefined);
    if (userInputRef.current) {
      const value = userInputRef.current.value;
      const attachLastIndex = value.lastIndexOf(TypeAheadModePrefix.Attach);
      const nextValue = value.slice(0, attachLastIndex);
      userInputRef.current.value = nextValue;
      userInputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
      userInputRef.current.focus();
    }
  }, [updateAttach, userInputRef, updatePluginAppRunner]);

  return <></>;
};

export default NetworkModelPanel;
