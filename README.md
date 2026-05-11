# Brocante

Application React locale pour gérer une petite brocante :

- estimation indicative d'un objet à partir du nom, des notes et d'une photo ;
- inventaire avec photos, prix, statut vendu/disponible ;
- caisse avec calcul du rendu monnaie et historique des ventes ;
- persistance dans le `localStorage` du navigateur ;
- synchronisation Supabase optionnelle.

## Lancer le projet

```bash
npm install
npm run dev
```

Puis ouvrir l'URL affichée par Vite, par défaut `http://127.0.0.1:5173/`.

## Supabase

1. Créer un projet Supabase.
2. Exécuter le SQL de `supabase/schema.sql` dans le SQL editor Supabase.
3. Copier `.env.example` vers `.env`.
4. Renseigner :

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
```

Sans ces variables, l'application reste en mode local.

## Estimation OpenAI

L'estimation utilise OpenAI si `OPENAI_API_KEY` est présente côté serveur. La clé ne doit jamais être exposée avec un préfixe `VITE_`, sinon elle serait lisible dans le navigateur.

Ajouter dans `.env` :

```bash
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-5-mini
```

Avec `npm run dev`, l'application lance `server.js`, qui expose `/api/estimate` et sert l'app Vite. Si la clé manque ou si l'appel API échoue, l'app repasse sur l'estimation locale.

## Build

```bash
npm run build
```
