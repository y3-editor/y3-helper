import * as React from 'react';
import { TypeAheadModePrefix, TypeAheadSubProps } from '../../const';


const UploadImagePanel = (props: TypeAheadSubProps) => {
  const { userInputRef } = props;

  React.useEffect(() => {
    if (userInputRef.current) {
      const value = userInputRef.current.value;
      const attachLastIndex = value.lastIndexOf(TypeAheadModePrefix.Attach);
      const nextValue = value.slice(0, attachLastIndex);
      userInputRef.current.value = nextValue;
      userInputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
      userInputRef.current.focus();
    }
  }, [userInputRef]);

  return <></>;
};

export default UploadImagePanel;
