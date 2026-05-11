# Brocante

AI-assisted flea-market inventory and checkout app with Supabase team sharing.

🇫🇷 [Français](#-français) · 🇬🇧 [English](#-english)

---

## 🇫🇷 Français

Application React pour gérer une petite brocante :

- estimation IA avec photo, nom et notes ;
- inventaire avec prix conseillé et prix minimum ;
- caisse avec calcul du rendu monnaie ;
- historique des estimations et ventes ;
- authentification Supabase ;
- inventaires partagés par équipe.

### Lancer en local

```bash
npm install
npm run dev
```

Ouvre ensuite `http://127.0.0.1:5173/`.

Le serveur local `server.js` sert Vite et expose aussi `/api/estimate` pour garder la clé OpenAI côté serveur.

### Variables d'environnement

Copie `.env.example` vers `.env.local`, puis renseigne :

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key

OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-5-mini
```

Ne préfixe jamais la clé OpenAI avec `VITE_`.

### Supabase

1. Crée un projet Supabase.
2. Active Auth email/password et désactive les inscriptions publiques si l'app doit rester privée.
3. Exécute `supabase/schema.sql` dans le SQL editor.
4. Dans Supabase Auth, ajoute l'URL locale et l'URL Vercel aux redirect URLs :
   - `http://127.0.0.1:5173`
   - `https://ton-projet.vercel.app`

Avec Supabase configuré, chaque utilisateur se connecte, puis crée ou rejoint une équipe. Les listes `inventaire`, `ventes` et `estimations` sont isolées par équipe. L'app n'affiche pas de création de compte publique : crée ou invite les utilisateurs depuis Supabase Auth.

### Déployer sur Vercel

1. Pousse le projet sur GitHub.
2. Crée un projet Vercel depuis ce repo.
3. Vercel détecte Vite automatiquement.
4. Ajoute les variables d'environnement dans Vercel :

```bash
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
OPENAI_API_KEY
OPENAI_MODEL
```

5. Déploie.

L'endpoint OpenAI est fourni par `api/estimate.js`, une fonction serverless Vercel.

### Build

```bash
npm run build
```

---

## 🇬🇧 English

React app for managing a small flea-market inventory:

- AI estimation from photo, name, and notes;
- inventory with target price and minimum price;
- register with change calculation;
- estimate and sales history;
- Supabase authentication;
- team-shared inventories.

### Run Locally

```bash
npm install
npm run dev
```

Then open `http://127.0.0.1:5173/`.

The local `server.js` serves Vite and exposes `/api/estimate`, so the OpenAI key stays server-side.

### Environment Variables

Copy `.env.example` to `.env.local`, then fill in:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key

OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-5-mini
```

Never expose the OpenAI key with a `VITE_` prefix.

### Supabase

1. Create a Supabase project.
2. Enable email/password Auth and disable public signups if the app should stay private.
3. Run `supabase/schema.sql` in the SQL editor.
4. In Supabase Auth, add both local and Vercel URLs to redirect URLs:
   - `http://127.0.0.1:5173`
   - `https://your-project.vercel.app`

When Supabase is configured, each user signs in, then creates or joins a team. `inventory`, `sales`, and `estimates` lists are isolated by team. The app does not expose public signup: create or invite users from Supabase Auth.

### Deploy to Vercel

1. Push this project to GitHub.
2. Create a Vercel project from the repo.
3. Vercel should detect Vite automatically.
4. Add these environment variables in Vercel:

```bash
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
OPENAI_API_KEY
OPENAI_MODEL
```

5. Deploy.

The OpenAI endpoint is handled by `api/estimate.js`, a Vercel serverless function.

### Build

```bash
npm run build
```
