/* Mes fichiers : espace de stockage privé. */
(function () {
    'use strict';
    var A = window.PiApp;
    var html = A.html;

    function size(bytes) {
        if (bytes < 1024) return bytes + ' o';
        if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' Ko';
        return (bytes / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' Mo';
    }

    A.route('#/fichiers', async function (ctx) {
        var data = await A.request('/api/files');
        var pct = Math.min(100, Math.round(data.used / data.quota * 100));

        A.mount(ctx, html`
            ${A.backLink('#/', 'Accueil')}
            <h1>Mes fichiers</h1>
            <p class="lead">Vos documents, photos et reçus. Vous seul y avez accès.</p>
            <div class="meter" role="img" aria-label="${pct} % utilisés"><span style="width:${pct}%"></span></div>
            <p class="row-meta">${size(data.used)} utilisés sur ${size(data.quota)}</p>
            <form class="form" data-form="upload">
                <label class="field"><span>Ajouter un fichier <small>(10 Mo maximum)</small></span>
                    <input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.zip,.mp3,.mp4">
                </label>
                <button class="btn btn-main" type="submit" data-busy="Envoi…">Envoyer</button>
            </form>
            ${data.files.length ? html`<ul class="rows">${data.files.map(function (f) {
                return html`
                    <li class="row" data-box>
                        <div class="row-head"><span class="row-title">${f.name}</span><span class="row-meta">${size(f.size)}</span></div>
                        <div class="row-meta">${A.date(f.createdAt)}</div>
                        <div class="row-actions">
                            <button class="btn-small btn-line" type="button" data-act="download" data-id="${f.id}" data-name="${f.name}">Télécharger</button>
                            <button class="btn-small btn-danger" type="button" data-act="remove" data-id="${f.id}">Supprimer</button>
                        </div>
                    </li>`;
            })}</ul>` : html`<p class="empty">Aucun fichier pour l'instant.</p>`}
        `, {
            upload: async function (form) {
                await A.request('/api/files', { method: 'POST', body: new FormData(form) });
                A.toast('Fichier enregistré.');
                A.go('#/fichiers');
            },
            download: async function (el) {
                var res = await A.request('/api/files/' + el.dataset.id + '/download', { raw: true });
                var url = URL.createObjectURL(await res.blob());
                var a = document.createElement('a');
                a.href = url;
                a.download = el.dataset.name;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
            },
            remove: async function (el) {
                if (!A.confirmFirst(el, 'Confirmer la suppression')) return;
                await A.request('/api/files/' + el.dataset.id, { method: 'DELETE' });
                A.toast('Fichier supprimé.');
                A.go('#/fichiers');
            }
        });
    });
})();
