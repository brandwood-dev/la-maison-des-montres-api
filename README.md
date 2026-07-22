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

## Développement

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm start:dev
```

Endpoint de santé : `GET /v1/health`.

## Validation

```bash
pnpm lint
pnpm test:ci
pnpm build
```

Ne commitez jamais `.env`, une URL de connexion PostgreSQL, une clé secrète ou une clé
`service_role`.
