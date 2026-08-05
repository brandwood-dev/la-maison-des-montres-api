# La Maison des Montres API

Backend NestJS partagé par la boutique publique et l’administration. Cette
première version couvre la fondation technique, l’authentification admin et le
catalogue. Elle ne connecte encore aucun frontend.

## Choix techniques

- NestJS 11, TypeScript strict, Node.js `>=22 <25`
- Bun `1.3.14`, avec `bun.lock` comme unique lockfile
- PostgreSQL Supabase côté serveur uniquement
- Drizzle ORM et migrations SQL versionnées
- JWT courts et refresh tokens rotatifs dans des cookies HTTP-only
- Argon2id pour les mots de passe

Drizzle a été retenu car le schéma, les contraintes et les migrations restent
du SQL PostgreSQL explicite et auditable. Il n’ajoute pas de moteur natif
généré et le client `postgres` peut désactiver les requêtes préparées, ce qui
est compatible avec Supavisor en mode transaction.

Les tables sont placées dans le schéma privé `app`. La migration révoque
l’accès au schéma pour les rôles publics Supabase et active RLS sans créer de
politique navigateur. L’API doit utiliser une connexion PostgreSQL serveur ;
aucune clé Supabase n’est transmise aux clients.

## Prérequis

- Bun `1.3.14`
- Node.js `>=22 <25`
- PostgreSQL 15 ou supérieur
- un projet Supabase séparé pour cette application

```bash
bun install --frozen-lockfile
cp .env.example .env
```

## Variables d’environnement

`.env.example` ne contient aucune valeur. Variables attendues :

- `NODE_ENV`
- `PORT`
- `DATABASE_URL` : connexion d’exécution côté serveur ; utiliser le pool
  transactionnel Supavisor pour un runtime serverless
- `DATABASE_DIRECT_URL` : connexion directe réservée aux migrations
- `SUPABASE_URL` : URL du projet Supabase utilisée uniquement côté serveur pour
  les tickets d’upload Storage
- `SUPABASE_SERVICE_ROLE_KEY` : clé secrète serveur Supabase, jamais exposée au
  navigateur
- `SUPABASE_STORAGE_BUCKET` : bucket public des images produit
- `BREVO_API_KEY` : clé API Brevo serveur uniquement
- `BREVO_SENDER_EMAIL` : expéditeur Brevo vérifié
- `BREVO_SENDER_NAME` : nom affiché par l’expéditeur
- `ADMIN_PUBLIC_URL` : URL publique de l’espace Admin utilisée pour les liens
  d’invitation (obligatoire en production)
- `CLOUDFLARE_ACCOUNT_ID` : identifiant du compte Cloudflare (serveur uniquement)
- `CLOUDFLARE_ACCESS_GROUP_ID` : groupe Access synchronisé avec les membres Admin
- `CLOUDFLARE_API_TOKEN` : jeton Cloudflare limité à la gestion des groupes Access
- `ORDER_NOTIFICATION_EMAIL` : boîte qui reçoit les nouvelles commandes
- `CORS_ORIGINS` : liste d’origines exactes séparées par des virgules ; CORS
  reste désactivé si la liste est vide
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_TTL_SECONDS`
- `JWT_REFRESH_TTL_SECONDS`
- `COOKIE_SECURE`
- `SWAGGER_ENABLED`
- `DEV_SEED_ENABLED`
- `DEV_SEED_SUPER_ADMIN_EMAIL`
- `DEV_SEED_SUPER_ADMIN_PASSWORD`

Ne jamais committer `.env`, une URL PostgreSQL, un mot de passe, un JWT ou une
clé `service_role`. `DATABASE_DIRECT_URL` ne doit pas être utilisée par le
runtime serverless.

## Lancement local

```bash
bun run start:dev
```

L’endpoint public `GET /health` retourne `{"status":"ok"}`.

Swagger est disponible sur `/docs` uniquement hors production et si
`SWAGGER_ENABLED` est activé.

## Base de données et migrations

```bash
bun run db:generate
bun run db:check
bun run db:migrate
```

La migration initiale crée :

- `admin_users` et `admin_sessions`
- `brands`
- `categories` avec hiérarchie facultative
- `attributes` et `attribute_values`
- `products`, `product_images`, `product_categories` et
  `product_attribute_values`

Les prix sont des entiers en millimes. `products.brand_id` est obligatoire.
Les références produit et les slugs SEO sont uniques. La migration additive
`0002_align_product_fronts` ajoute le stock non négatif et la fenêtre de
promotion nécessaires aux contrats Admin et boutique.

Le bucket `product-media` est créé par la migration additive
`0003_product_media_storage`. L’endpoint protégé
`POST /api/v1/media/product-upload-url` délivre un ticket PUT signé pour une
image produit (JPEG, PNG, WebP ou AVIF, 5 Mo maximum). L’URL publique retournée
est ensuite enregistrée dans `product_images` lors de la sauvegarde du produit.

La migration additive `0010_volatile_jubilee` ajoute les témoignages éditoriaux
gérés par l’Admin, séparés des futurs avis soumis par les clients :

- `GET|POST /api/v1/testimonials` (permission `reviews.moderate`)
- `GET|PATCH|DELETE /api/v1/testimonials/:id` (permission `reviews.moderate`)
- `GET /api/v1/public/testimonials` (public, publiés uniquement, maximum 12)

Un témoignage conserve une note entière de 1 à 5, un nom, un gouvernorat et un
texte. Le produit associé est facultatif ; lorsqu’il existe, l’API renvoie son
slug et conserve aussi son titre instantané. La table privée `app.testimonials`
active RLS et révoque les rôles `anon` et `authenticated`.

Le seed de développement est explicite et désactivé par défaut :

```bash
bun run seed:dev
```

Il refuse de s’exécuter en production et requiert les trois variables
`DEV_SEED_*`.

## Authentification et permissions

Routes :

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/invitations/:token/accept` (public, usage unique, 24 h)

