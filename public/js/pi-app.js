/* pi-superapp — connexion Pi, dépôts et retraits. */
(function () {
    'use strict';

    var TOKEN_KEY = 'pisa_token';
    var AUTH_TIMEOUT_MS = 20000;

    var state = {
        token: readToken(),
        user: null,
        settings: { sandbox: false, minDeposit: 0.01, minWithdrawal: 1, withdrawalFee: 0 },
        operations: [],
        piReady: false,
        piAuthed: false,
        mode: null,
        busy: false
    };

    var $ = function (id) { return document.getElementById(id); };

    // ------------------------------------------------------------------
    // Utilitaires
    // ------------------------------------------------------------------

    function readToken() {
        try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
    }

    function saveToken(token) {
        state.token = token;
        try {
            if (token) localStorage.setItem(TOKEN_KEY, token);
            else localStorage.removeItem(TOKEN_KEY);
        } catch (e) { /* stockage indisponible : la session dure le temps de la page */ }
    }

    var nfPi = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 7 });
    var nfBalance = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 7 });
    var dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

    function pi(n) { return nfPi.format(n) + ' π'; }

    function round7(n) { return Math.round(n * 1e7) / 1e7; }

    function floor7(n) { return Math.floor(n * 1e7 + 1e-6) / 1e7; }

    function parseAmount(raw) {
        var s = String(raw || '').replace(/\s/g, '').replace(',', '.');
        if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') return null;
        var n = Number(s);
        return Number.isFinite(n) && n > 0 ? round7(n) : null;
    }

    function inPiBrowser() {
        return /PiBrowser/i.test(navigator.userAgent) || window.self !== window.top;
    }

    function api(path, options) {
        options = options || {};
        var headers = { 'Content-Type': 'application/json' };
        if (state.token) headers.Authorization = 'Bearer ' + state.token;

        return fetch('/api/pi' + path, {
            method: options.method || 'GET',
            headers: headers,
            body: options.body ? JSON.stringify(options.body) : undefined
        }).catch(function () {
            throw new Error('Pas de connexion au serveur. Vérifiez votre internet puis réessayez.');
        }).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
                if (res.status === 401 && state.token && path !== '/auth') {
                    logout();
                    throw new Error('Votre session a expiré. Reconnectez-vous.');
                }
                if (!res.ok) throw new Error(data.error || 'Le serveur ne répond pas. Réessayez dans un instant.');
                return data;
            });
        });
    }

    function withTimeout(promise, ms, message) {
        return new Promise(function (resolve, reject) {
            var timer = setTimeout(function () { reject(new Error(message)); }, ms);
            promise.then(function (v) { clearTimeout(timer); resolve(v); },
                function (e) { clearTimeout(timer); reject(e); });
        });
    }

    // ------------------------------------------------------------------
    // SDK Pi
    // ------------------------------------------------------------------

    function initPi() {
        if (!window.Pi) return false;
        try {
            window.Pi.init({ version: '2.0', sandbox: !!state.settings.sandbox });
            state.piReady = true;
        } catch (e) {
            state.piReady = false;
        }
        return state.piReady;
    }

    // Un paiement est resté inachevé (app fermée, coupure...) : le serveur le termine ou l'annule.
    function onIncompletePaymentFound(payment) {
        if (!payment || !payment.identifier) return;
        // Traité juste après la connexion au serveur (le jeton n'existe pas encore ici)
        state.incompletePaymentId = payment.identifier;
    }

    function resolveIncompletePayment() {
        var paymentId = state.incompletePaymentId;
        if (!paymentId || !state.token) return;
        state.incompletePaymentId = null;
        api('/deposits/incomplete', { method: 'POST', body: { paymentId: paymentId } })
            .then(function () { if (state.user) return refresh(); })
            .catch(function () { /* sera retenté à la prochaine connexion */ });
    }

    function piAuthenticate() {
        if (!state.piReady) {
            return Promise.reject(new Error('Ouvrez cette page dans le Pi Browser pour vous connecter.'));
        }
        return withTimeout(
            window.Pi.authenticate(['username', 'payments'], onIncompletePaymentFound),
            AUTH_TIMEOUT_MS,
            'Pi ne répond pas. Ouvrez cette page dans le Pi Browser, puis réessayez.'
        ).then(function (auth) {
            return api('/auth', { method: 'POST', body: { accessToken: auth.accessToken } });
        }).then(function (data) {
            saveToken(data.token);
            state.user = data.user;
            state.piAuthed = true;
            resolveIncompletePayment();
            return data.user;
        });
    }

    // ------------------------------------------------------------------
    // Écrans
    // ------------------------------------------------------------------

    function showWelcome() {
        $('screenHome').hidden = true;
        $('screenWelcome').hidden = false;
        $('who').hidden = true;
        if (!inPiBrowser() && !state.settings.sandbox) {
            setHint('Pour vous connecter, ouvrez cette page dans le Pi Browser.');
        }
    }

    function showHome() {
        $('screenWelcome').hidden = true;
        $('screenHome').hidden = false;
        renderUser();
    }

    function setHint(text, isError) {
        var el = $('loginHint');
        el.textContent = text || '';
        el.classList.toggle('is-error', !!isError);
    }

    function renderUser() {
        var user = state.user;
        if (!user) return;
        $('who').textContent = '@' + user.piUsername;
        $('who').hidden = false;
        $('balance').textContent = nfBalance.format(user.balance || 0);
        $('adminLink').hidden = user.role !== 'admin';

        var reserved = state.operations
            .filter(function (op) { return op.type === 'withdrawal' && ['pending', 'processing', 'failed'].indexOf(op.status) !== -1; })
            .reduce(function (sum, op) { return sum + op.amount; }, 0);
        $('balanceSub').textContent = reserved > 0
            ? 'disponibles, et ' + pi(round7(reserved)) + ' en cours de retrait'
            : 'disponibles sur votre compte';
    }

    var ICONS = {
        deposit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14"/></svg>',
        withdrawal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V5m0 0L7.5 9.5M12 5l4.5 4.5M5 20h14"/></svg>'
    };

    function statusOf(op) {
        if (op.type === 'deposit') {
            if (op.status === 'completed') return ['Reçu', 'st-ok'];
            return ['En cours de confirmation', 'st-wait'];
        }
        switch (op.status) {
            case 'completed': return ['Envoyé', 'st-ok'];
            case 'processing': return ['Envoi en cours', 'st-wait'];
            case 'rejected': return ['Refusé', 'st-no'];
            default: return ['En attente de validation', 'st-wait'];
        }
    }

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function renderHistory() {
        var list = $('history');
        list.textContent = '';
        $('historyEmpty').hidden = state.operations.length > 0;

        state.operations.forEach(function (op) {
            var isDeposit = op.type === 'deposit';
            var status = statusOf(op);
            var li = el('li', 'op ' + (isDeposit ? 'op-deposit' : 'op-withdrawal'));

            var icon = el('span', 'op-icon');
            icon.innerHTML = ICONS[op.type];
            li.appendChild(icon);
            li.appendChild(el('span', 'op-title', isDeposit ? 'Dépôt' : 'Retrait'));
            li.appendChild(el('span', 'op-amount', (isDeposit ? '+' : '−') + pi(op.amount)));
            li.appendChild(el('span', 'op-date', dateFmt.format(new Date(op.createdAt))));
            li.appendChild(el('span', 'op-status ' + status[1], status[0]));

            var note = null;
            if (op.type === 'withdrawal' && op.status === 'rejected') {
                note = 'Vos ' + pi(op.amount) + ' ont été remis sur votre compte.' +
                    (op.rejectionReason ? ' Motif : ' + op.rejectionReason : '');
            } else if (op.type === 'withdrawal' && op.fee > 0) {
                note = (op.status === 'completed' ? 'Reçu sur votre wallet : ' : 'Vous recevrez ') + pi(op.netAmount) +
                    ' (frais ' + pi(op.fee) + ')';
            }
            if (note) li.appendChild(el('p', 'op-note', note));

            list.appendChild(li);
        });
    }

    function refresh() {
        return Promise.all([api('/me'), api('/operations')]).then(function (results) {
            state.user = results[0].user;
            state.settings = results[0].settings || state.settings;
            state.operations = results[1].operations || [];
            renderUser();
            renderHistory();
        });
    }

    // ------------------------------------------------------------------
    // Connexion / déconnexion
    // ------------------------------------------------------------------

    function setButtonBusy(button, busyText) {
        if (busyText) {
            button.dataset.label = button.textContent;
            button.textContent = busyText;
            button.disabled = true;
        } else {
            button.textContent = button.dataset.label || button.textContent;
            button.disabled = false;
        }
    }

    function login() {
        var button = $('loginBtn');
        setHint('');
        setButtonBusy(button, 'Connexion…');
        piAuthenticate()
            .then(function () {
                showHome();
                return refresh();
            })
            .catch(function (error) { setHint(error.message, true); })
            .then(function () { setButtonBusy(button, null); });
    }

    function logout() {
        saveToken(null);
        state.user = null;
        state.operations = [];
        state.piAuthed = false;
        showWelcome();
    }

    // ------------------------------------------------------------------
    // Feuille Déposer / Retirer
    // ------------------------------------------------------------------

    var lastFocus = null;

    function openSheet(mode) {
        state.mode = mode;
        lastFocus = document.activeElement;
        var s = state.settings;
        var balance = (state.user && state.user.balance) || 0;

        $('sheetForm').hidden = false;
        $('sheetDone').hidden = true;
        $('amount').value = '';
        setSheetError('');

        var chips = $('chips');
        chips.textContent = '';
        var options;

        if (mode === 'deposit') {
            $('sheetTitle').textContent = 'Déposer des Pi';
            $('sheetHelp').textContent = 'Les Pi viennent de votre wallet Pi. Vous confirmerez le paiement dans le wallet.';
            options = [[1, '1 π'], [5, '5 π'], [10, '10 π'], [50, '50 π']];
        } else {
            $('sheetTitle').textContent = 'Retirer des Pi';
            $('sheetHelp').textContent = 'Les Pi sont envoyés sur votre wallet Pi après validation par notre équipe.';
            var all = floor7(balance);
            options = [];
            if (all >= s.minWithdrawal * 2) options.push([floor7(all / 2), 'La moitié']);
            if (all >= s.minWithdrawal) options.push([all, 'Tout (' + pi(all) + ')']);
        }

        options.forEach(function (opt) {
            var chip = el('button', 'chip', opt[1]);
            chip.type = 'button';
            chip.addEventListener('click', function () {
                $('amount').value = String(opt[0]).replace('.', ',');
                updateSheet();
                $('amount').focus();
            });
            chips.appendChild(chip);
        });

        $('sheet').hidden = false;
        updateSheet();
        setTimeout(function () { $('amount').focus(); }, 50);
    }

    function closeSheet() {
        if (state.busy) return;
        $('sheet').hidden = true;
        state.mode = null;
        if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    function setSheetError(text, soft) {
        var e = $('sheetError');
        e.textContent = text || '';
        e.classList.toggle('is-soft', !!soft);
    }

    /** Vérifie le montant saisi et met à jour le résumé et le bouton. */
    function checkAmount() {
        var s = state.settings;
        var amount = parseAmount($('amount').value);
        var balance = (state.user && state.user.balance) || 0;

        if ($('amount').value.trim() === '') return { ok: false, amount: null, message: '' };
        if (amount === null) return { ok: false, amount: null, message: 'Entrez un montant, par exemple 10 ou 2,5.' };

        if (state.mode === 'deposit') {
            if (amount < s.minDeposit) return { ok: false, amount: amount, message: 'Le dépôt minimum est de ' + pi(s.minDeposit) + '.' };
            return { ok: true, amount: amount, summary: 'Votre solde passera à ' + pi(round7(balance + amount)) + '.' };
        }

        if (amount < s.minWithdrawal) return { ok: false, amount: amount, message: 'Le retrait minimum est de ' + pi(s.minWithdrawal) + '.' };
        if (amount > balance + 1e-9) return { ok: false, amount: amount, message: 'Vous avez seulement ' + pi(balance) + '.' };
        var net = round7(amount - s.withdrawalFee);
        if (net <= 0) return { ok: false, amount: amount, message: 'Le montant doit dépasser les frais (' + pi(s.withdrawalFee) + ').' };
        return {
            ok: true,
            amount: amount,
            summary: s.withdrawalFee > 0
                ? 'Frais : ' + pi(s.withdrawalFee) + '. Vous recevrez ' + pi(net) + ' sur votre wallet Pi.'
                : 'Vous recevrez ' + pi(net) + ' sur votre wallet Pi.'
        };
    }

    function updateSheet() {
        var check = checkAmount();
        var verb = state.mode === 'deposit' ? 'Déposer' : 'Retirer';
        $('summary').textContent = check.ok ? check.summary : '';
        setSheetError(check.ok ? '' : check.message);
        $('sheetSubmit').disabled = !check.ok || state.busy;
        if (!state.busy) {
            $('sheetSubmit').textContent = check.ok ? verb + ' ' + pi(check.amount) : verb;
        }
    }

    function showDone(title, text) {
        $('sheetForm').hidden = true;
        $('sheetDone').hidden = false;
        $('doneTitle').textContent = title;
        $('doneText').textContent = text;
        $('doneBtn').focus();
    }

    function setSheetBusy(text) {
        state.busy = !!text;
        $('sheetCancel').hidden = !!text;
        $('amount').disabled = !!text;
        if (text) {
            $('sheetSubmit').textContent = text;
            $('sheetSubmit').disabled = true;
        } else {
            updateSheet();
        }
    }

    function deposit(amount) {
        var ensureAuth = state.piAuthed ? Promise.resolve() : piAuthenticate();

        return ensureAuth.then(function () {
            return new Promise(function (resolve, reject) {
                window.Pi.createPayment({
                    amount: amount,
                    memo: 'Dépôt sur pi-superapp',
                    metadata: { type: 'deposit' }
                }, {
                    onReadyForServerApproval: function (paymentId) {
                        api('/deposits/approve', { method: 'POST', body: { paymentId: paymentId } }).catch(reject);
                    },
                    onReadyForServerCompletion: function (paymentId, txid) {
                        setSheetBusy('Confirmation en cours…');
                        api('/deposits/complete', { method: 'POST', body: { paymentId: paymentId, txid: txid } }).then(resolve, reject);
                    },
                    onCancel: function (paymentId) {
                        api('/deposits/cancel', { method: 'POST', body: { paymentId: paymentId } }).catch(function () {});
                        var e = new Error('Dépôt annulé. Aucun Pi n\'a été prélevé.');
                        e.soft = true;
                        reject(e);
                    },
                    onError: function (error) {
                        reject(new Error((error && error.message) ? 'Le dépôt n\'a pas abouti : ' + error.message : 'Le dépôt n\'a pas abouti. Réessayez.'));
                    }
                });
            });
        });
    }

    function submitSheet(event) {
        event.preventDefault();
        var check = checkAmount();
        if (!check.ok || state.busy) return;

        if (state.mode === 'deposit') {
            setSheetBusy('Confirmez dans votre wallet Pi…');
            deposit(check.amount)
                .then(function (result) {
                    setSheetBusy(null);
                    showDone(pi(result.amount) + ' ajoutés', 'Votre nouveau solde : ' + pi(result.balance) + '.');
                    refresh().catch(function () {});
                })
                .catch(function (error) {
                    setSheetBusy(null);
                    setSheetError(error.message, error.soft);
                    refresh().catch(function () {});
                });
            return;
        }

        setSheetBusy('Envoi de la demande…');
        api('/withdrawals', { method: 'POST', body: { amount: check.amount } })
            .then(function (result) {
                setSheetBusy(null);
                var op = result.operation;
                showDone('Demande envoyée',
                    'Vous recevrez ' + pi(op.netAmount) + ' sur votre wallet Pi dès que notre équipe aura validé. Suivez l\'avancement dans l\'historique.');
                refresh().catch(function () {});
            })
            .catch(function (error) {
                setSheetBusy(null);
                setSheetError(error.message);
            });
    }

    // ------------------------------------------------------------------
    // Démarrage
    // ------------------------------------------------------------------

    function bind() {
        $('loginBtn').addEventListener('click', login);
        $('logoutBtn').addEventListener('click', logout);
        $('depositBtn').addEventListener('click', function () { openSheet('deposit'); });
        $('withdrawBtn').addEventListener('click', function () { openSheet('withdrawal'); });
        $('sheetForm').addEventListener('submit', submitSheet);
        $('sheetCancel').addEventListener('click', closeSheet);
        $('doneBtn').addEventListener('click', closeSheet);
        $('amount').addEventListener('input', updateSheet);
        $('sheet').addEventListener('click', function (e) { if (e.target === $('sheet')) closeSheet(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('sheet').hidden) closeSheet(); });
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden && state.user) refresh().catch(function () {});
        });
    }

    function start() {
        bind();

        api('/config').then(function (settings) { state.settings = settings; })
            .catch(function () { /* valeurs par défaut */ })
            .then(function () {
                initPi();

                if (!state.token) {
                    showWelcome();
                    return;
                }

                // Session existante : on affiche tout de suite, et on reconnecte Pi en arrière-plan
                return refresh().then(function () {
                    showHome();
                    if (state.piReady && inPiBrowser()) {
                        piAuthenticate().catch(function () { /* on réessaiera au moment du dépôt */ });
                    }
                }).catch(function () {
                    logout();
                });
            });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
