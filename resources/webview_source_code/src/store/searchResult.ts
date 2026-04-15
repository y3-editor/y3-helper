import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
enableMapSet();
export interface SearchData {
  name: string;
  code: string;
  language?: string;
  module_name: string;
  annotation: string;
}

interface SearchResultStore {
  searchResult: Map<string, SearchData>;
  add: (id: string, result: SearchData) => void;
  remove: (id: string) => void;
  getResultByID: (id: string) => SearchData | undefined;
  addByArray: (array: (SearchData & { id: string })[]) => void;
}

const useSearchResultStore = create(
  immer<SearchResultStore>((set, get) => ({
    searchResult: new Map<string, SearchData>(),

    add: (id, result) =>
      set((state) => {
        state.searchResult.set(id, result);
      }),

    remove: (id) =>
      set((state) => {
        state.searchResult.delete(id);
      }),

    getResultByID: (id) => {
      return get().searchResult.get(id);
    },

    addByArray: (array) =>
      set((state) => {
        array.forEach((item) => {
          state.searchResult.set(item.id, item);
        });
      }),
  })),
);

export default useSearchResultStore;
