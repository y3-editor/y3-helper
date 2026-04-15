import { useMemo } from "react";
import { useWorkspaceStore } from "../../store/workspace";

interface CodebaseOption {
  _id: string;
  name: string;
  source: 'user' | 'devspace';
}

export function useCodebaseOptions(): CodebaseOption[] {
  // const { codeOptions } = useCodeBase();
  const devSpace = useWorkspaceStore((state) => state.devSpace);
  const codebasesOptions = useMemo(() => {
    const codebaseOptionsFromDevspace: CodebaseOption[] = devSpace?.codebases.map((codebase) => ({
      _id: codebase.codebase_id,
      name: codebase.codebase_name,
      source: 'devspace'
    }))
    const codebaseOptionsFromUser: CodebaseOption[] = [];
    // if (codeOptions) {
    //   for (const item of codeOptions) {
    //     for (const value of item.options) {
    //       codebaseOptionsFromUser.push({
    //         _id: value.value,
    //         name: value.label,
    //         source: 'user'
    //       });
    //     }
    //   }
    // }
    const allCodebases = [...codebaseOptionsFromDevspace];
    for (const codebase of codebaseOptionsFromUser) {
      if (!allCodebases.some((cb) => cb._id === codebase._id)) {
        allCodebases.push(codebase);
      }
    }
    return allCodebases;
  }, [devSpace]);
  return codebasesOptions;
}