export const publicEnv: PublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
};

function requireEnv(name: keyof PublicEnv): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const recommendedServerEnv = [
  "STRIPE_SECRET",
  "GOOGLE_CLIENT_ID",
  "APPLE_CLIENT_ID",
] as const;

