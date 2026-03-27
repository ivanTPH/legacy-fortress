import type { SupabaseClient, User } from "@supabase/supabase-js";
import { appendDevBankRequestTrace, mergeDevBankContextTrace } from "../devSmoke";

type AnySupabaseClient = SupabaseClient;

export function toSafeInternalPath(path: string | null | undefined, fallback: string) {
  if (!path) return fallback;
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//")) return fallback;
  return path;
}

export async function getActiveUser(client: AnySupabaseClient): Promise<User | null> {
  appendDevBankRequestTrace("[auth] getSession.start");
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) {
    appendDevBankRequestTrace(`[auth] getSession.error ${sessionError.message}`);
    mergeDevBankContextTrace({
      source: "auth.getActiveUser",
      stage: "auth.session-error",
      sessionPresent: false,
      userId: null,
      error: sessionError.message,
    });
    return null;
  }
  if (sessionData.session?.user) {
    const user = sessionData.session.user;
    appendDevBankRequestTrace(`[auth] getSession.success user=${user.id}`);
    mergeDevBankContextTrace({
      source: "auth.getActiveUser",
      stage: "auth.session-present",
      sessionPresent: true,
      userId: user.id,
      error: null,
    });
    return user;
  }

  appendDevBankRequestTrace("[auth] getSession.empty");
  mergeDevBankContextTrace({
    source: "auth.getActiveUser",
    stage: "auth.session-empty",
    sessionPresent: false,
    userId: null,
    error: null,
  });

  appendDevBankRequestTrace("[auth] getUser.start");
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) {
    appendDevBankRequestTrace(`[auth] getUser.error ${userError.message}`);
    mergeDevBankContextTrace({
      source: "auth.getActiveUser",
      stage: "auth.user-error",
      sessionPresent: false,
      userId: null,
      error: userError.message,
    });
    return null;
  }
  appendDevBankRequestTrace(`[auth] getUser.success user=${userData.user?.id ?? "<null>"}`);
  mergeDevBankContextTrace({
    source: "auth.getActiveUser",
    stage: userData.user ? "auth.user-present" : "auth.user-empty",
    sessionPresent: Boolean(userData.user),
    userId: userData.user?.id ?? null,
    error: null,
  });
  return userData.user;
}

export async function waitForActiveUser(
  client: AnySupabaseClient,
  options?: { attempts?: number; delayMs?: number },
): Promise<User | null> {
  const attempts = options?.attempts ?? 5;
  const delayMs = options?.delayMs ?? 150;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    appendDevBankRequestTrace(`[auth] waitForActiveUser.attempt ${attempt + 1}/${attempts}`);
    mergeDevBankContextTrace({
      source: "auth.waitForActiveUser",
      stage: `auth.waiting-${attempt + 1}`,
    });
    const user = await getActiveUser(client);
    if (user) {
      mergeDevBankContextTrace({
        source: "auth.waitForActiveUser",
        stage: "auth.user-resolved",
        sessionPresent: true,
        userId: user.id,
        error: null,
      });
      return user;
    }
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  appendDevBankRequestTrace("[auth] waitForActiveUser.failed");
  mergeDevBankContextTrace({
    source: "auth.waitForActiveUser",
    stage: "auth.user-missing",
    sessionPresent: false,
    userId: null,
    error: "No active signed-in user resolved.",
  });
  return null;
}
