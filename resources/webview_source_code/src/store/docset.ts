import { create } from 'zustand';
import { Docset, getDocsetRawFile } from '../services/docsets';

interface DocsetStore {
  isInitial: boolean;
  docsets: Map<string, Docset>;
  files: Map<string, string>;
  initializeUserDocsets: (data: Docset[]) => void;
  updateDocset: (
    updater: (docset: Map<string, Docset>) => Map<string, Docset>,
  ) => void;
  loadRawFile: (project: string, code: string, id: string) => void;
}

export const useDocsetStore = create<DocsetStore>()((set, get) => ({
  isInitial: false,
  docsets: new Map(),
  files: new Map(),
  initializeUserDocsets: (data: Docset[]) => {
    const nextDocsets = new Map();
    for (const docset of data) {
      nextDocsets.set(docset.code, docset);
    }
    set(() => ({ isInitial: true, docsets: nextDocsets }));
    return get().docsets;
  },
  updateDocset: (updater) => {
    const docsets = get().docsets;
    const nextDocsets = updater(docsets);
    set(() => ({ docsets: nextDocsets }));
  },
  loadRawFile: async (project: string, code: string, id: string) => {
    if (get().files.get(id)) {
      return;
    }
    try {
      const data = await getDocsetRawFile(code, project, id);
      const nextFiles = new Map(get().files);
      nextFiles.set(id, data);
      set(() => ({ files: nextFiles }));
    } catch (error) {
      console.error(error);
    }
  },
}));
