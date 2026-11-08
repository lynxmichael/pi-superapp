/* Administration : retraits, recharges à faire, litiges du marché, réglages. */
(function () {
    'use strict';

    var token = null;
    try { token = localStorage.getItem('pi_token') || localStorage.getItem('pisa_token'); } catch (e) { /* ignore */ }

    var filter = 'open';
    var rFilter = 'pending';
    var $ = function (id) { return document.getElementById(id); };
    var nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 7 });
    var nl = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
    var df = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    var pi = function (n) { return nf.format(n || 0) + ' π'; };

    function request(path, method, body) {
        return fetch(path, {
            method: method || 'GET',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: body ? JSON.stringify(body) : undefined
        }).catch(function () {
            throw new Error('Pas de connexion au serveur.');
        }).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
                if (res.status === 401 || res.status === 403) {
                    var e = new Error(data.error || 'Accès refusé');
                    e.gate = true;
                    throw e;
                }
                if (!res.ok) throw new Error(data.error || 'Erreur du serveur');
                return data;
            });
        });
    }

    var api = function (path, method, body) { return request('/api/pi' + path, method, body); };

    function el(tag, className, text) {
        var n = document.createElement(tag);
        if (className) n.className = className;
        if (text != null) n.textContent = text;
        return n;
    }

    function button(className, text, onClick) {
        var b = el('button', 'small-btn ' + className, text);
        b.type = 'button';
        b.addEventListener('click', onClick);
        return b;
    }

    /** Bouton en deux temps : premier clic = « Confirmer… », second clic = action. */
    function twoStep(b, confirmText, action) {
        var label = b.textContent;
        var armed = false;
        b.addEventListener('click', function () {
            if (!armed) {
                armed = true;
                b.classList.add('confirm');
                b.textContent = confirmText;
                setTimeout(function () {
                    if (armed && !b.disabled) { armed = false; b.classList.remove('confirm'); b.textContent = label; }
                }, 5000);
                return;
            }
            b.disabled = true;
            b.textContent = '…';
            action();
        });
        return b;
    }

    function showGate(text) {
        $('main').hidden = true;
        $('gate').hidden = false;
        if (text) $('gateText').textContent = text;
    }

    function setMsg(li, text, isError) {
        var msg = li.querySelector('.row-msg') || li.appendChild(el('p'));
        msg.className = 'row-msg ' + (isError ? 'err' : 'muted');
        msg.textContent = text;
    }

    function figure(value, label, key) {
        var f = el('div', 'figure' + (key ? ' key' : ''));
        f.appendChild(el('b', null, value));
        f.appendChild(el('span', null, label));
        return f;
    }

    function loadSummary() {
        return Promise.all([api('/admin/summary'), request('/api/admin/tasks')]).then(function (r) {
            var s = r[0];
            var t = r[1];
            var box = $('figures');
            box.textContent = '';
            box.appendChild(figure(pi(s.owedToUsers), 'Minimum à garder sur le wallet de l\'app', true));
            box.appendChild(figure(pi(s.withdrawalsOpen.net), s.withdrawalsOpen.count + ' retrait(s) à envoyer'));
            box.appendChild(figure(pi(s.held.amount), s.held.count + ' paiement(s) bloqué(s) en attente'));
            box.appendChild(figure(pi(s.deposits.amount), s.deposits.count + ' dépôt(s) reçus'));
            ['withdrawals', 'recharges', 'disputes', 'kyc'].forEach(function (k) { $('b-' + k).textContent = t[k] || ''; });
        });
    }

    // ------------------------------------------------------------------
    // Retraits
    // ------------------------------------------------------------------

    var STATUS = {
        pending: 'En attente',
        processing: 'Envoi en cours',
        failed: 'Échec, à réessayer',
        completed: 'Envoyé',
        rejected: 'Refusé'
    };

    function withdrawalRow(w) {
        var li = el('li', 'row');
        var who = el('div');
        who.appendChild(el('div', 'row-user', '@' + (w.piUsername || '?')));
        who.appendChild(el('div', 'row-date', df.format(new Date(w.createdAt)) + ', ' + (STATUS[w.status] || w.status).toLowerCase()));
        li.appendChild(who);

        var amount = el('div', 'row-amount');
        amount.appendChild(el('b', null, pi(w.netAmount)));
        amount.appendChild(el('span', null, w.fee > 0 ? 'à envoyer (débité ' + pi(w.amount) + ', frais ' + pi(w.fee) + ')' : 'à envoyer'));
        li.appendChild(amount);

        var actions = el('div', 'row-actions');
        li.appendChild(actions);

        if (['pending', 'failed', 'processing'].indexOf(w.status) !== -1) {
            var send = button('send', w.status === 'failed' ? 'Réessayer l\'envoi' : 'Envoyer ' + pi(w.netAmount), function () {});
            actions.appendChild(twoStep(send, 'Confirmer l\'envoi à @' + w.piUsername, function () {
                api('/admin/withdrawals/' + w.id + '/approve', 'POST')
                    .then(reloadWithdrawals)
                    .catch(function (e) { setMsg(li, e.message, true); reloadWithdrawals(); });
            }));
            if (w.status !== 'processing') {
                actions.appendChild(button('refuse', 'Refuser', function () {
                    reasonForm(li, 'Motif (visible par l\'utilisateur)', 'Refuser et rendre ' + pi(w.amount), function (reason) {
                        return api('/admin/withdrawals/' + w.id + '/reject', 'POST', { reason: reason }).then(reloadWithdrawals);
                    });
                }));
            }
        }

        if (w.status === 'failed' && w.errorMessage) setMsg(li, w.errorMessage, true);
        if (w.status === 'rejected' && w.rejectionReason) setMsg(li, 'Motif : ' + w.rejectionReason, false);
        if (w.status === 'completed' && w.txid) setMsg(li, 'Transaction : ' + w.txid, false);
        return li;
    }

    /** Petit formulaire « motif + bouton » sous une ligne. */
    function reasonForm(li, placeholder, label, send) {
        if (li.querySelector('.reject-form')) return;
        var form = el('form', 'reject-form');
        var input = el('input');
        input.placeholder = placeholder;
        input.maxLength = 300;
        var ok = el('button', 'small-btn refuse', label);
        ok.type = 'submit';
        var cancel = el('button', 'link', 'Annuler');
        cancel.type = 'button';
        cancel.addEventListener('click', function () { form.remove(); });
        form.appendChild(input);
        form.appendChild(ok);
        form.appendChild(cancel);
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            ok.disabled = true;
            send(input.value).catch(function (err) { ok.disabled = false; setMsg(li, err.message, true); });
        });
        li.appendChild(form);
        input.focus();
    }

    function reloadWithdrawals() {
        loadSummary().catch(function () {});
        return api('/admin/withdrawals?status=' + filter).then(function (data) {
            var rows = $('rows');
            rows.textContent = '';
            data.withdrawals.forEach(function (w) { rows.appendChild(withdrawalRow(w)); });
            $('empty').hidden = data.withdrawals.length > 0;
            $('empty').textContent = filter === 'open' ? 'Aucune demande en attente.' : 'Aucun retrait pour l\'instant.';
        });
    }

    // ------------------------------------------------------------------
    // Recharges
    // ------------------------------------------------------------------

    var R_STATUS = { pending: 'À faire', completed: 'Faite', refused: 'Refusée, Pi rendus' };

    function rechargeRow(r) {
        var li = el('li', 'row');
        var who = el('div');
        who.appendChild(el('div', 'row-user', r.kindLabel + ' ' + r.operator + ' : ' + nl.format(r.localAmount) + ' ' + r.currency));
        who.appendChild(el('div', 'row-date', 'Pour ' + r.recipient + ', demandé par @' + r.piUsername + ' le ' + df.format(new Date(r.createdAt))));
        li.appendChild(who);
        var amount = el('div', 'row-amount');
        amount.appendChild(el('b', null, pi(r.piAmount)));
        amount.appendChild(el('span', null, R_STATUS[r.status]));
        li.appendChild(amount);
        var actions = el('div', 'row-actions');
        li.appendChild(actions);

        if (r.status === 'pending') {
            actions.appendChild(button('send', 'Fait', function () {
                if (li.querySelector('.reject-form')) return;
                var form = el('form', 'reject-form');
                var input = el('input');
                input.placeholder = 'Référence de la transaction (facultatif)';
                input.maxLength = 120;
                var ok = el('button', 'small-btn send', 'Confirmer : recharge faite');
                ok.type = 'submit';
                form.appendChild(input);
                form.appendChild(ok);
                form.addEventListener('submit', function (e) {
                    e.preventDefault();
                    ok.disabled = true;
                    request('/api/admin/recharges/' + r.id + '/done', 'POST', { reference: input.value })
                        .then(reloadRecharges)
                        .catch(function (err) { ok.disabled = false; setMsg(li, err.message, true); });
                });
                li.appendChild(form);
                input.focus();
            }));
            actions.appendChild(button('refuse', 'Refuser', function () {
                reasonForm(li, 'Motif (numéro invalide, opérateur indisponible...)', 'Refuser et rendre ' + pi(r.piAmount), function (reason) {
                    return request('/api/admin/recharges/' + r.id + '/refuse', 'POST', { reason: reason }).then(reloadRecharges);
                });
            }));
        }
        if (r.reference) setMsg(li, 'Référence : ' + r.reference, false);
        if (r.refuseReason && r.status === 'refused') setMsg(li, 'Motif : ' + r.refuseReason, false);
        return li;
    }

    function reloadRecharges() {
        loadSummary().catch(function () {});
        return request('/api/admin/recharges?status=' + rFilter).then(function (data) {
            var rows = $('rechargeRows');
            rows.textContent = '';
            data.recharges.forEach(function (r) { rows.appendChild(rechargeRow(r)); });
            if (!data.recharges.length) rows.appendChild(el('li', 'empty', rFilter === 'pending' ? 'Aucune recharge à faire.' : 'Aucune recharge pour l\'instant.'));
        });
    }

    // ------------------------------------------------------------------
    // Litiges
    // ------------------------------------------------------------------

    function disputeRow(o) {
        var li = el('li', 'row');
        var who = el('div');
        who.appendChild(el('div', 'row-user', o.productName + (o.quantity > 1 ? ' ×' + o.quantity : '')));
        who.appendChild(el('div', 'row-date', 'Acheteur @' + o.buyer + ', vendeur @' + o.seller + ', litige du ' + df.format(new Date(o.disputedAt || o.createdAt))));
        li.appendChild(who);
        var amount = el('div', 'row-amount');
        amount.appendChild(el('b', null, pi(o.total)));
        amount.appendChild(el('span', null, 'bloqués'));
        li.appendChild(amount);
        var actions = el('div', 'row-actions');
        li.appendChild(actions);

        var details = el('p', 'row-msg muted');
        details.textContent = 'Problème : ' + (o.disputeReason || '—') + '. Livraison demandée : ' + (o.deliveryNote || '—') +
            (o.shippingNote ? '. Message du vendeur : ' + o.shippingNote : '') + (o.shippedAt ? ' (marqué envoyé)' : ' (jamais marqué envoyé)');
        li.appendChild(details);

        var resolve = function (decision) {
            return function () {
                request('/api/admin/disputes/' + o.id + '/resolve', 'POST', { decision: decision })
                    .then(reloadDisputes)
                    .catch(function (e) { setMsg(li, e.message, true); });
            };
        };
        actions.appendChild(twoStep(button('refuse', 'Rembourser l\'acheteur', function () {}), 'Confirmer le remboursement', resolve('refund')));
        actions.appendChild(twoStep(button('send', 'Payer le vendeur', function () {}), 'Confirmer le paiement', resolve('release')));
        return li;
    }

    function reloadDisputes() {
        loadSummary().catch(function () {});
        return request('/api/admin/disputes').then(function (data) {
            var rows = $('disputeRows');
            rows.textContent = '';
            data.orders.forEach(function (o) { rows.appendChild(disputeRow(o)); });
            if (!data.orders.length) rows.appendChild(el('li', 'empty', 'Aucun litige en cours.'));
        });
    }

    // ------------------------------------------------------------------
    // Réglages
    // ------------------------------------------------------------------

    function loadSettings() {
        return request('/api/admin/settings').then(function (data) {
            var s = data.settings;
            var f = $('settingsForm');
            ['rechargeRate', 'rechargeCurrency', 'rechargeMin', 'rechargeMax', 'rechargeFeePercent',
                'marketCommissionPercent', 'offersCommissionPercent'].forEach(function (k) {
                f[k].value = s[k] == null ? '' : String(s[k]).replace('.', ',');
            });
        });
    }

    $('settingsForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var f = e.target;
        var body = {};
        ['rechargeRate', 'rechargeCurrency', 'rechargeMin', 'rechargeMax', 'rechargeFeePercent',
            'marketCommissionPercent', 'offersCommissionPercent'].forEach(function (k) { body[k] = f[k].value.trim(); });
        var msg = $('settingsMsg');
        msg.className = 'row-msg muted';
        msg.textContent = 'Enregistrement…';
        request('/api/admin/settings', 'PUT', body).then(function () {
            msg.textContent = 'Réglages enregistrés.';
            return loadSettings();
        }).catch(function (err) {
            msg.className = 'row-msg err';
            msg.textContent = err.message;
        });
    });

    // ------------------------------------------------------------------
    // Onglets
    // ------------------------------------------------------------------

    var LOADERS = { withdrawals: reloadWithdrawals, recharges: reloadRecharges, disputes: reloadDisputes, settings: loadSettings };

    function openTab(name) {
        document.querySelectorAll('.tab[data-tab]').forEach(function (t) { t.setAttribute('aria-pressed', String(t.dataset.tab === name)); });
        Object.keys(LOADERS).forEach(function (k) { $('tab-' + k).hidden = k !== name; });
        LOADERS[name]().catch(function (e) { if (e.gate) showGate(e.message); });
    }

    document.querySelectorAll('.tab[data-tab]').forEach(function (t) {
        t.addEventListener('click', function () { openTab(t.dataset.tab); });
    });

    document.querySelectorAll('[data-filter]').forEach(function (c) {
        c.addEventListener('click', function () {
            filter = c.dataset.filter;
            document.querySelectorAll('[data-filter]').forEach(function (x) { x.classList.toggle('is-on', x === c); });
            reloadWithdrawals();
        });
    });

    document.querySelectorAll('[data-rfilter]').forEach(function (c) {
        c.addEventListener('click', function () {
            rFilter = c.dataset.rfilter;
            document.querySelectorAll('[data-rfilter]').forEach(function (x) { x.classList.toggle('is-on', x === c); });
            reloadRecharges();
        });
    });

    $('logoutBtn').addEventListener('click', function () {
        try { localStorage.removeItem('pi_token'); localStorage.removeItem('pi_user'); } catch (e) { /* ignore */ }
        window.location.href = '/admin/auth';
    });

    if (!token) {
        showGate();
        return;
    }

    api('/me').then(function (data) {
        if (!data.user || data.user.role !== 'admin') {
            showGate('Ce compte n\'est pas administrateur.');
            return;
        }
        $('main').hidden = false;
        openTab(location.hash === '#recharges' ? 'recharges' : location.hash === '#litiges' ? 'disputes' : 'withdrawals');
    }).catch(function (e) { showGate(e.gate ? null : e.message); });
})();
