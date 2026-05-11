/* === Brocante — page Estimer === */

import React from "react";
import {
  STORAGE_KEYS,
  Icon,
  estimateLocally,
  formatDateShort,
  loadList,
  saveList,
} from "./shared.jsx";

export function EstimatePage({ inventory = [], onToast, onAddToInventory }) {
  const [photo, setPhoto] = React.useState(null); // dataURL
  const [name, setName] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState(null); // {low, mid, high, why, confidence, name}
  const [history, setHistory] = React.useState(() => loadList(STORAGE_KEYS.estimates));
  const [search, setSearch] = React.useState("");
  const fileRef = React.useRef(null);

  React.useEffect(() => {
    const onListSaved = (event) => {
      if (event.detail?.key === STORAGE_KEYS.estimates) {
        setHistory(Array.isArray(event.detail.items) ? event.detail.items : loadList(STORAGE_KEYS.estimates));
      }
    };
    window.addEventListener("brocante:list-saved", onListSaved);
    return () => window.removeEventListener("brocante:list-saved", onListSaved);
  }, []);

  const reset = () => {
    setPhoto(null); setName(""); setNotes(""); setResult(null); setLoading(false);
  };

  const onFile = async (file) => {
    if (!file) return;
    // Downscale for API + storage
    const img = await new Promise((res, rej) => {
      const im = new Image();
      const url = URL.createObjectURL(file);
      im.onload = () => res(im); im.onerror = rej; im.src = url;
    });
    const max = 900;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    const dataUrl = c.toDataURL("image/jpeg", 0.78);
    setPhoto(dataUrl);
  };

  const estimate = async () => {
    if (!photo && !name.trim()) {
      onToast("Ajoute une photo ou un nom d'objet");
      return;
    }
    setLoading(true); setResult(null);
    try {
      let parsed;
      try {
        const response = await fetch("/api/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photo, name, notes }),
        });
        if (!response.ok) throw new Error("OpenAI indisponible");
        parsed = await response.json();
      } catch (error) {
        parsed = estimateLocally({ name, notes, hasPhoto: !!photo });
        onToast("Estimation locale utilisée");
      }
      const safeNum = (v) => Math.max(0, Math.round(Number(v) || 0));
      const lo = safeNum(parsed.low);
      const mi = safeNum(parsed.mid);
      const hi = safeNum(parsed.high);
      const res = {
        id: Date.now(),
        ts: Date.now(),
        name: parsed.name || parsed.label || name || "Objet",
        low: lo, mid: mi, high: hi,
        confidence: parsed.confidence || "moyenne",
        why: parsed.why || "",
        photo: photo,
      };
      setResult(res);
      const newHist = [res, ...history].slice(0, 60);
      setHistory(newHist);
      saveList(STORAGE_KEYS.estimates, newHist);
    } catch (e) {
      onToast("Échec : " + (e.message || "réessaie"));
    } finally {
      setLoading(false);
    }
  };

  const deleteHistoryItem = (id) => {
    const next = history.filter(h => h.id !== id);
    setHistory(next);
    saveList(STORAGE_KEYS.estimates, next);
  };

  const isInInventory = (value) => {
    const normalized = normalizeItemName(value);
    return inventory.some((item) =>
      item.status !== "sold" && normalizeItemName(item.name) === normalized
    );
  };

  const filtered = history.filter(h =>
    !search.trim() || (h.name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="app-header">
        <h1>Estimer</h1>
        <span className="pill">{history.length} {history.length === 1 ? "estim." : "estim."}</span>
      </div>

      <div className="page">
        {/* Photo zone */}
        <div className="section">
          {!photo ? (
            <div className="dropzone" onClick={() => fileRef.current?.click()}>
              <Icon.Camera />
              <strong>Prends ou choisis une photo</strong>
              <span>L'app proposera une fourchette de vente</span>
            </div>
          ) : (
            <div className="photo-preview" style={{ backgroundImage: `url(${photo})` }}>
              <div className="photo-overlay">
                <button className="btn btn-sm btn-ghost" onClick={() => fileRef.current?.click()}>
                  Changer
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => setPhoto(null)}>
                  <Icon.Close style={{ width: 16, height: 16 }} />
                </button>
              </div>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>

        {/* Name & notes */}
        <div className="section vstack">
          <div>
            <label className="label">Nom de l'objet (facultatif)</label>
            <input
              className="input"
              placeholder="ex : Lampe de bureau"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Notes (état, marque…)</label>
            <textarea
              className="textarea"
              placeholder="quelques mots, facultatif"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <button
          className="btn btn-primary btn-block btn-xl mt-4"
          onClick={estimate}
          disabled={loading}
        >
          {loading ? <><div className="spinner" /> Analyse…</> : <><Icon.Sparkles /> Estimer le prix</>}
        </button>

        {/* Result */}
        {loading && (
          <div className="card mt-6">
            <div className="skel" style={{ height: 14, width: "40%", marginBottom: 14 }} />
            <div className="skel" style={{ height: 56, marginBottom: 14 }} />
            <div className="skel" style={{ height: 12, marginBottom: 8 }} />
            <div className="skel" style={{ height: 12, width: "70%" }} />
          </div>
        )}

        {result && !loading && (
          <EstimateResult
            result={result}
            onClear={reset}
            onAddToInventory={() => {
              const added = onAddToInventory({
                name: result.name,
                priceCents: (result.mid || result.low || 0) * 100,
                minPriceCents: (result.low || result.mid || 0) * 100,
                photo: result.photo,
                notes: result.why || "",
              });
              if (added) onToast("Ajout\u00e9 \u00e0 l'inventaire");
            }}
          />
        )}

        {/* History */}
        <div className="section mt-6">
          <div className="section-title">
            Historique
            <small>{history.length} objet{history.length > 1 ? "s" : ""}</small>
          </div>
          {history.length > 0 && (
            <div style={{ position: "relative", marginBottom: 10 }}>
              <Icon.Search style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--ink-faint)", width: 18, height: 18 }} />
              <input
                className="input"
                style={{ paddingLeft: 44, fontSize: 15, padding: "12px 12px 12px 44px" }}
                placeholder="Rechercher dans l'historique"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="empty">
              <Icon.Empty />
              <h3>{history.length === 0 ? "Pas encore d'estimation" : "Aucun résultat"}</h3>
              <p>{history.length === 0 ? "Tes estimations passées s'afficheront ici" : "Essaie un autre mot"}</p>
            </div>
          ) : (
            <div>
              {filtered.map(h => (
                <HistoryRow
                  key={h.id}
                  item={h}
                  existsInInventory={isInInventory(h.name)}
                  onDelete={() => deleteHistoryItem(h.id)}
                  onAddToInventory={() => {
                    const added = onAddToInventory({
                      name: h.name,
                      priceCents: (h.mid || h.low || 0) * 100,
                      minPriceCents: (h.low || h.mid || 0) * 100,
                      photo: h.photo,
                      notes: h.why || "",
                    });
                    if (added) onToast("Ajout\u00e9 \u00e0 l'inventaire");
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function EstimateResult({ result, onClear, onAddToInventory }) {
  const range = Math.max(1, result.high - result.low);
  const midPct = ((result.mid - result.low) / range) * 100;
  const confChip = result.confidence === "élevée" ? "chip-ok" : result.confidence === "faible" ? "chip" : "chip-accent";
  return (
    <div className="card mt-6">
      <div className="hstack">
        <div className="row-main">
          <div style={{ fontSize: 13, color: "var(--ink-soft)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Estimation
          </div>
          <div style={{ fontWeight: 700, fontSize: 20, marginTop: 2 }}>{result.name}</div>
        </div>
        <span className={`chip ${confChip}`}>fiabilité {result.confidence}</span>
      </div>

      <div className="amount amount-huge mt-4" style={{ color: "var(--accent)" }}>
        {result.mid} €
      </div>
      <div className="muted" style={{ fontSize: 14, marginTop: 2 }}>
        prix conseillé
      </div>

      <div className="range-bar">
        <div className="range-bar-fill" />
        <div className="range-marker" style={{ left: `${midPct}%` }} />
      </div>
      <div className="hstack" style={{ justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600 }}>
        <span>{result.low} €</span>
        <span className="faint">fourchette</span>
        <span>{result.high} €</span>
      </div>

      {result.why && (
        <div className="card-flat mt-4" style={{ fontSize: 14, lineHeight: 1.5 }}>
          {result.why}
        </div>
      )}

      <div className="hstack mt-4" style={{ gap: 8 }}>
        <button className="btn btn-ghost" onClick={onClear} style={{ flex: 1 }}>
          Nouvelle
        </button>
        <button className="btn btn-primary" onClick={onAddToInventory} style={{ flex: 1.4 }}>
          <Icon.Plus /> Inventaire
        </button>
      </div>
    </div>
  );
}

function HistoryRow({ item, existsInInventory, onDelete, onAddToInventory }) {
  const [confirm, setConfirm] = React.useState(false);
  return (
    <div className="row">
      <div
        className="row-thumb"
        style={item.photo ? { backgroundImage: `url(${item.photo})` } : {}}
      >
        {!item.photo && <Icon.Camera style={{ width: 22, height: 22 }} />}
      </div>
      <div className="row-main">
        <div className="row-title">{item.name}</div>
        <div className="row-sub">
          <span className="amount" style={{ fontWeight: 600, color: "var(--ink)" }}>
            {item.low}–{item.high} €
          </span>
          <span className="faint"> · {formatDateShort(item.ts)}</span>
        </div>
      </div>
      <button
        className="btn btn-soft btn-sm icon-btn"
        onClick={onAddToInventory}
        disabled={existsInInventory}
        aria-label={existsInInventory ? "Déjà dans l'inventaire" : "Ajouter à l'inventaire"}
        title={existsInInventory ? "Déjà dans l'inventaire" : "Ajouter à l'inventaire"}
      >
        {existsInInventory ? <Icon.Check /> : <Icon.Plus />}
      </button>
      {confirm ? (
        <button className="btn btn-sm btn-danger" onClick={onDelete}>OK ?</button>
      ) : (
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => { setConfirm(true); setTimeout(() => setConfirm(false), 2500); }}
          aria-label="Supprimer"
          style={{ padding: "0 10px" }}
        >
          <Icon.Trash style={{ width: 18, height: 18 }} />
        </button>
      )}
    </div>
  );
}

function normalizeItemName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

if (typeof window !== "undefined") window.EstimatePage = EstimatePage;
