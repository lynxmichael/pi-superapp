// ============================================================================
// ADMIN PANEL — JS COMPLET
// Dashboard, Utilisateurs, KYC, Wallets, Transactions, Paramètres
// ============================================================================

const API = '/api/admin';
let currentPage = 1;
let currentLimit = 10;
let currentAction = null;
let currentUserId = null;
let currentSection = 'users';
let walletPage = 1;
let txPage = 1;

// ============================================================================
// INITIALISATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupSearch();
    setupFilters();
    setupMobileMenu();
    setupSidebarNav();
    setupModalClose();
    setupRefreshBtn();
    setupWalletSearch();
    setupTxSearch();
    loadUsers(1);
    setInterval(() => { if (currentSection === 'users') loadUsers(currentPage); }, 60000);
});

function checkAuth() {
    const token = localStorage.getItem('pi_token');
    if (!token) { window.location.href = '/admin/auth'; return; }
    const user = JSON.parse(localStorage.getItem('pi_user') || '{}');
    const initial = (user.piUsername || 'A').charAt(0).toUpperCase();
    const name = user.piUsername || 'Admin';
    ['adminAvatarText', 'adminAvatarText2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = initial;
    });
    const nameEl = document.getElementById('adminName');
    if (nameEl) nameEl.textContent = name;
}

