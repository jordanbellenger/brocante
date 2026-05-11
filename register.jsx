/* === Brocante — page Caisse === */

import React from "react";
import {
  STORAGE_KEYS,
  Icon,
  breakdownChange,
  digitsToCents,
  formatDateShort,
  formatDigitsAsEur,
  formatEur,
  formatEurShort,
  loadList,
  saveList,
} from "./shared.jsx";

export function RegisterPage({ onToast, prefill, onPrefillConsumed, onItemSold }) {
  const [title, setTitle] = React.useState("");
  const [priceDigits, setPriceDigits] = React.useState(""); // cents string
  const [stage, setStage] = React.useState("price"); // price | tendered | done
  const [tenderedDigits, setTenderedDigits] = React.useState("");
  const [sales, setSales] = React.useState(() => loadList(STORAGE_KEYS.sales));
  const [showHistory, setShowHistory] = React.useState(false);
  const [linkedItemId, setLinkedItemId] = React.useState(null);

  React.useEffect(() => {
    const onListSaved = (event) => {
      if (event.detail?.key === STORAGE_KEYS.sales) {
        setSales(Array.isArray(event.detail.items) ? event.detail.items : loadList(STORAGE_KEYS.sales));
      }
    };
    window.addEventListener("brocante:list-saved", onListSaved);
    return () => window.removeEventListener("brocante:list-saved", onListSaved);
  }, []);

  // Pre-fill from inventory
  React.useEffect(() => {
    if (prefill) {
      setTitle(prefill.name || "");
      setPriceDigits(String(prefill.priceCents || ""));
      setTenderedDigits("");
      setStage("tendered");
      setLinkedItemId(prefill.id);
      onPrefillConsumed && onPrefillConsumed();
    }
  }, [prefill]);

  const priceCents = digitsToCents(priceDigits);
  const tenderedCents = digitsToCents(tenderedDigits);
  const changeCents = Math.max(0, tenderedCents - priceCents);

  // Today's stats
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todaySales = sales.filter(s => s.ts >= todayStart.getTime());
  const todayTotal = todaySales.reduce((a, s) => a + s.priceCents, 0);
  const todayCount = todaySales.length;

  const pressKey = (k) => {
    const target = stage === "price" ? priceDigits : tenderedDigits;
    const setter = stage === "price" ? setPriceDigits : setTenderedDigits;
    let next = target;
    if (k === "back") next = target.slice(0, -1);
    else if (k === "clear") next = "";
    else if (next.length >= 7) return;
    else if (k === "00") next = target === "" ? "0" : target + "00";
    else next = target + k;
    // Strip leading zeros (keep one max)
    next = next.replace(/^0+(?=\d)/, "");
    setter(next.slice(0, 7));
  };

  const addBill = (cents) => {
    const cur = digitsToCents(tenderedDigits) + cents;
    setTenderedDigits(String(cur));
  };

  const validatePrice = () => {
    if (priceCents <= 0) { onToast("Saisis un prix"); return; }
    setStage("tendered");
    setTenderedDigits("");
  };

  const validateSale = () => {
    if (tenderedCents < priceCents) { onToast("Montant insuffisant"); return; }
    const sale = {
      id: Date.now(),
      ts: Date.now(),
      title: title.trim() || "Objet",
      priceCents,
      tenderedCents,
      changeCents,
      linkedItemId,
    };
    const next = [sale, ...sales].slice(0, 500);
    setSales(next);
    saveList(STORAGE_KEYS.sales, next);
    if (linkedItemId && onItemSold) onItemSold(linkedItemId, sale);
    setStage("done");
  };

  const newSale = () => {
    setTitle(""); setPriceDigits(""); setTenderedDigits(""); setStage("price");
    setLinkedItemId(null);
  };

  const skipTendered = () => {
    // Cash paid exact / card payment — no change
    const sale = {
      id: Date.now(),
      ts: Date.now(),
      title: title.trim() || "Objet",
      priceCents,
      tenderedCents: priceCents,
      changeCents: 0,
      noChange: true,
      linkedItemId,
    };
    const next = [sale, ...sales].slice(0, 500);
    setSales(next);
    saveList(STORAGE_KEYS.sales, next);
    if (linkedItemId && onItemSold) onItemSold(linkedItemId, sale);
    setStage("done");
  };

  const deleteSale = (id) => {
    const next = sales.filter(s => s.id !== id);
    setSales(next);
    saveList(STORAGE_KEYS.sales, next);
  };

  return (
    <>
      <div className="app-header">
        <h1>Caisse</h1>
        <button className="pill" style={{ border: "none", cursor: "pointer" }} onClick={() => setShowHistory(true)}>
          Aujourd'hui : {formatEurShort(todayTotal)}
        </button>
      </div>

      <div className="page">
        {stage === "price" && (
          <PriceStage
            title={title} setTitle={setTitle}
            priceDigits={priceDigits}
            pressKey={pressKey}
            onValidate={validatePrice}
          />
        )}
        {stage === "tendered" && (
          <TenderedStage
            title={title}
            priceCents={priceCents}
            tenderedDigits={tenderedDigits}
            tenderedCents={tenderedCents}
            changeCents={changeCents}
            pressKey={pressKey}
            addBill={addBill}
            onBack={() => setStage("price")}
            onValidate={validateSale}
            onSkip={skipTendered}
          />
        )}
        {stage === "done" && (
          <DoneStage
            sale={sales[0]}
            onNew={newSale}
          />
        )}
      </div>

      {showHistory && (
        <HistoryOverlay
          sales={sales}
          onClose={() => setShowHistory(false)}
          onDelete={deleteSale}
        />
      )}
    </>
  );
}

