// Service API - Version corrigée et simplifiée
class ApiService {
    constructor() {
        this.baseUrl = '/api';
        console.log('🚀 API Service initialisé');
    }

    // Méthode générique pour les appels API
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        
        // Ajouter le token si disponible
        const token = localStorage.getItem('pi_token');
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Préparer le body
        let body = options.body;
        if (body && !(body instanceof FormData)) {
            body = JSON.stringify(body);
        }
        
        try {
            const response = await fetch(url, {
                ...options,
                headers,
                body
            });

            // Gérer les erreurs d'authentification
            if (response.status === 401) {
                this.handleAuthError();
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.message || `Erreur ${response.status}`);
            }

            return data;
            
        } catch (error) {
            console.error('❌ API Error:', error);
            throw error;
        }
    }

    // ========== AUTHENTIFICATION ==========
    async login(identifier) {
        return this.request('/auth/login', {
            method: 'POST',
            body: {
                piUsername: identifier,
                walletAddress: identifier
            }
        });
    }

    async register(userData) {
        return this.request('/auth/register', {
            method: 'POST',
            body: userData
        });
    }

    async requestVerificationCode(email, piUsername) {
        return this.request('/auth/request-verification', {
            method: 'POST',
            body: { email, piUsername }
        });
    }

    async verifyCode(email, code) {
        return this.request('/auth/verify-code', {
            method: 'POST',
            body: { email, code }
        });
    }

    async getProfile() {
        return this.request('/auth/profile');
    }

    async updateProfile(profileData) {
        return this.request('/auth/profile', {
            method: 'PUT',
            body: profileData
        });
    }

    async updatePreferences(preferences) {
        return this.request('/auth/preferences', {
            method: 'PUT',
            body: preferences
        });
    }

    async updateSecurity(securityData) {
        return this.request('/auth/security', {
            method: 'PUT',
            body: securityData
        });
    }

    async requestKYC(kycData) {
        return this.request('/auth/request-kyc', {
            method: 'POST',
            body: kycData
        });
    }

    async getStats() {
        return this.request('/auth/stats');
    }

    // ========== WALLET ==========
    async getWalletBalance() {
        return this.request('/wallet/balance');
    }

    async getTransactions(page = 1, limit = 20) {
        return this.request(`/wallet/transactions?page=${page}&limit=${limit}`);
    }

    async sendMoney(recipient, amount, memo = '') {
        return this.request('/wallet/send', {
            method: 'POST',
            body: { recipient, amount, memo }
        });
    }

    async getWalletStats() {
        return this.request('/wallet/stats');
    }

    // ========== MARKETPLACE ==========
    async getProducts(page = 1, limit = 20, category = '', search = '') {
        let url = `/marketplace/products?page=${page}&limit=${limit}`;
        if (category) url += `&category=${encodeURIComponent(category)}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        
        return this.request(url);
    }

    async getProduct(id) {
        return this.request(`/marketplace/products/${id}`);
    }

    async addProduct(productData) {
        // Pour les produits avec images, utiliser FormData
        const formData = new FormData();
        
        Object.keys(productData).forEach(key => {
            const value = productData[key];
            if (value instanceof FileList || Array.isArray(value)) {
                for (let i = 0; i < value.length; i++) {
                    formData.append(key, value[i]);
                }
            } else {
                formData.append(key, value);
            }
        });
        
        // Pour FormData, ne pas définir Content-Type (le navigateur le fait)
        const token = localStorage.getItem('pi_token');
        return fetch(`${this.baseUrl}/marketplace/products`, {
            method: 'POST',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            body: formData
        }).then(r => r.json());
    }

    async purchaseProduct(productId, quantity = 1) {
        return this.request('/marketplace/purchase', {
            method: 'POST',
            body: { productId, quantity }
        });
    }

    async getCategories() {
        return this.request('/marketplace/categories');
    }

    // ========== SERVICES ==========
    async rechargeMobile(operator, phone, amount) {
        return this.request('/recharge/mobile', {
            method: 'POST',
            body: { operator, phone, amount }
        });
    }

    async getOperators() {
        return this.request('/recharge/operators');
    }

    async getSubscriptions() {
        return this.request('/subscriptions');
    }

    async subscribe(subscriptionId) {
        return this.request('/subscriptions/subscribe', {
            method: 'POST',
            body: { subscriptionId }
        });
    }

    async createReservation(serviceId, date, time, notes = '') {
        return this.request('/reservations', {
            method: 'POST',
            body: { serviceId, date, time, notes }
        });
    }

    async getReservations() {
        return this.request('/reservations');
    }

    // ========== GAMES ==========
    async getGames() {
        return this.request('/games');
    }

    async getGame(gameId) {
        return this.request(`/games/${gameId}`);
    }

    async submitScore(gameId, score) {
        return this.request(`/games/${gameId}/score`, {
            method: 'POST',
            body: { score }
        });
    }

    // ========== UTILITAIRES ==========
    async healthCheck() {
        try {
            const response = await fetch('/api/health');
            return response.json();
        } catch (error) {
            console.error('Health check failed:', error);
            return { status: 'ERROR', error: error.message };
        }
    }

    handleAuthError() {
        console.error('❌ Erreur d\'authentification');
        
        // Effacer la session
        localStorage.removeItem('pi_token');
        localStorage.removeItem('pi_session');
        
        // Notifier l'application
        if (window.app) {
            window.app.currentUser = null;
            window.app.updateUIForUnauthenticatedUser();
            window.app.showNotification('Session expirée. Veuillez vous reconnecter.', 'warning');
        }
    }

    // Validation
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    validateWalletAddress(address) {
        return address && address.startsWith('G') && address.length >= 20;
    }

    // Formatage
    formatCurrency(amount, currency = 'PI') {
        if (currency === 'PI') {
            return `${amount.toFixed(2)} π`;
        }
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: currency === 'PI' ? 'XOF' : currency
        }).format(amount);
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Session
    isAuthenticated() {
        return !!localStorage.getItem('pi_token');
    }

    getCurrentUser() {
        const sessionData = localStorage.getItem('pi_session');
        return sessionData ? JSON.parse(sessionData).user : null;
    }

    async testConnection() {
        try {
            const health = await this.healthCheck();
            console.log('✅ API connectée:', health);
            return health.status === 'OK';
        } catch (error) {
            console.error('❌ API déconnectée:', error);
            return false;
        }
    }
}

// Initialiser et exporter
const apiService = new ApiService();
window.api = apiService;

console.log('✅ API Service chargé et prêt');

// Test de connexion au démarrage
setTimeout(() => {
    apiService.testConnection().then(isConnected => {
        if (isConnected) {
            console.log('🌐 Backend accessible');
        } else {
            console.warn('⚠️ Backend non accessible');
        }
    });
}, 1000);