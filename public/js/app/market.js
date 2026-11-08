/* Marché : catalogue, fiche produit, achat (Pi bloqués jusqu'à réception) et suivi des achats. */
(function () {
    'use strict';
    var A = window.PiApp;
    var html = A.html;

    var CATEGORIES = {
        electronics: 'Électronique', fashion: 'Mode', home: 'Maison', sports: 'Sport',
        books: 'Livres', digital: 'Numérique', services: 'Services', other: 'Autres'
    };
    var CONDITIONS = { new: 'Neuf', used: 'Occasion', refurbished: 'Reconditionné' };

    A.market = { CATEGORIES: CATEGORIES, CONDITIONS: CONDITIONS };

    var filters = { q: '', category: '' };

    function productTile(p) {
        return html`
            <a class="tile" href="#/marche/produit/${p.id}">
                <div class="tile-img">${p.images[0] ? html`<img src="${p.images[0]}" alt="" loading="lazy">` : 'Pas de photo'}</div>
                <div class="tile-body">
                    <div class="tile-name">${p.name}</div>
                    <div class="tile-price">${A.pi(p.price)}</div>
                    <div class="tile-meta">${p.city || CATEGORIES[p.category]}</div>
                </div>
            </a>`;
    }

    A.route('#/marche', async function (ctx) {
        var params = new URLSearchParams();
        if (filters.q) params.set('q', filters.q);
        if (filters.category) params.set('category', filters.category);
        var data = await A.request('/api/market/products?' + params.toString());

        A.mount(ctx, html`
            ${A.backLink('#/', 'Accueil')}
            <h1>Marché</h1>
            <p class="lead">Payez avec votre solde. Vos Pi restent bloqués jusqu'à ce que vous confirmiez la réception.</p>
            <div class="toolbar">
                <a class="btn-small btn-line" href="#/marche/achats">Mes achats</a>
                <a class="btn-small btn-green" href="#/vendeur/produits">Vendre</a>
            </div>
            <form data-form="search" role="search">
                <input class="search" name="q" type="search" placeholder="Rechercher un produit" value="${filters.q}" enterkeyhint="search">
            </form>
            <div class="chips scroll">
                <button class="chip ${filters.category ? '' : 'is-on'}" type="button" data-act="cat" data-cat="">Tout</button>
                ${Object.keys(CATEGORIES).map(function (c) {
                    return html`<button class="chip ${filters.category === c ? 'is-on' : ''}" type="button" data-act="cat" data-cat="${c}">${CATEGORIES[c]}</button>`;
                })}
            </div>
            ${data.products.length
                ? html`<div class="grid">${data.products.map(productTile)}</div>`
                : html`<p class="empty">Aucun produit pour l'instant${filters.q || filters.category ? ' avec ces critères' : ''}.</p>`}
        `, {
            search: function (form) {
                filters.q = form.q.value.trim();
                A.go('#/marche');
            },
            cat: function (el) {
                filters.category = el.dataset.cat;
                A.go('#/marche');
            }
        });
    });

    A.route('#/marche/produit/:id', async function (ctx) {
        var data = await A.request('/api/market/products/' + encodeURIComponent(ctx.params.id));
        var p = data.product;
        var balance = A.state.user.balance;

        A.mount(ctx, html`
            ${A.backLink('#/marche', 'Marché')}
            ${p.images.length ? html`<div class="hero-img"><img id="heroImg" src="${p.images[0]}" alt=""></div>` : ''}
            ${p.images.length > 1 ? html`<div class="thumbs">${p.images.map(function (src, i) {
                return html`<img src="${src}" alt="Photo ${i + 1}" class="${i === 0 ? 'is-on' : ''}" data-act="photo">`;
            })}</div>` : ''}
            <h1>${p.name}</h1>
            <div class="price-big">${A.pi(p.price)}</div>
            <p class="facts">${CONDITIONS[p.condition]}${p.city ? ', ' + p.city : ''}. Vendu par @${p.seller.piUsername}. ${p.stock} disponible${p.stock > 1 ? 's' : ''}.</p>
            <p class="desc">${p.description}</p>

            ${data.mine
                ? html`<div class="notice"><strong>C'est votre produit</strong><a href="#/vendeur/produit/${p.id}">Le modifier</a></div>`
                : p.stock < 1 ? html`<div class="notice notice-wait">Plus de stock pour le moment.</div>`
                : html`
                <form class="buy-box form" data-form="buy">
                    <label class="field"><span>Quantité</span>
                        <input name="quantity" type="number" min="1" max="${Math.min(p.stock, 100)}" value="1" required inputmode="numeric">
                    </label>
                    <label class="field"><span>Livraison ou retrait <small>(adresse, téléphone, disponibilités)</small></span>
                        <textarea name="deliveryNote" required minlength="5" maxlength="500" placeholder="Cocody Angré, 07 00 00 00 00, après 17 h"></textarea>
                    </label>
                    <p class="summary" id="buySummary">Total : ${A.pi(p.price)}. Votre solde : ${A.pi(balance)}.</p>
                    <button class="btn btn-main" type="submit" data-busy="Paiement…">Acheter pour ${A.pi(p.price)}</button>
                    <p class="sheet-help">Le vendeur n'est payé que lorsque vous confirmez avoir reçu le produit.</p>
                </form>`}
        `, {
            photo: function (el) {
                ctx.view.querySelector('#heroImg').src = el.src;
                ctx.view.querySelectorAll('.thumbs img').forEach(function (i) { i.classList.toggle('is-on', i === el); });
            },
            $input: function (target) {
                if (target.name !== 'quantity') return;
                var q = Math.max(1, parseInt(target.value, 10) || 1);
                var total = A.round7(p.price * q);
                ctx.view.querySelector('#buySummary').textContent = 'Total : ' + A.pi(total) + '. Votre solde : ' + A.pi(balance) + '.';
                ctx.view.querySelector('form[data-form="buy"] button[type="submit"]').textContent = 'Acheter pour ' + A.pi(total);
            },
            buy: async function (form) {
                await A.request('/api/market/products/' + p.id + '/buy', {
                    method: 'POST',
                    body: { quantity: parseInt(form.quantity.value, 10), deliveryNote: form.deliveryNote.value }
                });
                await A.refresh();
                A.toast('Achat payé. Vos Pi sont bloqués jusqu\'à la réception.');
                A.go('#/marche/achats');
            }
        });
    });

    var BUYER_STATUS = {
        paid: ['Payé, en attente d\'envoi', 'st-wait'],
        shipped: ['Envoyé par le vendeur', 'st-wait'],
        completed: ['Reçu, vendeur payé', 'st-ok'],
        cancelled: ['Annulé, Pi rendus', 'st-no'],
        disputed: ['Litige en cours d\'examen', 'st-wait']
    };

    A.orderStatus = function (o) {
        if (o.resolution === 'release') return ['Litige : vendeur payé', 'st-ok'];
        if (o.resolution === 'refund') return ['Litige : remboursé', 'st-no'];
        return BUYER_STATUS[o.status] || [o.status, 'st-wait'];
    };

    A.route('#/marche/achats', async function (ctx) {
        var data = await A.request('/api/market/orders?role=buyer');

        function row(o) {
            var st = A.orderStatus(o);
            var open = o.status === 'paid' || o.status === 'shipped';
            return html`
                <li class="row" data-box>
                    <div class="row-head">
                        <a class="row-title" href="#/marche/produit/${o.product}">${o.productName}${o.quantity > 1 ? ' ×' + o.quantity : ''}</a>
                        <span class="row-amount">${A.pi(o.total)}</span>
                    </div>
                    <div class="row-meta">Vendeur @${o.seller}, ${A.date(o.createdAt)}</div>
                    ${o.shippingNote ? html`<div class="row-meta">Message du vendeur : ${o.shippingNote}</div>` : ''}
                    ${o.cancelReason && o.status === 'cancelled' ? html`<div class="row-meta">Motif : ${o.cancelReason}</div>` : ''}
                    <span class="pill ${st[1]}">${st[0]}</span>
                    ${open ? html`
                        <div class="row-actions">
                            <button class="btn-small btn-green" type="button" data-act="confirm" data-id="${o.id}">J'ai reçu le produit</button>
                            ${o.status === 'paid' ? html`<button class="btn-small btn-line" type="button" data-act="cancel" data-id="${o.id}">Annuler</button>` : ''}
                            <button class="btn-small btn-danger" type="button" data-act="dispute" data-id="${o.id}">Signaler un problème</button>
                        </div>` : ''}
                </li>`;
        }

        A.mount(ctx, html`
            ${A.backLink('#/marche', 'Marché')}
            <h1>Mes achats</h1>
            ${data.orders.length ? html`<ul class="rows">${data.orders.map(row)}</ul>`
                : html`<p class="empty">Vous n'avez encore rien acheté. <a href="#/marche">Voir le marché</a></p>`}
        `, {
            confirm: async function (el) {
                if (!A.confirmFirst(el, 'Confirmer : le vendeur sera payé')) return;
                await A.request('/api/market/orders/' + el.dataset.id + '/confirm', { method: 'POST' });
                A.toast('Merci ! Le vendeur a été payé.');
                A.go('#/marche/achats');
            },
            cancel: async function (el) {
                if (!A.confirmFirst(el, 'Confirmer l\'annulation')) return;
                await A.request('/api/market/orders/' + el.dataset.id + '/cancel', { method: 'POST', body: { reason: 'Annulé par l\'acheteur' } });
                await A.refresh();
                A.toast('Commande annulée : vos Pi sont revenus sur votre solde.');
                A.go('#/marche/achats');
            },
            dispute: function (el) {
                var box = el.closest('.row');
                if (box.querySelector('.inline-form')) return;
                box.insertAdjacentHTML('beforeend', A.html`
                    <form class="inline-form" data-form="disputeSend" data-id="${el.dataset.id}">
                        <textarea name="reason" required minlength="5" maxlength="300" placeholder="Que s'est-il passé ? (jamais reçu, produit différent...)"></textarea>
                        <button class="btn-small btn-danger" type="submit">Ouvrir un litige</button>
                    </form>`.s);
                box.querySelector('textarea').focus();
            },
            disputeSend: async function (form) {
                await A.request('/api/market/orders/' + form.dataset.id + '/dispute', { method: 'POST', body: { reason: form.reason.value } });
                A.toast('Litige ouvert : notre équipe va trancher. Vos Pi restent bloqués.');
                A.go('#/marche/achats');
            }
        });
    });
})();
