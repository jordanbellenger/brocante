/* === Brocante — page Inventaire === */

import React from "react";
import {
  Icon,
  digitsToCents,
  formatDigitsAsEur,
  formatEur,
  formatEurShort,
} from "./shared.jsx";

export function InventoryPage({ inventory, onUpdate, onSell, onToast }) {
  const [filter, setFilter] = React.useState("available"); // available | sold | all
  const [search, setSearch] = React.useState("");
  const [editing, setEditing] = React.useState(null); // item being edited
  const [adding, setAdding] = React.useState(false);

  const available = inventory.filter(i => i.status !== "sold");
  const sold = inventory.filter(i => i.status === "sold");
  const totalAvail = available.reduce((a, i) => a + (i.priceCents || 0), 0);
  const totalSold = sold.reduce((a, i) => a + (i.soldPriceCents || i.priceCents || 0), 0);

  const list = (filter === "available" ? available : filter === "sold" ? sold : inventory)
    .filter(i => !search.trim() || (i.name || "").toLowerCase().includes(search.toLowerCase()));

  const upsert = (item) => {
    const idx = inventory.findIndex(i => i.id === item.id);
    let next;
    if (idx >= 0) { next = [...inventory]; next[idx] = item; }
    else next = [item, ...inventory];
    onUpdate(next);
  };
  const remove = (id) => onUpdate(inventory.filter(i => i.id !== id));

  return (
    <>
      <div className="app-header">
        <h1>Inventaire</h1>
        <span className="pill">{available.length} en stock · {formatEurShort(totalAvail)}</span>
      </div>

      <div className="page">
        <div className="hstack" style={{ background: "var(--surface-2)", borderRadius: "var(--radius)", padding: 4, gap: 0 }}>
          {[
            { k: "available", label: "À vendre", n: available.length },
            { k: "sold", label: "Vendus", n: sold.length },
            { k: "all", label: "Tous", n: inventory.length },
          ].map(t => (
            <button
              key={t.k}
              onClick={() => setFilter(t.k)}
              className="btn"
              style={{
                flex: 1, height: 40, borderRadius: 10, fontSize: 14, padding: 0,
                background: filter === t.k ? "var(--surface)" : "transparent",
                color: filter === t.k ? "var(--ink)" : "var(--ink-soft)",
                boxShadow: filter === t.k ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                border: "none",
              }}
            >
              {t.label} <span className="faint" style={{ marginLeft: 4 }}>{t.n}</span>
            </button>
          ))}
        </div>

        {inventory.length > 0 && (
          <div style={{ position: "relative", marginTop: 14 }}>
            <Icon.Search style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--ink-faint)", width: 18, height: 18 }} />
            <input
              className="input"
              style={{ paddingLeft: 44, fontSize: 15, padding: "12px 12px 12px 44px" }}
              placeholder="Rechercher"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        <button className="btn btn-ghost btn-block mt-4" onClick={() => setAdding(true)}>
          <Icon.Plus /> Ajouter un objet
        </button>

        {filter === "sold" && sold.length > 0 && (
          <div className="card-flat mt-4 hstack" style={{ justifyContent: "space-between" }}>
            <span className="muted" style={{ fontSize: 13 }}>{sold.length} objet{sold.length > 1 ? "s" : ""} vendu{sold.length > 1 ? "s" : ""} · voir détails dans la Caisse</span>
          </div>
        )}

        <div className="section mt-4">
          {list.length === 0 ? (
            <div className="empty">
              <Icon.Box />
              <h3>{inventory.length === 0 ? "Inventaire vide" : "Aucun résultat"}</h3>
              <p>
                {inventory.length === 0
                  ? "Ajoute un objet ou passe par Estimer"
                  : "Essaie un autre filtre"}
              </p>
            </div>
          ) : (
            list.map(item => (
              <InventoryRow
                key={item.id}
                item={item}
                onSell={() => onSell(item)}
                onEdit={() => setEditing(item)}
                onDelete={() => remove(item.id)}
              />
            ))
          )}
        </div>
      </div>

      {adding && (
        <InventoryEditor
          item={null}
          onSave={(it) => { upsert(it); setAdding(false); onToast("Ajouté"); }}
          onClose={() => setAdding(false)}
        />
      )}
      {editing && (
        <InventoryEditor
          item={editing}
          onSave={(it) => { upsert(it); setEditing(null); onToast("Mis à jour"); }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function InventoryRow({ item, onSell, onEdit, onDelete }) {
  const [open, setOpen] = React.useState(false);
  const isSold = item.status === "sold";
  return (
    <div className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: 0, padding: 0 }}>
      <div className="hstack" style={{ padding: 12, gap: 12, cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <div
          className="row-thumb"
          style={item.photo ? { backgroundImage: `url(${item.photo})` } : {}}
        >
          {!item.photo && <Icon.Box style={{ width: 22, height: 22 }} />}
        </div>
        <div className="row-main">
          <div className="row-title" style={{ textDecoration: isSold ? "line-through" : "none", color: isSold ? "var(--ink-soft)" : "var(--ink)" }}>
            {item.name}
          </div>
          <div className="row-sub">
            {isSold ? (
              <>
                <span className="chip" style={{ padding: "2px 8px", fontSize: 11 }}>vendu</span>{" "}
                <span className="amount" style={{ fontWeight: 600 }}>{formatEur(item.soldPriceCents || item.priceCents)}</span>
              </>
            ) : (
              <>
                <span className="amount" style={{ fontWeight: 600, color: "var(--ink)" }}>{formatEur(item.priceCents)}</span>
                {item.notes && <span className="faint"> · {item.notes}</span>}
              </>
            )}
          </div>
        </div>
        {!isSold && (
          <button
            className="btn btn-soft btn-sm"
            onClick={(e) => { e.stopPropagation(); onSell(); }}
            style={{ padding: "0 14px" }}
          >
            <Icon.Tag /> Vendre
          </button>
        )}
      </div>
      {open && (
        <div className="hstack" style={{ padding: "0 12px 12px", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={onEdit} style={{ flex: 1 }}>
            <Icon.Edit /> Modifier
          </button>
          <button className="btn btn-danger btn-sm" onClick={onDelete} style={{ flex: 1 }}>
            <Icon.Trash /> Supprimer
          </button>
        </div>
      )}
    </div>
  );
}

export function InventoryEditor({ item, onSave, onClose }) {
  const [name, setName] = React.useState(item?.name || "");
  const [priceDigits, setPriceDigits] = React.useState(item ? String(item.priceCents || "") : "");
  const [notes, setNotes] = React.useState(item?.notes || "");
  const [photo, setPhoto] = React.useState(item?.photo || null);
  const fileRef = React.useRef(null);

  const onFile = async (file) => {
    if (!file) return;
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im); im.onerror = rej;
      im.src = URL.createObjectURL(file);
    });
    const max = 700;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    setPhoto(c.toDataURL("image/jpeg", 0.75));
  };

  const save = () => {
    if (!name.trim()) return;
    onSave({
      id: item?.id || Date.now(),
      ts: item?.ts || Date.now(),
      name: name.trim(),
      priceCents: digitsToCents(priceDigits),
      notes: notes.trim(),
      photo,
      status: item?.status || "available",
      soldAt: item?.soldAt,
      soldPriceCents: item?.soldPriceCents,
      saleId: item?.saleId,
    });
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay-card" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto" }}>
        <div className="hstack" style={{ justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{item ? "Modifier" : "Nouvel objet"}</h2>
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Fermer">
            <Icon.Close />
          </button>
        </div>

        {photo ? (
          <div className="photo-preview" style={{ backgroundImage: `url(${photo})`, aspectRatio: "3 / 2" }}>
            <div className="photo-overlay">
              <button className="btn btn-sm btn-ghost" onClick={() => fileRef.current?.click()}>Changer</button>
              <button className="btn btn-sm btn-ghost" onClick={() => setPhoto(null)}>
                <Icon.Close />
              </button>
            </div>
          </div>
        ) : (
          <div className="dropzone" onClick={() => fileRef.current?.click()} style={{ padding: 18 }}>
            <Icon.Camera />
            <strong>Photo (facultatif)</strong>
            <span>Prends ou choisis</span>
          </div>
        )}
        <input
          ref={fileRef} type="file" accept="image/*" capture="environment"
          style={{ display: "none" }}
          onChange={(e) => onFile(e.target.files?.[0])}
        />

        <div className="mt-4">
          <label className="label">Nom</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex : Vase en cristal" autoFocus />
        </div>
        <div className="mt-3">
          <label className="label">Prix de vente (€)</label>
          <input
            className="input"
            inputMode="numeric"
            value={priceDigits ? formatDigitsAsEur(priceDigits) : ""}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "");
              setPriceDigits(d.replace(/^0+(?=\d)/, "").slice(0, 7));
            }}
            placeholder="0,00 €"
          />
        </div>
        <div className="mt-3">
          <label className="label">Notes</label>
          <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="état, provenance…" />
        </div>

        <button className="btn btn-primary btn-block btn-xl mt-4" onClick={save} disabled={!name.trim()}>
          <Icon.Check /> Enregistrer
        </button>
      </div>
    </div>
  );
}

if (typeof window !== "undefined") {
  window.InventoryPage = InventoryPage;
  window.InventoryEditor = InventoryEditor;
}
