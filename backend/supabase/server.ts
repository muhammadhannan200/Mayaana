import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createBaseClient } from "@supabase/supabase-js";

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

// For credential checks that must not touch the signed-in session cookies.
export function createStatelessClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase public configuration is missing");
  return createBaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createClient(options?: {
  deferCookieWrite: (commit: () => void) => void;
}) {
  // Supabase initializes session timers eagerly. Keep that work out of PPR.
  await connection();
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) throw new Error("Supabase public configuration is missing");

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        const commit = () => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        };
        if (options?.deferCookieWrite) {
          options.deferCookieWrite(commit);
          return;
        }
        try {
          commit();
        } catch {
          // A Server Component cannot write cookies; the proxy refreshes them.
        }
      },
    },
  });
}
