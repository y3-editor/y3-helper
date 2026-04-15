import { useMemo } from "react";
import { useWorkspaceStore } from "../../store/workspace";
import useUserDocset from "../../routes/CodeChat/ChatTypeAhead/Attach/Docset/useUserDocset";

interface KnowledgeBaseOption {
  _id: string;
  name: string;
  source: 'user' | 'devspace';
}

export function useKnowledgeBaseOptions(): KnowledgeBaseOption[] {
  const devSpace = useWorkspaceStore((state) => state.devSpace);
  const { docsets } = useUserDocset();
  const knowledgeBaseOptions = useMemo(() => {
    const knowledgeBasesFromDevspace: KnowledgeBaseOption[] = devSpace?.knowledge_bases.map((kb) => ({
      _id: kb.knowledge_base_id,
      name: kb.knowledge_base_name,
      source: 'devspace'
    }));
    // const knowledgeBasesFromUser: KnowledgeBaseOption[] = docsets ? docsets.map((kb) => ({
    //   _id: kb._id,
    //   name: kb.name,
    //   source: 'user'
    // })) : [];
    const allKnowledgeBases = [...knowledgeBasesFromDevspace];
    // for (const kb of knowledgeBasesFromUser) {
    //   if (!allKnowledgeBases.some((existingKb) => existingKb._id === kb._id)) {
    //     allKnowledgeBases.push(kb);
    //   }
    // }
    return allKnowledgeBases;
  }, [devSpace, docsets]);
  return knowledgeBaseOptions;
}