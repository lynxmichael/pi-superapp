// Application principale Pi SuperApp - Version complète avec gestion de profil
class PiSuperApp {
    constructor() {
        this.currentUser = null;
        this.currentSection = 'home';
        this.apiBaseUrl = '/api';
        this.sessionKey = 'pi_session';
        this.init();
    }

    init() {
        this.loadTheme();
        this.setupGlobalErrorHandling();
        this.restoreSession();
        this.initializeEventListeners();
    }

    setupGlobalErrorHandling() {
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
        });
    }

    // Restaurer la session depuis localStorage
    async restoreSession() {
        const token = localStorage.getItem('pi_token');
        const sessionData = localStorage.getItem(this.sessionKey);
        
        if (token && sessionData) {
            try {
                const session = JSON.parse(sessionData);
                const now = new Date().getTime();
                const sessionAge = now - (session.timestamp || now);
                const maxAge = 30 * 24 * 60 * 60 * 1000;
                
                if (sessionAge < maxAge) {
                    this.currentUser = session.user;
                    this.updateUIForAuthenticatedUser();
                    console.log('✅ Session restaurée pour:', this.currentUser.piUsername);
                    
                    // Vérifier le token avec le backend
                    await this.verifyToken();
                } else {
                    console.log('⚠️ Session expirée');
                    this.clearSession();
                }
            } catch (error) {
                console.error('❌ Erreur restauration session:', error);
                this.clearSession();
            }
        } else {
            this.updateUIForUnauthenticatedUser();
        }
    }

    // Vérifier le token avec le backend
    async verifyToken() {
        try {
            if (!localStorage.getItem('pi_token')) return;
            
            const data = await window.api.getProfile();
            this.currentUser = data.user;
            this.saveSession(data.user);
            console.log('✅ Token valide, profil mis à jour');
            
        } catch (error) {
            console.error('❌ Token invalide:', error);
            this.clearSession();
        }
    }

    // Sauvegarder la session
    saveSession(user) {
        try {
            const sessionData = {
                user: user,
                timestamp: new Date().getTime()
            };
            localStorage.setItem(this.sessionKey, JSON.stringify(sessionData));
            console.log('✅ Session sauvegardée');
        } catch (error) {
            console.error('❌ Erreur sauvegarde session:', error);
        }
    }

    // Effacer la session
    clearSession() {
        localStorage.removeItem(this.sessionKey);
        localStorage.removeItem('pi_token');
        this.currentUser = null;
        this.updateUIForUnauthenticatedUser();
        console.log('✅ Session effacée');
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
        const loginBtn = document.getElementById('loginBtn');
        const registerBtn = document.getElementById('registerBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        
        if (loginBtn) loginBtn.addEventListener('click', () => this.showAuthModal('login'));
        if (registerBtn) registerBtn.addEventListener('click', () => this.showAuthModal('register'));
        if (logoutBtn) logoutBtn.addEventListener('click', () => this.confirmLogout());

        // User menu
        const userAvatar = document.getElementById('userAvatar');
        if (userAvatar) {
            userAvatar.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleUserDropdown();
            });
        }

        // Liens du dropdown utilisateur
        const userDropdown = document.getElementById('userDropdown');
        if (userDropdown) {
            userDropdown.querySelectorAll('a[data-section]').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const section = link.getAttribute('data-section');
                    this.showSection(section);
                    this.hideUserDropdown();
                });
            });
        }

        // Fermer le dropdown en cliquant ailleurs
        document.addEventListener('click', () => {
            this.hideUserDropdown();
        });

        // Thème sombre/clair
        const themeIcon = document.getElementById('themeIcon');
        if (themeIcon) {
            themeIcon.addEventListener('click', () => this.toggleTheme());
        }

        // Modal close
        const authModalClose = document.getElementById('authModalClose');
        if (authModalClose) {
            authModalClose.addEventListener('click', () => this.hideAuthModal());
        }

        // Switch auth modal
        const authSwitchBtn = document.getElementById('authSwitchBtn');
        if (authSwitchBtn) {
            authSwitchBtn.addEventListener('click', () => this.switchAuthMode());
        }

        // Bouton envoyer code de vérification
        const sendCodeBtn = document.getElementById('sendCodeBtn');
        if (sendCodeBtn) {
            sendCodeBtn.addEventListener('click', () => this.handleSendVerificationCode());
        }

        // Tabs profile
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = btn.getAttribute('data-tab');
                this.switchProfileTab(tabName);
            });
        });

        // Formulaires d'authentification (login + register)
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        if (loginForm) loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        if (registerForm) registerForm.addEventListener('submit', (e) => this.handleRegister(e));

        // Formulaires du profil
        const profileForm = document.getElementById('profileForm');
        const preferencesForm = document.getElementById('preferencesForm');
        const securityForm = document.getElementById('securityForm');
        const kycForm = document.getElementById('kycForm');
        const startKycBtn = document.getElementById('startKycBtn');
        
        if (profileForm) profileForm.addEventListener('submit', (e) => this.updateProfile(e));
        if (preferencesForm) preferencesForm.addEventListener('submit', (e) => this.updatePreferences(e));
        if (securityForm) securityForm.addEventListener('submit', (e) => this.updateSecurity(e));
        if (kycForm) kycForm.addEventListener('submit', (e) => this.submitKYC(e));
        if (startKycBtn) startKycBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.startKYCProcess();
        });

        // Boutons hero section
        const exploreBtn = document.getElementById('exploreBtn');
        const learnMoreBtn = document.getElementById('learnMoreBtn');
        
        if (exploreBtn) {
            exploreBtn.addEventListener('click', () => {
                if (this.currentUser) {
                    this.showSection('marketplace');
                } else {
                    this.showAuthModal('login');
                }
            });
        }
        
        if (learnMoreBtn) {
            learnMoreBtn.addEventListener('click', () => {
                this.showSection('services');
            });
        }

        // Service cards
        document.querySelectorAll('.service-card').forEach(card => {
            const button = card.querySelector('button');
            if (button) {
                button.addEventListener('click', () => {
                    const service = card.getAttribute('data-service');
                    this.handleServiceClick(service);
                });
            }
        });

        // Mobile navigation toggle
        const navToggle = document.getElementById('navToggle');
        const navMenu = document.getElementById('navMenu');
        
        if (navToggle && navMenu) {
            navToggle.addEventListener('click', () => {
                navMenu.classList.toggle('active');
                navToggle.classList.toggle('active');
            });
        }

        // Fermer les modals en cliquant à l'extérieur
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideModal(e.target.id);
            }
        });

        // Vérifier la santé de l'API au démarrage
        this.checkApiHealth();
    }

    // Vérifier si l'API est disponible
    async checkApiHealth() {
        try {
            if (window.api && window.api.healthCheck) {
                const health = await window.api.healthCheck();
                console.log('✅ API Health:', health);
            }
        } catch (error) {
            console.warn('⚠️ API non disponible:', error);
        }
    }

    // Connexion avec API réelle
    async handleLogin(e) {
        e.preventDefault();
        
        const identifier = document.getElementById('loginIdentifier').value.trim();
        
        if (!identifier) {
            this.showNotification('Veuillez entrer votre identifiant', 'error');
            return;
        }

        try {
            this.showLoading();
            
            const data = await window.api.login(identifier);
            
            // Sauvegarder le token et l'utilisateur
            localStorage.setItem('pi_token', data.token);
            this.currentUser = data.user;
            this.saveSession(data.user);
            
            this.updateUIForAuthenticatedUser();
            this.hideAuthModal();
            this.showNotification(`✅ Connexion réussie! Bienvenue ${data.user.piUsername}`, 'success');
            this.showSection('wallet');
            
        } catch (error) {
            console.error('❌ Erreur connexion:', error);
            this.showNotification(`Erreur de connexion: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Gérer l'envoi du code de vérification
    async handleSendVerificationCode() {
        const email = document.getElementById('registerEmail').value.trim();
        const username = document.getElementById('registerUsername').value.trim();
        
        if (!email || !username) {
            this.showNotification('Veuillez remplir l\'email et le nom d\'utilisateur d\'abord', 'warning');
            return;
        }

        try {
            this.showLoading();
            
            const data = await window.api.requestVerificationCode(email, username);
            
            // Afficher le champ pour le code de vérification
            document.getElementById('verificationCodeGroup').style.display = 'block';
            document.getElementById('sendCodeBtn').style.display = 'none';
            
            this.showNotification(`✅ ${data.message}`, 'success');
            
        } catch (error) {
            console.error('❌ Erreur envoi code:', error);
            this.showNotification(`Erreur: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Inscription avec API réelle
    async handleRegister(e) {
        e.preventDefault();
        
        const formData = {
            piUsername: document.getElementById('registerUsername').value.trim(),
            piUid: document.getElementById('registerUid').value.trim(),
            walletAddress: document.getElementById('registerWallet').value.trim(),
            email: document.getElementById('registerEmail').value.trim(),
            phone: document.getElementById('registerPhone')?.value.trim() || '',
            verificationCode: document.getElementById('registerVerificationCode')?.value.trim() || ''
        };

        // Validation
        if (!formData.piUsername || !formData.piUid || !formData.walletAddress || !formData.email) {
            this.showNotification('Veuillez remplir tous les champs obligatoires (*)', 'error');
            return;
        }

        // Vérifier si on a le code
        if (!formData.verificationCode) {
            this.showNotification('Veuillez d\'abord demander et entrer le code de vérification', 'warning');
            return;
        }

        try {
            this.showLoading();
            
            // D'abord vérifier le code
            await window.api.verifyCode(formData.email, formData.verificationCode);
            
            // Puis inscrire
            const data = await window.api.register(formData);
            
            // Sauvegarder le token et l'utilisateur
            localStorage.setItem('pi_token', data.token);
            this.currentUser = data.user;
            this.saveSession(data.user);
            
            this.updateUIForAuthenticatedUser();
            this.hideAuthModal();
            this.showNotification(`✅ Inscription réussie! Bienvenue ${data.user.piUsername}`, 'success');
            this.showSection('wallet');
            
        } catch (error) {
            console.error('❌ Erreur inscription:', error);
            this.showNotification(`Erreur d'inscription: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Mettre à jour le profil
    async updateProfile(e) {
        e.preventDefault();
        
        const formData = {
            phone: document.getElementById('profilePhone').value,
            profile: {
                firstName: document.getElementById('profileFirstName').value,
                lastName: document.getElementById('profileLastName').value,
                bio: document.getElementById('profileBio').value
            }
        };

        try {
            this.showLoading();
            
            const data = await window.api.updateProfile(formData);
            
            // Mettre à jour l'utilisateur
            this.currentUser = data.user;
            this.saveSession(data.user);
            
            this.showNotification('✅ Profil mis à jour avec succès', 'success');
            
        } catch (error) {
            console.error('❌ Erreur mise à jour profil:', error);
            window.api.handleAuthError(error);
            this.showNotification(`Erreur de mise à jour: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
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
            this.showLoading();
            
            const data = await window.api.updatePreferences(formData);
            
            // Mettre à jour l'utilisateur
            this.currentUser.preferences = data.preferences;
            this.saveSession(this.currentUser);
            
            this.showNotification('✅ Préférences mises à jour', 'success');
            
        } catch (error) {
            console.error('❌ Erreur mise à jour préférences:', error);
            window.api.handleAuthError(error);
            this.showNotification(`Erreur de mise à jour: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Mettre à jour la sécurité
    async updateSecurity(e) {
        e.preventDefault();
        
        const formData = {
            loginPin: document.getElementById('securityPin').value || undefined,
            currentPin: document.getElementById('currentPin').value || undefined,
            twoFactorEnabled: document.getElementById('twoFactorEnabled').checked
        };

        // Validation du PIN
        if (formData.loginPin && !/^\d{6}$/.test(formData.loginPin)) {
            this.showNotification('Le PIN doit contenir exactement 6 chiffres', 'error');
            return;
        }

        try {
            this.showLoading();
            
            await window.api.updateSecurity(formData);
            
            this.showNotification('✅ Paramètres de sécurité mis à jour', 'success');
            
            // Réinitialiser les champs
            document.getElementById('securityPin').value = '';
            document.getElementById('currentPin').value = '';
            
        } catch (error) {
            console.error('❌ Erreur mise à jour sécurité:', error);
            window.api.handleAuthError(error);
            this.showNotification(`Erreur: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Démarrer le processus KYC
    startKYCProcess() {
        document.getElementById('kycForm').style.display = 'block';
        document.getElementById('startKycBtn').style.display = 'none';
    }

    // Soumettre le KYC
    async submitKYC(e) {
        e.preventDefault();
        
        const formData = {
            documentType: document.getElementById('kycDocumentType').value,
            documentNumber: document.getElementById('kycDocumentNumber').value
        };

        if (!formData.documentType || !formData.documentNumber) {
            this.showNotification('Veuillez remplir tous les champs du KYC', 'error');
            return;
        }

        try {
            this.showLoading();
            
            await window.api.requestKYC(formData);
            
            this.showNotification('✅ Demande KYC soumise avec succès. Vérification en cours.', 'success');
            
            // Mettre à jour le statut
            document.getElementById('kycStatusText').textContent = 'En attente';
            document.getElementById('kycStatusText').className = 'status-badge pending';
            
        } catch (error) {
            console.error('❌ Erreur soumission KYC:', error);
            window.api.handleAuthError(error);
            this.showNotification(`Erreur: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Charger les données du profil
    async loadProfileData() {
        if (!this.currentUser) return;
        
        try {
            this.showLoading();
            
            const data = await window.api.getProfile();
            this.currentUser = data.user;
            this.saveSession(data.user);
            this.populateProfileForm(data.user);
            
            // Charger les statistiques
            await this.loadUserStats();
            
            // Charger le statut KYC
            await this.loadKYCStatus();
            
        } catch (error) {
            console.error('❌ Erreur chargement profil:', error);
            window.api.handleAuthError(error);
            this.showNotification('Erreur chargement profil', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Charger les statistiques utilisateur
    async loadUserStats() {
        try {
            const data = await window.api.getStats();
            
            // Mettre à jour les éléments UI
            if (data.stats) {
                const memberSince = document.getElementById('memberSince');
                const loginCount = document.getElementById('loginCount');
                
                if (memberSince && data.stats.joinedAt) {
                    memberSince.textContent = new Date(data.stats.joinedAt).toLocaleDateString('fr-FR');
                }
                if (loginCount) {
                    loginCount.textContent = data.stats.loginCount || 0;
                }
            }
        } catch (error) {
            console.error('Erreur chargement stats:', error);
        }
    }

    // Charger le statut KYC
    async loadKYCStatus() {
        try {
            const kycStatusText = document.getElementById('kycStatusText');
            if (!kycStatusText) return;
            
            // Vérifier le statut KYC dans l'utilisateur
            if (this.currentUser.verification?.kycStatus) {
                const status = this.currentUser.verification.kycStatus;
                kycStatusText.textContent = this.getKYCStatusText(status);
                kycStatusText.className = `status-badge ${status}`;
                
                // Masquer le formulaire si KYC est déjà soumis
                if (status !== 'none') {
                    document.getElementById('kycForm').style.display = 'none';
                    document.getElementById('startKycBtn').style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Erreur chargement KYC:', error);
        }
    }

    // Obtenir le texte du statut KYC
    getKYCStatusText(status) {
        const statusMap = {
            'none': 'Non vérifié',
            'pending': 'En attente',
            'approved': 'Vérifié',
            'rejected': 'Rejeté'
        };
        return statusMap[status] || 'Non vérifié';
    }

    // Remplir le formulaire de profil
    populateProfileForm(user) {
        console.log('Populating profile form with:', user);
        
        // Informations de base
        if (document.getElementById('profileUsername')) {
            document.getElementById('profileUsername').textContent = user.piUsername;
        }
        if (document.getElementById('profileWallet')) {
            document.getElementById('profileWallet').textContent = user.walletAddress || 'Non défini';
        }
        if (document.getElementById('piUsername')) {
            document.getElementById('piUsername').value = user.piUsername;
        }
        if (document.getElementById('profileEmail')) {
            document.getElementById('profileEmail').value = user.email || '';
        }
        if (document.getElementById('profilePhone')) {
            document.getElementById('profilePhone').value = user.phone || '';
        }
        
        // Profil détaillé
        if (document.getElementById('profileFirstName')) {
            document.getElementById('profileFirstName').value = user.profile?.firstName || '';
        }
        if (document.getElementById('profileLastName')) {
            document.getElementById('profileLastName').value = user.profile?.lastName || '';
        }
        if (document.getElementById('profileBio')) {
            document.getElementById('profileBio').value = user.profile?.bio || '';
        }
        
        // Avatar
        const avatarImg = document.getElementById('profileAvatar');
        if (avatarImg && user.profile?.avatar) {
            avatarImg.src = user.profile.avatar;
        }

        // Préférences
        if (user.preferences) {
            const prefLanguage = document.getElementById('prefLanguage');
            const prefCurrency = document.getElementById('prefCurrency');
            const prefNotifications = document.getElementById('prefNotifications');
            
            if (prefLanguage) prefLanguage.value = user.preferences.language || 'fr';
            if (prefCurrency) prefCurrency.value = user.preferences.currency || 'PI';
            if (prefNotifications) prefNotifications.checked = user.preferences.notifications !== false;
        }

        // Sécurité
        if (user.security) {
            const twoFactorEnabled = document.getElementById('twoFactorEnabled');
            if (twoFactorEnabled) {
                twoFactorEnabled.checked = user.security.twoFactorEnabled || false;
            }
        }
    }

    // Afficher une section
    showSection(sectionName) {
        // Vérifier l'authentification pour certaines sections
        const protectedSections = ['wallet', 'profile', 'marketplace'];
        if (protectedSections.includes(sectionName) && !this.currentUser) {
            this.showNotification('Veuillez vous connecter pour accéder à cette section', 'warning');
            this.showAuthModal('login');
            return;
        }

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
            setTimeout(() => {
                targetSection.classList.add('fade-in');
            }, 10);
        }

        // Activer le lien de navigation correspondant
        const navLink = document.querySelector(`[data-section="${sectionName}"]`);
        if (navLink) {
            navLink.classList.add('active');
        }

        this.currentSection = sectionName;

        // Charger les données spécifiques à la section
        this.loadSectionData(sectionName);

        // Fermer le menu mobile si ouvert
        const navMenu = document.getElementById('navMenu');
        const navToggle = document.getElementById('navToggle');
        if (navMenu) navMenu.classList.remove('active');
        if (navToggle) navToggle.classList.remove('active');
    }

    // Charger les données de section
    async loadSectionData(sectionName) {
        switch (sectionName) {
            case 'marketplace':
                if (window.marketplace) {
                    await window.marketplace.loadProducts();
                }
                break;
            case 'wallet':
                if (window.wallet) {
                    await window.wallet.loadWalletData();
                }
                break;
            case 'profile':
                await this.loadProfileData();
                break;
            case 'services':
                if (window.services) {
                    await window.services.loadServices();
                }
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
        const verificationGroup = document.getElementById('verificationCodeGroup');
        const sendCodeBtn = document.getElementById('sendCodeBtn');

        if (!modal) return;

        // Réinitialiser les formulaires
        if (loginForm) loginForm.reset();
        if (registerForm) registerForm.reset();
        if (verificationGroup) verificationGroup.style.display = 'none';
        if (sendCodeBtn) sendCodeBtn.style.display = 'block';

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
        const modal = document.getElementById('authModal');
        if (modal) modal.classList.remove('show');
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('show');
    }

    switchAuthMode() {
        const loginForm = document.getElementById('loginForm');
        const isLoginVisible = loginForm && loginForm.style.display !== 'none';
        
        this.showAuthModal(isLoginVisible ? 'register' : 'login');
    }

    // Confirmation de déconnexion
    confirmLogout() {
        this.showConfirmationModal(
            'Déconnexion',
            'Êtes-vous sûr de vouloir vous déconnecter ?',
            () => this.handleLogout(),
            () => console.log('Déconnexion annulée')
        );
    }

    // Déconnexion
    handleLogout() {
        this.clearSession();
        this.showSection('home');
        this.showNotification('👋 Vous avez été déconnecté avec succès', 'success');
    }

    // Handle service clicks
    handleServiceClick(service) {
        if (!this.currentUser) {
            this.showNotification('Veuillez vous connecter pour utiliser ce service', 'warning');
            this.showAuthModal('login');
            return;
        }

        switch(service) {
            case 'ecommerce':
                this.showSection('marketplace');
                break;
            case 'games':
                this.showNotification('Section jeux à venir!', 'info');
                break;
            case 'recharge':
            case 'subscriptions':
            case 'reservations':
            case 'files':
                if (window.services) {
                    window.services.handleServiceClick(service);
                } else {
                    this.showNotification('Service en cours de chargement...', 'info');
                }
                break;
            default:
                this.showSection('services');
        }
    }

    // Appel API générique (utilisé par wallet.js et d'autres modules)
    async apiCall(endpoint, options = {}) {
        const token = localStorage.getItem('pi_token');
        const defaultHeaders = {
            'Content-Type': 'application/json'
        };
        if (token) {
            defaultHeaders['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            ...options,
            headers: {
                ...defaultHeaders,
                ...(options.headers || {})
            }
        };

        const response = await fetch(`${this.apiBaseUrl}${endpoint}`, config);
        
        if (response.status === 401) {
            this.clearSession();
            this.showNotification('Session expirée, veuillez vous reconnecter', 'warning');
            this.showAuthModal('login');
            throw new Error('Session expirée');
        }

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || data.message || 'Erreur serveur');
        }
        
        return data;
    }

    // Boîte de dialogue de confirmation (utilisée par wallet.js)
    showConfirmDialog(title, message, onConfirm, onCancel = null) {
        this.showConfirmationModal(title, message, onConfirm, onCancel);
    }

    // Modal de confirmation
    showConfirmationModal(title, message, onConfirm, onCancel = null) {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.id = 'confirmationModal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h3><i class="fas fa-question-circle"></i> ${title}</h3>
                </div>
                <div class="modal-body">
                    <p style="font-size: 1rem; margin: 1rem 0;">${message}</p>
                </div>
                <div class="modal-footer" style="display: flex; gap: 1rem; justify-content: flex-end; padding: 1rem; border-top: 1px solid var(--border-color);">
                    <button class="btn btn-outline" id="confirmCancel">
                        <i class="fas fa-times"></i> Annuler
                    </button>
                    <button class="btn btn-primary" id="confirmOk">
                        <i class="fas fa-check"></i> Confirmer
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const closeModal = () => {
            modal.remove();
            if (onCancel) onCancel();
        };

        modal.querySelector('#confirmCancel').addEventListener('click', closeModal);
        
        modal.querySelector('#confirmOk').addEventListener('click', () => {
            modal.remove();
            if (onConfirm) onConfirm();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    // Changer l'onglet du profil
    switchProfileTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });

        const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);
        const targetPane = document.getElementById(`${tabName}-tab`);
        
        if (targetBtn) targetBtn.classList.add('active');
        if (targetPane) targetPane.classList.add('active');
    }

    // Mettre à jour l'UI pour utilisateur connecté
    updateUIForAuthenticatedUser() {
        const authButtons = document.getElementById('authButtons');
        const userMenu = document.getElementById('userMenu');
        const username = document.getElementById('username');
        const avatarImg = document.getElementById('avatarImg');

        if (authButtons) authButtons.style.display = 'none';
        if (userMenu) userMenu.style.display = 'flex';
        
        if (username) username.textContent = this.currentUser.piUsername;

        if (this.currentUser.profile?.avatar) {
            if (avatarImg) {
                avatarImg.src = this.currentUser.profile.avatar;
                avatarImg.style.display = 'block';
            }
        }
    }

    // Mettre à jour l'UI pour utilisateur non connecté
    updateUIForUnauthenticatedUser() {
        const authButtons = document.getElementById('authButtons');
        const userMenu = document.getElementById('userMenu');
        
        if (authButtons) authButtons.style.display = 'flex';
        if (userMenu) userMenu.style.display = 'none';
        
        // Si on est sur une section protégée, rediriger vers l'accueil
        const protectedSections = ['wallet', 'profile', 'marketplace'];
        if (protectedSections.includes(this.currentSection)) {
            this.showSection('home');
        }
    }

    // User dropdown
    toggleUserDropdown() {
        const dropdown = document.getElementById('userDropdown');
        if (dropdown) dropdown.classList.toggle('show');
    }

    hideUserDropdown() {
        const dropdown = document.getElementById('userDropdown');
        if (dropdown) dropdown.classList.remove('show');
    }

    // Thème sombre/clair
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        const themeIcon = document.getElementById('themeIcon');
        
        document.documentElement.setAttribute('data-theme', newTheme);
        if (themeIcon) {
            themeIcon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
        
        localStorage.setItem('theme', newTheme);
    }

    // Charger le thème sauvegardé
    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        const themeIcon = document.getElementById('themeIcon');
        if (themeIcon) {
            themeIcon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    // Afficher/masquer le loading
    showLoading() {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) spinner.classList.add('show');
    }

    hideLoading() {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) spinner.classList.remove('show');
    }

    // Notifications
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close">&times;</button>
        `;

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
            max-width: 500px;
            animation: slideInRight 0.3s ease-out;
        `;

        document.body.appendChild(notification);

        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => notification.remove());
        }

        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease-out';
                setTimeout(() => notification.remove(), 300);
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
}

// Initialiser l'application quand le DOM est prêt
document.addEventListener('DOMContentLoaded', function() {
    window.app = new PiSuperApp();
    console.log('✅ Application initialisée avec gestion complète du profil');
});