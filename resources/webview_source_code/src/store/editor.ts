import { create } from 'zustand';

export interface EditorFileState {
  // 当前文件元信息
  current_file: {
    // 文件内容
    content: string;
    // 文件路径
    path: string;
    // 文件名称
    file_name: string;
    // 文件语言
    language: string;
  };
  // 光标位置信息
  cursor_position: {
    line: number;
    character: number;
  };
  // 光标选中区域
  selection: {
    // 光标选中区域的起始位置
    start: {
      line: number;
      character: number;
    };
    // 光标选中区域的结束位置
    end: {
      line: number;
      character: number;
    };
  };
}

interface EditorFileStateStore {
  state: EditorFileState | null;
  update: (state: EditorFileState) => void;
}

export const useEditorFileState = create<EditorFileStateStore>()((set) => ({
  state: null,
  update: (state) => {
    set(() => ({ state }));
  },
}));
