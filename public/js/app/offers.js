/* Réserver et S'abonner auprès des commerçants vérifiés. */
(function () {
    'use strict';
    var A = window.PiApp;
    var html = A.html;
    var filters = { booking: { q: '', category: '' }, subscription: { q: '', category: '' } };

    function catalog(kind) {
        var isBooking = kind === 'booking';
        var hash = isBooking ? '#/reserver' : '#/abonnements';
        return async function (ctx) {
            var C = A.offers.CATEGORIES;
            var f = filters[kind];
            var params = new URLSearchParams({ kind: kind });
            if (f.q) params.set('q', f.q);
            if (f.category) params.set('category', f.category);
            var data = await A.request('/api/offers?' + params.toString());

            A.mount(ctx, html`
                ${A.backLink('#/', 'Accueil')}
                <h1>${isBooking ? 'Réserver' : 'Abonnements'}</h1>
                <p class="lead">${isBooking
                    ? 'Hôtels, restaurants, transport, événements... Vos Pi sont bloqués jusqu\'à ce que le commerçant accepte.'
                    : 'Payez à la semaine, au mois ou à l\'année auprès de commerçants vérifiés.'}</p>
                <div class="toolbar"><a class="btn-small btn-line" href="${hash}/mes">${isBooking ? 'Mes réservations' : 'Mes abonnements'}</a></div>
                <form data-form="search" role="search">
                    <input class="search" name="q" type="search" placeholder="Rechercher (nom, ville)" value="${f.q}" enterkeyhint="search">
                </form>
                <div class="chips scroll">
                    <button class="chip ${f.category ? '' : 'is-on'}" type="button" data-act="cat" data-cat="">Tout</button>
                    ${Object.keys(C).map(function (c) {
                        return html`<button class="chip ${f.category === c ? 'is-on' : ''}" type="button" data-act="cat" data-cat="${c}">${C[c]}</button>`;
                    })}
                </div>
                ${data.offers.length ? html`<div class="grid">${data.offers.map(function (o) {
                    return html`
                        <a class="tile" href="#/offre/${o.id}">
                            <div class="tile-img">${o.image ? html`<img src="${o.image}" alt="" loading="lazy">` : C[o.category]}</div>
                            <div class="tile-body">
                                <div class="tile-name">${o.title}</div>
                                <div class="tile-price">${A.pi(o.price)} / ${isBooking ? (o.unit || 'personne') : A.offers.PERIODS[o.period]}</div>
                                <div class="tile-meta">${o.city || C[o.category]}</div>
                            </div>
                        </a>`;
                })}</div>` : html`<p class="empty">Aucune offre pour l'instant${f.q || f.category ? ' avec ces critères' : ''}.</p>`}
            `, {
                search: function (form) { f.q = form.q.value.trim(); A.go(hash); },
                cat: function (el) { f.category = el.dataset.cat; A.go(hash); }
            });
        };
    }

    A.route('#/reserver', catalog('booking'));
    A.route('#/abonnements', catalog('subscription'));

    function today() {
        var d = new Date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 10);
    }

    A.route('#/offre/:id', async function (ctx) {
        var data = await A.request('/api/offers/' + encodeURIComponent(ctx.params.id));
        var o = data.offer;
        var C = A.offers.CATEGORIES;
        var isBooking = o.kind === 'booking';
        var unit = o.unit || 'personne';
        var balance = A.state.user.balance;

        A.mount(ctx, html`
            ${A.backLink(isBooking ? '#/reserver' : '#/abonnements', isBooking ? 'Réserver' : 'Abonnements')}
            ${o.image ? html`<div class="hero-img"><img src="${o.image}" alt=""></div>` : ''}
            <h1>${o.title}</h1>
            <div class="price-big">${A.pi(o.price)} <small>/ ${isBooking ? unit : A.offers.PERIODS[o.period]}</small></div>
            <p class="facts">${C[o.category]}${o.city ? ', ' + o.city : ''}. Proposé par @${o.merchant}, commerçant vérifié.</p>
            <p class="desc">${o.description}</p>

            ${data.mine ? html`<div class="notice"><strong>C'est votre offre</strong><a href="#/vendeur/offre/${o.id}">La modifier</a></div>`
            : isBooking ? html`
                <form class="buy-box form" data-form="book">
                    <div class="two">
                        <label class="field"><span>Date</span><input name="date" type="date" required min="${today()}" value="${today()}"></label>
                        <label class="field"><span>Nombre (${unit}s)</span><input name="quantity" type="number" min="1" max="50" value="1" required></label>
                    </div>
                    <label class="field"><span>Message au commerçant <small>(facultatif)</small></span><textarea name="note" maxlength="500" placeholder="Heure d'arrivée, demandes particulières..."></textarea></label>
                    <p class="summary" id="bookSummary">Total : ${A.pi(o.price)}. Votre solde : ${A.pi(balance)}.</p>
                    <button class="btn btn-main" type="submit" data-busy="Paiement…">Réserver pour ${A.pi(o.price)}</button>
                    <p class="sheet-help">Si le commerçant refuse, ou si vous annulez avant sa réponse, vos Pi vous sont rendus.</p>
                </form>`
            : html`
                <div class="buy-box" data-box>
                    <p class="summary">Paiement de ${A.pi(o.price)} pour 1 ${A.offers.PERIODS[o.period]}. Si vous êtes déjà abonné, la période s'ajoute à la suite.</p>
                    <button class="btn btn-main" type="button" data-act="subscribe">S'abonner pour ${A.pi(o.price)}</button>
                </div>`}
        `, {
            $input: function (t) {
                if (t.name !== 'quantity') return;
                var total = A.round7(o.price * Math.max(1, parseInt(t.value, 10) || 1));
                ctx.view.querySelector('#bookSummary').textContent = 'Total : ' + A.pi(total) + '. Votre solde : ' + A.pi(balance) + '.';
                ctx.view.querySelector('form[data-form="book"] button[type="submit"]').textContent = 'Réserver pour ' + A.pi(total);
            },
            book: async function (form) {
                await A.request('/api/offers/' + o.id + '/book', {
                    method: 'POST',
                    body: { date: form.date.value, quantity: parseInt(form.quantity.value, 10), note: form.note.value }
                });
                await A.refresh();
                A.toast('Réservation envoyée : le commerçant doit l\'accepter.');
                A.go('#/reserver/mes');
            },
            subscribe: async function (el) {
                if (!A.confirmFirst(el, 'Confirmer le paiement de ' + A.pi(o.price))) return;
                await A.request('/api/offers/' + o.id + '/subscribe', { method: 'POST' });
                await A.refresh();
                A.toast('Abonnement payé.');
                A.go('#/abonnements/mes');
            }
        });
    });

    A.route('#/reserver/mes', async function (ctx) {
        var data = await A.request('/api/offers/bookings?role=customer');
        var ST = {
            pending: ['En attente du commerçant', 'st-wait'],
            confirmed: ['Confirmée', 'st-ok'],
            refused: ['Refusée, Pi rendus', 'st-no'],
            cancelled: ['Annulée, Pi rendus', 'st-no']
        };
        A.mount(ctx, html`
            ${A.backLink('#/reserver', 'Réserver')}
            <h1>Mes réservations</h1>
            ${data.bookings.length ? html`<ul class="rows">${data.bookings.map(function (b) {
                var st = ST[b.status];
                return html`
                    <li class="row" data-box>
                        <div class="row-head"><a class="row-title" href="#/offre/${b.offer}">${b.offerTitle}</a><span class="row-amount">${A.pi(b.total)}</span></div>
                        <div class="row-meta">Le ${A.day(b.date)}, ${b.quantity} ${b.unit || 'personne'}${b.quantity > 1 ? 's' : ''}, chez @${b.merchant}</div>
                        ${b.refuseReason && b.status === 'refused' ? html`<div class="row-meta">Motif : ${b.refuseReason}</div>` : ''}
                        <span class="pill ${st[1]}">${st[0]}</span>
                        ${b.status === 'pending' ? html`<div class="row-actions"><button class="btn-small btn-line" type="button" data-act="cancel" data-id="${b.id}">Annuler</button></div>` : ''}
                    </li>`;
            })}</ul>` : html`<p class="empty">Aucune réservation. <a href="#/reserver">Voir les offres</a></p>`}
        `, {
            cancel: async function (el) {
                if (!A.confirmFirst(el, 'Confirmer l\'annulation')) return;
                await A.request('/api/offers/bookings/' + el.dataset.id + '/cancel', { method: 'POST' });
                await A.refresh();
                A.toast('Réservation annulée : vos Pi sont revenus sur votre solde.');
                A.go('#/reserver/mes');
            }
        });
    });

    A.route('#/abonnements/mes', async function (ctx) {
        var data = await A.request('/api/offers/memberships?role=customer');
        A.mount(ctx, html`
            ${A.backLink('#/abonnements', 'Abonnements')}
            <h1>Mes abonnements</h1>
            ${data.memberships.length ? html`<ul class="rows">${data.memberships.map(function (m) {
                return html`
                    <li class="row" data-box>
                        <div class="row-head"><a class="row-title" href="#/offre/${m.offer}">${m.offerTitle}</a><span class="row-amount">${A.pi(m.price)} / ${A.offers.PERIODS[m.period]}</span></div>
                        <div class="row-meta">Chez @${m.merchant}</div>
                        <span class="pill ${m.active ? 'st-ok' : 'st-no'}">${m.active ? 'Actif jusqu\'au ' + A.day(m.endDate) : 'Expiré le ' + A.day(m.endDate)}</span>
                        <div class="row-actions"><button class="btn-small btn-green" type="button" data-act="renew" data-id="${m.offer}" data-price="${m.price}">${m.active ? 'Prolonger' : 'Renouveler'}</button></div>
                    </li>`;
            })}</ul>` : html`<p class="empty">Aucun abonnement. <a href="#/abonnements">Voir les offres</a></p>`}
        `, {
            renew: async function (el) {
                if (!A.confirmFirst(el, 'Confirmer le paiement de ' + A.pi(Number(el.dataset.price)))) return;
                await A.request('/api/offers/' + el.dataset.id + '/subscribe', { method: 'POST' });
                await A.refresh();
                A.toast('Abonnement prolongé.');
                A.go('#/abonnements/mes');
            }
        });
    });
})();