function PriceStage({ title, setTitle, priceDigits, pressKey, onValidate }) {
  return (
    <>
      <div className="section">
        <label className="label">Titre de l'objet</label>
        <input
          className="input"
          placeholder="ex : Vase en porcelaine"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="section">
        <label className="label">Prix de vente</label>
        <div
          className="card center"
          style={{ padding: "26px 18px", display: "flex", flexDirection: "column", gap: 4 }}
        >
          <div className="amount amount-huge" style={{ color: priceDigits ? "var(--ink)" : "var(--ink-faint)" }}>
            {formatDigitsAsEur(priceDigits || "0")}
          </div>
        </div>
      </div>

      <div className="section">
        <Keypad onPress={pressKey} />
      </div>

      <button
        className="btn btn-primary btn-block btn-xl mt-4"
        onClick={onValidate}
        disabled={!digitsToCents(priceDigits)}
      >
        Encaisser →
      </button>
    </>
  );
}

function TenderedStage({ title, priceCents, tenderedDigits, tenderedCents, changeCents, pressKey, addBill, onBack, onValidate, onSkip }) {
  const enough = tenderedCents >= priceCents;
  const breakdown = enough && changeCents > 0 ? breakdownChange(changeCents) : [];

  return (
    <>
      {/* Top: client gives, change due */}
      <div className="card" style={{ padding: 18 }}>
        <div className="hstack" style={{ justifyContent: "space-between", fontSize: 14 }}>
          <span className="muted">{title || "Objet"}</span>
          <span className="amount" style={{ fontWeight: 700 }}>{formatEur(priceCents)}</span>
        </div>
        <div className="hstack" style={{ justifyContent: "space-between", marginTop: 12, fontSize: 14 }}>
          <span className="muted">Client donne</span>
          <span className="amount" style={{ fontWeight: 700, color: tenderedDigits ? "var(--ink)" : "var(--ink-faint)" }}>
            {formatDigitsAsEur(tenderedDigits || "0")}
          </span>
        </div>
      </div>

      {/* Change due — hero */}
      <div className="card mt-4 center" style={{
        background: enough && changeCents > 0 ? "var(--accent-soft)" : "var(--surface)",
        borderColor: enough && changeCents > 0 ? "var(--accent-soft)" : "var(--line)",
        padding: "22px 18px",
      }}>
        <div className="label" style={{ marginBottom: 4 }}>À rendre</div>
        <div
          className="amount amount-huge"
          style={{ color: enough ? (changeCents > 0 ? "var(--accent)" : "var(--ok)") : "var(--ink-faint)" }}
        >
          {enough ? formatEur(changeCents) : "—"}
        </div>
        {!enough && tenderedDigits && (
          <div className="muted mt-2" style={{ fontSize: 14 }}>
            il manque <strong style={{ color: "var(--danger)" }}>{formatEur(priceCents - tenderedCents)}</strong>
          </div>
        )}
        {enough && changeCents === 0 && (
          <div className="mt-2" style={{ fontSize: 14, color: "var(--ok)", fontWeight: 600 }}>
            Compte juste
          </div>
        )}
        {breakdown.length > 0 && (
          <div className="hstack mt-3" style={{ flexWrap: "wrap", justifyContent: "center", gap: 6 }}>
            {breakdown.map((b, i) => (
              <span key={i} className="chip chip-accent">
                {b.count > 1 && <strong>{b.count}×</strong>} {b.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Bill shortcuts */}
      <div className="section mt-4">
        <div className="label">Billets &amp; pièces</div>
        <div className="bills">
          {[500, 1000, 2000, 5000, 100, 200, 10000, 20000].map(c => (
            <button key={c} className="bill" onClick={() => addBill(c)}>
              {c >= 100 ? `${c/100} €` : `${c}¢`}
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <Keypad onPress={pressKey} />
      </div>

      <div className="hstack mt-4" style={{ gap: 8 }}>
        <button className="btn btn-ghost" onClick={onBack} style={{ flex: "0 0 auto", padding: "0 18px" }}>
          <Icon.Back />
        </button>
        <button
          className="btn btn-ghost"
          onClick={onSkip}
          style={{ flex: 1 }}
          title="Sans rendu (carte, compte juste)"
        >
          Payé direct
        </button>
        <button
          className="btn btn-primary"
          onClick={onValidate}
          disabled={!enough}
          style={{ flex: 1.4 }}
        >
          <Icon.Check /> Valider
        </button>
      </div>
    </>
  );
}

function DoneStage({ sale, onNew }) {
  if (!sale) return null;
  return (
    <div className="center" style={{ paddingTop: 30 }}>
      <div style={{
        width: 88, height: 88, borderRadius: "50%",
        background: "var(--accent-soft)", color: "var(--accent)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 16px",
      }}>
        <Icon.Check style={{ width: 44, height: 44 }} />
      </div>
      <div className="amount amount-big" style={{ color: "var(--ink)" }}>
        {formatEur(sale.priceCents)}
      </div>
      <div className="muted mt-2" style={{ fontSize: 15 }}>{sale.title}</div>

      {!sale.noChange && sale.changeCents > 0 && (
        <div className="card-flat mt-6" style={{ maxWidth: 280, margin: "24px auto 0" }}>
          <div className="hstack" style={{ justifyContent: "space-between", fontSize: 14 }}>
            <span className="muted">Reçu</span>
            <span className="amount" style={{ fontWeight: 600 }}>{formatEur(sale.tenderedCents)}</span>
          </div>
          <div className="hstack mt-2" style={{ justifyContent: "space-between", fontSize: 14 }}>
            <span className="muted">Rendu</span>
            <span className="amount" style={{ fontWeight: 600, color: "var(--accent)" }}>{formatEur(sale.changeCents)}</span>
          </div>
        </div>
      )}

      <button className="btn btn-primary btn-block btn-xl mt-6" onClick={onNew}>
        <Icon.Plus /> Vente suivante
      </button>
    </div>
  );
}

function Keypad({ onPress }) {
  const keys = [
    { k: "1" }, { k: "2" }, { k: "3" },
    { k: "4" }, { k: "5" }, { k: "6" },
    { k: "7" }, { k: "8" }, { k: "9" },
    { k: "00" }, { k: "0" }, { k: "back", icon: true },
  ];
  return (
    <div className="keypad">
      {keys.map((k, i) => (
        <button
          key={i}
          className={`key ${k.k === "back" ? "key-back" : ""}`}
          onClick={() => onPress(k.k)}
          onTouchStart={(e) => e.currentTarget.style.background = "var(--surface-2)"}
          onTouchEnd={(e) => e.currentTarget.style.background = ""}
        >
          {k.k === "back" ? <Icon.Back style={{ width: 22, height: 22 }} /> : k.k}
        </button>
      ))}
    </div>
  );
}

function HistoryOverlay({ sales, onClose, onDelete }) {
  // Group by day
  const groups = {};
  for (const s of sales) {
    const d = new Date(s.ts);
    const key = d.toDateString();
    groups[key] = groups[key] || { label: key, sales: [], total: 0 };
    groups[key].sales.push(s);
    groups[key].total += s.priceCents;
  }
  const ordered = Object.values(groups).sort((a, b) =>
    new Date(b.sales[0].ts) - new Date(a.sales[0].ts)
  );
  const grandTotal = sales.reduce((a, s) => a + s.priceCents, 0);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay-card" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "80vh", overflowY: "auto" }}>
        <div className="hstack" style={{ justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Ventes</h2>
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Fermer">
            <Icon.Close style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {sales.length > 0 && (
          <div className="card" style={{ marginBottom: 16, padding: 16, background: "var(--accent-soft)", borderColor: "var(--accent-soft)" }}>
            <div className="hstack" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total CA</span>
              <span className="amount amount-big" style={{ color: "var(--accent)" }}>{formatEur(grandTotal)}</span>
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{sales.length} vente{sales.length > 1 ? "s" : ""} au total</div>
          </div>
        )}

        {sales.length === 0 ? (
          <div className="empty">
            <Icon.Empty />
            <h3>Aucune vente</h3>
            <p>Tes ventes apparaîtront ici</p>
          </div>
        ) : (
          ordered.map((g, gi) => {
            const d = new Date(g.sales[0].ts);
            const today = new Date(); today.setHours(0,0,0,0);
            const isToday = d >= today;
            const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
            const isYesterday = d.toDateString() === yesterday.toDateString();
            const label = isToday ? "Aujourd'hui" : isYesterday ? "Hier" : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long" });
            return (
              <div key={gi} className="section">
                <div className="section-title">
                  {label}
                  <small><span className="amount">{formatEur(g.total)}</span> · {g.sales.length} vente{g.sales.length > 1 ? "s" : ""}</small>
                </div>
                {g.sales.map(s => (
                  <SaleRow key={s.id} sale={s} onDelete={() => onDelete(s.id)} />
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function SaleRow({ sale, onDelete }) {
  const [confirm, setConfirm] = React.useState(false);
  return (
    <div className="row">
      <div className="row-main">
        <div className="row-title">{sale.title}</div>
        <div className="row-sub">
          {formatDateShort(sale.ts)}
          {!sale.noChange && sale.changeCents > 0 && (
            <span className="faint"> · rendu {formatEur(sale.changeCents)}</span>
          )}
        </div>
      </div>
      <div className="row-amount">{formatEur(sale.priceCents)}</div>
      {confirm ? (
        <button className="btn btn-sm btn-danger" onClick={onDelete}>OK ?</button>
      ) : (
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => { setConfirm(true); setTimeout(() => setConfirm(false), 2500); }}
          style={{ padding: "0 10px" }}
          aria-label="Supprimer"
        >
          <Icon.Trash style={{ width: 16, height: 16 }} />
        </button>
      )}
    </div>
  );
}

if (typeof window !== "undefined") window.RegisterPage = RegisterPage;
