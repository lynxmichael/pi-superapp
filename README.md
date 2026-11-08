# pi-superapp

Déposer et retirer des Pi simplement, puis les utiliser dans des services. L'accueil reste simple : le solde, **Déposer**, **Retirer**, six services et l'historique.

- **Connexion** : un bouton « Se connecter avec Pi » (SDK Pi), sans mot de passe ni email.
- **Dépôt** : l'utilisateur paie depuis son wallet Pi ; le serveur vérifie le paiement auprès de Pi puis crédite le solde (une seule fois).
- **Retrait** : le montant est réservé tout de suite, un admin valide sur `/admin/retraits`, les Pi partent vers le wallet Pi de l'utilisateur. En cas de refus, les Pi sont rendus.

## Services (tous payés avec le solde)

| Service | Fonctionnement |
| --- | --- |
| **Marché** | Les vendeurs vérifiés (KYC) publient des produits. À l'achat, les Pi de l'acheteur sont **bloqués** jusqu'à ce qu'il confirme la réception ; le vendeur est alors payé (moins la commission). Annulation = remboursement. En cas de litige, l'admin rembourse ou paie le vendeur. |
| **Recharge et factures** | Crédit mobile, internet, électricité, eau, TV. Prix en Pi calculé avec le taux fixé par l'admin. Les Pi sont bloqués ; l'admin fait la recharge **à la main** puis clique « Fait », ou « Refuser » (remboursement). Fermé tant qu'aucun taux n'est fixé. |
| **Réserver** | Offres de commerçants vérifiés (hôtel, restaurant, transport...). Pi bloqués jusqu'à ce que le commerçant accepte (il est payé) ou refuse (remboursé). |
| **Abonnements** | Offres payées à la semaine, au mois ou à l'an ; chaque paiement prolonge l'abonnement. |
| **Jeux** | Calcul éclair et Mémoire, avec classement. **Aucun gain ni perte de Pi.** |
| **Fichiers** | Stockage privé par utilisateur (quota `FILES_QUOTA_MB`). |
| **KYC** | Dans « Mon compte ». Obligatoire pour vendre ou proposer des offres. Documents privés : seuls les admins les voient, après connexion. |

L'admin (`/admin/retraits`) a des onglets **Retraits**, **Recharges à faire**, **Litiges**, **Réglages** (taux des recharges, commissions) et un lien vers les **vérifications KYC** (`/admin/users`). Le chiffre « Minimum à garder sur le wallet de l'app » compte les soldes, les retraits en attente et tous les Pi bloqués.

## Installation

```bash
npm install
cp .env.example .env   # puis remplissez les valeurs
npm run dev
```

Il faut MongoDB (local ou Atlas) et Node 18+.

## Configuration Pi (portail développeur `develop.pinet.com` dans le Pi Browser)

1. Créez l'app. Dans la configuration, mettez l'**URL de développement** à `http://localhost:3000`.
2. Copiez la **clé API** dans `PI_API_KEY`.
3. Créez le **wallet de l'app** et mettez sa seed privée (commence par `S`) dans `PI_WALLET_PRIVATE_SEED`. Elle sert à envoyer les retraits : ne la partagez jamais.

### Tester sur l'ordinateur (bac à sable Pi)

1. `PI_SANDBOX=true` dans `.env`, puis `npm run dev`.
2. **N'ouvrez pas `http://localhost:3000` directement** : le SDK Pi n'y fonctionne pas (erreur « postMessage … app-cdn.minepi.com »).
3. Ouvrez dans le navigateur de l'ordinateur l'**URL du bac à sable** affichée dans le portail (section « Run Development App in the Sandbox », elle commence par `https://sandbox.minepi.com`).
4. La page affiche un code. Sur le téléphone, dans l'app Pi : menu ☰ → **Pi Utilities** → **Authorize Sandbox** en bas, puis saisissez le code.
5. L'application s'affiche dans le bac à sable : « Se connecter avec Pi » fonctionne.

En production : `PI_SANDBOX=false`, URL de production configurée dans le portail, et ouverture dans le Pi Browser.

Le wallet de l'app doit toujours contenir au moins le montant affiché dans « Minimum à garder sur le wallet de l'app » sur la page admin.

## Admin

- Mettez votre nom d'utilisateur Pi dans `ADMIN_PI_USERNAMES` : en vous connectant avec Pi, vous voyez le lien « Valider les retraits ».
- Ou, depuis un ordinateur : créez un compte admin avec code PIN sur `/admin/auth` (code `ADMIN_REGISTRATION_CODE`).

Sur `/admin/retraits` : « Envoyer » (deux clics pour confirmer) ou « Refuser » avec un motif visible par l'utilisateur. Un envoi qui échoue (wallet de l'app vide, réseau...) reste en « Échec, à réessayer » : les fonds de l'utilisateur restent réservés.

## Tests

```bash
npm test
```

Les tests utilisent un faux serveur Pi et deux bases MongoDB locales de test (`pi-superapp-test` et `pi-superapp-test-services`, vidées à chaque lancement). Ils couvrent : connexion, dépôt crédité une seule fois, retraits concurrents, envoi, refus avec remboursement ; KYC et documents privés ; achat avec Pi bloqués, confirmation, annulation, litige, dernier exemplaire disputé par deux acheteurs ; recharges ; réservations ; abonnements ; jeux sans Pi ; fichiers privés et quota.

## Fichiers principaux

| Rôle | Fichier |
| --- | --- |
| Écran utilisateur | `public/index.html`, `public/css/app.css`, `public/js/pi-app.js` |
| Écrans des services | `public/js/app/` (`market.js`, `seller.js`, `offers.js`, `recharge.js`, `games.js`, `files.js`, `account.js`) |
| Page admin | `public/admin-retraits.html`, `public/js/admin-retraits.js` |
| Dépôts / retraits | `routes/piRoutes.js`, `controllers/piController.js`, `services/piPlatform.js` |
| Paiements internes (débit, Pi bloqués, remboursement) | `services/ledger.js`, `models/PiOperation.js` |
| Services | `controllers/` et `routes/` : `marketplace`, `recharge`, `offer`, `game`, `files`, `account`, `adminServices` |

Les photos des produits et des offres sont rangées dans `uploads/products` (public). Les documents KYC (`uploads/kyc`) et les fichiers des utilisateurs (`uploads/files`) ne sont jamais servis publiquement. Pensez à sauvegarder le dossier `uploads/`.

## Anciens fichiers

L'ancienne connexion sans mot de passe, les transferts internes, l'ancien e-commerce et les anciens paiements ne sont plus branchés (`userRoutes`, `walletRoutes`, `paymentRoutes`, `transactionRoutes`, `ecommerceRoutes`, `reservationRoutes`, `subscriptionRoutes` et leurs contrôleurs). Leurs fichiers restent dans le dépôt mais ne servent plus.
