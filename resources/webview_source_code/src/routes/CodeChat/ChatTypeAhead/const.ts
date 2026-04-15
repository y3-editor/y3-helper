import { HandleImageUpload } from '../../../components/ImageUpload/ImageUpload';
export enum TypeAheadMode {
  Prompt = 'prompt',
  Attach = 'attach',
  Mask = 'mask',
  Plugin = 'plugin',
}

export enum TypeAheadModePrefix {
  Prompt = '/',
  Attach = '@',
}

// export enum AttachType {
//   Docset = 'docset',
//   File = 'file',
//   CodeBase = 'codebase',
//   ImageUrl = 'imageUrl',
// }

export interface TypeAheadSubProps {
  inputValue: string;
  focusIndex: number;
  userInputRef: React.RefObject<HTMLTextAreaElement>;
  mentionKeyword: string;
  updateOpenState: React.Dispatch<React.SetStateAction<boolean>>;
  resetIndex: React.Dispatch<React.SetStateAction<number>>;
  uploadImgRef: React.RefObject<HandleImageUpload>;
  resetAttachType?: () => void;
}
