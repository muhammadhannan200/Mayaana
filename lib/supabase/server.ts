import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
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