Les JWT ne sont jamais retournés dans le JSON et ne doivent pas être stockés
dans `localStorage`. Les cookies utilisent `HttpOnly`, `SameSite=Strict` et
doivent utiliser `Secure` en environnement distant. Les refresh tokens sont
hashés en base, rotatifs et révocables.

Rôles contractuels :

- `super_admin`
- `admin`
- `operateur`
- `lecture_seule`

La matrice de permissions est définie côté serveur dans
`src/auth/permissions.ts`. Les routes sensibles sont limitées en débit.

## Équipe et invitations

La gestion de l’équipe est réservée à `super_admin` :

- `GET /api/v1/admin/team`
- `POST /api/v1/admin/team/invitations`
- `POST /api/v1/admin/team/invitations/:id/resend`
- `DELETE /api/v1/admin/team/invitations/:id`
- `PATCH /api/v1/admin/team/:id`

Une invitation stocke uniquement un hash SHA-256 du jeton, expire après 24
heures et devient inutilisable dès son acceptation. Le mot de passe est choisi
sur l’espace Admin puis hashé avec Argon2id côté API. Brevo est utilisé côté
serveur pour envoyer le lien ; aucun jeton n’est renvoyé dans les réponses API.
L’API synchronise automatiquement l’e-mail invité avec un groupe Cloudflare
Access dédié. La politique Access autorise ce groupe et le super-administrateur
principal ; le jeton Cloudflare reste uniquement côté serveur.

## Catalogue V1

Toutes les routes suivantes nécessitent une session admin. Les lectures
requièrent `products.read`, les écritures `products.write`.

- `/api/v1/brands`
- `/api/v1/categories`
- `PATCH /api/v1/categories/reorder`
- `/api/v1/attributes`
- `/api/v1/attributes/:id/values`
- `/api/v1/attribute-values/:id`
- `/api/v1/products`
- `PATCH /api/v1/products/:id/status`

Les lectures publiques ne nécessitent aucune session et ne retournent que les
produits publiés avec un stock positif :

- `GET /api/v1/public/products`
- `GET /api/v1/public/products/:slug`

Les collections acceptent pagination, recherche, filtres et tri. Les DTO sont
stricts et rejettent les propriétés inconnues. Le backend valide notamment :

- la marque obligatoire ;
- l’existence des catégories, attributs et valeurs ;
- une valeur pour un attribut simple ;
- plusieurs valeurs possibles uniquement pour `multiselect` ;
- un `swatch` hexadécimal pour les valeurs de couleur ;
- les cycles de catégories ;
- les prix entiers positifs ou nuls ;
- un stock entier positif ou nul ;
- une promotion active avec prix barré supérieur au prix courant et date de
  fin obligatoire.

## Validation

```bash
bun run lint
bun run format:check
bun run typecheck
bun run test:ci
bun run build
```

Avec l’API locale démarrée et Supabase Development configuré, le smoke test
réel est disponible via `bun run test:dev-db`. Il crée puis supprime uniquement
ses propres données temporaires.

Les tests unitaires couvrent l’authentification, la rotation des sessions, la
matrice de permissions et les règles du catalogue. Les tests d’intégration
exercent les routes auth, marques, catégories, attributs, produits et le
handler serverless Vercel.

## Runtime Vercel

`api/index.ts` initialise NestJS sans `app.listen()` et réutilise
l’application entre les invocations chaudes. Le rewrite existant expose
`GET /api/health` sur Vercel, tandis que les routes V1 conservent leur préfixe
`/api/v1`.

Aucun déploiement, domaine ou ressource Vercel n’est créé par cette version.

## Limites connues de cette étape

- aucune commande, client, checkout ou paiement ;
- aucun ledger de mouvements de stock ;
- aucune promotion catalogue distincte des promotions produit ;
- aucun upload média réel ; `MediaProvider` est seulement une abstraction ;
- aucune intégration Supabase Auth, Storage, Brevo, WhatsApp ou Cloudflare ;
- aucune migration n’est appliquée automatiquement ;
- aucun frontend n’est connecté.

Avant la Preview, il reste à remplacer les services catalogue mockés de
l’Admin et les fixtures produits de la boutique par ces endpoints, puis à
configurer les origines/cookies Preview. La Production exige une base Supabase
séparée et ses propres secrets.
