import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboard } from "@/lib/growth.functions";
import { useWorkspace } from "@/lib/workspace";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Growth Agent" },
      {
        name: "description",
        content: "Detected growth opportunities, integration status and recent executions.",
      },
      { property: "og:title", content: "Dashboard — Growth Agent" },
      {
        property: "og:description",
        content: "Detected growth opportunities, integration status and recent executions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function statusVariant(status: string) {
  if (status === "executed" || status === "succeeded" || status === "connected") return "default";
  if (status === "rejected" || status === "failed" || status === "disconnected")
    return "destructive";
  return "secondary";
}

function Dashboard() {
  const { current } = useWorkspace();
  const fetchDashboard = useServerFn(getDashboard);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", current?.id],
    queryFn: () => fetchDashboard({ data: { workspaceId: current!.id } }),
    enabled: Boolean(current?.id),
  });

  return (
    <AppShell
      title={current?.name ?? "Dashboard"}
      description="Detected opportunities, integration status and recent activity for this workspace."
    >
      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Loading workspace…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Detected opportunities</CardTitle>
              <CardDescription>Generated from synthetic page performance data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.recommendations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No opportunities detected.</p>
              ) : (
                data.recommendations.map((rec: any) => (
                  <Link
                    key={rec.id}
                    to="/recommendations/$recommendationId"
                    params={{ recommendationId: rec.id }}
                    className="block rounded-lg border border-border p-4 transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{rec.title}</span>
                      <Badge variant={statusVariant(rec.status)}>{rec.status}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{rec.finding}</p>
                    <p className="mt-2 font-mono text-xs text-muted-foreground">{rec.page_url}</p>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">PagePilot</CardTitle>
                <CardDescription>Fictional marketing platform integration.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={data.genuinelyConnected ? "default" : "destructive"}>
                    {data.genuinelyConnected
                      ? "connected"
                      : (data.integration?.status ?? "not configured")}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Token</span>
                  <span>{data.tokenCheck.state}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Connected</span>
                  <span>
                    {data.integration?.connected_at
                      ? new Date(data.integration.connected_at).toLocaleDateString()
                      : "—"}
                  </span>
                </div>
              </CardContent>

            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent executions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {data.executions.length === 0 ? (
                  <p className="text-muted-foreground">No executions yet.</p>
                ) : (
                  data.executions.map((execution: any) => (
                    <div key={execution.id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant={statusVariant(execution.status)}>{execution.status}</Badge>
                        <span className="text-xs text-muted-foreground">
                          attempt {execution.attempts}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {execution.verification_result ?? "Not verified yet"}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}