function getHeaders() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('pi_token')}` };
}

function setupRefreshBtn() {
    const btn = document.getElementById('refreshBtn');
    if (btn) btn.addEventListener('click', () => switchSection(currentSection));
}

// ============================================================================
// TOAST / LOADING
// ============================================================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const icons = { success: 'check-circle', error: 'exclamation-circle', warning: 'exclamation-triangle', info: 'info-circle' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas fa-${icons[type] || 'info-circle'}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function showLoading(msg = 'Chargement...') {
    const el = document.getElementById('loadingOverlay');
    const txt = document.getElementById('loadingText');
    if (el) el.classList.add('show');
    if (txt) txt.textContent = msg;
}

function hideLoading() {
    const el = document.getElementById('loadingOverlay');
    if (el) el.classList.remove('show');
}

// ============================================================================
// SIDEBAR NAVIGATION
// ============================================================================

function setupSidebarNav() {
    document.querySelectorAll('.sidebar-nav a[data-section]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchSection(link.dataset.section);
            // Close mobile sidebar
            document.getElementById('sidebar')?.classList.remove('open');
        });
    });
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('pi_token');
            localStorage.removeItem('pi_user');
            window.location.href = '/admin/auth';
        });
    }
}

function switchSection(section) {
    currentSection = section;
    // Update sidebar
    document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
    const link = document.querySelector(`.sidebar-nav a[data-section="${section}"]`);
    if (link) link.classList.add('active');

    // Show/hide sections
    document.querySelectorAll('.section-content').forEach(s => s.style.display = 'none');
    const content = document.getElementById(`section-${section}`);
    if (content) content.style.display = 'block';

    // Update topbar
    const titles = {
        dashboard:    { h2: 'Tableau de bord',           bc: 'Admin / Dashboard' },
        users:        { h2: 'Gestion des utilisateurs',  bc: 'Admin / Utilisateurs' },
        kyc:          { h2: 'Demandes KYC',              bc: 'Admin / Vérifications KYC' },
        wallets:      { h2: 'Gestion des Wallets',       bc: 'Admin / Wallets' },
        transactions: { h2: 'Transactions',              bc: 'Admin / Transactions' },
        settings:     { h2: 'Paramètres',                bc: 'Admin / Paramètres' }
    };
    const t = titles[section] || titles.users;
    setText('topbarTitle', t.h2);
    setText('topbarBreadcrumb', t.bc);

    // Load data
    if (section === 'dashboard')    loadDashboard();
    if (section === 'users')        loadUsers(1);
    if (section === 'kyc')          loadPendingKYC();
    if (section === 'wallets')      loadWallets(1);
    if (section === 'transactions') loadTransactions(1);
}

// ============================================================================
// DASHBOARD
// ============================================================================

async function loadDashboard() {
    try {
        // Load stats from users endpoint
        const res = await fetch(`${API}/users?page=1&limit=5`, { headers: getHeaders() });
        if (res.status === 401) { window.location.href = '/admin/auth'; return; }
        const data = await res.json();
        const s = data.stats || {};

        // Stats cards
        const statsEl = document.getElementById('dashStats');
        if (statsEl) {
            statsEl.innerHTML = `
                <div class="stat-card total"><div class="stat-icon"><i class="fas fa-users"></i></div><div class="stat-number">${s.totalUsers || 0}</div><div class="stat-label">Total utilisateurs</div></div>
                <div class="stat-card active"><div class="stat-icon"><i class="fas fa-user-check"></i></div><div class="stat-number">${s.activeUsers || 0}</div><div class="stat-label">Actifs</div></div>
                <div class="stat-card suspended"><div class="stat-icon"><i class="fas fa-user-slash"></i></div><div class="stat-number">${s.suspendedUsers || 0}</div><div class="stat-label">Suspendus</div></div>
                <div class="stat-card pending"><div class="stat-icon"><i class="fas fa-id-card"></i></div><div class="stat-number">${s.pendingKYC || 0}</div><div class="stat-label">KYC en attente</div></div>`;
        }

        // Recent users
        const recentEl = document.getElementById('recentUsersList');
        if (recentEl) {
            const users = data.users || [];
            if (!users.length) {
                recentEl.innerHTML = '<p style="text-align:center;color:var(--gray-400);padding:20px;">Aucun utilisateur</p>';
            } else {
                recentEl.innerHTML = users.map(u => `
                    <div class="recent-item">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(u.piUsername)}&background=6366f1&color=fff&size=36" style="width:36px;height:36px;border-radius:8px;">
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:600;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(u.piUsername)}</div>
                            <div style="font-size:.8rem;color:var(--gray-400);">${esc(u.email || '—')}</div>
                        </div>
                        <span class="badge badge-${u.status === 'active' ? 'success' : 'warning'}">${u.status}</span>
                    </div>`).join('');
            }
        }

        // Dashboard KYC list
        try {
            const kycRes = await fetch(`${API}/kyc/pending`, { headers: getHeaders() });
            const kycData = await kycRes.json();
            const dashKyc = document.getElementById('dashKycList');
            if (dashKyc) {
                const users = kycData.users || [];
                if (!users.length) {
                    dashKyc.innerHTML = '<div style="text-align:center;padding:20px;color:var(--success);"><i class="fas fa-check-double" style="font-size:2rem;display:block;margin-bottom:8px;"></i>Tout est traité !</div>';
                } else {
                    dashKyc.innerHTML = users.slice(0, 5).map(u => `
                        <div class="recent-item">
                            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(u.piUsername)}&background=f59e0b&color=fff&size=36" style="width:36px;height:36px;border-radius:8px;">
                            <div style="flex:1;min-width:0;">
                                <div style="font-weight:600;font-size:.9rem;">${esc(u.piUsername)}</div>
                                <div style="font-size:.8rem;color:var(--gray-400);">${u.verification?.kycSubmittedAt ? timeAgo(u.verification.kycSubmittedAt) : '—'}</div>
                            </div>
                            <button class="btn btn-sm btn-warning" onclick="switchSection('kyc');reviewKYC('${u._id}')"><i class="fas fa-eye"></i></button>
                        </div>`).join('');
                }
            }
        } catch (e) { console.log('KYC dashboard:', e); }

    } catch (error) {
        console.error('Dashboard:', error);
        showToast('Erreur chargement dashboard', 'error');
    }
}

// ============================================================================
// LOAD USERS
// ============================================================================

async function loadUsers(page = 1) {
    currentPage = page;
    try {
        const search = document.getElementById('search')?.value || '';
        const role = document.getElementById('roleFilter')?.value || '';
        const status = document.getElementById('statusFilter')?.value || '';
        const kyc = document.getElementById('kycFilter')?.value || '';

        const params = new URLSearchParams({ page, limit: currentLimit });
        if (search) params.append('search', search);
        if (role) params.append('role', role);
        if (status) params.append('status', status);
        if (kyc) params.append('kyc', kyc);

        const res = await fetch(`${API}/users?${params}`, { headers: getHeaders() });
        if (res.status === 401) { localStorage.removeItem('pi_token'); window.location.href = '/admin/auth'; return; }
        if (res.status === 403) { showToast('Accès refusé', 'error'); return; }

        const data = await res.json();
        renderUsers(data.users || []);
        updateStats(data.stats);
        updatePagination(data.total, data.page, data.pages);
        updateTableInfo(data.total, data.page);
    } catch (error) {
        console.error('Erreur:', error);
        showToast('Erreur de connexion au serveur', 'error');
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('usersTable');
    if (!tbody) return;

    if (!users.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--gray-400);"><i class="fas fa-inbox" style="font-size:2rem;display:block;margin-bottom:8px;"></i>Aucun utilisateur trouvé</td></tr>`;
        return;
    }

    tbody.innerHTML = users.map(u => {
        const avatar = u.profile?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.piUsername)}&background=6366f1&color=fff&size=40`;
        const kycStatus = u.verification?.kycStatus || 'none';
        const kycBadge = { none: '<span class="badge badge-secondary">Non vérifié</span>', pending: '<span class="badge badge-warning">En attente</span>', approved: '<span class="badge badge-success">Vérifié ✓</span>', rejected: '<span class="badge badge-danger">Rejeté</span>' }[kycStatus] || '<span class="badge badge-secondary">—</span>';
        const statusBadge = { active: '<span class="badge badge-success">Actif</span>', suspended: '<span class="badge badge-danger">Suspendu</span>', pending: '<span class="badge badge-warning">En attente</span>', banned: '<span class="badge badge-danger">Banni</span>' }[u.status] || '<span class="badge badge-secondary">—</span>';
        const roleBadge = { admin: '<span class="badge badge-primary">Admin</span>', merchant: '<span class="badge badge-info">Marchand</span>', user: '<span class="badge badge-secondary">Utilisateur</span>' }[u.role] || '<span class="badge badge-secondary">—</span>';
        const lastLogin = u.stats?.lastLogin ? timeAgo(u.stats.lastLogin) : 'Jamais';
        const isActive = u.status === 'active';
        const isSuspended = u.status === 'suspended';
        const walletBlocked = u.security?.walletBlocked;

        return `<tr>
            <td><div style="display:flex;align-items:center;gap:10px;">
                <img src="${avatar}" style="width:36px;height:36px;border-radius:8px;object-fit:cover;" onerror="this.src='https://ui-avatars.com/api/?name=U&background=ccc&color=fff&size=36'">
                <div><div style="font-weight:600;font-size:.9rem;">${esc(u.piUsername)}</div><div style="font-size:.8rem;color:var(--gray-400);">${esc(u.walletAddress?.substring(0, 12) || '')}...</div></div>
            </div></td>
            <td style="font-size:.9rem;">${esc(u.email || '—')}</td>
            <td>${roleBadge}</td>
            <td>${statusBadge}</td>
            <td style="font-weight:600;">${(u.balance || 0).toFixed(2)} π</td>
            <td>${kycBadge}</td>
            <td style="font-size:.85rem;color:var(--gray-500);">${lastLogin}</td>
            <td><div style="display:flex;gap:6px;justify-content:center;">
                <button class="btn-action btn-view" title="Voir détails" onclick="viewUser('${u._id}')"><i class="fas fa-eye"></i></button>
                ${kycStatus === 'pending' ? `<button class="btn-action btn-kyc" title="Examiner KYC" onclick="reviewKYC('${u._id}')"><i class="fas fa-id-card"></i></button>` : ''}
                ${isActive ? `<button class="btn-action btn-warn" title="Suspendre" onclick="showConfirm('suspend','${u._id}','${esc(u.piUsername)}')"><i class="fas fa-ban"></i></button>` : ''}
                ${isSuspended ? `<button class="btn-action btn-ok" title="Activer" onclick="showConfirm('activate','${u._id}','${esc(u.piUsername)}')"><i class="fas fa-check"></i></button>` : ''}
                <button class="btn-action btn-del" title="Supprimer" onclick="showConfirm('delete','${u._id}','${esc(u.piUsername)}')"><i class="fas fa-trash"></i></button>
            </div></td>
        </tr>`;
    }).join('');
}

function updateStats(stats) {
    if (!stats) return;
    setText('totalUsers', stats.totalUsers || 0);
    setText('activeUsers', stats.activeUsers || 0);
    setText('suspendedUsers', stats.suspendedUsers || 0);
    setText('pendingKYC', stats.pendingKYC || 0);
    const kycBadge = document.getElementById('kycPendingBadge');
    if (kycBadge) {
        kycBadge.textContent = stats.pendingKYC || 0;
        kycBadge.style.display = (stats.pendingKYC > 0) ? 'inline-flex' : 'none';
    }
}

function updatePagination(total, current, pages) {
    const container = document.getElementById('paginationContainer');
    if (!container || pages <= 1) { if (container) container.innerHTML = ''; return; }
    let html = `<button class="page-btn" ${current <= 1 ? 'disabled' : ''} onclick="loadUsers(${current - 1})"><i class="fas fa-chevron-left"></i></button>`;
    for (let i = 1; i <= pages; i++) {
        if (i === 1 || i === pages || (i >= current - 1 && i <= current + 1)) {
            html += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="loadUsers(${i})">${i}</button>`;
        } else if (i === current - 2 || i === current + 2) {
            html += `<span style="color:var(--gray-400);">...</span>`;
        }
    }
    html += `<button class="page-btn" ${current >= pages ? 'disabled' : ''} onclick="loadUsers(${current + 1})"><i class="fas fa-chevron-right"></i></button>`;
    container.innerHTML = html;
}

