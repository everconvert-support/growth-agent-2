/**
 * PagePilot — a simulated page-editing service. No network calls.
 *
 * It keeps a token registry, supports a `change_cta` action, and exposes a
 * readable page state (persisted on the integration row) so a later read can
 * observe what an execution applied.
 */

export type ChangeCtaInput = {
  page_url: string;
  existing_cta: string;
  new_cta: string;
};

export type PagePilotResponse = {
  ok: boolean;
  provider: "pagepilot";
  request_id: string;
  page_url: string;
  applied_cta: string;
  simulated_at: string;
};

export type PageState = Record<string, { current_cta: string; updated_at: string }>;

/** What the fake external service thinks of a token. */
export type TokenState = "valid" | "expired" | "revoked";

export type TokenCheck = {
  valid: boolean;
  /** "missing" means our side has no token at all. */
  state: TokenState | "missing";
  checked_at: string;
  reason: string;
};

type TokenRow = { token: string; state: TokenState; expires_at: string | null };

type ServiceDb = { from: (table: string) => any };

function requestId(idempotencyKey: string) {
  let hash = 0;
  for (const char of idempotencyKey) hash = (hash * 31 + char.charCodeAt(0)) % 0xffffffff;
  return `pp_req_${hash.toString(16).padStart(8, "0")}`;
}

export function parseChangeCtaInput(raw: unknown): ChangeCtaInput {
  const input = (raw ?? {}) as Partial<ChangeCtaInput>;
  if (!input.page_url || !input.existing_cta || !input.new_cta) {
    throw new Error("Invalid change_cta input: page_url, existing_cta and new_cta are required");
  }
  return { page_url: input.page_url, existing_cta: input.existing_cta, new_cta: input.new_cta };
}

/** Pure decision: given the service's record of a token, is it usable right now? */
export function evaluateToken(row: TokenRow | null, now = new Date()): TokenCheck {
  const checked_at = now.toISOString();
  if (!row) {
    return {
      valid: false,
      state: "missing",
      checked_at,
      reason: "PagePilot does not recognise this token",
    };
  }
  if (row.state === "revoked") {
    return { valid: false, state: "revoked", checked_at, reason: "Token was revoked by PagePilot" };
  }
  const lapsed = row.expires_at ? new Date(row.expires_at).getTime() <= now.getTime() : false;
  if (row.state === "expired" || lapsed) {
    return { valid: false, state: "expired", checked_at, reason: "Token has expired" };
  }
  return { valid: true, state: "valid", checked_at, reason: "Token is valid" };
}

/**
 * Simulated remote call: ask PagePilot whether a token is actually valid.
 * The answer comes from the service's own token registry, never from our
 * `integrations.status` column.
 */
export async function pagePilotValidateToken(
  db: ServiceDb,
  token: string | null,
): Promise<TokenCheck> {
  if (!token) return evaluateToken(null);
  const { data } = await db
    .from("pagepilot_service_tokens")
    .select("token, state, expires_at")
    .eq("token", token)
    .maybeSingle();
  return evaluateToken((data as TokenRow | null) ?? null);
}

/** Simulated remote call: PagePilot issues a fresh token in the requested state. */
export async function pagePilotIssueToken(
  db: ServiceDb,
  state: TokenState = "valid",
): Promise<string> {
  const token = `pp_fake_${Math.random().toString(16).slice(2, 10)}`;
  const expiresAt =
    state === "expired"
      ? new Date(Date.now() - 86_400_000).toISOString()
      : new Date(Date.now() + 30 * 86_400_000).toISOString();
  await db
    .from("pagepilot_service_tokens")
    .insert({ token, state, expires_at: expiresAt });
  return token;
}

/** Simulated remote administration: change the state of an existing token. */
export async function pagePilotSetTokenState(
  db: ServiceDb,
  token: string,
  state: TokenState,
): Promise<void> {
  const expiresAt =
    state === "expired"
      ? new Date(Date.now() - 86_400_000).toISOString()
      : new Date(Date.now() + 30 * 86_400_000).toISOString();
  await db
    .from("pagepilot_service_tokens")
    .update({ state, expires_at: expiresAt })
    .eq("token", token);
}

/** Simulates PagePilot applying a CTA change. Returns the response + new page state. */
export function pagePilotChangeCta(args: {
  tokenCheck: TokenCheck;
  input: ChangeCtaInput;
  idempotencyKey: string;
  pageState: PageState;
}): { response: PagePilotResponse; pageState: PageState } {
  if (!args.tokenCheck.valid) {
    throw new Error(`PagePilot rejected the request: ${args.tokenCheck.reason}`);
  }
  const simulatedAt = new Date().toISOString();
  const pageState: PageState = {
    ...args.pageState,
    [args.input.page_url]: { current_cta: args.input.new_cta, updated_at: simulatedAt },
  };
  return {
    response: {
      ok: true,
      provider: "pagepilot",
      request_id: requestId(args.idempotencyKey),
      page_url: args.input.page_url,
      applied_cta: args.input.new_cta,
      simulated_at: simulatedAt,
    },
    pageState,
  };
}

/** Simulates reading the live page back from PagePilot (verification step). */
export function pagePilotReadPage(pageState: PageState, pageUrl: string) {
  return pageState[pageUrl] ?? null;
}
