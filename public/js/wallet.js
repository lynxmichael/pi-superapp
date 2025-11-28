// Gestion du portefeuille
class Wallet {
    constructor() {
        this.transactions = [];
        this.init();
    }

    init() {
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Boutons d'action du portefeuille
        document.getElementById('sendMoneyBtn')?.addEventListener('click', () => {
            this.showSendMoneyModal();
        });

        document.getElementById('receiveMoneyBtn')?.addEventListener('click', () => {
            this.showReceiveMoneyModal();
        });

        document.getElementById('transactionHistoryBtn')?.addEventListener('click', () => {
            this.showTransactionHistory();
        });
    }

    // Charger les données du portefeuille
    async loadWalletData() {
        if (!app.currentUser) return;

        try {
            await Promise.all([
                this.loadBalance(),
                this.loadRecentTransactions(),
                this.loadStats()
            ]);
        } catch (error) {
            console.error('Erreur chargement données portefeuille:', error);
        }
    }

    // Charger le solde
    async loadBalance() {
        try {
            const response = await app.apiCall('/wallet/balance');
            
            document.getElementById('balanceValue').textContent = response.balance.toFixed(2);
            document.getElementById('totalEarned').textContent = response.totalEarned.toFixed(2);
            document.getElementById('totalSpent').textContent = response.totalSpent.toFixed(2);
        } catch (error) {
            console.error('Erreur chargement solde:', error);
        }
    }

    // Charger les transactions récentes
    async loadRecentTransactions() {
        try {
            const response = await app.apiCall('/wallet/transactions?limit=5');
            this.transactions = response.transactions;
            this.displayRecentTransactions();
        } catch (error) {
            console.error('Erreur chargement transactions:', error);
        }
    }

    // Charger les statistiques
    async loadStats() {
        try {
            const response = await app.apiCall('/wallet/stats');
            document.getElementById('totalTransactions').textContent = response.stats.transactionCount || 0;
        } catch (error) {
            console.error('Erreur chargement stats:', error);
        }
    }

    // Afficher les transactions récentes
    displayRecentTransactions() {
        const transactionsList = document.getElementById('transactionsList');
        
        if (!transactionsList) return;

        if (this.transactions.length === 0) {
            transactionsList.innerHTML = `
                <div class="no-transactions">
                    <i class="fas fa-receipt"></i>
                    <p>Aucune transaction récente</p>
                </div>
            `;
            return;
        }

        transactionsList.innerHTML = this.transactions.map(transaction => `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-memo">${transaction.memo}</div>
                    <div class="transaction-date">${new Date(transaction.createdAt).toLocaleDateString()}</div>
                </div>
                <div class="transaction-amount ${this.getTransactionAmountClass(transaction)}">
                    ${this.getTransactionAmountSymbol(transaction)}${transaction.amount} π
                </div>
            </div>
        `).join('');
    }

    // Obtenir la classe CSS pour le montant de transaction
    getTransactionAmountClass(transaction) {
        return transaction.toAddress === app.currentUser?.walletAddress ? 'positive' : 'negative';
    }

    // Obtenir le symbole pour le montant de transaction
    getTransactionAmountSymbol(transaction) {
        return transaction.toAddress === app.currentUser?.walletAddress ? '+' : '-';
    }

    // Afficher le modal d'envoi d'argent
    showSendMoneyModal() {
        if (!app.currentUser) {
            app.showNotification('Veuillez vous connecter pour envoyer de l\'argent', 'warning');
            app.showAuthModal('login');
            return;
        }

        // Implémentation du modal d'envoi
        app.showNotification('Modal d\'envoi d\'argent à venir!', 'info');
    }

    // Afficher le modal de réception d'argent
    showReceiveMoneyModal() {
        if (!app.currentUser) {
            app.showNotification('Veuillez vous connecter pour voir votre adresse', 'warning');
            app.showAuthModal('login');
            return;
        }

        // Afficher l'adresse wallet avec QR code
        this.showWalletAddress();
    }

    // Afficher l'adresse du portefeuille
    async showWalletAddress() {
        try {
            const response = await app.apiCall('/wallet/address');
            
            // Créer un modal pour afficher l'adresse et le QR code
            this.createAddressModal(response.address);
        } catch (error) {
            console.error('Erreur récupération adresse:', error);
            app.showNotification('Erreur lors de la récupération de l\'adresse', 'error');
        }
    }

    // Créer le modal d'adresse
    createAddressModal(address) {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Votre Adresse Pi</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body" style="text-align: center;">
                    <div id="qrcode" style="margin: 1rem auto; width: 200px; height: 200px;"></div>
                    <div class="address-display">
                        <code style="word-break: break-all; background: var(--bg-secondary); padding: 1rem; border-radius: var(--radius); display: block; margin: 1rem 0;">${address}</code>
                    </div>
                    <button class="btn btn-primary" onclick="wallet.copyAddress('${address}')">
                        <i class="fas fa-copy"></i>
                        Copier l'adresse
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Fermer le modal
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Générer le QR code (nécessite une librairie QR code)
        this.generateQRCode(address);
    }

    // Copier l'adresse
    copyAddress(address) {
        navigator.clipboard.writeText(address).then(() => {
            app.showNotification('Adresse copiée dans le presse-papier!', 'success');
        }).catch(() => {
            // Fallback pour les anciens navigateurs
            const textArea = document.createElement('textarea');
            textArea.value = address;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            app.showNotification('Adresse copiée!', 'success');
        });
    }

    // Générer le QR code
    generateQRCode(address) {
        // Implémentation basique du QR code
        // En production, utiliser une librairie comme qrcode.js
        const qrContainer = document.getElementById('qrcode');
        if (qrContainer) {
            qrContainer.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: white; border-radius: 8px;">
                    <div style="text-align: center;">
                        <i class="fas fa-qrcode" style="font-size: 3rem; color: #666; margin-bottom: 0.5rem;"></i>
                        <div style="font-size: 0.8rem; color: #666;">QR Code</div>
                    </div>
                </div>
            `;
        }
    }

    // Afficher l'historique des transactions
    showTransactionHistory() {
        // Implémentation de la vue complète de l'historique
        app.showNotification('Historique complet des transactions à venir!', 'info');
    }
}