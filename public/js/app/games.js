/* Jeux pour s'amuser : scores et classement, sans gain en Pi. */
(function () {
    'use strict';
    var A = window.PiApp;
    var html = A.html;

    A.route('#/jeux', async function (ctx) {
        var data = await A.request('/api/games');
        A.mount(ctx, html`
            ${A.backLink('#/', 'Accueil')}
            <h1>Jeux</h1>
            <p class="lead">Pour le plaisir et le classement : les jeux ne font ni gagner ni perdre de Pi.</p>
            <ul class="rows">${data.games.map(function (g) {
                return html`
                    <li class="row">
                        <div class="row-head"><span class="row-title">${g.name}</span>${g.myBest != null ? html`<span class="row-amount">Mon record : ${g.myBest}</span>` : ''}</div>
                        <div class="row-meta">${g.description}</div>
                        ${g.leader ? html`<div class="row-meta">En tête : @${g.leader.piUsername} avec ${g.leader.score} points</div>` : ''}
                        <div class="row-actions"><a class="btn-small btn-green" href="#/jeux/${g.slug}">Jouer</a></div>
                    </li>`;
            })}</ul>
        `);
    });

    async function finish(ctx, slug, score, extra) {
        var result = null;
        var error = null;
        try {
            result = await A.request('/api/games/' + slug + '/scores', { method: 'POST', body: { score: score } });
        } catch (e) {
            error = e.message;
        }
        var board = await A.request('/api/games/' + slug + '/leaderboard');
        var me = A.state.user.piUsername;
        A.mount(ctx, html`
            ${A.backLink('#/jeux', 'Jeux')}
            <h1>${board.game.name}</h1>
            <div class="game-board">
                <p class="question">${score} points</p>
                <p>${extra || ''}${result && result.newRecord ? ' Nouveau record !' : result ? ' Votre record : ' + result.myBest + '.' : ''}</p>
                ${error ? html`<p class="form-error">${error}</p>` : ''}
                <button class="btn btn-main" type="button" data-act="again">Rejouer</button>
            </div>
            <h2>Classement</h2>
            <ol class="leader">${board.leaderboard.map(function (row) {
                return html`<li class="${row.piUsername === me ? 'is-me' : ''}"><span>${row.rank}. @${row.piUsername}</span><span>${row.score}</span></li>`;
            })}</ol>
        `, { again: function () { A.go('#/jeux/' + slug); } });
    }

    // ------------------------------------------------------------------
    // Calcul éclair : 60 secondes, +10 par bonne réponse, −5 par erreur
    // ------------------------------------------------------------------

    function question() {
        var op = ['+', '−', '×'][Math.floor(Math.random() * 3)];
        var a, b, r;
        if (op === '×') { a = 2 + Math.floor(Math.random() * 9); b = 2 + Math.floor(Math.random() * 9); r = a * b; }
        else if (op === '+') { a = 5 + Math.floor(Math.random() * 60); b = 5 + Math.floor(Math.random() * 40); r = a + b; }
        else { a = 20 + Math.floor(Math.random() * 60); b = 1 + Math.floor(Math.random() * 19); r = a - b; }
        var choices = [r];
        while (choices.length < 4) {
            var c = r + (Math.floor(Math.random() * 11) - 5);
            if (c !== r && c >= 0 && choices.indexOf(c) === -1) choices.push(c);
        }
        choices.sort(function () { return Math.random() - 0.5; });
        return { text: a + ' ' + op + ' ' + b, answer: r, choices: choices };
    }

    A.route('#/jeux/calcul', async function (ctx) {
        var score = 0;
        var good = 0;
        var left = 60;
        var q = question();
        var timer = null;

        function draw() {
            A.mount(ctx, html`
                ${A.backLink('#/jeux', 'Jeux')}
                <h1>Calcul éclair</h1>
                <div class="game-board">
                    <div class="game-stats"><span>${left} s</span><span>${score} points</span></div>
                    <p class="question">${q.text}</p>
                    <div class="answers">${q.choices.map(function (c) {
                        return html`<button type="button" data-act="pick" data-v="${c}">${c}</button>`;
                    })}</div>
                </div>
            `, {
                pick: function (el) {
                    if (Number(el.dataset.v) === q.answer) { score += 10; good += 1; } else { score = Math.max(0, score - 5); }
                    q = question();
                    draw();
                }
            });
        }

        A.mount(ctx, html`
            ${A.backLink('#/jeux', 'Jeux')}
            <h1>Calcul éclair</h1>
            <div class="game-board">
                <p>Répondez au plus grand nombre de calculs en 60 secondes. Bonne réponse : +10. Erreur : −5.</p>
                <button class="btn btn-main" type="button" data-act="start">Commencer</button>
            </div>
        `, {
            start: function () {
                draw();
                timer = setInterval(function () {
                    if (!ctx.isCurrent()) { clearInterval(timer); return; }
                    left -= 1;
                    if (left <= 0) {
                        clearInterval(timer);
                        finish(ctx, 'calcul', score, good + ' bonne' + (good > 1 ? 's' : '') + ' réponse' + (good > 1 ? 's' : '') + '.');
                        return;
                    }
                    var t = ctx.view.querySelector('.game-stats span');
                    if (t) t.textContent = left + ' s';
                }, 1000);
            }
        });
    });

    // ------------------------------------------------------------------
    // Mémoire : 8 paires ; score = 1000 − 30 par coup en trop − 3 par seconde
    // ------------------------------------------------------------------

    A.route('#/jeux/memoire', async function (ctx) {
        var symbols = ['☀', '☂', '★', '♣', '♥', '♦', '♠', '☘'];
        var deck = symbols.concat(symbols).sort(function () { return Math.random() - 0.5; })
            .map(function (s, i) { return { id: i, s: s, done: false }; });
        var open = [];
        var moves = 0;
        var started = null;
        var lock = false;

        function draw() {
            A.mount(ctx, html`
                ${A.backLink('#/jeux', 'Jeux')}
                <h1>Mémoire</h1>
                <div class="game-board">
                    <div class="game-stats"><span>${moves} coups</span><span>${deck.filter(function (c) { return c.done; }).length / 2} / 8 paires</span></div>
                    <div class="cards">${deck.map(function (c) {
                        var up = c.done || open.indexOf(c.id) !== -1;
                        return html`<button class="card ${c.done ? 'is-done' : up ? 'is-up' : ''}" type="button" data-act="flip" data-id="${c.id}" aria-label="${up ? c.s : 'Carte cachée'}">${up ? c.s : ''}</button>`;
                    })}</div>
                </div>
            `, {
                flip: function (el) {
                    if (lock) return;
                    var card = deck[Number(el.dataset.id)];
                    if (card.done || open.indexOf(card.id) !== -1) return;
                    if (!started) started = Date.now();
                    open.push(card.id);
                    if (open.length === 2) {
                        moves += 1;
                        var a = deck[open[0]];
                        var b = deck[open[1]];
                        if (a.s === b.s) {
                            a.done = b.done = true;
                            open = [];
                            if (deck.every(function (c) { return c.done; })) {
                                var seconds = Math.round((Date.now() - started) / 1000);
                                var score = Math.max(50, Math.min(1000, 1000 - (moves - 8) * 30 - seconds * 3));
                                finish(ctx, 'memoire', score, moves + ' coups en ' + seconds + ' secondes.');
                                return;
                            }
                        } else {
                            lock = true;
                            setTimeout(function () { open = []; lock = false; if (ctx.isCurrent()) draw(); }, 800);
                        }
                    }
                    draw();
                }
            });
        }
        draw();
    });
})();
