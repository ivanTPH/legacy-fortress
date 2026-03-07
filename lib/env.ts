export const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
};

export const recommendedServerEnv = [
  "STRIPE_SECRET",
  "GOOGLE_CLIENT_ID",
  "APPLE_CLIENT_ID",
] as const;