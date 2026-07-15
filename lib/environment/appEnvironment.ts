const UAT_ENVIRONMENT_VALUES = new Set([
  "uat",
  "local_uat",
  "local-uat",
  "test",
  "testing",
  "staging",
  "preview",
]);

function normalizeEnvironmentValue(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function getApplicationEnvironment() {
  return (
    normalizeEnvironmentValue(process.env.APP_ENV)
    || normalizeEnvironmentValue(process.env.LEGACY_FORTRESS_ENV)
    || normalizeEnvironmentValue(process.env.VERCEL_ENV)
    || normalizeEnvironmentValue(process.env.NODE_ENV)
    || "development"
  );
}

export function isUatEnvironment() {
  return UAT_ENVIRONMENT_VALUES.has(getApplicationEnvironment());
}

export function getRobotsPolicy() {
  if (isUatEnvironment()) {
    return {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
      },
    } as const;
  }

  return undefined;
}
