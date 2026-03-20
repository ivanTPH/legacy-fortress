export type DevSmokeVariant = "empty" | "fixture";

type SearchParamsLike = {
  get: (key: string) => string | null;
} | null | undefined;

export function isDevSmokeModeEnabled(searchParams: SearchParamsLike) {
  if (process.env.NODE_ENV !== "development") return false;
  return searchParams?.get("lf_dev_smoke") === "1";
}

export function getDevSmokeVariant(searchParams: SearchParamsLike): DevSmokeVariant {
  const variant = searchParams?.get("lf_dev_variant");
  return variant === "fixture" ? "fixture" : "empty";
}
