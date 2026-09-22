import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Growth Agent" },
      {
        name: "description",
        content: "Sign in to Growth Agent, a synthetic multi-tenant SaaS assessment environment.",
      },
      { property: "og:title", content: "Sign in — Growth Agent" },
      {
        property: "og:description",
        content: "Sign in to Growth Agent, a synthetic multi-tenant SaaS assessment environment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const demoAccounts = [
  { email: "dana@acmefitness.example.com", label: "Acme Fitness owner" },
  { email: "sam@brightlearn.example.com", label: "BrightLearn owner" },
  { email: "kim@northstar.example.com", label: "Northstar Commerce owner" },
  { email: "multi@growthagent.example.com", label: "Member of two workspaces" },
];

const demoPassword = "growth-agent-demo";

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(demoAccounts[0]!.email);
  const [password, setPassword] = useState(demoPassword);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(mode: "signin" | "signup") {
    setBusy(true);
    try {
      const result =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: window.location.origin },
            });
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      if (!result.data.session) {
        toast.success("Account created. Sign in to continue.");
        return;
      }
      navigate({ to: "/dashboard" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-12">
      <div className="w-full max-w-md space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Growth Agent</CardTitle>
            <CardDescription>
              Synthetic assessment environment. All data, users and integrations are fictional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" disabled={busy} onClick={() => handleSubmit("signin")}>
                Sign in
              </Button>
              <Button
                className="flex-1"
                variant="outline"
                disabled={busy}
                onClick={() => handleSubmit("signup")}
              >
                Create account
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Fictional demo accounts</CardTitle>
            <CardDescription>
              First use: pick one and press Create account (password {demoPassword}). Workspace
              membership is attached automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {demoAccounts.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(demoPassword);
                }}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
              >
                <span className="font-mono text-xs">{account.email}</span>
                <span className="text-xs text-muted-foreground">{account.label}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
