/* Mon compte : vérification d'identité (KYC) et accès aux activités. */
(function () {
    'use strict';
    var A = window.PiApp;
    var html = A.html;

    var KYC = {
        none: { title: 'Identité non vérifiée', text: 'Vérifiez votre identité pour vendre sur le marché et proposer des réservations ou des abonnements.', cls: 'notice-blue' },
        pending: { title: 'Vérification en cours', text: 'Notre équipe examine vos documents. Vous serez prévenu dès que c\'est fait.', cls: 'notice-wait' },
        approved: { title: 'Identité vérifiée', text: 'Vous pouvez vendre et proposer des offres.', cls: '' },
        rejected: { title: 'Vérification refusée', text: '', cls: 'notice-error' }
    };

    A.route('#/compte', async function (ctx) {
        var data = await A.request('/api/account');
        var acc = data.account;
        var k = acc.kyc;
        var t = KYC[k.status] || KYC.none;
        var user = A.state.user;

        A.mount(ctx, html`
            ${A.backLink('#/', 'Accueil')}
            <h1>Mon compte</h1>
            <p class="lead">@${acc.piUsername}</p>

            <div class="notice ${t.cls}">
                <strong>${t.title}</strong>
                ${k.status === 'rejected'
                    ? 'Motif : ' + (k.rejectionReason || 'non précisé') + '. Vous pouvez envoyer de nouveaux documents.'
                    : t.text}
            </div>
            ${k.status === 'none' || k.status === 'rejected'
                ? html`<a class="btn btn-main" href="#/compte/kyc">Vérifier mon identité</a>` : ''}
            ${k.status === 'approved'
                ? html`<a class="btn btn-main" href="#/vendeur">Mon espace vendeur</a>` : ''}

            <h2>Mes activités</h2>
            <ul class="menu-list">
                <li><a href="#/marche/achats">Mes achats <span aria-hidden="true">›</span></a></li>
                <li><a href="#/reserver/mes">Mes réservations <span aria-hidden="true">›</span></a></li>
                <li><a href="#/abonnements/mes">Mes abonnements <span aria-hidden="true">›</span></a></li>
                <li><a href="#/recharge">Mes recharges <span aria-hidden="true">›</span></a></li>
                <li><a href="#/fichiers">Mes fichiers <span aria-hidden="true">›</span></a></li>
            </ul>

            <div class="home-foot">
                ${user.role === 'admin' ? html`<a class="link" href="/admin/retraits">Administration</a>` : ''}
                <button class="link" type="button" data-act="logout">Se déconnecter</button>
            </div>
        `, {
            logout: function () { A.logout(); }
        });
    });

    A.route('#/compte/kyc', async function (ctx) {
        var data = await A.request('/api/account');
        var status = data.account.kyc.status;
        if (status === 'pending' || status === 'approved') {
            A.go('#/compte');
            return;
        }

        A.mount(ctx, html`
            ${A.backLink('#/compte', 'Mon compte')}
            <h1>Vérifier mon identité</h1>
            <p class="lead">Les informations doivent être exactement celles de votre pièce d'identité. Seule notre équipe voit vos documents.</p>

            <form class="form" data-form="send">
                <div class="two">
                    <label class="field"><span>Prénom</span><input name="firstName" required maxlength="50" autocomplete="given-name"></label>
                    <label class="field"><span>Nom</span><input name="lastName" required maxlength="50" autocomplete="family-name"></label>
                </div>
                <div class="two">
                    <label class="field"><span>Date de naissance</span><input name="dateOfBirth" type="date" required></label>
                    <label class="field"><span>Nationalité</span><input name="nationality" required maxlength="50" placeholder="Ivoirienne"></label>
                </div>
                <label class="field"><span>Adresse</span><input name="address" required maxlength="200" placeholder="Quartier, ville, pays"></label>
                <label class="field"><span>Téléphone</span><input name="phone" type="tel" required maxlength="20" placeholder="+225 07 00 00 00 00"></label>
                <div class="two">
                    <label class="field"><span>Pièce d'identité</span>
                        <select name="documentType" required>
                            <option value="id_card">Carte d'identité</option>
                            <option value="passport">Passeport</option>
                            <option value="driver_license">Permis de conduire</option>
                        </select>
                    </label>
                    <label class="field"><span>Numéro de la pièce</span><input name="documentNumber" required maxlength="40"></label>
                </div>
                <label class="field"><span>Photo du recto</span><input name="docFront" type="file" accept="image/*" capture="environment" required></label>
                <label class="field"><span>Photo du verso</span><input name="docBack" type="file" accept="image/*" capture="environment" required></label>
                <label class="field"><span>Selfie <small>(votre visage, de face, bien éclairé)</small></span><input name="selfie" type="file" accept="image/*" capture="user" required></label>
                <button class="btn btn-main" type="submit" data-busy="Envoi des documents…">Envoyer pour vérification</button>
            </form>
        `, {
            send: async function (form) {
                await A.request('/api/account/kyc', { method: 'POST', body: new FormData(form) });
                A.toast('Documents envoyés : notre équipe va les examiner.');
                A.go('#/compte');
            }
        });
    });
})();
