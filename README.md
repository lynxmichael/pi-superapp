# pi-superapp

Déposer et retirer des Pi, simplement. Un écran : le solde, un bouton **Déposer**, un bouton **Retirer**, l'historique.

- **Connexion** : un bouton « Se connecter avec Pi » (SDK Pi), sans mot de passe ni email.
- **Dépôt** : l'utilisateur paie depuis son wallet Pi ; le serveur vérifie le paiement auprès de Pi puis crédite le solde (une seule fois).
- **Retrait** : l'utilisateur demande un montant, qui est réservé tout de suite sur son solde. Un admin valide sur `/admin/retraits` et les Pi partent vers le wallet Pi de l'utilisateur. Si l'admin refuse, les Pi sont rendus.

## Installation

```bash
npm install
cp .env.example .env   # puis remplissez les valeurs
npm run dev
```

Il faut MongoDB (local ou Atlas) et Node 18+.

## Configuration Pi (portail développeur `develop.pi` dans le Pi Browser)

1. Créez l'app et indiquez l'URL du serveur (par exemple `https://votre-domaine.com`).
2. Copiez la **clé API** dans `PI_API_KEY`.
3. Créez le **wallet de l'app** et mettez sa seed privée (commence par `S`) dans `PI_WALLET_PRIVATE_SEED`. Elle sert à envoyer les retraits : ne la partagez jamais.
4. Pour tester : `PI_SANDBOX=true`, puis ouvrez l'URL du bac à sable donnée par le portail. En production : `PI_SANDBOX=false` et ouverture dans le Pi Browser.

Le wallet de l'app doit toujours contenir au moins le montant affiché dans « Minimum à garder sur le wallet de l'app » sur la page admin.

## Admin

- Mettez votre nom d'utilisateur Pi dans `ADMIN_PI_USERNAMES` : en vous connectant avec Pi, vous voyez le lien « Valider les retraits ».
- Ou, depuis un ordinateur : créez un compte admin avec code PIN sur `/admin/auth` (code `ADMIN_REGISTRATION_CODE`).

Sur `/admin/retraits` : « Envoyer » (deux clics pour confirmer) ou « Refuser » avec un motif visible par l'utilisateur. Un envoi qui échoue (wallet de l'app vide, réseau...) reste en « Échec, à réessayer » : les fonds de l'utilisateur restent réservés.

## Tests

```bash
npm test
```

Les tests utilisent un faux serveur Pi et une base MongoDB locale de test (`MONGODB_TEST_URI`, par défaut `mongodb://127.0.0.1:27017/pi-superapp-test`, vidée à chaque lancement). Ils couvrent : connexion, dépôt crédité une seule fois (même avec des confirmations simultanées), paiement d'un autre utilisateur refusé, retraits concurrents, envoi, échec puis nouvel essai, refus avec remboursement.

## Fichiers principaux

| Rôle | Fichier |
| --- | --- |
| Écran utilisateur | `public/index.html`, `public/css/app.css`, `public/js/pi-app.js` |
| Page admin des retraits | `public/admin-retraits.html`, `public/js/admin-retraits.js` |
| API dépôts / retraits | `routes/piRoutes.js`, `controllers/piController.js` |
| Appels à Pi | `services/piPlatform.js` |
| Historique des opérations | `models/PiOperation.js` |

## Anciens services

Marketplace, jeux, recharge, réservations, abonnements, fichiers et KYC sont toujours dans le code mais **désactivés** (`ENABLE_LEGACY_SERVICES=false`). Leur ancienne connexion ne demandait aucun mot de passe et leurs transferts acceptaient des montants négatifs : ne les réactivez pas en production sans les corriger.
