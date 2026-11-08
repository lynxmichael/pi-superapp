/* Validation des retraits par l'admin. */
(function () {
    'use strict';

    var token = null;
    try { token = localStorage.getItem('pi_token') || localStorage.getItem('pisa_token'); } catch (e) { /* ignore */ }

    var filter = 'open';
    var $ = function (id) { return document.getElementById(id); };
    var nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 7 });
    var df = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    var pi = function (n) { return nf.format(n || 0) + ' π'; };

    function api(path, method, body) {
        return fetch('/api/pi' + path, {
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

    function el(tag, className, text) {
        var n = document.createElement(tag);
        if (className) n.className = className;
        if (text != null) n.textContent = text;
        return n;
    }

    function showGate(text) {
        $('main').hidden = true;
        $('gate').hidden = false;
        if (text) $('gateText').textContent = text;
    }

    function figure(value, label, key) {
        var f = el('div', 'figure' + (key ? ' key' : ''));
        f.appendChild(el('b', null, value));
        f.appendChild(el('span', null, label));
        return f;
    }

    function loadSummary() {
        return api('/admin/summary').then(function (s) {
            var box = $('figures');
            box.textContent = '';
            box.appendChild(figure(pi(s.owedToUsers), 'Minimum à garder sur le wallet de l\'app', true));
            box.appendChild(figure(pi(s.withdrawalsOpen.net), s.withdrawalsOpen.count + ' retrait(s) à envoyer'));
            box.appendChild(figure(pi(s.deposits.amount), s.deposits.count + ' dépôt(s) reçus'));
            box.appendChild(figure(pi(s.withdrawalsSent.net), s.withdrawalsSent.count + ' retrait(s) envoyés'));
        });
    }

    var STATUS = {
        pending: 'En attente',
        processing: 'Envoi en cours',
        failed: 'Échec, à réessayer',
        completed: 'Envoyé',
        rejected: 'Refusé'
    };

    function renderRow(w) {
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

        var open = ['pending', 'failed', 'processing'].indexOf(w.status) !== -1;
        if (open) {
            var send = el('button', 'small-btn send', w.status === 'failed' ? 'Réessayer l\'envoi' : 'Envoyer ' + pi(w.netAmount));
            send.type = 'button';
            var armed = false;
            send.addEventListener('click', function () {
                if (!armed) {
                    armed = true;
                    send.classList.add('confirm');
                    send.textContent = 'Confirmer l\'envoi à @' + w.piUsername;
                    setTimeout(function () {
                        if (armed && !send.disabled) {
                            armed = false;
                            send.classList.remove('confirm');
                            send.textContent = w.status === 'failed' ? 'Réessayer l\'envoi' : 'Envoyer ' + pi(w.netAmount);
                        }
                    }, 5000);
                    return;
                }
                send.disabled = true;
                send.textContent = 'Envoi…';
                api('/admin/withdrawals/' + w.id + '/approve', 'POST')
                    .then(reload)
                    .catch(function (e) { setMsg(li, e.message, true); reload(); });
            });
            actions.appendChild(send);

            if (w.status !== 'processing') {
                var refuse = el('button', 'small-btn refuse', 'Refuser');
                refuse.type = 'button';
                refuse.addEventListener('click', function () { showRejectForm(li, w); });
                actions.appendChild(refuse);
            }
        }

        if (w.status === 'failed' && w.errorMessage) setMsg(li, w.errorMessage, true);
        if (w.status === 'rejected' && w.rejectionReason) setMsg(li, 'Motif : ' + w.rejectionReason, false);
        if (w.status === 'completed' && w.txid) setMsg(li, 'Transaction : ' + w.txid, false);

        return li;
    }

    function setMsg(li, text, isError) {
        var msg = li.querySelector('.row-msg') || li.appendChild(el('p'));
        msg.className = 'row-msg ' + (isError ? 'err' : 'muted');
        msg.textContent = text;
    }

    function showRejectForm(li, w) {
        if (li.querySelector('.reject-form')) return;
        var form = el('form', 'reject-form');
        var input = el('input');
        input.placeholder = 'Motif (visible par l\'utilisateur)';
        input.maxLength = 300;
        var ok = el('button', 'small-btn refuse', 'Refuser et rendre ' + pi(w.amount));
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
            api('/admin/withdrawals/' + w.id + '/reject', 'POST', { reason: input.value })
                .then(reload)
                .catch(function (err) { ok.disabled = false; setMsg(li, err.message, true); });
        });
        li.appendChild(form);
        input.focus();
    }

    function loadRows() {
        return api('/admin/withdrawals?status=' + filter).then(function (data) {
            var rows = $('rows');
            rows.textContent = '';
            data.withdrawals.forEach(function (w) { rows.appendChild(renderRow(w)); });
            $('empty').hidden = data.withdrawals.length > 0;
            $('empty').textContent = filter === 'open' ? 'Aucune demande en attente.' : 'Aucun retrait pour l\'instant.';
        });
    }

    function reload() {
        return Promise.all([loadSummary(), loadRows()]).catch(function (e) {
            if (e.gate) showGate(e.message);
        });
    }

    document.querySelectorAll('.tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
            filter = tab.dataset.status;
            document.querySelectorAll('.tab').forEach(function (t) { t.setAttribute('aria-pressed', String(t === tab)); });
            loadRows();
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
        return reload();
    }).catch(function (e) { showGate(e.gate ? null : e.message); });
})();
