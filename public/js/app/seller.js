/* Espace vendeur / commerçant : produits, ventes, offres, réservations reçues, abonnés. */
(function () {
    'use strict';
    var A = window.PiApp;
    var html = A.html;

    var OFFER_CATEGORIES = {
        hotel: 'Hôtel', restaurant: 'Restaurant', transport: 'Transport', event: 'Événement',
        sport: 'Sport', beauty: 'Beauté', education: 'Formation', other: 'Autre'
    };
    var PERIODS = { week: 'semaine', month: 'mois', year: 'an' };
    A.offers = { CATEGORIES: OFFER_CATEGORIES, PERIODS: PERIODS };

    /** Affiche l'invitation à vérifier l'identité si besoin. Renvoie true si on peut continuer. */
    function needVerified(ctx, back) {
        var status = A.state.user.kycStatus;
        if (A.state.user.verified) return true;
        A.mount(ctx, html`
            ${A.backLink(back || '#/', 'Retour')}
            <h1>Espace vendeur</h1>
            <div class="notice ${status === 'pending' ? 'notice-wait' : 'notice-blue'}">
                <strong>${status === 'pending' ? 'Vérification en cours' : 'Vérifiez d\'abord votre identité'}</strong>
                ${status === 'pending'
                    ? 'Vous pourrez vendre dès que notre équipe aura validé vos documents.'
                    : 'Pour protéger les acheteurs, seuls les vendeurs et commerçants vérifiés peuvent publier.'}
            </div>
            ${status !== 'pending' ? html`<a class="btn btn-main" href="#/compte/kyc">Vérifier mon identité</a>` : ''}
        `);
        return false;
    }

    function options(map, selected) {
        return Object.keys(map).map(function (k) {
            return html`<option value="${k}" ${k === selected ? 'selected' : ''}>${map[k]}</option>`;
        });
    }

    // ------------------------------------------------------------------
    // Accueil vendeur
    // ------------------------------------------------------------------

    A.route('#/vendeur', async function (ctx) {
        await A.refresh();
        if (!needVerified(ctx, '#/compte')) return;
        var r = await Promise.all([
            A.request('/api/market/my/products'),
            A.request('/api/market/orders?role=seller'),
            A.request('/api/offers/mine'),
            A.request('/api/offers/bookings?role=merchant'),
            A.request('/api/offers/memberships?role=merchant')
        ]);
        var toShip = r[1].orders.filter(function (o) { return o.status === 'paid'; }).length;
        var toAnswer = r[3].bookings.filter(function (b) { return b.status === 'pending'; }).length;
        var activeSubs = r[4].memberships.filter(function (m) { return m.active; }).length;
        var count = function (n) { return n ? html`<span class="count">${n}</span>` : html`<span aria-hidden="true">›</span>`; };

        A.mount(ctx, html`
            ${A.backLink('#/compte', 'Mon compte')}
            <h1>Espace vendeur</h1>
            <p class="lead">Vos produits, vos offres et ce que vos clients attendent de vous.</p>
            <ul class="menu-list">
                <li><a href="#/vendeur/ventes">Ventes à envoyer ${count(toShip)}</a></li>
                <li><a href="#/vendeur/reservations">Réservations à accepter ${count(toAnswer)}</a></li>
                <li><a href="#/vendeur/produits">Mes produits (${r[0].products.length}) <span aria-hidden="true">›</span></a></li>
                <li><a href="#/vendeur/offres">Mes offres de réservation et d'abonnement (${r[2].offers.length}) <span aria-hidden="true">›</span></a></li>
                <li><a href="#/vendeur/abonnes">Mes abonnés actifs (${activeSubs}) <span aria-hidden="true">›</span></a></li>
            </ul>
        `);
    });

    // ------------------------------------------------------------------
    // Produits
    // ------------------------------------------------------------------

    A.route('#/vendeur/produits', async function (ctx) {
        if (!needVerified(ctx, '#/marche')) return;
        var data = await A.request('/api/market/my/products');
        A.mount(ctx, html`
            ${A.backLink('#/vendeur', 'Espace vendeur')}
            <h1>Mes produits</h1>
            <a class="btn btn-main" href="#/vendeur/produit/nouveau">Ajouter un produit</a>
            ${data.products.length ? html`<ul class="rows">${data.products.map(function (p) {
                return html`
                    <li class="row">
                        <div class="row-head">
                            <a class="row-title" href="#/vendeur/produit/${p.id}">${p.name}</a>
                            <span class="row-amount">${A.pi(p.price)}</span>
                        </div>
                        <div class="row-meta">${p.stock} en stock, ${p.sales} vendu${p.sales > 1 ? 's' : ''}</div>
                        <span class="pill ${p.status === 'active' ? 'st-ok' : 'st-wait'}">${p.status === 'active' ? 'En vente' : 'Masqué'}</span>
                    </li>`;
            })}</ul>` : html`<p class="empty">Aucun produit pour l'instant.</p>`}
        `);
    });

    function productForm(p) {
        var M = A.market;
        return html`
            <form class="form" data-form="save">
                <label class="field"><span>Nom du produit</span><input name="name" required minlength="2" maxlength="120" value="${p.name || ''}"></label>
                <label class="field"><span>Description</span><textarea name="description" required minlength="5" maxlength="2000">${p.description || ''}</textarea></label>
                <div class="two">
                    <label class="field"><span>Prix (π)</span><input name="price" required inputmode="decimal" value="${p.price != null ? String(p.price).replace('.', ',') : ''}" placeholder="10"></label>
                    <label class="field"><span>Quantité disponible</span><input name="stock" type="number" min="0" max="10000" required value="${p.stock != null ? p.stock : 1}"></label>
                </div>
                <div class="two">
                    <label class="field"><span>Catégorie</span><select name="category">${options(M.CATEGORIES, p.category || 'other')}</select></label>
                    <label class="field"><span>État</span><select name="condition">${options(M.CONDITIONS, p.condition || 'new')}</select></label>
                </div>
                <label class="field"><span>Ville</span><input name="city" maxlength="80" value="${p.city || ''}" placeholder="Abidjan"></label>
                <label class="field"><span>Photos <small>(jusqu'à 4${p.id ? ' ; en choisir remplace les anciennes' : ''})</small></span><input name="images" type="file" accept="image/*" multiple></label>
                ${p.id ? html`<label class="field"><span>Visibilité</span>
                    <select name="status"><option value="active" ${p.status === 'active' ? 'selected' : ''}>En vente</option><option value="inactive" ${p.status !== 'active' ? 'selected' : ''}>Masqué</option></select></label>` : ''}
                <button class="btn btn-main" type="submit" data-busy="Enregistrement…">${p.id ? 'Enregistrer' : 'Publier le produit'}</button>
            </form>`;
    }

    async function saveProduct(form, id) {
        var fd = new FormData(form);
        if (!form.images.files.length) fd.delete('images');
        var r = await A.request(id ? '/api/market/products/' + id : '/api/market/products', { method: id ? 'PUT' : 'POST', body: fd });
        A.toast(id ? 'Produit enregistré.' : 'Produit publié.');
        A.go('#/vendeur/produits');
        return r;
    }

    A.route('#/vendeur/produit/nouveau', async function (ctx) {
        if (!needVerified(ctx, '#/marche')) return;
        A.mount(ctx, html`
            ${A.backLink('#/vendeur/produits', 'Mes produits')}
            <h1>Nouveau produit</h1>
            ${productForm({})}
        `, { save: function (form) { return saveProduct(form, null); } });
    });

    A.route('#/vendeur/produit/:id', async function (ctx) {
        var data = await A.request('/api/market/products/' + encodeURIComponent(ctx.params.id));
        if (!data.mine) { A.go('#/marche/produit/' + ctx.params.id); return; }
        var p = data.product;
        A.mount(ctx, html`
            ${A.backLink('#/vendeur/produits', 'Mes produits')}
            <h1>Modifier le produit</h1>
            ${productForm(p)}
            <p><button class="btn-small btn-danger" type="button" data-act="remove">Supprimer ce produit</button></p>
        `, {
            save: function (form) { return saveProduct(form, p.id); },
            remove: async function (el) {
                if (!A.confirmFirst(el, 'Confirmer la suppression')) return;
                await A.request('/api/market/products/' + p.id, { method: 'DELETE' });
                A.toast('Produit supprimé.');
                A.go('#/vendeur/produits');
            }
        });
    });

    // ------------------------------------------------------------------
    // Ventes
    // ------------------------------------------------------------------

    A.route('#/vendeur/ventes', async function (ctx) {
        var data = await A.request('/api/market/orders?role=seller');
        var SELLER_STATUS = {
            paid: ['À envoyer', 'st-wait'],
            shipped: ['Envoyé, en attente de confirmation', 'st-wait'],
            completed: ['Terminé, vous avez été payé', 'st-ok'],
            cancelled: ['Annulé, acheteur remboursé', 'st-no'],
            disputed: ['Litige en cours d\'examen', 'st-wait']
        };

        function row(o) {
            var st = o.resolution ? A.orderStatus(o) : SELLER_STATUS[o.status];
            return html`
                <li class="row" data-box>
                    <div class="row-head">
                        <span class="row-title">${o.productName}${o.quantity > 1 ? ' ×' + o.quantity : ''}</span>
                        <span class="row-amount">${A.pi(o.status === 'completed' && o.sellerAmount != null ? o.sellerAmount : o.total)}</span>
                    </div>
                    <div class="row-meta">Acheteur @${o.buyer}, ${A.date(o.createdAt)}</div>
                    <div class="row-meta">Livraison : ${o.deliveryNote}</div>
                    ${o.disputeReason ? html`<div class="row-meta">Problème signalé : ${o.disputeReason}</div>` : ''}
                    <span class="pill ${st[1]}">${st[0]}</span>
                    ${o.status === 'paid' || o.status === 'shipped' ? html`
                        <div class="row-actions">
                            ${o.status === 'paid' ? html`<button class="btn-small btn-green" type="button" data-act="ship" data-id="${o.id}">Marquer comme envoyé</button>` : ''}
                            <button class="btn-small btn-danger" type="button" data-act="cancel" data-id="${o.id}">Annuler et rembourser</button>
                        </div>` : ''}
                </li>`;
        }

        A.mount(ctx, html`
            ${A.backLink('#/vendeur', 'Espace vendeur')}
            <h1>Mes ventes</h1>
            <p class="lead">Vous êtes payé quand l'acheteur confirme la réception${A.state.settings.marketCommissionPercent ? ', moins ' + A.state.settings.marketCommissionPercent + ' % de commission' : ''}.</p>
            ${data.orders.length ? html`<ul class="rows">${data.orders.map(row)}</ul>` : html`<p class="empty">Aucune vente pour l'instant.</p>`}
        `, {
            ship: function (el) {
                var box = el.closest('.row');
                if (box.querySelector('.inline-form')) return;
                box.insertAdjacentHTML('beforeend', A.html`
                    <form class="inline-form" data-form="shipSend" data-id="${el.dataset.id}">
                        <input name="note" maxlength="300" placeholder="Message pour l'acheteur (facultatif) : livreur, date...">
                        <button class="btn-small btn-green" type="submit">Confirmer l'envoi</button>
                    </form>`.s);
            },
            shipSend: async function (form) {
                await A.request('/api/market/orders/' + form.dataset.id + '/ship', { method: 'POST', body: { note: form.note.value } });
                A.toast('Commande marquée comme envoyée.');
                A.go('#/vendeur/ventes');
            },
            cancel: async function (el) {
                if (!A.confirmFirst(el, 'Confirmer : l\'acheteur sera remboursé')) return;
                await A.request('/api/market/orders/' + el.dataset.id + '/cancel', { method: 'POST', body: { reason: 'Annulé par le vendeur' } });
                A.toast('Commande annulée, acheteur remboursé.');
                A.go('#/vendeur/ventes');
            }
        });
    });

    // ------------------------------------------------------------------
    // Offres (réservations et abonnements)
    // ------------------------------------------------------------------

    A.route('#/vendeur/offres', async function (ctx) {
        if (!needVerified(ctx, '#/vendeur')) return;
        var data = await A.request('/api/offers/mine');
        A.mount(ctx, html`
            ${A.backLink('#/vendeur', 'Espace vendeur')}
            <h1>Mes offres</h1>
            <a class="btn btn-main" href="#/vendeur/offre/nouvelle">Nouvelle offre</a>
            ${data.offers.length ? html`<ul class="rows">${data.offers.map(function (o) {
                return html`
                    <li class="row">
                        <div class="row-head">
                            <a class="row-title" href="#/vendeur/offre/${o.id}">${o.title}</a>
                            <span class="row-amount">${A.pi(o.price)}</span>
                        </div>
                        <div class="row-meta">${o.kind === 'booking' ? 'Réservation, par ' + (o.unit || 'personne') : 'Abonnement, par ' + PERIODS[o.period]}</div>
                        <span class="pill ${o.status === 'active' ? 'st-ok' : 'st-wait'}">${o.status === 'active' ? 'Visible' : 'Masquée'}</span>
                    </li>`;
            })}</ul>` : html`<p class="empty">Aucune offre pour l'instant.</p>`}
        `);
    });

    function offerForm(o) {
        var kind = o.kind || 'booking';
        return html`
            <form class="form" data-form="save">
                ${o.id ? '' : html`
                <label class="field"><span>Type d'offre</span>
                    <select name="kind">
                        <option value="booking">Réservation (hôtel, table, billet, séance...)</option>
                        <option value="subscription">Abonnement (payé chaque semaine, mois ou an)</option>
                    </select>
                </label>`}
                <label class="field"><span>Titre</span><input name="title" required minlength="3" maxlength="120" value="${o.title || ''}" placeholder="Chambre double vue lagune"></label>
                <label class="field"><span>Description</span><textarea name="description" required minlength="10" maxlength="2000">${o.description || ''}</textarea></label>
                <div class="two">
                    <label class="field"><span>Catégorie</span><select name="category">${options(OFFER_CATEGORIES, o.category || 'other')}</select></label>
                    <label class="field"><span>Ville</span><input name="city" maxlength="80" value="${o.city || ''}"></label>
                </div>
                <div class="two">
                    <label class="field"><span>Prix (π)</span><input name="price" required inputmode="decimal" value="${o.price != null ? String(o.price).replace('.', ',') : ''}"></label>
                    <label class="field" data-kind="booking" ${kind === 'booking' ? '' : 'hidden'}><span>Prix par</span><input name="unit" maxlength="30" value="${o.unit || 'personne'}" placeholder="personne, nuit, billet..."></label>
                    <label class="field" data-kind="subscription" ${kind === 'subscription' ? '' : 'hidden'}><span>Durée payée</span><select name="period">${options({ month: 'Mois', week: 'Semaine', year: 'An' }, o.period || 'month')}</select></label>
                </div>
                <label class="field"><span>Photo <small>(facultative)</small></span><input name="image" type="file" accept="image/*"></label>
                ${o.id ? html`<label class="field"><span>Visibilité</span>
                    <select name="status"><option value="active" ${o.status === 'active' ? 'selected' : ''}>Visible</option><option value="inactive" ${o.status !== 'active' ? 'selected' : ''}>Masquée</option></select></label>` : ''}
                <button class="btn btn-main" type="submit" data-busy="Enregistrement…">${o.id ? 'Enregistrer' : 'Publier l\'offre'}</button>
            </form>`;
    }

    async function saveOffer(form, offer) {
        var fd = new FormData(form);
        var kind = offer ? offer.kind : form.kind.value;
        if (!form.image.files.length) fd.delete('image');
        if (kind === 'booking') fd.delete('period'); else fd.delete('unit');
        await A.request(offer ? '/api/offers/' + offer.id : '/api/offers', { method: offer ? 'PUT' : 'POST', body: fd });
        A.toast(offer ? 'Offre enregistrée.' : 'Offre publiée.');
        A.go('#/vendeur/offres');
    }

    function toggleKind(target, view) {
        if (target.name !== 'kind') return;
        view.querySelectorAll('[data-kind]').forEach(function (f) { f.hidden = f.dataset.kind !== target.value; });
    }

    A.route('#/vendeur/offre/nouvelle', async function (ctx) {
        if (!needVerified(ctx, '#/vendeur')) return;
        A.mount(ctx, html`
            ${A.backLink('#/vendeur/offres', 'Mes offres')}
            <h1>Nouvelle offre</h1>
            ${offerForm({})}
        `, {
            $change: function (t) { toggleKind(t, ctx.view); },
            save: function (form) { return saveOffer(form, null); }
        });
    });

    A.route('#/vendeur/offre/:id', async function (ctx) {
        var data = await A.request('/api/offers/' + encodeURIComponent(ctx.params.id));
        if (!data.mine) { A.go('#/offre/' + ctx.params.id); return; }
        var o = data.offer;
        A.mount(ctx, html`
            ${A.backLink('#/vendeur/offres', 'Mes offres')}
            <h1>Modifier l'offre</h1>
            ${offerForm(o)}
            <p><button class="btn-small btn-danger" type="button" data-act="remove">Supprimer cette offre</button></p>
        `, {
            save: function (form) { return saveOffer(form, o); },
            remove: async function (el) {
                if (!A.confirmFirst(el, 'Confirmer la suppression')) return;
                await A.request('/api/offers/' + o.id, { method: 'DELETE' });
                A.toast('Offre supprimée.');
                A.go('#/vendeur/offres');
            }
        });
    });

    // ------------------------------------------------------------------
    // Réservations reçues et abonnés
    // ------------------------------------------------------------------

    A.route('#/vendeur/reservations', async function (ctx) {
        var data = await A.request('/api/offers/bookings?role=merchant');
        var ST = {
            pending: ['À accepter ou refuser', 'st-wait'],
            confirmed: ['Acceptée, vous avez été payé', 'st-ok'],
            refused: ['Refusée, client remboursé', 'st-no'],
            cancelled: ['Annulée par le client', 'st-no']
        };
        A.mount(ctx, html`
            ${A.backLink('#/vendeur', 'Espace vendeur')}
            <h1>Réservations reçues</h1>
            <p class="lead">Le client a déjà payé : ses Pi sont bloqués. En acceptant, vous les recevez${A.state.settings.offersCommissionPercent ? ' (moins ' + A.state.settings.offersCommissionPercent + ' % de commission)' : ''}.</p>
            ${data.bookings.length ? html`<ul class="rows">${data.bookings.map(function (b) {
                var st = ST[b.status];
                return html`
                    <li class="row" data-box>
                        <div class="row-head">
                            <span class="row-title">${b.offerTitle}</span>
                            <span class="row-amount">${A.pi(b.status === 'confirmed' && b.merchantAmount != null ? b.merchantAmount : b.total)}</span>
                        </div>
                        <div class="row-meta">@${b.customer}, le ${A.day(b.date)}, ${b.quantity} ${b.unit || 'personne'}${b.quantity > 1 ? 's' : ''}</div>
                        ${b.note ? html`<div class="row-meta">Message : ${b.note}</div>` : ''}
                        <span class="pill ${st[1]}">${st[0]}</span>
                        ${b.status === 'pending' ? html`
                            <div class="row-actions">
                                <button class="btn-small btn-green" type="button" data-act="accept" data-id="${b.id}">Accepter</button>
                                <button class="btn-small btn-danger" type="button" data-act="refuse" data-id="${b.id}">Refuser</button>
                            </div>` : ''}
                    </li>`;
            })}</ul>` : html`<p class="empty">Aucune réservation pour l'instant.</p>`}
        `, {
            accept: async function (el) {
                if (!A.confirmFirst(el, 'Confirmer et recevoir les Pi')) return;
                await A.request('/api/offers/bookings/' + el.dataset.id + '/accept', { method: 'POST' });
                A.toast('Réservation acceptée : vous avez été payé.');
                A.go('#/vendeur/reservations');
            },
            refuse: function (el) {
                var box = el.closest('.row');
                if (box.querySelector('.inline-form')) return;
                box.insertAdjacentHTML('beforeend', A.html`
                    <form class="inline-form" data-form="refuseSend" data-id="${el.dataset.id}">
                        <input name="reason" maxlength="300" placeholder="Motif pour le client (complet, fermé ce jour...)">
                        <button class="btn-small btn-danger" type="submit">Refuser et rembourser</button>
                    </form>`.s);
            },
            refuseSend: async function (form) {
                await A.request('/api/offers/bookings/' + form.dataset.id + '/refuse', { method: 'POST', body: { reason: form.reason.value } });
                A.toast('Réservation refusée, client remboursé.');
                A.go('#/vendeur/reservations');
            }
        });
    });

    A.route('#/vendeur/abonnes', async function (ctx) {
        var data = await A.request('/api/offers/memberships?role=merchant');
        A.mount(ctx, html`
            ${A.backLink('#/vendeur', 'Espace vendeur')}
            <h1>Mes abonnés</h1>
            ${data.memberships.length ? html`<ul class="rows">${data.memberships.map(function (m) {
                return html`
                    <li class="row">
                        <div class="row-head"><span class="row-title">@${m.customer}</span><span class="row-amount">${A.pi(m.price)} / ${PERIODS[m.period]}</span></div>
                        <div class="row-meta">${m.offerTitle}, ${m.payments} paiement${m.payments > 1 ? 's' : ''}</div>
                        <span class="pill ${m.active ? 'st-ok' : 'st-no'}">${m.active ? 'Actif jusqu\'au ' + A.day(m.endDate) : 'Expiré le ' + A.day(m.endDate)}</span>
                    </li>`;
            })}</ul>` : html`<p class="empty">Aucun abonné pour l'instant.</p>`}
        `);
    });
})();