function updateTableInfo(total, page) {
    const el = document.getElementById('tableInfo');
    if (el) {
        const start = total ? (page - 1) * currentLimit + 1 : 0;
        const end = Math.min(page * currentLimit, total);
        el.textContent = `Affichage de ${start} à ${end} sur ${total} entrées`;
    }
}

// ============================================================================
// VIEW USER DETAIL
// ============================================================================

async function viewUser(id) {
    try {
        showLoading('Chargement du profil...');
        const res = await fetch(`${API}/users/${id}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Erreur');
        const user = await res.json();
        showUserDetailModal(user);
    } catch (error) { showToast('Erreur lors du chargement', 'error'); }
    finally { hideLoading(); }
}

function showUserDetailModal(u) {
    const body = document.getElementById('detailBody');
    if (!body) return;
    const kycStatus = u.verification?.kycStatus || 'none';
    const kycClass = { none: 'secondary', pending: 'warning', approved: 'success', rejected: 'danger' }[kycStatus] || 'secondary';
    const kycLabel = { none: 'Non vérifié', pending: 'En attente', approved: 'Vérifié ✓', rejected: 'Rejeté' }[kycStatus] || '—';
    const walletBlocked = u.security?.walletBlocked;

    body.innerHTML = `
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid var(--gray-200);">
            <img src="${u.profile?.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.piUsername)}" style="width:64px;height:64px;border-radius:14px;object-fit:cover;">
            <div><h3 style="font-size:1.15rem;font-weight:700;">${esc(u.piUsername)}</h3>
                <div style="font-size:.85rem;color:var(--gray-500);">${esc(u.email)}</div>
                <div style="display:flex;gap:8px;margin-top:6px;">
                    <span class="badge badge-${u.status === 'active' ? 'success' : 'danger'}">${u.status}</span>
                    <span class="badge badge-${kycClass}">${kycLabel}</span>
                    <span class="badge badge-primary">${u.role}</span>
                    ${walletBlocked ? '<span class="badge badge-danger">🔒 Wallet bloqué</span>' : ''}
                </div>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div class="detail-item"><label>Wallet</label><span style="font-family:monospace;font-size:.82rem;word-break:break-all;">${esc(u.walletAddress || '—')}</span></div>
            <div class="detail-item"><label>Solde</label><span style="font-weight:700;font-size:1.1rem;">${(u.balance || 0).toFixed(2)} π</span></div>
            <div class="detail-item"><label>Téléphone</label><span>${esc(u.phone || 'Non renseigné')}</span></div>
            <div class="detail-item"><label>Prénom / Nom</label><span>${esc(u.profile?.firstName || '')} ${esc(u.profile?.lastName || '')}</span></div>
            <div class="detail-item"><label>Inscrit le</label><span>${u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '—'}</span></div>
            <div class="detail-item"><label>Dernière connexion</label><span>${u.stats?.lastLogin ? new Date(u.stats.lastLogin).toLocaleString('fr-FR') : 'Jamais'}</span></div>
            <div class="detail-item"><label>Connexions</label><span>${u.stats?.loginCount || 0}</span></div>
            <div class="detail-item"><label>Total gagné</label><span>${(u.totalEarned || 0).toFixed(2)} π</span></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:24px;padding-top:20px;border-top:1px solid var(--gray-200);flex-wrap:wrap;">
            <button class="btn btn-sm btn-ghost" onclick="editUser('${u._id}')"><i class="fas fa-edit"></i> Modifier</button>
            ${kycStatus === 'pending' ? `<button class="btn btn-sm btn-primary" onclick="closeModal('detailModal');reviewKYC('${u._id}')"><i class="fas fa-id-card"></i> Examiner KYC</button>` : ''}
            ${u.status === 'active' ? `<button class="btn btn-sm btn-warning" onclick="closeModal('detailModal');showConfirm('suspend','${u._id}','${esc(u.piUsername)}')"><i class="fas fa-ban"></i> Suspendre</button>` : ''}
            ${u.status === 'suspended' ? `<button class="btn btn-sm btn-success" onclick="closeModal('detailModal');showConfirm('activate','${u._id}','${esc(u.piUsername)}')"><i class="fas fa-check"></i> Activer</button>` : ''}
            ${!walletBlocked ? `<button class="btn btn-sm btn-danger" onclick="closeModal('detailModal');showConfirm('block_wallet','${u._id}','${esc(u.piUsername)}')"><i class="fas fa-lock"></i> Bloquer wallet</button>` : `<button class="btn btn-sm btn-success" onclick="closeModal('detailModal');showConfirm('unblock_wallet','${u._id}','${esc(u.piUsername)}')"><i class="fas fa-unlock"></i> Débloquer wallet</button>`}
            <button class="btn btn-sm btn-danger" onclick="closeModal('detailModal');showConfirm('delete','${u._id}','${esc(u.piUsername)}')"><i class="fas fa-trash"></i> Supprimer</button>
        </div>`;
    openModal('detailModal');
}

// ============================================================================
// REVIEW KYC
// ============================================================================

async function reviewKYC(id) {
    try {
        showLoading('Chargement du dossier KYC...');
        const res = await fetch(`${API}/kyc/${id}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Erreur');
        const data = await res.json();
        showKYCReviewModal(data.user || data);
    } catch (error) { showToast('Erreur chargement KYC', 'error'); }
    finally { hideLoading(); }
}

function showKYCReviewModal(u) {
    const body = document.getElementById('kycBody');
    if (!body) return;
    const v = u.verification || {};
    const identity = v.kycIdentity || {};
    const docs = v.kycDocuments || {};
    const selfie = v.kycSelfie || {};
    const docTypes = { id_card: "Carte d'identité", passport: 'Passeport', driver_license: 'Permis de conduire' };

    body.innerHTML = `
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--gray-200);">
            <img src="${u.profile?.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.piUsername)}" style="width:50px;height:50px;border-radius:12px;">
            <div><h3 style="font-weight:700;">${esc(u.piUsername)}</h3>
            <span style="font-size:.85rem;color:var(--gray-500);">${esc(u.email)} · Soumis le ${v.kycSubmittedAt ? new Date(v.kycSubmittedAt).toLocaleDateString('fr-FR') : '—'}</span></div>
        </div>
        <div class="kyc-section"><h4><i class="fas fa-user" style="color:var(--primary);"></i> Identité déclarée</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div class="detail-item"><label>Prénom</label><span>${esc(identity.firstName || '—')}</span></div>
                <div class="detail-item"><label>Nom</label><span>${esc(identity.lastName || '—')}</span></div>
                <div class="detail-item"><label>Date de naissance</label><span>${identity.dateOfBirth ? new Date(identity.dateOfBirth).toLocaleDateString('fr-FR') : '—'}</span></div>
                <div class="detail-item"><label>Nationalité</label><span>${esc(identity.nationality || '—')}</span></div>
                <div class="detail-item"><label>Téléphone</label><span>${esc(identity.phone || u.phone || '—')}</span></div>
                <div class="detail-item"><label>Adresse</label><span>${esc(identity.address || '—')}</span></div>
            </div>
        </div>
        <div class="kyc-section" style="background:var(--info-light);border-left:4px solid var(--info);padding:12px 16px;border-radius:8px;">
            <strong><i class="fas fa-balance-scale"></i> Correspondance profil :</strong>
            Profil: <strong>${esc(u.profile?.firstName || '?')} ${esc(u.profile?.lastName || '?')}</strong>
            ${(identity.firstName?.toLowerCase() === u.profile?.firstName?.toLowerCase() && identity.lastName?.toLowerCase() === u.profile?.lastName?.toLowerCase())
                ? '<span style="color:var(--success);font-weight:700;"> ✓ Correspond</span>'
                : '<span style="color:var(--danger);font-weight:700;"> ✗ Ne correspond pas</span>'}
        </div>
        <div class="kyc-section"><h4><i class="fas fa-file-alt" style="color:var(--primary);"></i> Document: ${docTypes[docs.type] || docs.type || '—'} · N° ${esc(docs.number || '—')}</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div><label style="display:block;font-size:.8rem;color:var(--gray-500);margin-bottom:6px;font-weight:600;">RECTO</label>
                    ${docs.frontImage ? `<img src="${docs.frontImage}" class="kyc-doc-img" onclick="openImageFullscreen(this.src)" title="Cliquer pour agrandir">` : '<div class="kyc-doc-placeholder"><i class="fas fa-image"></i> Non fourni</div>'}</div>
                <div><label style="display:block;font-size:.8rem;color:var(--gray-500);margin-bottom:6px;font-weight:600;">VERSO</label>
                    ${docs.backImage ? `<img src="${docs.backImage}" class="kyc-doc-img" onclick="openImageFullscreen(this.src)" title="Cliquer pour agrandir">` : '<div class="kyc-doc-placeholder"><i class="fas fa-image"></i> Non fourni</div>'}</div>
            </div>
        </div>
        <div class="kyc-section"><h4><i class="fas fa-portrait" style="color:var(--primary);"></i> Selfie de vérification</h4>
            ${selfie.image ? `<div style="text-align:center;"><img src="${selfie.image}" class="kyc-selfie-img" onclick="openImageFullscreen(this.src)" title="Agrandir"><div style="font-size:.8rem;color:var(--gray-500);margin-top:6px;">Capturé le ${selfie.capturedAt ? new Date(selfie.capturedAt).toLocaleString('fr-FR') : '—'}</div></div>` : '<div class="kyc-doc-placeholder"><i class="fas fa-user-circle"></i> Pas de selfie</div>'}
        </div>
        <div class="kyc-section"><h4><i class="fas fa-comment" style="color:var(--gray-500);"></i> Notes administrateur</h4>
            <textarea id="kycAdminNotes" rows="3" placeholder="Ajouter des notes (optionnel)..." style="width:100%;padding:10px 14px;border:2px solid var(--gray-200);border-radius:10px;font-family:inherit;font-size:.9rem;resize:vertical;"></textarea>
        </div>
        <div id="kycRejectReasonBlock" style="display:none;" class="kyc-section">
            <h4 style="color:var(--danger);"><i class="fas fa-times-circle"></i> Raison du rejet *</h4>
            <select id="kycRejectReason" style="width:100%;padding:10px 14px;border:2px solid var(--gray-200);border-radius:10px;font-family:inherit;font-size:.9rem;margin-bottom:8px;">
                <option value="">Choisir une raison...</option>
                <option value="Documents illisibles ou flous">Documents illisibles ou flous</option>
                <option value="Le nom ne correspond pas au document">Le nom ne correspond pas au document</option>
                <option value="Selfie ne correspond pas au document">Selfie ne correspond pas au document</option>
                <option value="Document expiré">Document expiré</option>
                <option value="Document non accepté">Type de document non accepté</option>
                <option value="Informations incomplètes">Informations incomplètes</option>
            </select>
            <input type="text" id="kycRejectReasonCustom" placeholder="Ou raison personnalisée..." style="width:100%;padding:10px 14px;border:2px solid var(--gray-200);border-radius:10px;font-family:inherit;font-size:.9rem;">
        </div>
        <div style="display:flex;gap:12px;margin-top:20px;padding-top:16px;border-top:1px solid var(--gray-200);">
            <button class="btn btn-success" style="flex:1;" onclick="approveKYC('${u._id || u.id}')"><i class="fas fa-check-circle"></i> Approuver</button>
            <button class="btn btn-danger" style="flex:1;" id="kycRejectToggleBtn" onclick="toggleRejectForm()"><i class="fas fa-times-circle"></i> Rejeter</button>
            <button class="btn btn-danger" style="flex:1;display:none;" id="kycRejectConfirmBtn" onclick="rejectKYC('${u._id || u.id}')"><i class="fas fa-paper-plane"></i> Confirmer le rejet</button>
        </div>`;
    openModal('kycModal');
}

function toggleRejectForm() {
    const block = document.getElementById('kycRejectReasonBlock');
    const toggleBtn = document.getElementById('kycRejectToggleBtn');
    const confirmBtn = document.getElementById('kycRejectConfirmBtn');
    if (block.style.display === 'none') {
        block.style.display = 'block';
        toggleBtn.style.display = 'none';
        confirmBtn.style.display = 'flex';
        block.scrollIntoView({ behavior: 'smooth' });
    }
}

async function approveKYC(id) {
    try {
        showLoading('Approbation en cours...');
        const notes = document.getElementById('kycAdminNotes')?.value || '';
        const res = await fetch(`${API}/kyc/${id}/approve`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify({ adminNotes: notes }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        showToast(data.message || 'KYC approuvé avec succès!', 'success');
        closeModal('kycModal');
        if (currentSection === 'users') loadUsers(currentPage);
        if (currentSection === 'kyc') loadPendingKYC();
    } catch (error) { showToast(error.message || 'Erreur', 'error'); }
    finally { hideLoading(); }
}

async function rejectKYC(id) {
    const reason = document.getElementById('kycRejectReason')?.value || document.getElementById('kycRejectReasonCustom')?.value;
    if (!reason) { showToast('Veuillez sélectionner ou saisir une raison de rejet', 'warning'); return; }
    try {
        showLoading('Rejet en cours...');
        const notes = document.getElementById('kycAdminNotes')?.value || '';
        const res = await fetch(`${API}/kyc/${id}/reject`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify({ reason, adminNotes: notes }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        showToast(data.message || 'KYC rejeté', 'warning');
        closeModal('kycModal');
        if (currentSection === 'users') loadUsers(currentPage);
        if (currentSection === 'kyc') loadPendingKYC();
    } catch (error) { showToast(error.message || 'Erreur', 'error'); }
    finally { hideLoading(); }
}

// ============================================================================
// PENDING KYC LIST
// ============================================================================

async function loadPendingKYC() {
    try {
        const res = await fetch(`${API}/kyc/pending`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Erreur');
        const data = await res.json();
        renderPendingKYC(data.users || []);
    } catch (error) { showToast('Erreur chargement KYC', 'error'); }
}

function renderPendingKYC(users) {
    const container = document.getElementById('kycListContainer');
    if (!container) return;
    if (!users.length) {
        container.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--gray-400);"><i class="fas fa-check-double" style="font-size:3rem;display:block;margin-bottom:12px;color:var(--success);"></i><h3 style="color:var(--gray-600);">Aucune demande en attente</h3><p>Toutes les demandes KYC ont été traitées.</p></div>`;
        return;
    }
    container.innerHTML = users.map(u => {
        const identity = u.verification?.kycIdentity || {};
        const timeDiff = u.verification?.kycSubmittedAt ? timeAgo(u.verification.kycSubmittedAt) : '—';
        return `<div class="kyc-card">
            <div style="display:flex;align-items:center;gap:12px;">
                <img src="${u.profile?.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.piUsername)}" style="width:44px;height:44px;border-radius:10px;">
                <div style="flex:1;"><div style="font-weight:700;">${esc(u.piUsername)}</div><div style="font-size:.85rem;color:var(--gray-500);">${esc(identity.firstName || '')} ${esc(identity.lastName || '')} · ${esc(u.email)}</div></div>
                <div style="text-align:right;"><span class="badge badge-warning">En attente</span><div style="font-size:.8rem;color:var(--gray-400);margin-top:4px;">${timeDiff}</div></div>
            </div>
            <div style="display:flex;gap:10px;margin-top:12px;">
                <button class="btn btn-sm btn-primary" onclick="reviewKYC('${u._id}')"><i class="fas fa-search"></i> Examiner</button>
                <button class="btn btn-sm btn-success" onclick="approveKYC('${u._id}')"><i class="fas fa-check"></i> Approuver</button>
                <button class="btn btn-sm btn-danger" onclick="reviewKYC('${u._id}')"><i class="fas fa-times"></i> Rejeter</button>
            </div>
        </div>`;
    }).join('');
}

// ============================================================================
// WALLETS
// ============================================================================

async function loadWallets(page = 1) {
    walletPage = page;
    try {
        const search = document.getElementById('walletSearch')?.value || '';
        const walletFilter = document.getElementById('walletStatusFilter')?.value || '';
        const params = new URLSearchParams({ page, limit: 10 });
        if (search) params.append('search', search);

        const res = await fetch(`${API}/users?${params}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Erreur');
        const data = await res.json();
        const users = data.users || [];
        const stats = data.stats || {};

        // Stats
        const statsEl = document.getElementById('walletStatsGrid');
        if (statsEl) {
            const totalBalance = users.reduce((sum, u) => sum + (u.balance || 0), 0);
            const blocked = users.filter(u => u.security?.walletBlocked).length;
            statsEl.innerHTML = `
                <div class="stat-card total"><div class="stat-icon"><i class="fas fa-wallet"></i></div><div class="stat-number">${stats.totalUsers || 0}</div><div class="stat-label">Total wallets</div></div>
                <div class="stat-card active"><div class="stat-icon"><i class="fas fa-coins"></i></div><div class="stat-number">${totalBalance.toFixed(2)} π</div><div class="stat-label">Solde total (page)</div></div>
                <div class="stat-card suspended"><div class="stat-icon"><i class="fas fa-lock"></i></div><div class="stat-number">${blocked}</div><div class="stat-label">Wallets bloqués</div></div>
                <div class="stat-card info-card"><div class="stat-icon"><i class="fas fa-user-check"></i></div><div class="stat-number">${stats.activeUsers || 0}</div><div class="stat-label">Utilisateurs actifs</div></div>`;
        }

        // Filter
        let filtered = users;
        if (walletFilter === 'blocked') filtered = users.filter(u => u.security?.walletBlocked);
        if (walletFilter === 'active') filtered = users.filter(u => !u.security?.walletBlocked);

        // Table
        const tbody = document.getElementById('walletsTable');
        if (tbody) {
            if (!filtered.length) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--gray-400);"><i class="fas fa-wallet" style="font-size:2rem;display:block;margin-bottom:8px;"></i>Aucun wallet trouvé</td></tr>`;
            } else {
                tbody.innerHTML = filtered.map(u => {
                    const blocked = u.security?.walletBlocked;
                    const kycStatus = u.verification?.kycStatus || 'none';
                    const kycBadge = { approved: '<span class="badge badge-success">Vérifié</span>', pending: '<span class="badge badge-warning">En attente</span>', rejected: '<span class="badge badge-danger">Rejeté</span>' }[kycStatus] || '<span class="badge badge-secondary">—</span>';
                    return `<tr>
                        <td><div style="display:flex;align-items:center;gap:10px;"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(u.piUsername)}&background=6366f1&color=fff&size=36" style="width:36px;height:36px;border-radius:8px;"><div><div style="font-weight:600;">${esc(u.piUsername)}</div><div style="font-size:.8rem;color:var(--gray-400);">${esc(u.email || '')}</div></div></div></td>
                        <td style="font-family:monospace;font-size:.82rem;word-break:break-all;">${esc(u.walletAddress || '—')}</td>
                        <td style="font-weight:700;">${(u.balance || 0).toFixed(2)} π</td>
                        <td>${blocked ? '<span class="badge badge-danger">🔒 Bloqué</span>' : '<span class="badge badge-success">✓ Actif</span>'}</td>
                        <td>${kycBadge}</td>
                        <td style="text-align:center;">
                            <div style="display:flex;gap:6px;justify-content:center;">
                                <button class="btn-action btn-view" title="Détails" onclick="viewUser('${u._id}')"><i class="fas fa-eye"></i></button>
                                ${!blocked ? `<button class="btn-action btn-del" title="Bloquer" onclick="showConfirm('block_wallet','${u._id}','${esc(u.piUsername)}')"><i class="fas fa-lock"></i></button>` : `<button class="btn-action btn-ok" title="Débloquer" onclick="showConfirm('unblock_wallet','${u._id}','${esc(u.piUsername)}')"><i class="fas fa-unlock"></i></button>`}
                            </div>
                        </td>
                    </tr>`;
                }).join('');
            }
        }

        const info = document.getElementById('walletTableInfo');
        if (info) info.textContent = `${filtered.length} wallets affichés · Page ${data.page} sur ${data.pages}`;

    } catch (error) {
        console.error('Wallets:', error);
        showToast('Erreur chargement wallets', 'error');
    }
}

function setupWalletSearch() {
    const input = document.getElementById('walletSearch');
    const filter = document.getElementById('walletStatusFilter');
    let timeout;
    if (input) input.addEventListener('input', () => { clearTimeout(timeout); timeout = setTimeout(() => loadWallets(1), 400); });
    if (filter) filter.addEventListener('change', () => loadWallets(1));
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

async function loadTransactions(page = 1) {
    txPage = page;
    try {
        const search = document.getElementById('txSearch')?.value || '';
        const type = document.getElementById('txTypeFilter')?.value || '';
        const status = document.getElementById('txStatusFilter')?.value || '';
        const params = new URLSearchParams({ page, limit: 10 });
        if (search) params.append('search', search);
        if (type) params.append('type', type);
        if (status) params.append('status', status);

        const res = await fetch(`/api/transactions?${params}`, { headers: getHeaders() });

        if (!res.ok) {
            // Fallback: show empty state if transactions route doesn't exist yet
            showEmptyTransactions();
            return;
        }

        const data = await res.json();
        const transactions = data.transactions || data.data || [];
        const total = data.total || transactions.length;

        // Stats
        const statsEl = document.getElementById('txStatsGrid');
        if (statsEl) {
            const completed = transactions.filter(t => t.status === 'completed').length;
            const pendingTx = transactions.filter(t => t.status === 'pending').length;
            const failed = transactions.filter(t => t.status === 'failed').length;
            const totalAmount = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
            statsEl.innerHTML = `
                <div class="stat-card total"><div class="stat-icon"><i class="fas fa-exchange-alt"></i></div><div class="stat-number">${total}</div><div class="stat-label">Total transactions</div></div>
                <div class="stat-card active"><div class="stat-icon"><i class="fas fa-check-circle"></i></div><div class="stat-number">${completed}</div><div class="stat-label">Complétées</div></div>
                <div class="stat-card pending"><div class="stat-icon"><i class="fas fa-clock"></i></div><div class="stat-number">${pendingTx}</div><div class="stat-label">En attente</div></div>
                <div class="stat-card suspended"><div class="stat-icon"><i class="fas fa-coins"></i></div><div class="stat-number">${totalAmount.toFixed(2)} π</div><div class="stat-label">Volume (page)</div></div>`;
        }

        // Table
        const tbody = document.getElementById('txTable');
        if (tbody) {
            if (!transactions.length) {
                tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--gray-400);"><i class="fas fa-exchange-alt" style="font-size:2rem;display:block;margin-bottom:8px;"></i>Aucune transaction trouvée</td></tr>`;
            } else {
                tbody.innerHTML = transactions.map(tx => {
                    const statusBadge = { completed: '<span class="badge badge-success">Complété</span>', pending: '<span class="badge badge-warning">En attente</span>', failed: '<span class="badge badge-danger">Échoué</span>' }[tx.status] || '<span class="badge badge-secondary">—</span>';
                    const typeBadge = { transfer: '<span class="badge badge-info">Transfert</span>', payment: '<span class="badge badge-primary">Paiement</span>', deposit: '<span class="badge badge-success">Dépôt</span>', withdrawal: '<span class="badge badge-warning">Retrait</span>' }[tx.type] || `<span class="badge badge-secondary">${esc(tx.type || '—')}</span>`;
                    const from = tx.sender?.piUsername || tx.from || '—';
                    const to = tx.recipient?.piUsername || tx.to || '—';
                    return `<tr>
                        <td style="font-family:monospace;font-size:.82rem;">${esc((tx._id || '').substring(0, 10))}...</td>
                        <td style="font-size:.9rem;">${esc(from)}</td>
                        <td style="font-size:.9rem;">${esc(to)}</td>
                        <td style="font-weight:700;">${(tx.amount || 0).toFixed(2)} π</td>
                        <td>${typeBadge}</td>
                        <td>${statusBadge}</td>
                        <td style="font-size:.85rem;color:var(--gray-500);">${tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('fr-FR') : '—'}</td>
                        <td style="text-align:center;"><button class="btn-action btn-view" title="Détails" onclick="viewTransaction('${tx._id}')"><i class="fas fa-eye"></i></button></td>
                    </tr>`;
                }).join('');
            }
        }

        const info = document.getElementById('txTableInfo');
        if (info) info.textContent = `${transactions.length} transactions · Page ${page}`;

    } catch (error) {
        console.error('Transactions:', error);
        showEmptyTransactions();
    }
}

function showEmptyTransactions() {
    const statsEl = document.getElementById('txStatsGrid');
    if (statsEl) statsEl.innerHTML = `
        <div class="stat-card total"><div class="stat-icon"><i class="fas fa-exchange-alt"></i></div><div class="stat-number">0</div><div class="stat-label">Total transactions</div></div>
        <div class="stat-card active"><div class="stat-icon"><i class="fas fa-check-circle"></i></div><div class="stat-number">0</div><div class="stat-label">Complétées</div></div>
        <div class="stat-card pending"><div class="stat-icon"><i class="fas fa-clock"></i></div><div class="stat-number">0</div><div class="stat-label">En attente</div></div>
        <div class="stat-card suspended"><div class="stat-icon"><i class="fas fa-coins"></i></div><div class="stat-number">0.00 π</div><div class="stat-label">Volume total</div></div>`;
    const tbody = document.getElementById('txTable');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--gray-400);"><i class="fas fa-exchange-alt" style="font-size:2rem;display:block;margin-bottom:8px;"></i>Aucune transaction pour le moment</td></tr>`;
}

function viewTransaction(id) {
    const body = document.getElementById('txDetailBody');
    if (!body) return;
    body.innerHTML = `<div style="text-align:center;padding:20px;color:var(--gray-400);"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem;"></i></div>`;
    openModal('txDetailModal');

    fetch(`/api/transactions/${id}`, { headers: getHeaders() })
        .then(r => r.json())
        .then(tx => {
            const t = tx.transaction || tx;
            body.innerHTML = `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                    <div class="detail-item"><label>ID Transaction</label><span style="font-family:monospace;font-size:.82rem;word-break:break-all;">${esc(t._id || '—')}</span></div>
                    <div class="detail-item"><label>Montant</label><span style="font-weight:700;font-size:1.1rem;">${(t.amount || 0).toFixed(2)} π</span></div>
                    <div class="detail-item"><label>De</label><span>${esc(t.sender?.piUsername || t.from || '—')}</span></div>
                    <div class="detail-item"><label>À</label><span>${esc(t.recipient?.piUsername || t.to || '—')}</span></div>
                    <div class="detail-item"><label>Type</label><span>${esc(t.type || '—')}</span></div>
                    <div class="detail-item"><label>Statut</label><span>${esc(t.status || '—')}</span></div>
                    <div class="detail-item"><label>Date</label><span>${t.createdAt ? new Date(t.createdAt).toLocaleString('fr-FR') : '—'}</span></div>
                    <div class="detail-item"><label>Référence</label><span style="font-family:monospace;">${esc(t.reference || t.piPaymentId || '—')}</span></div>
                </div>
                ${t.memo ? `<div class="detail-item" style="margin-top:12px;"><label>Mémo</label><span>${esc(t.memo)}</span></div>` : ''}`;
        })
        .catch(() => { body.innerHTML = '<p style="color:var(--danger);text-align:center;">Erreur chargement détails</p>'; });
}

function setupTxSearch() {
    const input = document.getElementById('txSearch');
    const typeF = document.getElementById('txTypeFilter');
    const statusF = document.getElementById('txStatusFilter');
    let timeout;
    if (input) input.addEventListener('input', () => { clearTimeout(timeout); timeout = setTimeout(() => loadTransactions(1), 400); });
    if (typeF) typeF.addEventListener('change', () => loadTransactions(1));
    if (statusF) statusF.addEventListener('change', () => loadTransactions(1));
}

// ============================================================================
// SETTINGS
// ============================================================================

function saveSettings() {
    showToast('Paramètres enregistrés avec succès !', 'success');
    // Here you would POST to /api/admin/settings with the values
    console.log('Settings saved:', {
        kycRequired: document.getElementById('settingKycRequired')?.checked,
        emailVerif: document.getElementById('settingEmailVerif')?.checked,
        dailyLimit: document.getElementById('settingDailyLimit')?.value,
        adminEmail: document.getElementById('settingAdminEmail')?.checked,
        smsKyc: document.getElementById('settingSmsKyc')?.checked,
        maintenance: document.getElementById('settingMaintenance')?.checked,
        exchangeRate: document.getElementById('settingExchangeRate')?.value
    });
}

// ============================================================================
// CONFIRM ACTIONS (activate, suspend, delete, block/unblock wallet)
// ============================================================================

function showConfirm(action, userId, username) {
    currentAction = action;
    currentUserId = userId;
    const title = document.getElementById('modalTitle');
    const message = document.getElementById('modalMessage');
    const btn = document.getElementById('confirmActionBtn');
    const configs = {
        activate: { title: 'Activer le compte', msg: `Voulez-vous activer le compte de <strong>${username}</strong> ?`, btnText: 'Activer', btnClass: 'btn btn-success' },
        suspend: { title: 'Suspendre le compte', msg: `Voulez-vous suspendre le compte de <strong>${username}</strong> ? L'utilisateur ne pourra plus se connecter.`, btnText: 'Suspendre', btnClass: 'btn btn-warning' },
        delete: { title: 'Supprimer le compte', msg: `Voulez-vous <strong>supprimer définitivement</strong> le compte de <strong>${username}</strong> ? Cette action est irréversible.`, btnText: 'Supprimer', btnClass: 'btn btn-danger' },
        block_wallet: { title: 'Bloquer le wallet', msg: `Voulez-vous bloquer le wallet de <strong>${username}</strong> ? Aucune transaction ne sera possible.`, btnText: 'Bloquer', btnClass: 'btn btn-danger' },
        unblock_wallet: { title: 'Débloquer le wallet', msg: `Voulez-vous débloquer le wallet de <strong>${username}</strong> ?`, btnText: 'Débloquer', btnClass: 'btn btn-success' }
    };
    const cfg = configs[action] || configs.suspend;
    title.textContent = cfg.title;
    message.innerHTML = cfg.msg;
    btn.textContent = cfg.btnText;
    btn.className = cfg.btnClass;
    openModal('confirmModal');
}

async function confirmAction() {
    try {
        showLoading('Traitement...');
        let res;
        if (currentAction === 'activate' || currentAction === 'suspend') {
            res = await fetch(`${API}/users/${currentUserId}/status`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify({ status: currentAction === 'activate' ? 'active' : 'suspended' }) });
        } else if (currentAction === 'delete') {
            res = await fetch(`${API}/users/${currentUserId}`, { method: 'DELETE', headers: getHeaders() });
        } else if (currentAction === 'block_wallet' || currentAction === 'unblock_wallet') {
            res = await fetch(`${API}/users/${currentUserId}/wallet`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify({ walletBlocked: currentAction === 'block_wallet' }) });
        }
        if (!res) return;
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        showToast(data.message || 'Action effectuée', 'success');
        closeModal('confirmModal');
        if (currentSection === 'users') loadUsers(currentPage);
        if (currentSection === 'wallets') loadWallets(walletPage);
    } catch (error) { showToast(error.message || 'Erreur', 'error'); }
    finally { hideLoading(); }
}

// ============================================================================
// EDIT USER
// ============================================================================

async function editUser(id) {
    try {
        showLoading('Chargement...');
        const res = await fetch(`${API}/users/${id}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Erreur');
        const user = await res.json();
        showEditModal(user);
    } catch (error) { showToast('Erreur', 'error'); }
    finally { hideLoading(); }
}

function showEditModal(u) {
    const body = document.getElementById('editForm');
    if (!body) return;
    body.innerHTML = `
        <div class="form-field"><label>Nom d'utilisateur Pi</label><input type="text" value="${esc(u.piUsername || '')}" readonly style="opacity:.6;"></div>
        <div class="form-field"><label>Email</label><input type="email" id="editEmail" value="${esc(u.email || '')}"></div>
        <div class="form-field"><label>Téléphone</label><input type="tel" id="editPhone" value="${esc(u.phone || '')}"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-field"><label>Rôle</label><select id="editRole"><option value="user" ${u.role === 'user' ? 'selected' : ''}>Utilisateur</option><option value="merchant" ${u.role === 'merchant' ? 'selected' : ''}>Marchand</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option></select></div>
            <div class="form-field"><label>Statut</label><select id="editStatus"><option value="active" ${u.status === 'active' ? 'selected' : ''}>Actif</option><option value="suspended" ${u.status === 'suspended' ? 'selected' : ''}>Suspendu</option><option value="pending" ${u.status === 'pending' ? 'selected' : ''}>En attente</option></select></div>
        </div>
        <div class="form-field"><label>Solde (π)</label><input type="number" id="editBalance" value="${u.balance || 0}" step="0.01" min="0"></div>
        <div class="form-field"><label>Statut KYC</label><select id="editKyc"><option value="none" ${u.verification?.kycStatus === 'none' ? 'selected' : ''}>Non vérifié</option><option value="pending" ${u.verification?.kycStatus === 'pending' ? 'selected' : ''}>En attente</option><option value="approved" ${u.verification?.kycStatus === 'approved' ? 'selected' : ''}>Approuvé</option><option value="rejected" ${u.verification?.kycStatus === 'rejected' ? 'selected' : ''}>Rejeté</option></select></div>
        <div class="modal-foot" style="padding:16px 0 0;">
            <button class="btn btn-ghost" onclick="closeModal('editModal')">Annuler</button>
            <button class="btn btn-primary" onclick="saveUser('${u._id}')"><i class="fas fa-save"></i> Enregistrer</button>
        </div>`;
    openModal('editModal');
}

async function saveUser(id) {
    try {
        showLoading('Sauvegarde...');
        const body = {
            email: document.getElementById('editEmail')?.value,
            phone: document.getElementById('editPhone')?.value,
            role: document.getElementById('editRole')?.value,
            status: document.getElementById('editStatus')?.value,
            balance: parseFloat(document.getElementById('editBalance')?.value) || 0,
            'verification.kycStatus': document.getElementById('editKyc')?.value
        };
        const res = await fetch(`${API}/users/${id}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        showToast('Utilisateur mis à jour', 'success');
        closeModal('editModal');
        closeModal('detailModal');
        loadUsers(currentPage);
    } catch (error) { showToast(error.message || 'Erreur', 'error'); }
    finally { hideLoading(); }
}

// ============================================================================
// IMAGE FULLSCREEN
// ============================================================================

function openImageFullscreen(src) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:10000;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
    overlay.innerHTML = `<img src="${src}" style="max-width:90%;max-height:90%;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.5);"><button style="position:absolute;top:20px;right:20px;background:rgba(255,255,255,.2);border:none;color:white;width:44px;height:44px;border-radius:50%;font-size:1.2rem;cursor:pointer;"><i class="fas fa-times"></i></button>`;
    overlay.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
}

// ============================================================================
// SEARCH / FILTERS
// ============================================================================

function setupSearch() {
    const input = document.getElementById('search');
    if (!input) return;
    let timeout;
    input.addEventListener('input', () => { clearTimeout(timeout); timeout = setTimeout(() => loadUsers(1), 400); });
}

function setupFilters() {
    ['roleFilter', 'statusFilter', 'kycFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => loadUsers(1));
    });
}

