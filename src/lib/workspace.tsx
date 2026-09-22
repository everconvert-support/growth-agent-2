import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { listMyWorkspaces } from "./growth.functions";

export type Workspace = { id: string; name: string; slug: string };

type WorkspaceContextValue = {
  workspaces: Workspace[];
  current: Workspace | null;
  loading: boolean;
  select: (id: string) => void;
};


const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const STORAGE_KEY = "growth-agent.workspace";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const fetchWorkspaces = useServerFn(listMyWorkspaces);
  const { data, isLoading } = useQuery({
    queryKey: ["my-workspaces"],
    queryFn: () => fetchWorkspaces(),
  });
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) setSelected(stored);
  }, []);

  const workspaces = data?.workspaces ?? [];
  const current =
    workspaces.find((workspace) => workspace.id === selected) ?? workspaces[0] ?? null;

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      current,
      loading: isLoading,
      select: (id: string) => {
        window.localStorage.setItem(STORAGE_KEY, id);
        setSelected(id);
      },
    }),
    [workspaces, current, isLoading],
  );


  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return context;
}
