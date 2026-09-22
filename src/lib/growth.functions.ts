import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import {
  pagePilotChangeCta,
  pagePilotIssueToken,
  pagePilotReadPage,
  pagePilotSetTokenState,
  pagePilotValidateToken,
  parseChangeCtaInput,
  type PageState,
} from "./pagepilot.server";

type AuthContext = {
  supabase: {
    from: (table: string) => any;
  };
  userId: string;
};

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as { from: (table: string) => any };
}

/** Loads the signed-in user's membership row for a workspace. */
async function assertMember(context: AuthContext, workspaceId: string) {
  const { data, error } = await context.supabase
    .from("workspace_members")
    .select("id, role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("You are not a member of this workspace");
  return data as { id: string; role: string };
}

async function writeAudit(
  db: { from: (table: string) => any },
  entry: {
    workspace_id: string;
    event_type: string;
    actor_id: string | null;
    entity_type: string;
    entity_id: string;
    details?: Record<string, unknown>;
  },
) {
  await db.from("audit_logs").insert({ ...entry, details: entry.details ?? {} });
}

export const listMyWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as AuthContext;
    const { data, error } = await ctx.supabase
      .from("workspaces")
      .select("id, name, slug")
      .order("name");
    if (error) throw new Error(error.message);
    return { workspaces: (data ?? []) as Array<{ id: string; name: string; slug: string }> };
  });

