import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { listAuditLog } from "@/lib/growth.functions";
import { useWorkspace } from "@/lib/workspace";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({
    meta: [
      { title: "Audit log — Growth Agent" },
      {
        name: "description",
        content:
          "Every recommendation, proposal, approval, execution and verification recorded per workspace.",
      },
      { property: "og:title", content: "Audit log — Growth Agent" },
      {
        property: "og:description",
        content: "Recommendations, approvals, executions and verifications for this workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuditPage,
});

function eventBadgeVariant(eventType: string) {
  if (eventType === "action.executed" || eventType === "execution.verified") return "default";
  if (
    eventType === "action.rejected" ||
    eventType === "execution.failed" ||
    eventType === "execution.verification_failed" ||
    eventType === "integration.disconnected"
  ) {
    return "destructive" as const;
  }
  return "secondary" as const;
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function describeEvent(eventType: string) {
  if (eventType === "recommendation.created") return "Opportunity detected";
  if (eventType === "action.proposed") return "Action proposed";
  if (eventType === "action.approved") return "Action approved";
  if (eventType === "action.rejected") return "Action rejected";
  if (eventType === "action.executed") return "Action executed via PagePilot";
  if (eventType === "execution.verified") return "Execution verified";
  if (eventType === "execution.verification_failed") return "Verification failed";
  if (eventType === "execution.failed") return "Execution failed";
  if (eventType === "integration.connected") return "PagePilot connected";
  if (eventType === "integration.disconnected") return "PagePilot disconnected";
  return eventType;
}

function AuditPage() {
  const { current } = useWorkspace();
  const fetchAudit = useServerFn(listAuditLog);
  const { data, isLoading } = useQuery({
    queryKey: ["audit", current?.id],
    queryFn: () => fetchAudit({ data: { workspaceId: current!.id } }),
    enabled: Boolean(current?.id),
  });

  return (
    <AppShell title="Audit log" description="Workspace-scoped record of every agent step.">
      <Card>
        <CardContent className="p-0">
          {isLoading || !data ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : data.entries.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No entries yet.</p>
          ) : (
            <table className="w-[1100px] table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-6 py-3 font-medium">Event</th>
                  <th className="px-6 py-3 font-medium">Description</th>
                  <th className="px-6 py-3 font-medium">Entity</th>
                  <th className="px-6 py-3 font-medium">Details</th>
                  <th className="px-6 py-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data.entries as any[]).map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-6 py-3">
                      <Badge variant={eventBadgeVariant(entry.event_type)}>
                        {entry.event_type}
                      </Badge>
                    </td>
                    <td className="px-6 py-3">{describeEvent(entry.event_type)}</td>
                    <td className="px-6 py-3 text-muted-foreground">{entry.entity_type}</td>
                    <td className="px-6 py-3 font-mono text-xs text-muted-foreground">
                      {JSON.stringify(entry.details)}
                    </td>
                    <td className="px-6 py-3 text-xs text-muted-foreground">
                      {formatTimestamp(entry.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
