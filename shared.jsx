/* === Brocante — shared helpers === */

import React from "react";
import { saveRemoteList } from "./remoteStore.js";

export const STORAGE_KEYS = {
  sales: "brocante.sales.v1",
  estimates: "brocante.estimates.v1",
  inventory: "brocante.inventory.v1",
};

export function loadList(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) { return []; }
}
export function saveList(key, items) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("brocante:list-saved", { detail: { key, items } }));
    saveRemoteList(key, items).catch((error) => {
      console.warn("Supabase sync failed", error);
    });
  } catch (e) {}
}

export function formatEur(cents) {
  const n = (cents || 0) / 100;
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
export function formatEurShort(cents) {
  const n = Math.round((cents || 0) / 100);
  return n.toLocaleString("fr-FR") + " €";
}
export function formatDateShort(ts) {
  const d = new Date(ts);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const yesterday = new Date(Date.now() - 86400000);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const hm = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return "Aujourd'hui · " + hm;
  if (isYesterday) return "Hier · " + hm;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) + " · " + hm;
}

/* Greedy change breakdown — French euro coins/bills */
export const DENOMS_CENTS = [
  20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1,
];
export const DENOM_LABEL = {
  20000: "200 €", 10000: "100 €", 5000: "50 €", 2000: "20 €", 1000: "10 €", 500: "5 €",
  200: "2 €", 100: "1 €", 50: "50¢", 20: "20¢", 10: "10¢", 5: "5¢", 2: "2¢", 1: "1¢",
};
export function breakdownChange(cents) {
  const out = [];
  let r = Math.max(0, Math.round(cents));
  for (const d of DENOMS_CENTS) {
    if (r >= d) {
      const n = Math.floor(r / d);
      r -= n * d;
      out.push({ denom: d, count: n, label: DENOM_LABEL[d] });
    }
  }
  return out;
}

/* Parse a digit-string ("1250") into cents (1250 cents = 12,50 €) */
export function digitsToCents(digits) {
  if (!digits) return 0;
  return parseInt(digits, 10) || 0;
}
export function formatDigitsAsEur(digits) {
  const cents = digitsToCents(digits);
  return formatEur(cents);
}

/* Icons (inline SVG) */
export const Icon = {
  Camera: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 8a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
      <circle cx="12" cy="13" r="3.6" />
    </svg>
  ),
  Cash: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 10v4M18 10v4" />
    </svg>
  ),
  Back: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m11 5-6 7 6 7" />
      <path d="M19 12H5" />
    </svg>
  ),
  Trash: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
    </svg>
  ),
  Plus: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Check: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m5 13 4 4L19 7" />
    </svg>
  ),
  Sparkles: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 4v4M12 16v4M4 12h4M16 12h4" />
      <path d="m6 6 2 2M16 16l2 2M6 18l2-2M16 8l2-2" />
    </svg>
  ),
  Search: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  History: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  Empty: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 7h18M5 7v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7" />
      <path d="M9 7V5a3 3 0 0 1 6 0v2" />
    </svg>
  ),
  Close: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 6 18 18M18 6 6 18" />
    </svg>
  ),
  Box: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" />
      <path d="M3 7.5 12 12l9-4.5M12 12v9" />
    </svg>
  ),
  Tag: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12V4h8l10 10-8 8L3 12Z" />
      <circle cx="8" cy="9" r="1.4" />
    </svg>
  ),
  ArrowRight: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  ),
  Edit: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 20h4l11-11-4-4L4 16v4Z" />
      <path d="m14 5 4 4" />
    </svg>
  ),
};

export function estimateLocally({ name = "", notes = "", hasPhoto = false }) {
  const text = `${name} ${notes}`.toLowerCase();
  const rules = [
    { re: /lampe|luminaire|applique|lustre/, label: "Luminaire vintage", low: 8, mid: 18, high: 35, why: "Les luminaires se vendent bien si l'etat est correct." },
    { re: /vase|porcelaine|cristal|verre|ceramique|céramique/, label: "Objet decoratif", low: 4, mid: 12, high: 28, why: "Prix courant pour une piece decorative de brocante." },
    { re: /chaise|tabouret|fauteuil|meuble|table|commode/, label: "Petit mobilier", low: 15, mid: 35, high: 80, why: "Le mobilier part mieux avec un prix negociable." },
    { re: /jouet|lego|poupee|poupée|jeu|console/, label: "Jeu ou jouet", low: 5, mid: 15, high: 45, why: "La marque et l'etat peuvent fortement changer le prix." },
    { re: /livre|bd|vinyle|disque|cd|dvd/, label: "Livre ou media", low: 1, mid: 5, high: 18, why: "Les medias se vendent surtout en lots ou titres recherches." },
    { re: /outil|perceuse|bricolage|jardin|jardinage/, label: "Outil d'occasion", low: 5, mid: 20, high: 55, why: "Les outils propres et fonctionnels gardent une bonne valeur." },
    { re: /bijou|montre|bracelet|collier|bague/, label: "Bijou fantaisie", low: 3, mid: 12, high: 40, why: "Le prix depend surtout de la matiere et de la marque." },
    { re: /vetement|vêtement|robe|veste|sac|chaussure/, label: "Mode d'occasion", low: 3, mid: 10, high: 30, why: "La taille, la marque et l'etat dictent le prix." },
  ];
  const found = rules.find((r) => r.re.test(text));
  if (found) return { ...found, confidence: text.trim() ? "moyenne" : "faible" };
  const label = name.trim() || (hasPhoto ? "Objet a identifier" : "Objet de brocante");
  return {
    label,
    low: hasPhoto ? 3 : 2,
    mid: hasPhoto ? 12 : 8,
    high: hasPhoto ? 35 : 22,
    confidence: "faible",
    why: "Estimation indicative sans reconnaissance IA connectee.",
  };
}

if (typeof window !== "undefined") {
  Object.assign(window, {
    STORAGE_KEYS, loadList, saveList,
    formatEur, formatEurShort, formatDateShort,
    breakdownChange, digitsToCents, formatDigitsAsEur,
    estimateLocally,
    Icon,
  });
}
