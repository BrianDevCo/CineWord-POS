import { createClient, SupabaseClient } from "@supabase/supabase-js";

export function supabaseReady() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return url.length > 0 && !url.includes("TU_") && url.startsWith("http");
}

// Usar globalThis para evitar múltiples instancias con hot-reload
const g = globalThis as unknown as {
  _cwPosClient?: SupabaseClient;
  _cwPosAdmin?: SupabaseClient;
};

function buildClient(): SupabaseClient | null {
  if (!supabaseReady()) return null;
  if (!g._cwPosClient) {
    g._cwPosClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { realtime: { params: { eventsPerSecond: 10 } } }
    );
  }
  return g._cwPosClient;
}

function buildAdmin(): SupabaseClient | null {
  if (!supabaseReady()) return null;
  const key = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
           ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return buildClient(); // fallback al anon si no hay service key
  if (!g._cwPosAdmin) {
    g._cwPosAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      key,
      { auth: { persistSession: false, autoRefreshToken: false, storageKey: "cw-pos-admin" } }
    );
  }
  return g._cwPosAdmin;
}

// Para suscripciones realtime — devuelve el cliente directo
export function getSupabaseClient() { return buildClient(); }
export function getSupabaseAdmin() { return buildAdmin(); }

const noop = () => Promise.resolve({ data: null, error: new Error("Supabase no configurado") });

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = buildClient();
    if (!client) return noop;
    return (client as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = buildAdmin();
    if (!client) return noop;
    return (client as unknown as Record<string | symbol, unknown>)[prop];
  },
});
