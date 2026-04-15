import { useCallback, useEffect, useRef } from "react";
import { usePostMessage } from "../PostMessageProvider";
import { useWorkspaceStore } from "../store/workspace";

export function useLoadWorkspace() {
  const workspaceInfo = useWorkspaceStore((state) => state.workspaceInfo);
  const { postMessage } = usePostMessage();
  const maxCountRef = useRef(3);
  const currentCountRef = useRef(0);
  const hasWorkspaceInfoRef = useRef(false);
  const loadingRef = useRef(false);

  const loadWorkspaceInfo = useCallback(() => {
    if (loadingRef.current) return
    if (currentCountRef.current > maxCountRef.current) return
    loadingRef.current = true
    postMessage({
      type: 'GET_WORKSPACE_INFO',
    });
    postMessage({
      type: 'GET_WORKSPACE_LIST',
    });
    setTimeout(() => {
      loadingRef.current = false
      if (hasWorkspaceInfoRef.current) return
      loadWorkspaceInfo()
    }, 2000)
    currentCountRef.current++
  }, [postMessage])

  useEffect(() => {
    loadWorkspaceInfo()
  }, [loadWorkspaceInfo])


  useEffect(() => {
    hasWorkspaceInfoRef.current = !!workspaceInfo.repoName
  }, [workspaceInfo])
}

