import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getMySubmission, saveMySubmission } from "@/lib/growth.functions";

export const Route = createFileRoute("/_authenticated/submission")({
  head: () => ({
    meta: [
      { title: "Submit trial — Growth Agent" },
      { name: "description", content: "Write up your trial: findings, changes and next steps." },
      { property: "og:title", content: "Submit trial — Growth Agent" },
      {
        property: "og:description",
        content: "Write up your trial: findings, changes and next steps.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SubmissionPage,
});

const fields = [
  { key: "answer_found", label: "What I found" },
  { key: "answer_changed", label: "What I changed" },
  { key: "answer_not_changed", label: "What I deliberately didn't change" },
  { key: "answer_next_day", label: "What I would do next with another day" },
] as const;

type FormState = Record<string, string>;

function SubmissionPage() {
  const queryClient = useQueryClient();
  const fetchSubmission = useServerFn(getMySubmission);
  const save = useServerFn(saveMySubmission);
  const { data, isLoading } = useQuery({
    queryKey: ["my-submission"],
    queryFn: () => fetchSubmission(),
  });

  const [form, setForm] = useState<FormState>({});

  useEffect(() => {
    const submission = data?.submission as any;
    if (!submission) return;
    setForm({
      answer_found: submission.answer_found ?? "",
      answer_changed: submission.answer_changed ?? "",
      answer_not_changed: submission.answer_not_changed ?? "",
      answer_next_day: submission.answer_next_day ?? "",
      repo_url: submission.repo_url ?? "",
      commit_sha: submission.commit_sha ?? "",
    });
  }, [data]);

  const mutation = useMutation({
    mutationFn: (submit: boolean) =>
      save({
        data: {
          answer_found: form["answer_found"] ?? "",
          answer_changed: form["answer_changed"] ?? "",
          answer_not_changed: form["answer_not_changed"] ?? "",
          answer_next_day: form["answer_next_day"] ?? "",
          repo_url: form["repo_url"] ?? "",
          commit_sha: form["commit_sha"] ?? "",
          submit,
        },
      }),
    onSuccess: (_result, submit) => {
      toast.success(submit ? "Trial submitted" : "Draft saved");
      queryClient.invalidateQueries({ queryKey: ["my-submission"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submission = data?.submission as any;

  return (
    <AppShell title="Submit trial" description="Your write-up of the work you did.">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Repository</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="repo_url">GitHub repository URL</Label>
                <Input
                  id="repo_url"
                  value={form["repo_url"] ?? ""}
                  onChange={(event) => setForm({ ...form, repo_url: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="commit_sha">Submitted commit SHA</Label>
                <Input
                  id="commit_sha"
                  value={form["commit_sha"] ?? ""}
                  onChange={(event) => setForm({ ...form, commit_sha: event.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          {fields.map((field) => (
            <Card key={field.key}>
              <CardHeader>
                <CardTitle className="text-base">{field.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  rows={5}
                  value={form[field.key] ?? ""}
                  onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                />
              </CardContent>
            </Card>
          ))}

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(false)}
            >
              Save draft
            </Button>
            <Button disabled={mutation.isPending} onClick={() => mutation.mutate(true)}>
              Submit trial
            </Button>
            {submission?.submitted_at ? (
              <span className="text-xs text-muted-foreground">
                Submitted {new Date(submission.submitted_at).toLocaleString()}
              </span>
            ) : null}
          </div>
        </div>
      )}
    </AppShell>
  );
}
