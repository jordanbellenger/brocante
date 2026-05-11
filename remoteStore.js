import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

export { isSupabaseConfigured };

const TABLE = "brocante_lists";

export async function loadRemoteList(key) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select("items")
    .eq("key", key)
    .maybeSingle();

  if (error) throw error;
  return Array.isArray(data?.items) ? data.items : null;
}

export async function saveRemoteList(key, items) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from(TABLE)
    .upsert({
      key,
      items,
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;
}

export async function syncRemoteLists(keys) {
  if (!isSupabaseConfigured) return { configured: false, loaded: 0 };

  let loaded = 0;
  for (const key of keys) {
    const items = await loadRemoteList(key);
    if (!items) continue;
    localStorage.setItem(key, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("brocante:list-saved", { detail: { key, items } }));
    loaded += 1;
  }

  return { configured: true, loaded };
}