function changeLimit(val) {
    currentLimit = parseInt(val) || 10;
    loadUsers(1);
}

function setupMobileMenu() {
    const btn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    if (btn && sidebar) btn.addEventListener('click', () => sidebar.classList.toggle('open'));
}

// ============================================================================
// MODAL UTILS
// ============================================================================

function openModal(id) { const m = document.getElementById(id); if (m) m.classList.add('show'); }
function closeModal(id) { const m = document.getElementById(id); if (m) m.classList.remove('show'); }

function setupModalClose() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'));
    });
}

// ============================================================================
// EXPORT
// ============================================================================

function exportPDF() {
    const params = new URLSearchParams();
    const search = document.getElementById('search')?.value;
    if (search) params.append('search', search);
    window.open(`${API}/users/export/pdf?${params}`, '_blank');
}

function exportExcel() {
    const params = new URLSearchParams();
    const search = document.getElementById('search')?.value;
    if (search) params.append('search', search);
    window.open(`${API}/users/export/excel?${params}`, '_blank');
}

// ============================================================================
// UTILITIES
// ============================================================================

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

function esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }

function timeAgo(date) {
    const now = new Date();
    const d = new Date(date);
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'À l\'instant';
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `Il y a ${Math.floor(diff / 86400)}j`;
    return d.toLocaleDateString('fr-FR');
}