import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "./env";
import { appendDevBankRequestTrace, isDevBankTraceEnabled } from "./devSmoke";

const supabaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const baseSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});

type AnyRecord = Record<string, unknown>;
type InstrumentedBuilder = AnyRecord & { __lfAssetsBuilderInstrumented?: boolean };

function isAssetsTable(table: string) {
  return table.trim().toLowerCase() === "assets";
}

function normalizePotentialColumnName(value: string) {
  return value.trim().toLowerCase().replace(/[-\s]+/g, "_");
}

function findHyphenatedAssetIdentifiers(input: string) {
  return Array.from(new Set((input.match(/\b[a-z0-9]+-[a-z0-9_-]+\b/gi) ?? []).filter(Boolean)));
}

function sanitizePayloadKeys(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  if (Array.isArray(payload)) return payload.map((item): unknown => sanitizePayloadKeys(item));

  const entries: Array<readonly [string, unknown]> = Object.entries(payload as AnyRecord).map(([key, value]) => {
    const normalizedKey = normalizePotentialColumnName(key);
    return [normalizedKey, sanitizePayloadKeys(value)] as const;
  });
  return Object.fromEntries(entries);
}

function getCallerStack() {
  const stack = new Error().stack ?? "";
  return stack
    .split("\n")
    .slice(3, 9)
    .map((line) => line.trim())
    .join(" | ");
}

function summarizeTraceValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "function") return `[function:${value.name || "anonymous"}]`;
  if (Array.isArray(value)) return `[array:length=${value.length}]`;
  if (value instanceof Date) return `[date:${value.toISOString()}]`;
  if (value instanceof Error) return `[error:${value.name}:${value.message}]`;

  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    const isPlainObject = proto === Object.prototype || proto === null;
    if (isPlainObject) {
      try {
        return `[object keys=${Object.keys(value as AnyRecord).join(",")}]`;
      } catch {
        return "[object]";
      }
    }

    const ctorName =
      typeof (value as { constructor?: { name?: string } }).constructor?.name === "string"
        ? (value as { constructor: { name: string } }).constructor.name
        : "object";
    return `[${ctorName}]`;
  }

  return String(value);
}

function guardAssetsIdentifier(method: string, identifier: string, table: string) {
  const badIdentifiers = findHyphenatedAssetIdentifiers(identifier);
  if (!badIdentifiers.length) return identifier;

  const normalized = badIdentifiers.reduce(
    (next, item) => next.replaceAll(item, normalizePotentialColumnName(item)),
    identifier,
  );
  const stack = getCallerStack();
  const message = `[assets-request-guard] ${method} on ${table} received hyphenated identifier(s): ${badIdentifiers.join(", ")} -> ${normalized}`;
  appendDevBankRequestTrace(`${message} | stack=${stack}`);
  console.error(message, { table, method, identifier, normalized, stack });
  if (process.env.NODE_ENV === "development") {
    throw new Error(`${message} | stack=${stack}`);
  }
  return normalized;
}

function instrumentAssetsBuilder<T extends object>(table: string, builder: T): T {
  if (!isAssetsTable(table)) return builder;

  const target = builder as InstrumentedBuilder;
  if (target.__lfAssetsBuilderInstrumented) return builder;
  target.__lfAssetsBuilderInstrumented = true;
  const methodNames = ["select", "insert", "update", "upsert", "eq", "in", "order", "filter", "or", "is"] as const;

  for (const methodName of methodNames) {
    const original = target[methodName];
    if (typeof original !== "function") continue;

    target[methodName] = (...args: unknown[]) => {
      const stack = getCallerStack();
      let nextArgs = args;

      if (methodName === "select" && typeof args[0] === "string") {
        const guarded = guardAssetsIdentifier("select", args[0], table);
        nextArgs = [guarded, ...args.slice(1)];
      }

      if ((methodName === "eq" || methodName === "in" || methodName === "order" || methodName === "is") && typeof args[0] === "string") {
        const guarded = guardAssetsIdentifier(methodName, args[0], table);
        nextArgs = [guarded, ...args.slice(1)];
      }

      if (methodName === "filter" && typeof args[0] === "string") {
        const guarded = guardAssetsIdentifier(methodName, args[0], table);
        nextArgs = [guarded, ...args.slice(1)];
      }

      if ((methodName === "insert" || methodName === "update" || methodName === "upsert") && args[0]) {
        const sanitized = sanitizePayloadKeys(args[0]);
        appendDevBankRequestTrace(`[assets.${methodName}] payload_keys=${Object.keys((Array.isArray(sanitized) ? sanitized[0] : sanitized) ?? {}).join(",")} stack=${stack}`);
        nextArgs = [sanitized, ...args.slice(1)];
      } else {
        appendDevBankRequestTrace(`[assets.${methodName}] args=${nextArgs.map((arg) => summarizeTraceValue(arg)).join(" | ")} stack=${stack}`);
      }

      const result = original.apply(target, nextArgs);
      if (result && typeof result === "object") {
        instrumentAssetsBuilder(table, result as object);
      }
      return result;
    };
  }

  return builder;
}

function createInstrumentedSupabaseClient() {
  if (process.env.NODE_ENV !== "development") return baseSupabase;

  return new Proxy(baseSupabase, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (table: string) => {
          appendDevBankRequestTrace(`[supabase.from] table=${table}`);
          const builder = target.from(table);
          return isDevBankTraceEnabled() ? instrumentAssetsBuilder(table, builder as object) : builder;
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export const supabase = createInstrumentedSupabaseClient();