export const getDashboard = createServerFn({ method: "GET" })
  .inputValidator((input: { workspaceId: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthContext;
    await assertMember(ctx, data.workspaceId);

    const [workspace, integration, recommendations, executions] = await Promise.all([
      ctx.supabase.from("workspaces").select("id, name, slug").eq("id", data.workspaceId).single(),
      ctx.supabase
        .from("integrations")
        .select("id, provider, status, connected_at, last_checked_at")
        .eq("workspace_id", data.workspaceId)
        .eq("provider", "pagepilot")
        .maybeSingle(),
      ctx.supabase
        .from("recommendations")
        .select("id, title, finding, status, page_url, created_at")
        .eq("workspace_id", data.workspaceId)
        .order("created_at", { ascending: false }),
      ctx.supabase
        .from("executions")
        .select("id, status, attempts, verification_result, created_at, provider_response")
        .eq("workspace_id", data.workspaceId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const connected = integration.data?.status === "connected";

    return {
      workspace: workspace.data,
      integration: integration.data,
      tokenCheck: {
        valid: connected,
        state: connected ? "valid" : "missing",
        checked_at: integration.data?.last_checked_at ?? new Date().toISOString(),
        reason: connected ? "Token is valid" : "PagePilot is not connected",
      },
      genuinelyConnected: connected,
      recommendations: recommendations.data ?? [],
      executions: executions.data ?? [],
    };

  });

export const getRecommendation = createServerFn({ method: "GET" })
  .inputValidator((input: { workspaceId: string; recommendationId: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    const db = await adminClient();

    const { data: recommendation, error } = await db
      .from("recommendations")
      .select("id, workspace_id, title, finding, why_it_matters, page_url, status, created_at")
      .eq("workspace_id", data.workspaceId)
      .eq("id", data.recommendationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!recommendation) throw new Error("Recommendation not found");

    const { data: action } = await db
      .from("proposed_actions")
      .select("id, action_type, input, status, created_at")
      .eq("workspace_id", data.workspaceId)
      .eq("recommendation_id", data.recommendationId)
      .maybeSingle();

    const approval = action
      ? (
          await db
            .from("approvals")
            .select("id, decision, note, decided_at, decided_by")
            .eq("action_id", action.id)
            .maybeSingle()
        ).data
      : null;

    const execution = action
      ? (
          await db
            .from("executions")
            .select("id, status, attempts, provider_response, verified_at, verification_result")
            .eq("action_id", action.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        ).data
      : null;

    const { data: integration } = await db
      .from("integrations")
      .select("status")
      .eq("workspace_id", data.workspaceId)
      .eq("provider", "pagepilot")
      .maybeSingle();

    return { recommendation, action, approval, execution, integration };
  });

export const decideAction = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      workspaceId: string;
      actionId: string;
      decision: "approved" | "rejected";
      note?: string;
    }) => {
      if (input.decision !== "approved" && input.decision !== "rejected") {
        throw new Error("Invalid decision");
      }
      return input;
    },
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthContext;
    await assertMember(ctx, data.workspaceId);

    const { data: action } = await ctx.supabase
      .from("proposed_actions")
      .select("id, workspace_id, recommendation_id, status")
      .eq("workspace_id", data.workspaceId)
      .eq("id", data.actionId)
      .maybeSingle();
    if (!action) throw new Error("Action not found in this workspace");
    if (action.status !== "proposed") throw new Error("This action has already been decided");

    const db = await adminClient();
    const { data: approval, error } = await db
      .from("approvals")
      .insert({
        workspace_id: data.workspaceId,
        action_id: action.id,
        decision: data.decision,
        decided_by: ctx.userId,
        note: data.note ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await db
      .from("proposed_actions")
      .update({ status: data.decision })
      .eq("id", action.id)
      .eq("workspace_id", data.workspaceId);
    await db
      .from("recommendations")
      .update({ status: data.decision })
      .eq("id", action.recommendation_id)
      .eq("workspace_id", data.workspaceId);

    await writeAudit(db, {
      workspace_id: data.workspaceId,
      event_type: data.decision === "approved" ? "action.approved" : "action.rejected",
      actor_id: ctx.userId,
      entity_type: "approval",
      entity_id: approval.id,
      details: { action_id: action.id, note: data.note ?? null },
    });

    return { approvalId: approval.id as string, decision: data.decision };
  });

export const executeAction = createServerFn({ method: "POST" })
  .inputValidator((input: { workspaceId: string; actionId: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthContext;
    await assertMember(ctx, data.workspaceId);
    const db = await adminClient();

    const { data: action } = await db
      .from("proposed_actions")
      .select("id, workspace_id, recommendation_id, action_type, input, status")
      .eq("id", data.actionId)
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    if (!action) throw new Error("Action not found in this workspace");
    if (action.action_type !== "change_cta") throw new Error("Unsupported action type");

    const { data: approval } = await db
      .from("approvals")
      .select("id, action_id, workspace_id, decision")
      .eq("action_id", action.id)
      .maybeSingle();
    if (!approval || approval.action_id !== action.id) {
      throw new Error("This action has no approval");
    }
    if (approval.workspace_id !== action.workspace_id) {
      throw new Error("Approval does not belong to this workspace");
    }
    if (approval.decision !== "approved") {
      throw new Error("This action was not approved");
    }

    const { data: integration } = await db
      .from("integrations")
      .select("id, status, access_token, page_state")
      .eq("workspace_id", data.workspaceId)
      .eq("provider", "pagepilot")
      .maybeSingle();
    if (!integration || integration.status !== "connected") {
      throw new Error("PagePilot is not connected for this workspace");
    }

    const tokenCheck = await pagePilotValidateToken(db, integration.access_token);
    await db
      .from("integrations")
      .update({ last_checked_at: tokenCheck.checked_at })
      .eq("id", integration.id);
    if (!tokenCheck.valid) {
      throw new Error(`PagePilot token is not usable: ${tokenCheck.reason}`);
    }

    const { data: recommendation } = await db
      .from("recommendations")
      .select("id, page_url")
      .eq("id", action.recommendation_id)
      .maybeSingle();

    const currentInput = (action.input ?? {}) as Record<string, unknown>;
    const input = parseChangeCtaInput({
      ...currentInput,
      page_url: recommendation?.page_url ?? currentInput["page_url"],
    });

    const idempotencyKey = `exec:${action.id}:${Date.now().toString(36)}`;
    const { data: execution, error: execError } = await db
      .from("executions")
      .insert({
        workspace_id: data.workspaceId,
        action_id: action.id,
        approval_id: approval.id,
        idempotency_key: idempotencyKey,
        status: "pending",
      })
      .select("id, status, attempts")
      .single();
    if (execError) throw new Error(execError.message);

    const attempts = (execution.attempts ?? 0) + 1;

    try {
      const { response, pageState } = pagePilotChangeCta({
        tokenCheck,
        input,
        idempotencyKey,
        pageState: (integration.page_state ?? {}) as PageState,
      });

      await db.from("integrations").update({ page_state: pageState }).eq("id", integration.id);
      await db
        .from("executions")
        .update({ status: "succeeded", attempts, provider_response: response })
        .eq("id", execution.id);
      await writeAudit(db, {
        workspace_id: data.workspaceId,
        event_type: "action.executed",
        actor_id: ctx.userId,
        entity_type: "execution",
        entity_id: execution.id,
        details: { attempts, request_id: response.request_id, new_cta: input.new_cta },
      });

      const live = pagePilotReadPage(pageState, input.page_url);
      const verified = live?.current_cta === input.new_cta;
      const verificationResult = verified
        ? `Verified: page CTA is now "${input.new_cta}"`
        : "Verification failed: page CTA does not match the approved change";
      await db
        .from("executions")
        .update({ verified_at: new Date().toISOString(), verification_result: verificationResult })
        .eq("id", execution.id);
      await writeAudit(db, {
        workspace_id: data.workspaceId,
        event_type: verified ? "execution.verified" : "execution.verification_failed",
        actor_id: ctx.userId,
        entity_type: "execution",
        entity_id: execution.id,
        details: { verification_result: verificationResult },
      });

      if (verified) {
        await db.from("proposed_actions").update({ status: "executed" }).eq("id", action.id);
        await db
          .from("recommendations")
          .update({ status: "executed" })
          .eq("id", action.recommendation_id);
      }

      return { executionId: execution.id as string, status: "succeeded", replayed: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown execution error";
      await db
        .from("executions")
        .update({ status: "failed", attempts, provider_response: { ok: false, error: message } })
        .eq("id", execution.id);
      await writeAudit(db, {
        workspace_id: data.workspaceId,
        event_type: "execution.failed",
        actor_id: ctx.userId,
        entity_type: "execution",
        entity_id: execution.id,
        details: { attempts, error: message },
      });
      throw new Error(message);
    }
  });

export const getIntegration = createServerFn({ method: "GET" })
  .inputValidator((input: { workspaceId: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthContext;
    await assertMember(ctx, data.workspaceId);
    const { data: integration } = await ctx.supabase
      .from("integrations")
      .select("id, provider, status, connected_at, last_checked_at, page_state")
      .eq("workspace_id", data.workspaceId)
      .eq("provider", "pagepilot")
      .maybeSingle();
    const { data: executions } = await ctx.supabase
      .from("executions")
      .select("id, status, attempts, provider_response, verification_result, created_at")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false });

    const tokenCheck = await verifyPagePilotToken(data.workspaceId);

    return {
      integration,
      executions: executions ?? [],
      tokenCheck,
      genuinelyConnected: integration?.status === "connected" && tokenCheck.valid,
    };
  });

/** Reads the stored token and asks PagePilot whether it is usable. */
async function verifyPagePilotToken(workspaceId: string) {
  const db = await adminClient();
  const { data: integration } = await db
    .from("integrations")
    .select("id, access_token")
    .eq("workspace_id", workspaceId)
    .eq("provider", "pagepilot")
    .maybeSingle();
  const check = await pagePilotValidateToken(db, integration?.access_token ?? null);
  if (integration) {
    await db
      .from("integrations")
      .update({ last_checked_at: check.checked_at })
      .eq("id", integration.id);
  }
  return check;
}

export const setIntegrationConnection = createServerFn({ method: "POST" })
  .inputValidator((input: { workspaceId: string; connect: boolean }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthContext;
    await assertMember(ctx, data.workspaceId);
    const db = await adminClient();
    const now = new Date().toISOString();

    const patch = data.connect
      ? {
          status: "connected",
          access_token: await pagePilotIssueToken(db, "valid"),
          connected_at: now,
          last_checked_at: now,
        }
      : { status: "disconnected", access_token: null, connected_at: null, last_checked_at: now };

    const { data: integration, error } = await db
      .from("integrations")
      .update(patch)
      .eq("workspace_id", data.workspaceId)
      .eq("provider", "pagepilot")
      .select("id, status")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(db, {
      workspace_id: data.workspaceId,
      event_type: data.connect ? "integration.connected" : "integration.disconnected",
      actor_id: ctx.userId,
      entity_type: "integration",
      entity_id: integration.id,
      details: { provider: "pagepilot" },
    });
    return { status: integration.status as string };
  });

/** Changes the state of the workspace's token in the simulated service. */
export const simulateTokenState = createServerFn({ method: "POST" })
  .inputValidator((input: { workspaceId: string; state: "valid" | "expired" | "revoked" }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthContext;
    await assertMember(ctx, data.workspaceId);
    const db = await adminClient();
    const { data: integration } = await db
      .from("integrations")
      .select("access_token")
      .eq("workspace_id", data.workspaceId)
      .eq("provider", "pagepilot")
      .maybeSingle();
    if (!integration?.access_token) throw new Error("There is no PagePilot token to change");
    await pagePilotSetTokenState(db, integration.access_token, data.state);
    return { state: data.state };
  });

export const listAuditLog = createServerFn({ method: "GET" })
  .inputValidator((input: { workspaceId: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthContext;
    await assertMember(ctx, data.workspaceId);
    const { data: entries, error } = await ctx.supabase
      .from("audit_logs")
      .select("id, event_type, entity_type, entity_id, details, created_at, actor_id")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { entries: entries ?? [] };
  });

/* ---------- Trial submission (the signed-in person's own answers) ---------- */

const submissionColumns =
  "id, answer_found, answer_changed, answer_not_changed, answer_next_day, repo_url, commit_sha, submitted_at, updated_at";

export const getMySubmission = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as AuthContext;
    const { data, error } = await ctx.supabase
      .from("trial_submissions")
      .select(submissionColumns)
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { submission: data ?? null };
  });

export const saveMySubmission = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      answer_found: string;
      answer_changed: string;
      answer_not_changed: string;
      answer_next_day: string;
      repo_url?: string;
      commit_sha?: string;
      submit?: boolean;
    }) => input,
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthContext;
    const row = {
      user_id: ctx.userId,
      answer_found: data.answer_found,
      answer_changed: data.answer_changed,
      answer_not_changed: data.answer_not_changed,
      answer_next_day: data.answer_next_day,
      repo_url: data.repo_url ?? null,
      commit_sha: data.commit_sha ?? null,
      submitted_at: data.submit ? new Date().toISOString() : null,
    };
    const { error } = await ctx.supabase
      .from("trial_submissions")
      .upsert(row, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true, submitted: Boolean(data.submit) };
  });

