import { createClient } from "@supabase/supabase-js";

export const isServerAuthConfigured = Boolean(
  process.env.VITE_SUPABASE_URL &&
  (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY)
);

export async function requireAuthenticatedUser(authHeader) {
  if (!isServerAuthConfigured) return null;

  const token = String(authHeader || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    const authError = new Error("Invalid authentication");
    authError.statusCode = 401;
    throw authError;
  }

  return data.user;
}
