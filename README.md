# La Maison des Montres API

API NestJS séparée du frontend public et de l’administration.

## Principes MVP

- checkout invité, sans compte client ;
- paiement à la livraison en TND ;
- recalcul obligatoire de tous les prix côté API ;
- le client envoie uniquement les identifiants produit et les quantités ;
- suivi par référence de commande et téléphone ;
- base Supabase dédiée, jamais partagée avec Soltani Signature ;
- secrets Supabase disponibles uniquement côté serveur.

Supabase n’est pas encore connecté et aucune migration n’est exécutée par ce projet.

## Développement local

```bash
cp .env.example .env
bun install --frozen-lockfile
bun run start:dev
```

Endpoint local : `GET /health`.

## Vercel

Le runtime Vercel utilise Node.js et l’entrée serverless `api/index.ts`. Le démarrage
serverless initialise NestJS sans appeler `app.listen()` et réutilise l’application
entre les invocations chaudes.

Endpoint Vercel : `GET /api/health`.

Variables à configurer manuellement :

- `NODE_ENV`
- `FRONTEND_URL`
- `LOCAL_FRONTEND_URL` uniquement pour le développement
- variables Supabase serveur uniquement lorsqu’une connexion sera développée

## Validation

```bash
bun run lint
bun run format:check
bun run typecheck
bun run test:ci
bun run build
```

Ne commitez jamais `.env`, `.env.local`, une URL PostgreSQL, une clé secrète ou une
clé `service_role`.
