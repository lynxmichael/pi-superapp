/* Recharge de crédit et paiement de factures, faits à la main par notre équipe. */
(function () {
    'use strict';
    var A = window.PiApp;
    var html = A.html;

    var KINDS = {
        mobile: { label: 'Crédit mobile', target: 'Numéro de téléphone', placeholder: '07 00 00 00 00', operators: ['Orange', 'MTN', 'Moov'] },
        internet: { label: 'Internet', target: 'Numéro de téléphone', placeholder: '07 00 00 00 00', operators: ['Orange', 'MTN', 'Moov'] },
        electricity: { label: 'Électricité', target: 'Numéro de compteur ou de contrat', placeholder: '123456789', operators: ['CIE'] },
        water: { label: 'Eau', target: 'Numéro de compteur ou de contrat', placeholder: '123456789', operators: ['SODECI'] },
        tv: { label: 'TV', target: 'Numéro d\'abonné ou de décodeur', placeholder: '123456789', operators: ['Canal+', 'StarTimes'] }
    };
    var QUICK = [500, 1000, 2000, 5000, 10000];
    var ST = {
        pending: ['En cours, notre équipe s\'en occupe', 'st-wait'],
        completed: ['Effectuée', 'st-ok'],
        refused: ['Refusée, Pi rendus', 'st-no']
    };

    A.route('#/recharge', async function (ctx) {
        await A.refresh();
        var r = A.state.settings.recharge || { open: false };
        var data = await A.request('/api/recharge');
        var kind = 'mobile';

        function cost(amount) {
            if (!r.open || !(amount > 0)) return null;
            return A.round7(amount / r.rate * (1 + (r.feePercent || 0) / 100));
        }

        var history = data.recharges.length ? html`
            <h2>Mes recharges</h2>
            <ul class="rows">${data.recharges.map(function (x) {
                var st = ST[x.status];
                return html`
                    <li class="row">
                        <div class="row-head"><span class="row-title">${x.kindLabel} ${x.operator}, ${A.local(x.localAmount)} ${x.currency}</span><span class="row-amount">${A.pi(x.piAmount)}</span></div>
                        <div class="row-meta">${x.recipient}, ${A.date(x.createdAt)}</div>
                        ${x.reference ? html`<div class="row-meta">Référence : ${x.reference}</div>` : ''}
                        ${x.refuseReason && x.status === 'refused' ? html`<div class="row-meta">Motif : ${x.refuseReason}</div>` : ''}
                        <span class="pill ${st[1]}">${st[0]}</span>
                    </li>`;
            })}</ul>` : '';

        if (!r.open) {
            A.mount(ctx, html`
                ${A.backLink('#/', 'Accueil')}
                <h1>Recharge et factures</h1>
                <div class="notice notice-wait"><strong>Bientôt disponible</strong>Les recharges ouvrent dès que notre équipe aura fixé le tarif.</div>
                ${history}
            `);
            return;
        }

        A.mount(ctx, html`
            ${A.backLink('#/', 'Accueil')}
            <h1>Recharge et factures</h1>
            <p class="lead">Payez en Pi : notre équipe fait la recharge pour vous. Si elle est impossible, vos Pi vous sont rendus.</p>
            <form class="form" data-form="send">
                <div class="chips" role="radiogroup" aria-label="Type">
                    ${Object.keys(KINDS).map(function (k) {
                        return html`<button class="chip ${k === kind ? 'is-on' : ''}" type="button" role="radio" aria-checked="${k === kind}" data-act="kind" data-kind="${k}">${KINDS[k].label}</button>`;
                    })}
                </div>
                <label class="field"><span>Opérateur</span>
                    <input name="operator" list="operators" required maxlength="60" value="${KINDS[kind].operators[0]}">
                    <datalist id="operators">${KINDS[kind].operators.map(function (o) { return html`<option value="${o}">`; })}</datalist>
                </label>
                <label class="field"><span id="targetLabel">${KINDS[kind].target}</span>
                    <input name="recipient" required maxlength="40" placeholder="${KINDS[kind].placeholder}" inputmode="tel">
                </label>
                <label class="field"><span>Montant (${r.currency}) <small>entre ${A.local(r.min)} et ${A.local(r.max)}</small></span>
                    <input name="localAmount" required inputmode="numeric" placeholder="1000">
                </label>
                <div class="chips">${QUICK.filter(function (q) { return q >= r.min && q <= r.max; }).map(function (q) {
                    return html`<button class="chip" type="button" data-act="quick" data-v="${q}">${A.local(q)}</button>`;
                })}</div>
                <p class="summary" id="cost">1 π = ${A.local(r.rate)} ${r.currency}${r.feePercent ? ', frais ' + r.feePercent + ' %' : ''}.</p>
                <button class="btn btn-main" type="submit" data-busy="Paiement…">Payer</button>
            </form>
            ${history}
        `, {
            kind: function (el) {
                kind = el.dataset.kind;
                var k = KINDS[kind];
                ctx.view.querySelectorAll('[data-act="kind"]').forEach(function (c) {
                    c.classList.toggle('is-on', c === el);
                    c.setAttribute('aria-checked', String(c === el));
                });
                var form = ctx.view.querySelector('form');
                form.operator.value = k.operators[0];
                ctx.view.querySelector('#operators').innerHTML = k.operators.map(function (o) { return A.html`<option value="${o}">`.s; }).join('');
                ctx.view.querySelector('#targetLabel').textContent = k.target;
                form.recipient.placeholder = k.placeholder;
            },
            quick: function (el) {
                var input = ctx.view.querySelector('input[name="localAmount"]');
                input.value = el.dataset.v;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            },
            $input: function (t) {
                if (t.name !== 'localAmount') return;
                var amount = parseInt(String(t.value).replace(/\s/g, ''), 10);
                var c = cost(amount);
                var button = ctx.view.querySelector('form button[type="submit"]');
                ctx.view.querySelector('#cost').textContent = c
                    ? 'Coût : ' + A.pi(c) + ' (1 π = ' + A.local(r.rate) + ' ' + r.currency + (r.feePercent ? ', frais ' + r.feePercent + ' %' : '') + ').'
                    : '1 π = ' + A.local(r.rate) + ' ' + r.currency + '.';
                button.textContent = c ? 'Payer ' + A.pi(c) : 'Payer';
            },
            send: async function (form) {
                await A.request('/api/recharge', {
                    method: 'POST',
                    body: {
                        kind: kind,
                        operator: form.operator.value,
                        recipient: form.recipient.value,
                        localAmount: String(form.localAmount.value).replace(/\s/g, '')
                    }
                });
                await A.refresh();
                A.toast('Recharge payée : notre équipe s\'en occupe.');
                A.go('#/recharge');
            }
        });
    });
})();
