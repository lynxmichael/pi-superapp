// Application principale Pi SuperApp
class PiSuperApp {
    constructor() {
        this.currentUser = null;
        this.currentSection = 'home';
        this.apiBaseUrl = '/api';
        this.init();
    }

    init() {
        this.initializeEventListeners();
        this.checkAuthentication();
        this.loadInitialData();
    }

    // Vérifier l'authentification
    async checkAuthentication() {
        const token = localStorage.getItem('pi_token');
        
        if (token) {
            try {
                const response = await fetch(`${this.apiBaseUrl}/auth/profile`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    this.currentUser = data.user;
                    this.updateUIForAuthenticatedUser();
                } else {
                    this.handleLogout();
                }
            } catch (error) {
                console.error('Erreur vérification auth:', error);
                this.handleLogout();
            }
        }
    }

    // Initialiser les événements
    initializeEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('data-section');
                this.showSection(section);
            });
        });

        // Boutons d'authentification
        document.getElementById('loginBtn').addEventListener('click', () => this.showAuthModal('login'));
        document.getElementById('registerBtn').addEventListener('click', () => this.showAuthModal('register'));
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());

        // User menu
        document.getElementById('userAvatar').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleUserDropdown();
        });

        // Fermer le dropdown en cliquant ailleurs
        document.addEventListener('click', () => {
            this.hideUserDropdown();
        });

        // Thème sombre/clair
        document.getElementById('themeIcon').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Modals
        document.getElementById('authModalClose').addEventListener('click', () => {
            this.hideAuthModal();
        });

        // Switch auth modal
        document.getElementById('authSwitchBtn').addEventListener('click', () => {
            this.switchAuthMode();
        });

        // Forms
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('registerForm').addEventListener('submit', (e) => this.handleRegister(e));
        document.getElementById('profileForm').addEventListener('submit', (e) => this.updateProfile(e));
        document.getElementById('preferencesForm').addEventListener('submit', (e) => this.updatePreferences(e));

        // Tabs profile
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchProfileTab(btn.getAttribute('data-tab'));
            });
        });

        // Boutons d'action
        document.getElementById('exploreBtn').addEventListener('click', () => {
            this.showSection('marketplace');
        });
    }

    // Afficher une section
    showSection(sectionName) {
        // Cacher toutes les sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });

        // Désactiver tous les liens de navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });

        // Activer la section demandée
        const targetSection = document.getElementById(sectionName);
        if (targetSection) {
            targetSection.classList.add('active');
            targetSection.classList.add('fade-in');
        }

        // Activer le lien de navigation correspondant
        const navLink = document.querySelector(`[data-section="${sectionName}"]`);
        if (navLink) {
            navLink.classList.add('active');
        }

        this.currentSection = sectionName;

        // Charger les données spécifiques à la section
        this.loadSectionData(sectionName);
    }

    // Charger les données de section
    async loadSectionData(sectionName) {
        switch (sectionName) {
            case 'marketplace':
                await marketplace.loadProducts();
                break;
            case 'wallet':
                await wallet.loadWalletData();
                break;
            case 'profile':
                await this.loadProfileData();
                break;
        }
    }

    // Modal d'authentification
    showAuthModal(mode = 'login') {
        const modal = document.getElementById('authModal');
        const title = document.getElementById('authModalTitle');
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const switchText = document.getElementById('authSwitchText');
        const switchBtn = document.getElementById('authSwitchBtn');

        if (mode === 'login') {
            title.textContent = 'Connexion';
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
            switchText.textContent = 'Pas de compte ?';
            switchBtn.textContent = 'S\'inscrire';
        } else {
            title.textContent = 'Inscription';
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
            switchText.textContent = 'Déjà un compte ?';
            switchBtn.textContent = 'Se connecter';
        }

        modal.classList.add('show');
    }

    hideAuthModal() {
        document.getElementById('authModal').classList.remove('show');
    }

    switchAuthMode() {
        const loginForm = document.getElementById('loginForm');
        const isLoginVisible = loginForm.style.display !== 'none';
        
        this.showAuthModal(isLoginVisible ? 'register' : 'login');
    }

    // Connexion
    async handleLogin(e) {
        e.preventDefault();
        
        const identifier = document.getElementById('loginIdentifier').value;
        
        try {
            this.showLoading();
            
            const response = await fetch(`${this.apiBaseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    piUsername: identifier,
                    walletAddress: identifier
                })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('pi_token', data.token);
                this.currentUser = data.user;
                this.updateUIForAuthenticatedUser();
                this.hideAuthModal();
                this.showNotification('Connexion réussie!', 'success');
            } else {
                this.showNotification(data.error || 'Erreur de connexion', 'error');
            }
        } catch (error) {
            console.error('Erreur connexion:', error);
            this.showNotification('Erreur de connexion', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Inscription
    async handleRegister(e) {
        e.preventDefault();
        
        const formData = {
            piUsername: document.getElementById('registerUsername').value,
            piUid: document.getElementById('registerUid').value,
            walletAddress: document.getElementById('registerWallet').value,
            email: document.getElementById('registerEmail').value
        };

        try {
            this.showLoading();
            
            const response = await fetch(`${this.apiBaseUrl}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('pi_token', data.token);
                this.currentUser = data.user;
                this.updateUIForAuthenticatedUser();
                this.hideAuthModal();
                this.showNotification('Inscription réussie!', 'success');
            } else {
                this.showNotification(data.error || 'Erreur d\'inscription', 'error');
            }
        } catch (error) {
            console.error('Erreur inscription:', error);
            this.showNotification('Erreur d\'inscription', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Déconnexion
    handleLogout() {
        localStorage.removeItem('pi_token');
        this.currentUser = null;
        this.updateUIForUnauthenticatedUser();
        this.showSection('home');
        this.showNotification('Déconnexion réussie', 'success');
    }

    // Mettre à jour le profil
    async updateProfile(e) {
        e.preventDefault();
        
        const formData = {
            email: document.getElementById('profileEmail').value,
            phone: document.getElementById('profilePhone').value,
            profile: {
                firstName: document.getElementById('profileFirstName').value,
                lastName: document.getElementById('profileLastName').value,
                bio: document.getElementById('profileBio').value
            }
        };

        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/profile`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('pi_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                this.showNotification('Profil mis à jour avec succès', 'success');
                this.loadProfileData();
            } else {
                this.showNotification('Erreur lors de la mise à jour', 'error');
            }
        } catch (error) {
            console.error('Erreur mise à jour profil:', error);
            this.showNotification('Erreur de mise à jour', 'error');
        }
    }

    // Mettre à jour les préférences
    async updatePreferences(e) {
        e.preventDefault();
        
        const formData = {
            language: document.getElementById('prefLanguage').value,
            currency: document.getElementById('prefCurrency').value,
            notifications: document.getElementById('prefNotifications').checked
        };

        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/preferences`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('pi_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                this.showNotification('Préférences mises à jour', 'success');
            } else {
                this.showNotification('Erreur lors de la mise à jour', 'error');
            }
        } catch (error) {
            console.error('Erreur mise à jour préférences:', error);
            this.showNotification('Erreur de mise à jour', 'error');
        }
    }

    // Charger les données du profil
    async loadProfileData() {
        if (!this.currentUser) return;

        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/profile`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('pi_token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.populateProfileForm(data.user);
            }
        } catch (error) {
            console.error('Erreur chargement profil:', error);
        }
    }

    // Remplir le formulaire de profil
    populateProfileForm(user) {
        document.getElementById('piUsername').value = user.piUsername || '';
        document.getElementById('profileEmail').value = user.email || '';
        document.getElementById('profilePhone').value = user.phone || '';
        document.getElementById('profileFirstName').value = user.profile?.firstName || '';
        document.getElementById('profileLastName').value = user.profile?.lastName || '';
        document.getElementById('profileBio').value = user.profile?.bio || '';
        document.getElementById('profileUsername').textContent = user.piUsername;
        document.getElementById('profileWallet').textContent = user.walletAddress;
        
        if (user.stats) {
            document.getElementById('memberSince').textContent = new Date(user.stats.joinedAt).toLocaleDateString();
            document.getElementById('loginCount').textContent = user.stats.loginCount || 0;
        }

        // Préférences
        if (user.preferences) {
            document.getElementById('prefLanguage').value = user.preferences.language || 'fr';
            document.getElementById('prefCurrency').value = user.preferences.currency || 'PI';
            document.getElementById('prefNotifications').checked = user.preferences.notifications !== false;
        }
    }

    // Changer l'onglet du profil
    switchProfileTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });

        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }

    // Mettre à jour l'UI pour utilisateur connecté
    updateUIForAuthenticatedUser() {
        document.getElementById('authButtons').style.display = 'none';
        document.getElementById('userMenu').style.display = 'flex';
        
        document.getElementById('username').textContent = this.currentUser.piUsername;
        document.getElementById('profileUsername').textContent = this.currentUser.piUsername;
        document.getElementById('profileWallet').textContent = this.currentUser.walletAddress;

        if (this.currentUser.profile?.avatar) {
            document.getElementById('avatarImg').src = this.currentUser.profile.avatar;
            document.getElementById('profileAvatar').src = this.currentUser.profile.avatar;
        }
    }

    // Mettre à jour l'UI pour utilisateur non connecté
    updateUIForUnauthenticatedUser() {
        document.getElementById('authButtons').style.display = 'flex';
        document.getElementById('userMenu').style.display = 'none';
    }

    // User dropdown
    toggleUserDropdown() {
        document.getElementById('userDropdown').classList.toggle('show');
    }

    hideUserDropdown() {
        document.getElementById('userDropdown').classList.remove('show');
    }

    // Thème sombre/clair
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        const themeIcon = document.getElementById('themeIcon');
        
        document.documentElement.setAttribute('data-theme', newTheme);
        themeIcon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        
        localStorage.setItem('theme', newTheme);
    }

    // Charger le thème sauvegardé
    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        const themeIcon = document.getElementById('themeIcon');
        themeIcon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    // Chargement initial
    loadInitialData() {
        this.loadTheme();
        
        // Vérifier si on a un token au chargement
        const token = localStorage.getItem('pi_token');
        if (token) {
            this.checkAuthentication();
        }
    }

    // Afficher/masquer le loading
    showLoading() {
        document.getElementById('loadingSpinner').classList.add('show');
    }

    hideLoading() {
        document.getElementById('loadingSpinner').classList.remove('show');
    }

    // Notifications
    showNotification(message, type = 'info') {
        // Créer l'élément de notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close">&times;</button>
        `;

        // Styles pour la notification
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: ${this.getNotificationColor(type)};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            min-width: 300px;
            animation: slideInRight 0.3s ease-out;
        `;

        document.body.appendChild(notification);

        // Fermer la notification
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.remove();
        });

        // Auto-fermeture après 5 secondes
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    getNotificationColor(type) {
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        return colors[type] || '#3b82f6';
    }

    // Méthode utilitaire pour les appels API
    async apiCall(endpoint, options = {}) {
        const token = localStorage.getItem('pi_token');
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        };

        try {
            const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
                ...defaultOptions,
                ...options
            });

            if (response.status === 401) {
                this.handleLogout();
                throw new Error('Session expirée');
            }

            return await response.json();
        } catch (error) {
            console.error('Erreur API:', error);
            throw error;
        }
    }
}

// Initialiser l'application
const app = new PiSuperApp();

// Modules spécifiques
const marketplace = new Marketplace();
const wallet = new Wallet();

// Styles pour les notifications
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    .notification-close {
        background: none;
        border: none;
        color: white;
        font-size: 1.2rem;
        cursor: pointer;
        margin-left: auto;
    }

    .notification-content {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
`;
document.head.appendChild(notificationStyles);