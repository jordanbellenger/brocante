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
  const [inventory, setInventoryState] = React.useState(() => loadList(STORAGE_KEYS.inventory));
  const [syncState, setSyncState] = React.useState(() => isSupabaseConfigured ? "team" : "local");
  const [session, setSession] = React.useState(null);
  const [authReady, setAuthReady] = React.useState(!isSupabaseConfigured);
  const [teams, setTeams] = React.useState([]);
  const [activeTeamId, setActiveTeamIdState] = React.useState(() => getActiveTeamId());
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

  const screenLabel = tab === "estimate" ? "01 Estimer" : tab === "inventory" ? "02 Inventaire" : tab === "register" ? "03 Caisse" : "04 Plus";
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
        {tab === "more" && (
          <MorePage
            teams={teams}
            activeTeamId={activeTeamId}
            activeTeam={activeTeam}
            tweaks={tweaks}
            onTweakChange={(edits) => setTweaks((cur) => ({ ...cur, ...edits }))}
            onSelectTeam={setActiveTeamId}
            onToast={showToast}
            onCreateTeam={async (name) => {
              const team = await createTeam(name);
              await refreshTeams(team.id);
              showToast("Équipe créée");
            }}
            onJoinTeam={async (code) => {
              const team = await joinTeam(code);
              await refreshTeams(team.id);
              showToast("Équipe rejointe");
            }}
            onSignOut={async () => {
              await signOut();
              setSession(null);
            }}
          />
        )}
      </div>

      <nav className="tabbar tabbar-4" role="tablist">
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
        <button className="tab" aria-current={tab === "more"} onClick={() => setTab("more")}>
          <Icon.Edit />
          Plus
        </button>
      </nav>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
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

function MorePage({ teams, activeTeamId, activeTeam, tweaks, onTweakChange, onSelectTeam, onToast, onCreateTeam, onJoinTeam, onSignOut }) {
  return (
    <>
      <div className="app-header">
        <h1>Plus</h1>
        <span className="pill">{activeTeam?.name || "Équipe"}</span>
      </div>
      <div className="page">
        <div className="section">
          <div className="section-title">Équipe</div>
          {teams.map((team) => (
            <button
              key={team.id}
              className="team-row"
              aria-current={team.id === activeTeamId}
              onClick={() => onSelectTeam(team.id)}
            >
              <span>
                <strong>{team.name}</strong>
                <small>Code {team.invite_code}</small>
              </span>
              {team.id === activeTeamId && <Icon.Check />}
            </button>
          ))}
        </div>
        {activeTeam && (
          <InviteCard
            team={activeTeam}
            onToast={onToast}
          />
        )}
        <TeamActions onToast={onToast} onCreate={onCreateTeam} onJoin={onJoinTeam} />
        <div className="section">
          <div className="section-title">Réglages</div>
          <SettingsContent tweaks={tweaks} onChange={onTweakChange} />
        </div>
        <button className="btn btn-danger btn-block mt-4" onClick={onSignOut}>Se déconnecter</button>
      </div>
    </>
  );
}

function InviteCard({ team, onToast }) {
  const inviteText = `Rejoins mon équipe Brocante "${team.name}" avec le code : ${team.invite_code}`;

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(team.invite_code);
      onToast && onToast("Code copié");
    } catch (error) {
      onToast && onToast(`Code équipe : ${team.invite_code}`);
    }
  };

  const shareInvite = async () => {
    if (!navigator.share) {
      await copyInvite();
      return;
    }
    try {
      await navigator.share({
        title: "Invitation Brocante",
        text: inviteText,
        url: window.location.origin,
      });
    } catch (error) {}
  };

  return (
    <div className="invite-card section">
      <div>
        <div className="label">Inviter quelqu'un</div>
        <div className="invite-code">{team.invite_code}</div>
        <p className="muted">Partage ce code. La personne pourra rejoindre ton inventaire depuis l'écran Équipe.</p>
      </div>
      <div className="hstack" style={{ gap: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={copyInvite} style={{ flex: 1 }}>
          Copier
        </button>
        <button className="btn btn-primary btn-sm" onClick={shareInvite} style={{ flex: 1 }}>
          Partager
        </button>
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

function SettingsContent({ tweaks, onChange }) {
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
    <>
      <div className="mt-3">
        <div className="label">Palette</div>
        <div className="segmented">
          {themes.map((theme) => (
            <button key={theme.value} className="segment" aria-current={tweaks.theme === theme.value} onClick={() => onChange({ theme: theme.value })}>
              {theme.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="label">Densité</div>
        <div className="segmented">
          {densities.map((density) => (
            <button key={density.value} className="segment" aria-current={tweaks.density === density.value} onClick={() => onChange({ density: density.value })}>
              {density.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="label">Chiffres</div>
        <div className="segmented">
          <button className="segment" aria-current={tweaks.numStyle === "mono"} onClick={() => onChange({ numStyle: "mono" })}>Mono</button>
          <button className="segment" aria-current={tweaks.numStyle === "display"} onClick={() => onChange({ numStyle: "display" })}>Display</button>
        </div>
      </div>
    </>
  );
}

const rootEl = document.getElementById("app");
if (rootEl) createRoot(rootEl).render(<App />);

if (typeof window !== "undefined") window.App = App;
