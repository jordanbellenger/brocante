/* === Brocante — App shell === */

import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { EstimatePage } from "./estimate.jsx";
import { InventoryPage } from "./inventory.jsx";
import { RegisterPage } from "./register.jsx";
import { Icon, STORAGE_KEYS, loadList, saveList } from "./shared.jsx";
import {
  createTeam,
  ensureProfile,
  fetchTeams,
  getActiveTeamId,
  getSession,
  isSupabaseConfigured,
  joinTeam,
  onAuthChange,
  setActiveTeamId as persistActiveTeamId,
  signIn,
  signOut,
  syncRemoteLists,
} from "./remoteStore.js";

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "forest",
  "density": "airy",
  "numStyle": "display"
}/*EDITMODE-END*/;
const SETTINGS_KEY = "brocante.settings.v2";

function App() {
  const [tab, setTab] = React.useState(() => {
    try { return localStorage.getItem("brocante.tab") || "estimate"; } catch (e) { return "estimate"; }
  });
  const [toast, setToast] = React.useState(null);
  const [tweaks, setTweaks] = React.useState(() => {
    try {
      return { ...TWEAK_DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
    } catch (e) {
      return TWEAK_DEFAULTS;
    }
  });
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [inventory, setInventoryState] = React.useState(() => loadList(STORAGE_KEYS.inventory));
  const [syncState, setSyncState] = React.useState(() => isSupabaseConfigured ? "team" : "local");
  const [session, setSession] = React.useState(null);
  const [authReady, setAuthReady] = React.useState(!isSupabaseConfigured);
  const [teams, setTeams] = React.useState([]);
  const [activeTeamId, setActiveTeamIdState] = React.useState(() => getActiveTeamId());
  const [teamPanelOpen, setTeamPanelOpen] = React.useState(false);
  const [prefillSale, setPrefillSale] = React.useState(null);

  const updateInventory = (next) => {
    setInventoryState(next);
    saveList(STORAGE_KEYS.inventory, next);
  };

  React.useEffect(() => {
    const root = document.getElementById("app");
    if (!root) return;
    root.setAttribute("data-theme", tweaks.theme || "cream");
    root.setAttribute("data-density", tweaks.density || "comfortable");
    root.setAttribute("data-numstyle", tweaks.numStyle || "mono");
  }, [tweaks.theme, tweaks.density, tweaks.numStyle]);

  React.useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(tweaks)); } catch (e) {}
  }, [tweaks]);

  React.useEffect(() => {
    try { localStorage.setItem("brocante.tab", tab); } catch (e) {}
  }, [tab]);

  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    let mounted = true;
    getSession()
      .then((nextSession) => {
        if (!mounted) return;
        setSession(nextSession);
        setAuthReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setSyncState("error");
        setAuthReady(true);
      });
    const unsubscribe = onAuthChange((nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setTeams([]);
        setActiveTeamId("");
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    const onListSaved = (event) => {
      if (event.detail?.key === STORAGE_KEYS.inventory) {
        setInventoryState(Array.isArray(event.detail.items) ? event.detail.items : loadList(STORAGE_KEYS.inventory));
      }
    };
    window.addEventListener("brocante:list-saved", onListSaved);
    return () => window.removeEventListener("brocante:list-saved", onListSaved);
  }, []);

  React.useEffect(() => {
    if (!isSupabaseConfigured || !session) return;
    ensureProfile(session.user?.email).catch(() => setSyncState("error"));
    fetchTeams()
      .then((nextTeams) => {
        setTeams(nextTeams);
        const storedTeamId = getActiveTeamId();
        const nextActive = nextTeams.some((team) => team.id === storedTeamId)
          ? storedTeamId
          : nextTeams[0]?.id || "";
        setActiveTeamId(nextActive);
      })
      .catch(() => setSyncState("error"));
  }, [session]);

  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (!session) {
      setSyncState("auth");
      return;
    }
    if (!activeTeamId) {
      setSyncState("team");
      return;
    }
    let cancelled = false;
    setSyncState("syncing");
    syncRemoteLists(Object.values(STORAGE_KEYS), activeTeamId)
      .then(({ loaded }) => {
        if (cancelled) return;
        setInventoryState(loadList(STORAGE_KEYS.inventory));
        setSyncState("online");
        if (loaded > 0) showToast("Données synchronisées");
      })
      .catch(() => {
        if (!cancelled) setSyncState("error");
      });
    return () => { cancelled = true; };
  }, [session, activeTeamId]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const setActiveTeamId = (teamId) => {
    setActiveTeamIdState(teamId);
    persistActiveTeamId(teamId);
    setInventoryState(loadList(STORAGE_KEYS.inventory));
  };

  const refreshTeams = async (teamIdToSelect) => {
    const nextTeams = await fetchTeams();
    setTeams(nextTeams);
    const nextActive = teamIdToSelect || activeTeamId || nextTeams[0]?.id || "";
    if (nextActive) setActiveTeamId(nextActive);
    return nextTeams;
  };

  const normalizeItemName = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const addToInventory = (data) => {
    const normalizedName = normalizeItemName(data.name || "Objet");
    const alreadyExists = inventory.some((item) =>
      item.status !== "sold" && normalizeItemName(item.name) === normalizedName
    );
    if (alreadyExists) {
      showToast("Déjà dans l'inventaire");
      return false;
    }

    const item = {
      id: Date.now(),
      ts: Date.now(),
      name: data.name || "Objet",
      priceCents: data.priceCents || 0,
      minPriceCents: data.minPriceCents || data.priceCents || 0,
      photo: data.photo || null,
      notes: data.notes || "",
      status: "available",
    };
    updateInventory([item, ...inventory]);
    return true;
  };

  const sellFromInventory = (item) => {
    setPrefillSale(item);
    setTab("register");
  };

  const markItemSold = (itemId, sale) => {
    const next = inventory.map(i =>
      i.id === itemId
        ? { ...i, status: "sold", soldAt: sale.ts, soldPriceCents: sale.priceCents, saleId: sale.id }
        : i
    );
    updateInventory(next);
  };

  const screenLabel = tab === "estimate" ? "01 Estimer" : tab === "inventory" ? "02 Inventaire" : "03 Caisse";
  const activeTeam = teams.find((team) => team.id === activeTeamId);

  if (!authReady) return <div className="auth-screen"><div className="spinner" /></div>;

  if (isSupabaseConfigured && !session) {
    return <AuthScreen onToast={showToast} onSignedIn={(nextSession) => setSession(nextSession)} />;
  }

  if (isSupabaseConfigured && session && !activeTeamId) {
    return (
      <TeamScreen
        onToast={showToast}
        onCreate={async (name) => {
          const team = await createTeam(name);
          await refreshTeams(team.id);
        }}
        onJoin={async (code) => {
          const team = await joinTeam(code);
          await refreshTeams(team.id);
        }}
        onSignOut={async () => { await signOut(); setSession(null); }}
      />
    );
  }

  return (
    <>
      <div data-screen-label={screenLabel} style={{ display: "contents" }}>
        {tab === "estimate" && (
          <EstimatePage
            inventory={inventory}
            onToast={showToast}
            onAddToInventory={addToInventory}
          />
        )}
        {tab === "inventory" && (
          <InventoryPage
            inventory={inventory}
            onUpdate={updateInventory}
            onSell={sellFromInventory}
            onToast={showToast}
          />
        )}
        {tab === "register" && (
          <RegisterPage
            onToast={showToast}
            prefill={prefillSale}
            onPrefillConsumed={() => setPrefillSale(null)}
            onItemSold={markItemSold}
          />
        )}
      </div>

      <nav className="tabbar tabbar-3" role="tablist">
        <button className="tab" aria-current={tab === "estimate"} onClick={() => setTab("estimate")}>
          <Icon.Sparkles />
          Estimer
        </button>
        <button className="tab" aria-current={tab === "inventory"} onClick={() => setTab("inventory")}>
          <Icon.Box />
          Inventaire
        </button>
        <button className="tab" aria-current={tab === "register"} onClick={() => setTab("register")}>
          <Icon.Cash />
          Caisse
        </button>
      </nav>

      {toast && <div className="toast">{toast}</div>}

      <div className={`sync-badge sync-${syncState}`} title={getSyncLabel(syncState)} aria-label={getSyncLabel(syncState)}>
        <span className="sync-dot" />
      </div>

      <button className="team-fab" onClick={() => setTeamPanelOpen(true)} aria-label="Équipe">
        {activeTeam?.name?.slice(0, 2).toUpperCase() || "EQ"}
      </button>

      <button className="settings-fab" onClick={() => setSettingsOpen(true)} aria-label="Réglages">
        <Icon.Edit />
      </button>

      {settingsOpen && (
        <SettingsOverlay
          tweaks={tweaks}
          onChange={(edits) => setTweaks((cur) => ({ ...cur, ...edits }))}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {teamPanelOpen && (
        <TeamOverlay
          teams={teams}
          activeTeamId={activeTeamId}
          onSelect={setActiveTeamId}
          onCreate={async (name) => {
            const team = await createTeam(name);
            await refreshTeams(team.id);
            showToast("Équipe créée");
          }}
          onJoin={async (code) => {
            const team = await joinTeam(code);
            await refreshTeams(team.id);
            showToast("Équipe rejointe");
          }}
          onSignOut={async () => {
            await signOut();
            setSession(null);
            setTeamPanelOpen(false);
          }}
          onClose={() => setTeamPanelOpen(false)}
        />
      )}
    </>
  );
}

function getSyncLabel(syncState) {
  if (syncState === "online") return "Base de données synchronisée";
  if (syncState === "syncing") return "Synchronisation base en cours";
  if (syncState === "auth") return "Connexion requise";
  if (syncState === "team") return "Équipe requise";
  if (syncState === "error") return "Erreur de synchronisation base";
  return "Synchronisation base désactivée";
}

function AuthScreen({ onToast, onSignedIn }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setLoading(true);
    try {
      const nextSession = await signIn(email, password);
      onSignedIn(nextSession);
      onToast("Connecté");
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
      onToast("Action impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <h1>Brocante</h1>
        <p className="muted">Connecte-toi pour partager un inventaire par équipe.</p>
        {errorMessage && (
          <div className="form-error mt-4" role="alert">
            {errorMessage}
          </div>
        )}
        <div className="mt-4">
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@example.com" required />
        </div>
        <div className="mt-3">
          <label className="label">Mot de passe</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 6 caractères" required />
        </div>
        <button className="btn btn-primary btn-block btn-xl mt-4" disabled={loading}>
          {loading ? <><div className="spinner" /> Patiente…</> : "Se connecter"}
        </button>
      </form>
    </div>
  );
}

function getAuthErrorMessage(error) {
  const message = String(error?.message || "");
  if (/invalid login credentials/i.test(message)) return "Email ou mot de passe incorrect.";
  if (/email not confirmed/i.test(message)) return "Confirme ton email avant de te connecter.";
  if (/user already registered|already registered/i.test(message)) return "Un compte existe déjà avec cet email.";
  if (/password/i.test(message)) return "Le mot de passe doit contenir au moins 6 caractères.";
  return message || "Connexion impossible. Réessaie dans un instant.";
}

function TeamScreen({ onToast, onCreate, onJoin, onSignOut }) {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>Équipe</h1>
        <p className="muted">Crée une équipe ou rejoins un inventaire partagé.</p>
        <TeamActions onToast={onToast} onCreate={onCreate} onJoin={onJoin} />
        <button className="btn btn-ghost btn-block mt-4" onClick={onSignOut}>Se déconnecter</button>
      </div>
    </div>
  );
}

function TeamOverlay({ teams, activeTeamId, onSelect, onCreate, onJoin, onSignOut, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay-card" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "88vh", overflowY: "auto" }}>
        <div className="hstack" style={{ justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Équipe</h2>
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Fermer"><Icon.Close /></button>
        </div>
        <div className="section">
          {teams.map((team) => (
            <button
              key={team.id}
              className="team-row"
              aria-current={team.id === activeTeamId}
              onClick={() => onSelect(team.id)}
            >
              <span>
                <strong>{team.name}</strong>
                <small>Code {team.invite_code}</small>
              </span>
              {team.id === activeTeamId && <Icon.Check />}
            </button>
          ))}
        </div>
        <TeamActions onCreate={onCreate} onJoin={onJoin} />
        <button className="btn btn-danger btn-block mt-4" onClick={onSignOut}>Se déconnecter</button>
      </div>
    </div>
  );
}

function TeamActions({ onToast, onCreate, onJoin }) {
  const [teamName, setTeamName] = React.useState("");
  const [inviteCode, setInviteCode] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const run = async (fn) => {
    setErrorMessage("");
    setLoading(true);
    try {
      await fn();
      setTeamName("");
      setInviteCode("");
    } catch (error) {
      setErrorMessage(getTeamErrorMessage(error));
      onToast && onToast("Action impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {errorMessage && (
        <div className="form-error mt-4" role="alert">
          {errorMessage}
        </div>
      )}
      <div className="section">
        <label className="label">Créer une équipe</label>
        <input className="input" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="ex : Brocante famille" />
        <button className="btn btn-primary btn-block mt-3" disabled={loading || !teamName.trim()} onClick={() => run(() => onCreate(teamName.trim()))}>
          <Icon.Plus /> Créer
        </button>
      </div>
      <div className="section">
        <label className="label">Rejoindre avec un code</label>
        <input className="input" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} placeholder="CODE ÉQUIPE" />
        <button className="btn btn-ghost btn-block mt-3" disabled={loading || !inviteCode.trim()} onClick={() => run(() => onJoin(inviteCode.trim()))}>
          Rejoindre
        </button>
      </div>
    </>
  );
}

function getTeamErrorMessage(error) {
  const message = String(error?.message || "");
  if (/not authenticated/i.test(message)) return "Reconnecte-toi avant de créer une équipe.";
  if (/invalid invite code/i.test(message)) return "Code équipe invalide.";
  if (/permission denied|row-level security|violates row-level security/i.test(message)) {
    return "Accès refusé par Supabase. Réexécute le fichier supabase/schema.sql.";
  }
  if (/function .* does not exist|could not find the function/i.test(message)) {
    return "Fonction Supabase manquante. Réexécute le fichier supabase/schema.sql.";
  }
  return message || "Action équipe impossible.";
}

function SettingsOverlay({ tweaks, onChange, onClose }) {
  const themes = [
    { value: "cream", label: "Crème" },
    { value: "forest", label: "Forêt" },
    { value: "register", label: "Sombre" },
  ];
  const densities = [
    { value: "compact", label: "Compact" },
    { value: "comfortable", label: "Normal" },
    { value: "airy", label: "Aéré" },
  ];
  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
        <div className="hstack" style={{ justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Réglages</h2>
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Fermer">
            <Icon.Close />
          </button>
        </div>

        <div className="section">
          <div className="label">Palette</div>
          <div className="segmented">
            {themes.map((theme) => (
              <button key={theme.value} className="segment" aria-current={tweaks.theme === theme.value} onClick={() => onChange({ theme: theme.value })}>
                {theme.label}
              </button>
            ))}
          </div>
        </div>

        <div className="section">
          <div className="label">Densité</div>
          <div className="segmented">
            {densities.map((density) => (
              <button key={density.value} className="segment" aria-current={tweaks.density === density.value} onClick={() => onChange({ density: density.value })}>
                {density.label}
              </button>
            ))}
          </div>
        </div>

        <div className="section">
          <div className="label">Chiffres</div>
          <div className="segmented">
            <button className="segment" aria-current={tweaks.numStyle === "mono"} onClick={() => onChange({ numStyle: "mono" })}>Mono</button>
            <button className="segment" aria-current={tweaks.numStyle === "display"} onClick={() => onChange({ numStyle: "display" })}>Display</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const rootEl = document.getElementById("app");
if (rootEl) createRoot(rootEl).render(<App />);

if (typeof window !== "undefined") window.App = App;
