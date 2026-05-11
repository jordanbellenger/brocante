import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

export { isSupabaseConfigured };

const TABLE = "brocante_lists";
const ACTIVE_TEAM_KEY = "brocante.activeTeamId.v1";

export function getActiveTeamId() {
  try { return localStorage.getItem(ACTIVE_TEAM_KEY) || ""; } catch (e) { return ""; }
}

export function setActiveTeamId(teamId) {
  try {
    if (teamId) localStorage.setItem(ACTIVE_TEAM_KEY, teamId);
    else localStorage.removeItem(ACTIVE_TEAM_KEY);
  } catch (e) {}
}

export function getScopedListKey(key, teamId = getActiveTeamId()) {
  return teamId ? `${key}.${teamId}` : key;
}

export async function getSession() {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session || null;
}

export function onAuthChange(callback) {
  if (!isSupabaseConfigured) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  setActiveTeamId("");
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function ensureProfile(displayName) {
  if (!isSupabaseConfigured) return;
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) return;
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email,
    display_name: displayName || user.user_metadata?.display_name || user.email,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function fetchTeams() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("team_members")
    .select("role, teams(id, name, invite_code)")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({ ...row.teams, role: row.role })).filter(Boolean);
}

export async function createTeam(name) {
  const { data, error } = await supabase.rpc("create_team", { team_name: name });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function joinTeam(inviteCode) {
  const { data, error } = await supabase.rpc("join_team", { invite: inviteCode });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function loadRemoteList(key, teamId = getActiveTeamId()) {
  if (!isSupabaseConfigured || !teamId) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select("items")
    .eq("team_id", teamId)
    .eq("key", key)
    .maybeSingle();

  if (error) throw error;
  return Array.isArray(data?.items) ? data.items : null;
}

export async function saveRemoteList(key, items, teamId = getActiveTeamId()) {
  if (!isSupabaseConfigured || !teamId) return;
  const { error } = await supabase
    .from(TABLE)
    .upsert({
      team_id: teamId,
      key,
      items,
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;
}

export async function syncRemoteLists(keys, teamId = getActiveTeamId()) {
  if (!isSupabaseConfigured) return { configured: false, loaded: 0 };
  if (!teamId) return { configured: true, loaded: 0, missingTeam: true };

  let loaded = 0;
  for (const key of keys) {
    const items = await loadRemoteList(key, teamId);
    if (!items) continue;
    localStorage.setItem(getScopedListKey(key, teamId), JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("brocante:list-saved", { detail: { key, items } }));
    loaded += 1;
  }

  return { configured: true, loaded };
}
