import { useMemo } from "react";
import { useWorkspaceStore } from "../../store/workspace";

export function useRulesOptions() {
  const rules = useWorkspaceStore((state) => state.rules);
  const teamRules = useWorkspaceStore((state) => state.teamRules);
  const rulesOptions = useMemo(() => {
    const allRulesOptions = [
      ...teamRules,
      ...rules
    ];
    return allRulesOptions;
  }, [rules, teamRules]);
  return rulesOptions;
}