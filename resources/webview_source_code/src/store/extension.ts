import { create } from 'zustand';

export enum IDE {
  VisualStudio = 'Visual Studio',
  // TODO: 后续插件需要更改为 Visual Studio Code
  // VisualStudioCode = 'Visual Studio Code',
  VisualStudioCode = 'vscode',
  JetBrains = 'JetBrains',
}

interface ExtensionStore {
  codeMakerVersion: string | null;
  setCodeMakerVersion: (token: string) => void;
  generateModel: string | null;
  setGenerateModel: (username: string) => void;
  generateModelCode: string | null;
  setGenerateModelCode: (code: string) => void;
  gatewayName: string | null;
  setGatewayName: (username: string) => void;
  IDE: string | null;
  setIDE: (ide: string | null) => void;
  newCodeReview: boolean;
  setNewCodeReview: (state: boolean) => void;
  isMhxy: boolean;
  setIsMhxy: (bool: boolean) => void;
  // 入口，为空即为 codemaker
  entrance: string;
  setEntrance: (entrance: string) => void;
  // IDE 版本号
  appVersion: string | null;
  setAppVersion: (version: string) => void;
  // Y3Helper: 固定模型名（用户自定义模型）
  fixedModel: string;
  setFixedModel: (model: string) => void;
}

export const useExtensionStore = create<ExtensionStore>()((set) => ({
  codeMakerVersion: null,
  setCodeMakerVersion: (version: string) => {
    set({ codeMakerVersion: version });
  },
  generateModel: null,
  setGenerateModel: (model: string) => {
    set({ generateModel: model });
  },
  generateModelCode: null,
  setGenerateModelCode: (code: string) => {
    set({ generateModelCode: code });
  },
  gatewayName: null,
  setGatewayName: (name: string) => {
    set({ gatewayName: name });
  },
  IDE: '',
  setIDE: (ide) => {
    set(() => ({ IDE: ide }));
  },
  newCodeReview: true,
  setNewCodeReview: (state: boolean) => {
    set(() => ({ newCodeReview: state }));
  },
  isMhxy: false,
  setIsMhxy: (bool: boolean) => {
    set(() => ({ isMhxy: bool }));
  },
  entrance: '',
  setEntrance: (entrance) => {
    set(() => ({ entrance }));
  },
  appVersion: null,
  setAppVersion: (version) => {
    set(() => ({ appVersion: version }));
  },
  fixedModel: '',
  setFixedModel: (model: string) => {
    set(() => ({ fixedModel: model }));
  },
}));

export const extensionStore = useExtensionStore;
