# Dépenses du foyer

Site web pour suivre à deux les dépenses mensuelles du foyer (V1), puis le chantier de la maison (V2).
Interface en français et en arabe, utilisable sur téléphone (site installable).

Plan du projet : https://claude.ai/artifact/1CoYTDYoWFPRt5aYt23jML

## Ce que fait le MVP

- Connexion par e-mail et mot de passe, création du foyer, invitation du conjoint par lien (valable 7 jours).
- Saisie rapide d'une dépense ou d'un revenu : montant, devise (TND ou EUR), catégorie, date, qui a payé, compte, note.
- Dépenses communes ou personnelles (une dépense personnelle n'est visible que par son auteur).
- Catégories par défaut en français et en arabe, modifiables.
- Opérations récurrentes (loyer, abonnements) créées automatiquement chaque mois.
- Taux de change : chaque montant est converti dans la devise de référence du foyer pour les totaux.
- Tableau de bord du mois : dépensé, revenus, solde, répartition par catégorie, dernières opérations.

## Stack

Next.js 15 (App Router, TypeScript, Tailwind CSS 4) · Supabase (PostgreSQL avec règles RLS, Auth) · Vercel.

## Mise en route

1. Créer un projet gratuit sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécuter le contenu de `supabase/migrations/0001_init.sql`.
3. Dans **Authentication > URL Configuration**, mettre l'adresse du site (par exemple `https://depenses-foyer.vercel.app`) comme *Site URL* et ajouter `https://<votre-site>/auth/callback` aux *Redirect URLs*.
4. Copier `.env.example` en `.env.local` et y mettre l'URL et la clé `anon` du projet (Settings > API).
5. En local : `npm install` puis `npm run dev`, et ouvrir http://localhost:3000.
6. En ligne : importer le dépôt sur [vercel.com](https://vercel.com), ajouter les deux variables d'environnement, déployer.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm test` | Tests unitaires et tests du schéma SQL (PostgreSQL embarqué via PGlite) |
| `npm run lint` / `npm run typecheck` | Vérifications du code |
| `npm run build` | Build de production |

## Organisation

- `supabase/migrations/` : schéma de la base, procédures et règles d'accès.
- `supabase/tests/` : tests du schéma (isolation des foyers, invitations, dépenses personnelles, conversions, récurrences).
- `src/app/` : pages ; `src/app/actions.ts` : actions serveur (écritures).
- `src/i18n/` : traductions française et arabe.
- `src/lib/` : accès Supabase, calculs de montants et de dates.
