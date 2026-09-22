import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getIntegration,
  setIntegrationConnection,
  simulateTokenState,
} from "@/lib/growth.functions";

import { useWorkspace } from "@/lib/workspace";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({
    meta: [
      { title: "Integrations — Growth Agent" },
      {
        name: "description",
        content: "PagePilot connection status and simulated execution history.",
      },
      { property: "og:title", content: "Integrations — Growth Agent" },
      {
        property: "og:description",
        content: "PagePilot connection status and simulated execution history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IntegrationsPage,
});

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function executionBadgeVariant(status: string) {
  if (status === "succeeded") return "default" as const;
  if (status === "failed") return "destructive" as const;
  return "secondary" as const;
}

function IntegrationsPage() {
  const { current } = useWorkspace();
  const queryClient = useQueryClient();
  const fetchIntegration = useServerFn(getIntegration);
  const setConnection = useServerFn(setIntegrationConnection);
  const setTokenState = useServerFn(simulateTokenState);

  const { data, isLoading } = useQuery({
    queryKey: ["integration", current?.id],
    queryFn: () => fetchIntegration({ data: { workspaceId: current!.id } }),
    enabled: Boolean(current?.id),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["integration", current?.id] });
    queryClient.invalidateQueries({ queryKey: ["dashboard", current?.id] });
    queryClient.invalidateQueries({ queryKey: ["audit", current?.id] });
  }

  const mutation = useMutation({
    mutationFn: (connect: boolean) =>
      setConnection({ data: { workspaceId: current!.id, connect } }),
    onSuccess: (result) => {
      toast.success(`PagePilot is now ${result.status}`);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const tokenMutation = useMutation({
    mutationFn: (state: "valid" | "expired" | "revoked") =>
      setTokenState({ data: { workspaceId: current!.id, state } }),
    onSuccess: (result) => {
      toast.success(`PagePilot now reports the token as ${result.state}`);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const integration = data?.integration as any;
  const storedFlag = integration?.status ?? "not configured";
  const tokenCheck = data?.tokenCheck;
  const genuinelyConnected = data?.genuinelyConnected ?? false;
  const busy = mutation.isPending || tokenMutation.isPending;

  return (
    <AppShell
      title="Integrations"
      description="PagePilot is a fictional platform. Nothing leaves this application."
    >
      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">PagePilot</CardTitle>
              <CardDescription>Simulated landing-page editing platform.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Reported connection</span>
                <Badge variant={genuinelyConnected ? "default" : "destructive"}>
                  {genuinelyConnected ? "connected" : "not usable"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Our stored flag</span>
                <span>{storedFlag}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">PagePilot token check</span>
                <span>{tokenCheck?.state ?? "unknown"}</span>
              </div>
              <p className="text-xs text-muted-foreground">{tokenCheck?.reason}</p>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Connected at</span>
                <span>{formatTimestamp(integration?.connected_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last checked</span>
                <span>{formatTimestamp(integration?.last_checked_at)}</span>
              </div>
              <Button
                variant={storedFlag === "connected" ? "outline" : "default"}
                disabled={busy}
                onClick={() => mutation.mutate(storedFlag !== "connected")}
              >
                {storedFlag === "connected" ? "Disconnect PagePilot" : "Connect PagePilot"}
              </Button>
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-muted-foreground">Simulate PagePilot token lifecycle</p>
                <div className="flex flex-wrap gap-2">
                  {(["valid", "expired", "revoked"] as const).map((state) => (
                    <Button
                      key={state}
                      size="sm"
                      variant="outline"
                      disabled={busy || storedFlag !== "connected"}
                      onClick={() => tokenMutation.mutate(state)}
                    >
                      {state} token
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-muted-foreground">Simulated live page state</p>
                <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(integration?.page_state ?? {}, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>


          <Card>
            <CardHeader>
              <CardTitle className="text-base">Execution history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {data.executions.length === 0 ? (
                <p className="text-muted-foreground">No executions recorded.</p>
              ) : (
                data.executions.map((execution: any) => (
                  <div key={execution.id} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between">
                      <Badge variant={executionBadgeVariant(execution.status)}>
                        {execution.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(execution.created_at)} · attempt {execution.attempts}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {execution.verification_result ?? "Not verified yet"}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
