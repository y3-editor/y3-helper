import { create } from 'zustand';

export type PromptSampleFormValue = {
  promptName: string;
  promptContent: string;
};

export type MaskSampleFormValue = {
  name: string;
  description: string;
  prompt: string;
};

export type ChatActionStore = {
  customPromptSampleCallback?: (formValue: PromptSampleFormValue) => void;
  setCustomPromptSampleCallback: (
    callback: (formValue: PromptSampleFormValue) => void,
  ) => void;
  triggerCustomPromptSample: (formValue: PromptSampleFormValue) => void;
  customMaskSampleCallback?: (formValue: MaskSampleFormValue) => void;
  setCustomMaskSampleCallback: (
    callback: (formValue: MaskSampleFormValue) => void,
  ) => void;
  triggerCustomMaskSample: (formValue: MaskSampleFormValue) => void;
};

export const useChatActionStore = create<ChatActionStore>((set, get) => ({
  setCustomPromptSampleCallback(callback) {
    set(() => ({
      customPromptSampleCallback: callback,
    }));
  },
  triggerCustomPromptSample: (formValue: PromptSampleFormValue) => {
    const { customPromptSampleCallback } = get();
    if (customPromptSampleCallback) {
      customPromptSampleCallback(formValue);
    }
  },
  setCustomMaskSampleCallback(callback) {
    set(() => ({
      customMaskSampleCallback: callback,
    }));
  },
  triggerCustomMaskSample: (formValue: MaskSampleFormValue) => {
    const { customMaskSampleCallback } = get();
    if (customMaskSampleCallback) {
      customMaskSampleCallback(formValue);
    }
  },
}));
