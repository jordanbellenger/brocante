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

## Build

```bash
npm run build
```
