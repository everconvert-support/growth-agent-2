import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { decideAction, executeAction, getRecommendation } from "@/lib/growth.functions";
import { useWorkspace } from "@/lib/workspace";

export const Route = createFileRoute("/_authenticated/recommendations/$recommendationId")({
  head: () => ({
    meta: [
      { title: "Recommendation — Growth Agent" },
      {
        name: "description",
        content: "Review a detected opportunity, then approve or reject the proposed action.",
      },
      { property: "og:title", content: "Recommendation — Growth Agent" },
      {
        property: "og:description",
        content: "Review a detected opportunity, then approve or reject the proposed action.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RecommendationPage,
});

function RecommendationPage() {
  const { recommendationId } = Route.useParams();
  const { current } = useWorkspace();
  const queryClient = useQueryClient();
  const fetchRecommendation = useServerFn(getRecommendation);
  const decide = useServerFn(decideAction);
  const execute = useServerFn(executeAction);

  const queryKey = ["recommendation", current?.id, recommendationId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      fetchRecommendation({ data: { workspaceId: current!.id, recommendationId } }),
    enabled: Boolean(current?.id),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["dashboard", current?.id] });
    queryClient.invalidateQueries({ queryKey: ["audit", current?.id] });
    queryClient.invalidateQueries({ queryKey: ["integration", current?.id] });
  }

  const decideMutation = useMutation({
    mutationFn: (decision: "approved" | "rejected") =>
      decide({ data: { workspaceId: current!.id, actionId: data!.action!.id, decision } }),
    onSuccess: (result) => {
      toast.success(result.decision === "approved" ? "Action approved" : "Action rejected");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const executeMutation = useMutation({
    mutationFn: () =>
      execute({ data: { workspaceId: current!.id, actionId: data!.action!.id } }),
    onSuccess: (result) => {
      toast.success(
        result.replayed
          ? "Already executed — retry was a safe no-op"
          : "Executed and verified through PagePilot",
      );
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading || !data) {
    return (
      <AppShell title="Recommendation">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }

  const action = data.action as any;
  const approval = data.approval as any;
  const execution = data.execution as any;
  const input = (action?.input ?? {}) as Record<string, string>;
  const connected = (data.integration as any)?.status === "connected";

  return (
    <AppShell title={(data.recommendation as any).title} description="Detected opportunity">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What was found</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>{(data.recommendation as any).finding}</p>
              <div>
                <p className="font-medium">Why it matters</p>
                <p className="text-muted-foreground">
                  {(data.recommendation as any).why_it_matters}
                </p>
              </div>
              <p className="font-mono text-xs text-muted-foreground">
                {(data.recommendation as any).page_url}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Proposed action</CardTitle>
              <CardDescription>
                {action ? `${action.action_type} via PagePilot` : "No action proposed"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {action ? (
                <>
                  <dl className="grid gap-2 sm:grid-cols-3">
                    <div>
                      <dt className="text-muted-foreground">Page</dt>
                      <dd className="font-mono text-xs">{input["page_url"]}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Existing CTA</dt>
                      <dd>{input["existing_cta"]}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">New CTA</dt>
                      <dd className="font-medium">{input["new_cta"]}</dd>
                    </div>
                  </dl>

                  {!approval ? (
                    <div className="flex gap-2">
                      <Button
                        disabled={decideMutation.isPending}
                        onClick={() => decideMutation.mutate("approved")}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        disabled={decideMutation.isPending}
                        onClick={() => decideMutation.mutate("rejected")}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-muted-foreground">
                        {approval.decision === "approved" ? "Approved" : "Rejected"} on{" "}
                        {new Date(approval.decided_at).toLocaleString()}
                      </p>
                      {approval.decision === "approved" ? (
                        <>
                          <Button
                            disabled={executeMutation.isPending || !connected}
                            onClick={() => executeMutation.mutate()}
                          >
                            {execution?.status === "succeeded"
                              ? "Retry execution"
                              : "Execute approved action"}
                          </Button>
                          {!connected ? (
                            <p className="text-xs text-destructive">
                              PagePilot is disconnected for this workspace — connect it first.
                            </p>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  )}
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Execution & verification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {execution ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={execution.status === "succeeded" ? "default" : "destructive"}>
                    {execution.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Attempts</span>
                  <span>{execution.attempts}</span>
                </div>
                <p className="text-muted-foreground">
                  {execution.verification_result ?? "Not verified yet"}
                </p>
                <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(execution.provider_response, null, 2)}
                </pre>
              </>
            ) : (
              <p className="text-muted-foreground">Nothing executed yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
