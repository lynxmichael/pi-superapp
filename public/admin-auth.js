// admin-auth.js

// Configuration
const API_BASE = '/api/admin/auth';

// Éléments DOM
const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const alertDiv = document.getElementById('alertMessage');
const switchToRegister = document.getElementById('switchToRegister');
const switchToLogin = document.getElementById('switchToLogin');

// Attacher les événements après chargement du DOM
document.addEventListener('DOMContentLoaded', function() {
    // Vérifier si déjà connecté
    const token = localStorage.getItem('pi_token');
    if (token) {
        window.location.href = '/admin/users';
    }

    // Événements des onglets
    loginTab.addEventListener('click', () => switchTab('login'));
    registerTab.addEventListener('click', () => switchTab('register'));

    // Événements des liens de bascule
    if (switchToRegister) {
        switchToRegister.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('register');
        });
    }
    if (switchToLogin) {
        switchToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('login');
        });
    }

    // Événements de soumission des formulaires
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
});

// Changer d'onglet
function switchTab(tab) {
    if (tab === 'login') {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
    } else {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.add('active');
        loginForm.classList.remove('active');
    }
    hideAlert();
}

// Afficher une alerte
function showAlert(message, type = 'error') {
    alertDiv.style.display = 'flex';
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = `<i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i> ${message}`;
}

function hideAlert() {
    alertDiv.style.display = 'none';
}

// Connexion
async function handleLogin(event) {
    event.preventDefault();
    hideAlert();

    const identifier = document.getElementById('loginIdentifier').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!identifier || !password) {
        showAlert('Veuillez remplir tous les champs');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Erreur de connexion');
        }

        // Stocker le token et les infos utilisateur
        localStorage.setItem('pi_token', data.token);
        localStorage.setItem('pi_user', JSON.stringify(data.user));

        showAlert('Connexion réussie ! Redirection...', 'success');

        setTimeout(() => {
            window.location.href = '/admin/users';
        }, 1500);

    } catch (error) {
        showAlert(error.message);
    }
}

// Inscription
async function handleRegister(event) {
    event.preventDefault();
    hideAlert();

    const piUsername = document.getElementById('regPiUsername').value.trim();
    const piUid = document.getElementById('regPiUid').value.trim();
    const walletAddress = document.getElementById('regWallet').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const adminCode = document.getElementById('regAdminCode').value;
    const pin = document.getElementById('regPin').value;

    // Vérifications basiques
    if (!piUsername || !piUid || !walletAddress || !email || !adminCode || !pin) {
        showAlert('Tous les champs sauf téléphone sont requis');
        return;
    }

    if (pin.length !== 6 || !/^\d+$/.test(pin)) {
        showAlert('Le PIN doit contenir exactement 6 chiffres');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                piUsername,
                piUid,
                walletAddress,
                email,
                phone: phone || undefined,
                pin,
                adminCode,
                role: 'admin'
            })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Erreur lors de l\'inscription');
        }

        showAlert('Compte admin créé avec succès ! Vous pouvez maintenant vous connecter.', 'success');

        setTimeout(() => {
            switchTab('login');
            document.getElementById('loginIdentifier').value = email;
            document.getElementById('loginPassword').value = '';
        }, 2000);

    } catch (error) {
        showAlert(error.message);
    }
}