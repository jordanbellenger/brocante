/* === Brocante — App shell === */

import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { EstimatePage } from "./estimate.jsx";
import { InventoryPage } from "./inventory.jsx";
import { RegisterPage } from "./register.jsx";
import { Icon, STORAGE_KEYS, loadList, saveList } from "./shared.jsx";
import { isSupabaseConfigured, syncRemoteLists } from "./remoteStore.js";

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
  const [syncState, setSyncState] = React.useState(() => isSupabaseConfigured ? "syncing" : "local");
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
    const onListSaved = (event) => {
      if (event.detail?.key === STORAGE_KEYS.inventory) {
        setInventoryState(Array.isArray(event.detail.items) ? event.detail.items : loadList(STORAGE_KEYS.inventory));
      }
    };
    window.addEventListener("brocante:list-saved", onListSaved);
    return () => window.removeEventListener("brocante:list-saved", onListSaved);
  }, []);

  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    syncRemoteLists(Object.values(STORAGE_KEYS))
      .then(({ loaded }) => {
        if (cancelled) return;
        setInventoryState(loadList(STORAGE_KEYS.inventory));
        setSyncState("online");
        if (loaded > 0) showToast("Données Supabase synchronisées");
      })
      .catch(() => {
        if (!cancelled) setSyncState("error");
      });
    return () => { cancelled = true; };
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
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

  return (
    <>
      <div data-screen-label={screenLabel} style={{ display: "contents" }}>
        {tab === "estimate" && (
          <EstimatePage onToast={showToast} onAddToInventory={addToInventory} />
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

      <div className={`sync-badge sync-${syncState}`}>
        {syncState === "online" ? "DB sync OK" : syncState === "syncing" ? "DB sync..." : syncState === "error" ? "DB sync erreur" : "DB sync off"}
      </div>

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
    </>
  );
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
