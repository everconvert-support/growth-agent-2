import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Growth Agent — synthetic SaaS assessment environment" },
      {
        name: "description",
        content:
          "Growth Agent is a small fictional multi-tenant SaaS: detect, recommend, approve, execute, verify and log growth actions.",
      },
      { property: "og:title", content: "Growth Agent — synthetic SaaS assessment environment" },
      {
        property: "og:description",
        content:
          "A deliberately small fictional SaaS used as a senior engineering assessment environment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const steps = ["Detect", "Recommend", "Approve", "Execute", "Verify", "Log"];

function Landing() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted px-6 py-16">
      <div className="w-full max-w-2xl space-y-8 text-center">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Synthetic assessment environment
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Growth Agent</h1>
          <p className="text-muted-foreground">
            A fictional multi-tenant SaaS. A business connects a make-believe marketing platform,
            the agent finds a growth opportunity, proposes an action, waits for approval, executes
            it through a fake integration, verifies the result and records an audit trail.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {steps.map((step) => (
            <span
              key={step}
              className="rounded-full border border-border bg-card px-3 py-1 text-sm text-foreground"
            >
              {step}
            </span>
          ))}
        </div>

        <div className="flex justify-center gap-3">
          <Button asChild>
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          All businesses, users, data and integrations in this application are invented for testing.
        </p>
      </div>
    </div>
  );
}
