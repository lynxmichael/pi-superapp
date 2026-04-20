// Gestion complète du portefeuille avec QR Code avancé
class Wallet {
    constructor() {
        this.transactions = [];
        this.qrCodeInstance = null;
        this.qrScanner = null;
        this.scannerStream = null;
        this.scannerAnimationId = null;
        this.init();
    }

    init() {
        this.initializeEventListeners();
        this.initializeModalEvents();
        this.loadQRCodeLibrary();
        this.loadQRScannerLibrary();
    }

    // ========================================================================
    // CHARGEMENT DES BIBLIOTHÈQUES QR
    // ========================================================================

    loadQRCodeLibrary() {
        if (typeof QRCode === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
            script.onload = () => console.log('✅ QRCode.js chargé');
            script.onerror = () => console.error('❌ Erreur chargement QRCode.js');
            document.head.appendChild(script);
        }
    }

    loadQRScannerLibrary() {
        if (typeof jsQR === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
            script.onload = () => console.log('✅ jsQR scanner chargé');
            script.onerror = () => console.error('❌ Erreur chargement jsQR');
            document.head.appendChild(script);
        }
    }

    // ========================================================================
    // ÉVÉNEMENTS
    // ========================================================================

    initializeEventListeners() {
        const sendMoneyBtn = document.getElementById('sendMoneyBtn');
        const receiveMoneyBtn = document.getElementById('receiveMoneyBtn');
        const transactionHistoryBtn = document.getElementById('transactionHistoryBtn');

        if (sendMoneyBtn) {
            sendMoneyBtn.addEventListener('click', () => this.showSendMoneyModal());
        }
        if (receiveMoneyBtn) {
            receiveMoneyBtn.addEventListener('click', () => this.showReceiveMoneyModal());
        }
        if (transactionHistoryBtn) {
            transactionHistoryBtn.addEventListener('click', () => this.showTransactionHistory());
        }
    }

    initializeModalEvents() {}

    // ========================================================================
    // CHARGEMENT DES DONNÉES DU PORTEFEUILLE
    // ========================================================================

    async loadWalletData() {
        if (!window.app || !window.app.currentUser) {
            console.log('⚠️ Utilisateur non connecté');
            return;
        }
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

    async loadBalance() {
        try {
            const response = await window.app.apiCall('/wallet/balance');
            const balanceValue = document.getElementById('balanceValue');
            const totalEarned = document.getElementById('totalEarned');
            const totalSpent = document.getElementById('totalSpent');
            if (balanceValue) balanceValue.textContent = (response.balance || 0).toFixed(2);
            if (totalEarned) totalEarned.textContent = (response.totalEarned || 0).toFixed(2);
            if (totalSpent) totalSpent.textContent = (response.totalSpent || 0).toFixed(2);
        } catch (error) {
            console.error('Erreur chargement solde:', error);
        }
    }

    async loadRecentTransactions() {
        try {
            const response = await window.app.apiCall('/wallet/transactions?limit=5');
            this.transactions = response.transactions || [];
            this.displayRecentTransactions();
        } catch (error) {
            console.error('Erreur chargement transactions:', error);
            this.transactions = [];
            this.displayRecentTransactions();
        }
    }

    async loadStats() {
        try {
            const response = await window.app.apiCall('/wallet/wallet-stats');
            const totalTransactions = document.getElementById('totalTransactions');
            if (totalTransactions && response.stats) {
                totalTransactions.textContent = response.stats.transactionCount || 0;
            }
        } catch (error) {
            console.error('Erreur chargement stats:', error);
            const totalTransactions = document.getElementById('totalTransactions');
            if (totalTransactions) totalTransactions.textContent = '0';
        }
    }

    // ========================================================================
    // AFFICHAGE DES TRANSACTIONS
    // ========================================================================

    displayRecentTransactions() {
        const transactionsList = document.getElementById('transactionsList');
        if (!transactionsList) return;

        if (this.transactions.length === 0) {
            transactionsList.innerHTML = `
                <div class="no-transactions" style="text-align:center;padding:2rem;color:var(--text-secondary);">
                    <i class="fas fa-receipt" style="font-size:3rem;margin-bottom:1rem;opacity:0.5;"></i>
                    <p>Aucune transaction récente</p>
                    <small>Vos transactions apparaîtront ici</small>
                </div>`;
            return;
        }

        transactionsList.innerHTML = this.transactions.map(tx => {
            const isIncome = tx.toAddress === window.app?.currentUser?.walletAddress;
            const sign = isIncome ? '+' : '-';
            const icon = isIncome ? 'fa-arrow-down' : 'fa-arrow-up';
            const color = isIncome ? '#28a745' : '#dc3545';
            const bg = isIncome ? '#d4edda' : '#f8d7da';
            return `
                <div class="transaction-item" style="display:flex;justify-content:space-between;align-items:center;padding:1rem;border-bottom:1px solid var(--border-color);cursor:pointer;transition:background 0.2s;" data-transaction-id="${tx._id}">
                    <div style="display:flex;align-items:center;gap:1rem;flex:1;">
                        <div style="width:40px;height:40px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;color:${color};">
                            <i class="fas ${icon}"></i>
                        </div>
                        <div>
                            <div style="font-weight:500;margin-bottom:0.25rem;">${tx.memo || 'Transaction'}</div>
                            <div style="font-size:0.875rem;color:var(--text-secondary);">
                                ${new Date(tx.createdAt).toLocaleDateString('fr-FR')} à ${new Date(tx.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                    <div style="font-weight:600;font-size:1.125rem;color:${color};">
                        ${sign}${tx.amount.toFixed(2)} π
                    </div>
                </div>`;
        }).join('');

        transactionsList.querySelectorAll('.transaction-item').forEach(item => {
            item.addEventListener('mouseenter', function() { this.style.background = 'var(--bg-secondary)'; });
            item.addEventListener('mouseleave', function() { this.style.background = 'transparent'; });
            item.addEventListener('click', () => {
                this.showTransactionDetails(item.getAttribute('data-transaction-id'));
            });
        });
    }

    // ========================================================================
    // MODAL ENVOI D'ARGENT
    // ========================================================================

    async showSendMoneyModal() {
        if (!window.app?.currentUser) {
            window.app?.showNotification('Veuillez vous connecter pour envoyer de l\'argent', 'warning');
            window.app?.showAuthModal('login');
            return;
        }

        const modal = document.getElementById('sendMoneyModal');
        if (!modal) {
            console.error('Modal sendMoneyModal introuvable');
            return;
        }

        const balanceElement = document.getElementById('sendBalanceAmount');
        if (balanceElement) {
            try {
                const response = await window.app.apiCall('/wallet/balance');
                balanceElement.textContent = `${response.balance.toFixed(2)} π`;
            } catch (error) {
                balanceElement.textContent = '0.00 π';
            }
        }

        this.initializeSendMoneyForm();
        modal.classList.add('show');
    }

    initializeSendMoneyForm() {
        const form = document.getElementById('sendMoneyForm');
        const amountInput = document.getElementById('sendAmount');
        if (!form) return;

        form.reset();

        // Éviter l'accumulation d'event listeners en clonant les éléments
        // ou en utilisant un flag
        if (form._sendFormInitialized) {
            // Déjà initialisé, juste recalculer
            this.calculateTransactionTotals();
            return;
        }
        form._sendFormInitialized = true;

        document.querySelectorAll('.btn-amount-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const amount = btn.getAttribute('data-amount');
                if (amount === 'max' || btn.id === 'maxAmountBtn') {
                    this.setMaxAmount();
                } else {
                    amountInput.value = amount;
                    this.calculateTransactionTotals();
                }
                document.querySelectorAll('.btn-amount-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        if (amountInput) {
            amountInput.addEventListener('input', () => this.calculateTransactionTotals());
        }

        const scanQRBtn = document.getElementById('scanQRBtn');
        if (scanQRBtn) {
            scanQRBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showQRScanner();
            });
        }

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSendMoneySubmit();
        });

        const cancelBtn = document.getElementById('cancelSendBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                document.getElementById('sendMoneyModal').classList.remove('show');
            });
        }

        this.calculateTransactionTotals();
    }

    async setMaxAmount() {
        try {
            const response = await window.app.apiCall('/wallet/balance');
            const maxAmount = Math.max(0, response.balance - 0.01);
            const amountInput = document.getElementById('sendAmount');
            if (amountInput) {
                amountInput.value = maxAmount.toFixed(2);
                this.calculateTransactionTotals();
            }
        } catch (error) {
            console.error('Erreur récupération solde:', error);
        }
    }

    calculateTransactionTotals() {
        const amountInput = document.getElementById('sendAmount');
        const totalElement = document.getElementById('totalSendAmount');
        const netElement = document.getElementById('netReceiveAmount');
        const feeElement = document.getElementById('transactionFee');
        const confirmBtn = document.getElementById('confirmSendBtn');
        if (!amountInput || !totalElement || !netElement) return;

        const amount = parseFloat(amountInput.value) || 0;
        const fee = 0.01;
        const total = amount + fee;

        totalElement.textContent = `${total.toFixed(2)} π`;
        netElement.textContent = `${amount.toFixed(2)} π`;
        if (feeElement) feeElement.textContent = `${fee.toFixed(2)} π`;

        if (confirmBtn && window.app?.currentUser) {
            const balance = window.app.currentUser.balance || 0;
            if (total > balance || amount <= 0) {
                confirmBtn.disabled = true;
                confirmBtn.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' +
                    (amount <= 0 ? 'Montant invalide' : 'Solde insuffisant');
                confirmBtn.classList.add('btn-danger');
                confirmBtn.classList.remove('btn-primary');
            } else {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Envoyer';
                confirmBtn.classList.add('btn-primary');
                confirmBtn.classList.remove('btn-danger');
            }
        }
    }

    async handleSendMoneySubmit() {
        const recipientAddress = document.getElementById('recipientAddress').value.trim();
        const amount = parseFloat(document.getElementById('sendAmount').value);
        const memo = document.getElementById('sendMemo').value.trim();

        if (!recipientAddress) {
            window.app?.showNotification('Veuillez entrer une adresse de destinataire', 'error');
            return;
        }
        if (!amount || amount <= 0) {
            window.app?.showNotification('Veuillez entrer un montant valide', 'error');
            return;
        }
        if (!recipientAddress.startsWith('G') || recipientAddress.length < 20) {
            window.app?.showNotification('Format d\'adresse wallet invalide', 'error');
            return;
        }
        if (recipientAddress === window.app.currentUser.walletAddress) {
            window.app?.showNotification('Vous ne pouvez pas vous envoyer de l\'argent à vous-même', 'error');
            return;
        }

        const balance = window.app.currentUser?.balance || 0;
        const fee = 0.01;
        const total = amount + fee;

        if (total > balance) {
            window.app?.showNotification('Solde insuffisant', 'error');
            return;
        }

        const confirmMessage = `
            <div style="text-align:left;">
                <p><strong>Récapitulatif de la transaction:</strong></p>
                <p>Destinataire: <code>${recipientAddress.substring(0, 8)}...${recipientAddress.substring(recipientAddress.length - 8)}</code></p>
                <p>Montant: <strong>${amount.toFixed(2)} π</strong></p>
                <p>Frais: <strong>${fee.toFixed(2)} π</strong></p>
                <p>Total débité: <strong>${total.toFixed(2)} π</strong></p>
                ${memo ? `<p>Mémo: ${memo}</p>` : ''}
            </div>`;

        if (window.app?.showConfirmDialog) {
            window.app.showConfirmDialog(
                'Confirmer le transfert',
                confirmMessage,
                async () => {
                    try {
                        window.app?.showLoading();
                        const response = await window.app.apiCall('/wallet/transfer', {
                            method: 'POST',
                            body: JSON.stringify({
                                toAddress: recipientAddress,
                                amount: amount,
                                memo: memo || 'Transfert Pi'
                            })
                        });
                        window.app?.hideLoading();
                        window.app?.showNotification('Transfert effectué avec succès!', 'success');
                        document.getElementById('sendMoneyModal').classList.remove('show');
                        await this.loadWalletData();
                    } catch (error) {
                        window.app?.hideLoading();
                        window.app?.showNotification(error.message || 'Erreur lors du transfert', 'error');
                    }
                }
            );
        } else {
            if (confirm(`Envoyer ${amount.toFixed(2)} π à ${recipientAddress.substring(0, 12)}...?`)) {
                try {
                    window.app?.showLoading();
                    await window.app.apiCall('/wallet/transfer', {
                        method: 'POST',
                        body: JSON.stringify({
                            toAddress: recipientAddress,
                            amount: amount,
                            memo: memo || 'Transfert Pi'
                        })
                    });
                    window.app?.hideLoading();
                    window.app?.showNotification('Transfert effectué avec succès!', 'success');
                    document.getElementById('sendMoneyModal').classList.remove('show');
                    await this.loadWalletData();
                } catch (error) {
                    window.app?.hideLoading();
                    window.app?.showNotification(error.message || 'Erreur lors du transfert', 'error');
                }
            }
        }
    }

    // ========================================================================
    // MODAL RECEVOIR - QR CODE AVANCÉ (MULTI-TYPES)
    // ========================================================================

    async showReceiveMoneyModal() {
        if (!window.app?.currentUser) {
            window.app?.showNotification('Veuillez vous connecter pour voir votre adresse', 'warning');
            window.app?.showAuthModal('login');
            return;
        }

        const user = window.app.currentUser;

        // Supprimer tout modal existant
        const existing = document.getElementById('receiveMoneyModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.id = 'receiveMoneyModal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:650px;border-radius:20px;overflow:hidden;">
                <div class="modal-header" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;padding:1.5rem 2rem;">
                    <h3 style="margin:0;font-size:1.25rem;display:flex;align-items:center;gap:10px;">
                        <i class="fas fa-qrcode"></i> Recevoir des Pi
                    </h3>
                    <button class="modal-close" data-modal-id="receiveMoneyModal" style="background:rgba(255,255,255,0.2);border:none;color:white;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:1.2rem;display:flex;align-items:center;justify-content:center;">&times;</button>
                </div>
                <div class="modal-body" style="padding:0;">
                    
                    <!-- Onglets QR -->
                    <div class="qr-tabs" style="display:flex;border-bottom:2px solid #e5e7eb;background:#f9fafb;">
                        <button class="qr-tab active" data-qr-type="address" style="flex:1;padding:14px;border:none;background:transparent;font-weight:600;cursor:pointer;color:#6b7280;position:relative;font-size:0.9rem;transition:all 0.3s;">
                            <i class="fas fa-wallet"></i> Mon Adresse
                        </button>
                        <button class="qr-tab" data-qr-type="request" style="flex:1;padding:14px;border:none;background:transparent;font-weight:600;cursor:pointer;color:#6b7280;position:relative;font-size:0.9rem;transition:all 0.3s;">
                            <i class="fas fa-hand-holding-usd"></i> Demande de paiement
                        </button>
                        <button class="qr-tab" data-qr-type="merchant" style="flex:1;padding:14px;border:none;background:transparent;font-weight:600;cursor:pointer;color:#6b7280;position:relative;font-size:0.9rem;transition:all 0.3s;">
                            <i class="fas fa-store"></i> QR Marchand
                        </button>
                    </div>

                    <!-- Contenu QR: Adresse simple -->
                    <div class="qr-content" id="qrContent-address" style="text-align:center;padding:2rem;">
                        <p style="margin-bottom:1rem;color:#6b7280;font-size:0.95rem;">
                            Scannez ce QR code pour obtenir mon adresse wallet
                        </p>
                        <div id="qrcodeContainer-address" style="margin:1.5rem auto;padding:1.5rem;background:white;border-radius:16px;display:inline-block;box-shadow:0 8px 24px rgba(0,0,0,0.12);border:1px solid #e5e7eb;"></div>
                        <div style="margin:1.5rem 0;">
                            <label style="display:block;font-weight:700;margin-bottom:0.75rem;color:#374151;font-size:0.8rem;text-transform:uppercase;letter-spacing:1.5px;">
                                Adresse Wallet
                            </label>
                            <div style="background:#f3f4f6;padding:1rem;border-radius:12px;border:2px solid #e5e7eb;">
                                <code id="walletAddressDisplay-address" style="display:block;word-break:break-all;font-size:0.9rem;font-family:'Courier New',monospace;color:#1f2937;font-weight:600;line-height:1.6;">${user.walletAddress}</code>
                            </div>
                        </div>
                        <div style="display:flex;gap:0.75rem;margin-top:1.5rem;">
                            <button class="btn btn-primary" id="copyAddressBtn-address" style="flex:1;padding:0.875rem;font-size:0.95rem;border-radius:12px;border:none;background:#6366f1;color:white;cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.3s;">
                                <i class="fas fa-copy"></i> Copier
                            </button>
                            <button class="btn btn-outline" id="shareAddressBtn-address" style="flex:1;padding:0.875rem;font-size:0.95rem;border-radius:12px;border:2px solid #e5e7eb;background:white;cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.3s;">
                                <i class="fas fa-share-alt"></i> Partager
                            </button>
                            <button class="btn btn-outline" id="downloadQR-address" style="padding:0.875rem 1.25rem;font-size:0.95rem;border-radius:12px;border:2px solid #e5e7eb;background:white;cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.3s;">
                                <i class="fas fa-download"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Contenu QR: Demande de paiement -->
                    <div class="qr-content" id="qrContent-request" style="text-align:center;padding:2rem;display:none;">
                        <p style="margin-bottom:1.5rem;color:#6b7280;font-size:0.95rem;">
                            Créez un QR code avec un montant spécifique à recevoir
                        </p>
                        <div style="max-width:320px;margin:0 auto 1.5rem;">
                            <div style="margin-bottom:1rem;">
                                <label style="display:block;text-align:left;font-weight:600;margin-bottom:0.5rem;color:#374151;font-size:0.9rem;">Montant à recevoir (π)</label>
                                <div style="position:relative;">
                                    <input type="number" id="requestAmount" min="0.01" step="0.01" placeholder="0.00" 
                                        style="width:100%;padding:14px 50px 14px 16px;border:2px solid #e5e7eb;border-radius:12px;font-size:1.2rem;font-weight:700;text-align:center;outline:none;transition:border-color 0.3s;box-sizing:border-box;"
                                        onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#e5e7eb'">
                                    <span style="position:absolute;right:16px;top:50%;transform:translateY(-50%);font-size:1.2rem;font-weight:700;color:#6366f1;">π</span>
                                </div>
                            </div>
                            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:1rem;">
                                <button class="qr-amount-quick" data-amount="5" style="padding:8px 16px;border-radius:20px;border:2px solid #e5e7eb;background:white;cursor:pointer;font-weight:600;font-size:0.85rem;transition:all 0.2s;">5 π</button>
                                <button class="qr-amount-quick" data-amount="10" style="padding:8px 16px;border-radius:20px;border:2px solid #e5e7eb;background:white;cursor:pointer;font-weight:600;font-size:0.85rem;transition:all 0.2s;">10 π</button>
                                <button class="qr-amount-quick" data-amount="25" style="padding:8px 16px;border-radius:20px;border:2px solid #e5e7eb;background:white;cursor:pointer;font-weight:600;font-size:0.85rem;transition:all 0.2s;">25 π</button>
                                <button class="qr-amount-quick" data-amount="50" style="padding:8px 16px;border-radius:20px;border:2px solid #e5e7eb;background:white;cursor:pointer;font-weight:600;font-size:0.85rem;transition:all 0.2s;">50 π</button>
                                <button class="qr-amount-quick" data-amount="100" style="padding:8px 16px;border-radius:20px;border:2px solid #e5e7eb;background:white;cursor:pointer;font-weight:600;font-size:0.85rem;transition:all 0.2s;">100 π</button>
                            </div>
                            <div style="margin-bottom:1rem;">
                                <label style="display:block;text-align:left;font-weight:600;margin-bottom:0.5rem;color:#374151;font-size:0.9rem;">Description (optionnel)</label>
                                <input type="text" id="requestMemo" placeholder="Ex: Paiement commande #123" maxlength="50"
                                    style="width:100%;padding:12px 16px;border:2px solid #e5e7eb;border-radius:12px;font-size:0.95rem;outline:none;transition:border-color 0.3s;box-sizing:border-box;"
                                    onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#e5e7eb'">
                            </div>
                            <button id="generateRequestQR" style="width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-weight:700;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.3s;">
                                <i class="fas fa-qrcode"></i> Générer le QR Code
                            </button>
                        </div>
                        <div id="qrcodeContainer-request" style="margin:1.5rem auto;padding:1.5rem;background:white;border-radius:16px;display:none;box-shadow:0 8px 24px rgba(0,0,0,0.12);border:1px solid #e5e7eb;">
                        </div>
                        <div id="requestQRInfo" style="display:none;margin-top:1rem;padding:1rem;background:linear-gradient(135deg,#ecfdf5,#e0f2fe);border-radius:12px;border-left:4px solid #10b981;">
                            <p style="margin:0;font-size:0.9rem;color:#065f46;">
                                <i class="fas fa-check-circle" style="color:#10b981;"></i>
                                <strong>Demande créée:</strong> <span id="requestQRSummary"></span>
                            </p>
                        </div>
                        <div id="requestQRActions" style="display:none;margin-top:1rem;gap:0.75rem;">
                            <button class="btn btn-primary" id="copyRequestLink" style="flex:1;padding:0.875rem;font-size:0.95rem;border-radius:12px;border:none;background:#6366f1;color:white;cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;">
                                <i class="fas fa-link"></i> Copier le lien
                            </button>
                            <button class="btn btn-outline" id="shareRequestQR" style="flex:1;padding:0.875rem;font-size:0.95rem;border-radius:12px;border:2px solid #e5e7eb;background:white;cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;">
                                <i class="fas fa-share-alt"></i> Partager
                            </button>
                            <button class="btn btn-outline" id="downloadQR-request" style="padding:0.875rem 1.25rem;font-size:0.95rem;border-radius:12px;border:2px solid #e5e7eb;background:white;cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;">
                                <i class="fas fa-download"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Contenu QR: Mode Marchand -->
                    <div class="qr-content" id="qrContent-merchant" style="text-align:center;padding:2rem;display:none;">
                        <p style="margin-bottom:1.5rem;color:#6b7280;font-size:0.95rem;">
                            QR code marchand permanent pour accepter les paiements
                        </p>
                        <div style="max-width:320px;margin:0 auto 1.5rem;">
                            <div style="margin-bottom:1rem;">
                                <label style="display:block;text-align:left;font-weight:600;margin-bottom:0.5rem;color:#374151;font-size:0.9rem;">Nom de la boutique</label>
                                <input type="text" id="merchantName" placeholder="Ex: Ma Boutique Pi" maxlength="40"
                                    style="width:100%;padding:12px 16px;border:2px solid #e5e7eb;border-radius:12px;font-size:0.95rem;outline:none;transition:border-color 0.3s;box-sizing:border-box;"
                                    onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#e5e7eb'">
                            </div>
                            <div style="margin-bottom:1rem;">
                                <label style="display:block;text-align:left;font-weight:600;margin-bottom:0.5rem;color:#374151;font-size:0.9rem;">Montant fixe (optionnel)</label>
                                <div style="position:relative;">
                                    <input type="number" id="merchantAmount" min="0" step="0.01" placeholder="Laisser vide = libre"
                                        style="width:100%;padding:12px 50px 12px 16px;border:2px solid #e5e7eb;border-radius:12px;font-size:1rem;outline:none;transition:border-color 0.3s;box-sizing:border-box;"
                                        onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#e5e7eb'">
                                    <span style="position:absolute;right:16px;top:50%;transform:translateY(-50%);font-weight:700;color:#6366f1;">π</span>
                                </div>
                            </div>
                            <button id="generateMerchantQR" style="width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,#059669,#10b981);color:white;font-weight:700;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.3s;">
                                <i class="fas fa-store"></i> Générer le QR Marchand
                            </button>
                        </div>
                        <div id="qrcodeContainer-merchant" style="margin:1.5rem auto;padding:1.5rem;background:white;border-radius:16px;display:none;box-shadow:0 8px 24px rgba(0,0,0,0.12);border:1px solid #e5e7eb;">
                        </div>
                        <div id="merchantQRActions" style="display:none;margin-top:1rem;gap:0.75rem;">
                            <button class="btn btn-primary" id="downloadQR-merchant" style="flex:1;padding:0.875rem;font-size:0.95rem;border-radius:12px;border:none;background:#059669;color:white;cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;">
                                <i class="fas fa-download"></i> Télécharger pour impression
                            </button>
                            <button class="btn btn-outline" id="printMerchantQR" style="flex:1;padding:0.875rem;font-size:0.95rem;border-radius:12px;border:2px solid #e5e7eb;background:white;cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;">
                                <i class="fas fa-print"></i> Imprimer
                            </button>
                        </div>
                    </div>

                    <!-- Info sécurité -->
                    <div style="margin:0 2rem 1.5rem;padding:1rem;background:#eff6ff;border-radius:12px;border-left:4px solid #6366f1;">
                        <p style="margin:0;font-size:0.85rem;color:#1e40af;line-height:1.6;">
                            <i class="fas fa-shield-alt" style="color:#6366f1;"></i>
                            <strong>Sécurité:</strong> Seules les adresses commençant par "G" sont valides sur Pi Network. Ne partagez jamais votre clé privée.
                        </p>
                    </div>
                </div>
            </div>`;

        document.body.appendChild(modal);

        // Initialiser les onglets QR
        this.initQRTabs(modal, user);

        // Générer le QR d'adresse par défaut
        setTimeout(() => {
            this.generateQRCode(user.walletAddress, 'qrcodeContainer-address', 280);
        }, 150);

        // Fermeture
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.remove();
                this.qrCodeInstance = null;
            });
        }
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                this.qrCodeInstance = null;
            }
        });
    }

    // Initialiser les onglets QR
    initQRTabs(modal, user) {
        const tabs = modal.querySelectorAll('.qr-tab');
        const contents = modal.querySelectorAll('.qr-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const type = tab.getAttribute('data-qr-type');

                // Activer l'onglet
                tabs.forEach(t => {
                    t.classList.remove('active');
                    t.style.color = '#6b7280';
                    t.style.borderBottom = 'none';
                    t.style.background = 'transparent';
                });
                tab.classList.add('active');
                tab.style.color = '#6366f1';
                tab.style.borderBottom = '3px solid #6366f1';
                tab.style.background = 'white';

                // Afficher le contenu
                contents.forEach(c => c.style.display = 'none');
                const content = document.getElementById(`qrContent-${type}`);
                if (content) content.style.display = 'block';
            });
        });

        // Style initial de l'onglet actif
        const activeTab = modal.querySelector('.qr-tab.active');
        if (activeTab) {
            activeTab.style.color = '#6366f1';
            activeTab.style.borderBottom = '3px solid #6366f1';
            activeTab.style.background = 'white';
        }

        // Boutons copie/partage/download pour l'adresse
        const copyBtn = modal.querySelector('#copyAddressBtn-address');
        const shareBtn = modal.querySelector('#shareAddressBtn-address');
        const downloadBtn = modal.querySelector('#downloadQR-address');

        if (copyBtn) copyBtn.addEventListener('click', (e) => { e.preventDefault(); this.copyAddress(user.walletAddress); });
        if (shareBtn) shareBtn.addEventListener('click', (e) => { e.preventDefault(); this.shareAddress(user.walletAddress); });
        if (downloadBtn) downloadBtn.addEventListener('click', (e) => { e.preventDefault(); this.downloadQRCode('qrcodeContainer-address', `pi-wallet-${user.piUsername}`); });

        // Boutons de montant rapide pour la demande
        modal.querySelectorAll('.qr-amount-quick').forEach(btn => {
            btn.addEventListener('click', () => {
                const amount = btn.getAttribute('data-amount');
                const input = document.getElementById('requestAmount');
                if (input) input.value = amount;
                modal.querySelectorAll('.qr-amount-quick').forEach(b => {
                    b.style.background = 'white';
                    b.style.color = '#374151';
                    b.style.borderColor = '#e5e7eb';
                });
                btn.style.background = '#6366f1';
                btn.style.color = 'white';
                btn.style.borderColor = '#6366f1';
            });
        });

        // Générer QR demande de paiement
        const generateRequestBtn = document.getElementById('generateRequestQR');
        if (generateRequestBtn) {
            generateRequestBtn.addEventListener('click', () => {
                this.generatePaymentRequestQR(user);
            });
        }

        // Générer QR marchand
        const generateMerchantBtn = document.getElementById('generateMerchantQR');
        if (generateMerchantBtn) {
            generateMerchantBtn.addEventListener('click', () => {
                this.generateMerchantQR(user);
            });
        }
    }

    // ========================================================================
    // GÉNÉRATION QR CODE - MOTEUR PRINCIPAL
    // ========================================================================

    generateQRCode(data, containerId, size = 280) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container ${containerId} introuvable`);
            return;
        }
        container.innerHTML = '';

        if (typeof QRCode !== 'undefined') {
            try {
                this.qrCodeInstance = new QRCode(container, {
                    text: data,
                    width: size,
                    height: size,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.H
                });
                console.log('✅ QR Code généré:', data.substring(0, 30) + '...');
            } catch (error) {
                console.error('❌ Erreur génération QR:', error);
                this.showQRCodeFallback(container, data, size);
            }
        } else {
            console.error('❌ QRCode.js non chargé');
            this.showQRCodeFallback(container, data, size);
        }
    }

    // Générer QR pour demande de paiement
    generatePaymentRequestQR(user) {
        const amountInput = document.getElementById('requestAmount');
        const memoInput = document.getElementById('requestMemo');
        const amount = parseFloat(amountInput?.value);
        const memo = memoInput?.value?.trim() || '';

        if (!amount || amount <= 0) {
            window.app?.showNotification('Veuillez entrer un montant valide', 'error');
            return;
        }

        // Format URI pour la demande de paiement Pi
        const paymentData = {
            type: 'pi_payment_request',
            address: user.walletAddress,
            amount: amount,
            memo: memo,
            username: user.piUsername,
            timestamp: Date.now()
        };
        const qrData = `pi://pay?to=${user.walletAddress}&amount=${amount}&memo=${encodeURIComponent(memo)}&from=${user.piUsername}`;

        const container = document.getElementById('qrcodeContainer-request');
        if (container) {
            container.style.display = 'inline-block';
            this.generateQRCode(qrData, 'qrcodeContainer-request', 260);

            // Ajouter un label sous le QR
            const label = document.createElement('div');
            label.style.cssText = 'margin-top:12px;font-weight:700;font-size:1.3rem;color:#059669;';
            label.textContent = `${amount.toFixed(2)} π`;
            container.appendChild(label);
            if (memo) {
                const memoLabel = document.createElement('div');
                memoLabel.style.cssText = 'font-size:0.85rem;color:#6b7280;margin-top:4px;';
                memoLabel.textContent = memo;
                container.appendChild(memoLabel);
            }
        }

        // Afficher les infos et actions
        const infoEl = document.getElementById('requestQRInfo');
        const summaryEl = document.getElementById('requestQRSummary');
        const actionsEl = document.getElementById('requestQRActions');

        if (infoEl) infoEl.style.display = 'block';
        if (summaryEl) summaryEl.textContent = `${amount.toFixed(2)} π${memo ? ` - "${memo}"` : ''}`;
        if (actionsEl) actionsEl.style.display = 'flex';

        // Boutons d'action
        const copyLinkBtn = document.getElementById('copyRequestLink');
        if (copyLinkBtn) {
            copyLinkBtn.onclick = () => this.copyAddress(qrData);
        }
        const shareBtn = document.getElementById('shareRequestQR');
        if (shareBtn) {
            shareBtn.onclick = () => {
                const text = `Demande de paiement Pi\nMontant: ${amount.toFixed(2)} π\n${memo ? `Description: ${memo}\n` : ''}Adresse: ${user.walletAddress}`;
                this.shareAddress(text);
            };
        }
        const downloadBtn = document.getElementById('downloadQR-request');
        if (downloadBtn) {
            downloadBtn.onclick = () => this.downloadQRCode('qrcodeContainer-request', `pi-paiement-${amount}pi`);
        }
    }

    // Générer QR marchand
    generateMerchantQR(user) {
        const nameInput = document.getElementById('merchantName');
        const amountInput = document.getElementById('merchantAmount');
        const name = nameInput?.value?.trim() || user.piUsername;
        const amount = parseFloat(amountInput?.value) || 0;

        const merchantData = amount > 0
            ? `pi://merchant?to=${user.walletAddress}&name=${encodeURIComponent(name)}&amount=${amount}`
            : `pi://merchant?to=${user.walletAddress}&name=${encodeURIComponent(name)}`;

        const container = document.getElementById('qrcodeContainer-merchant');
        if (container) {
            container.style.display = 'inline-block';
            container.innerHTML = '';

            // Header marchand
            const header = document.createElement('div');
            header.style.cssText = 'margin-bottom:12px;padding-bottom:12px;border-bottom:2px solid #e5e7eb;';
            header.innerHTML = `
                <div style="font-weight:700;font-size:1.1rem;color:#059669;"><i class="fas fa-store"></i> ${this.escapeHtml(name)}</div>
                ${amount > 0 ? `<div style="font-size:1.3rem;font-weight:800;color:#1f2937;margin-top:4px;">${amount.toFixed(2)} π</div>` : '<div style="font-size:0.85rem;color:#6b7280;margin-top:4px;">Montant libre</div>'}
            `;
            container.appendChild(header);

            // QR code
            const qrDiv = document.createElement('div');
            qrDiv.id = 'merchantQRInner';
            container.appendChild(qrDiv);

            if (typeof QRCode !== 'undefined') {
                new QRCode(qrDiv, {
                    text: merchantData,
                    width: 260,
                    height: 260,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.H
                });
            }

            // Footer
            const footer = document.createElement('div');
            footer.style.cssText = 'margin-top:12px;font-size:0.75rem;color:#9ca3af;';
            footer.textContent = 'Scannez pour payer avec Pi Network';
            container.appendChild(footer);
        }

        // Afficher les actions
        const actionsEl = document.getElementById('merchantQRActions');
        if (actionsEl) actionsEl.style.display = 'flex';

        const downloadBtn = document.getElementById('downloadQR-merchant');
        if (downloadBtn) {
            downloadBtn.onclick = () => this.downloadQRCode('qrcodeContainer-merchant', `pi-marchand-${name.replace(/\s+/g, '-')}`);
        }
        const printBtn = document.getElementById('printMerchantQR');
        if (printBtn) {
            printBtn.onclick = () => this.printQRCode('qrcodeContainer-merchant', name, amount);
        }
    }

    // ========================================================================
    // QR CODE UTILITIES
    // ========================================================================

    showQRCodeFallback(container, data, size = 280) {
        container.innerHTML = `
            <div style="width:${size}px;height:${size}px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:3px dashed #d1d5db;border-radius:16px;background:#f9fafb;">
                <i class="fas fa-qrcode" style="font-size:4rem;color:#6366f1;margin-bottom:1rem;"></i>
                <div style="font-size:0.85rem;color:#6b7280;text-align:center;padding:0 1rem;">
                    <strong>QR Code en cours de chargement...</strong><br>
                    <small>${data.substring(0, 15)}...${data.substring(data.length - 10)}</small>
                </div>
                <button onclick="location.reload()" style="margin-top:1rem;padding:8px 16px;border-radius:8px;border:1px solid #d1d5db;background:white;cursor:pointer;font-size:0.85rem;">
                    <i class="fas fa-redo"></i> Recharger
                </button>
            </div>`;
    }

    downloadQRCode(containerId, filename) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const canvas = container.querySelector('canvas');
        if (canvas) {
            const link = document.createElement('a');
            link.download = `${filename}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            window.app?.showNotification('QR Code téléchargé!', 'success');
        } else {
            const img = container.querySelector('img');
            if (img) {
                const link = document.createElement('a');
                link.download = `${filename}.png`;
                link.href = img.src;
                link.click();
                window.app?.showNotification('QR Code téléchargé!', 'success');
            } else {
                window.app?.showNotification('Impossible de télécharger le QR Code', 'error');
            }
        }
    }

    printQRCode(containerId, merchantName, amount) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const printWindow = window.open('', '_blank', 'width=400,height=600');
        printWindow.document.write(`
            <!DOCTYPE html><html><head><title>QR Marchand - ${this.escapeHtml(merchantName)}</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
                .merchant-name { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
                .amount { font-size: 20px; color: #059669; margin-bottom: 20px; }
                .qr-container { display: inline-block; padding: 20px; border: 3px solid #000; border-radius: 12px; }
                .footer { margin-top: 20px; font-size: 12px; color: #666; }
                @media print { body { padding: 20px; } }
            </style></head><body>
            <div class="merchant-name">${this.escapeHtml(merchantName)}</div>
            ${amount > 0 ? `<div class="amount">${amount.toFixed(2)} π</div>` : '<div class="amount">Montant libre</div>'}
            <div class="qr-container">${container.innerHTML}</div>
            <div class="footer">Scannez pour payer avec Pi Network<br>Powered by Pi SuperApp</div>
            </body></html>
        `);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========================================================================
    // SCANNER QR CODE
    // ========================================================================

    showQRScanner() {
        // Supprimer un scanner existant
        const existing = document.getElementById('qrScannerModalDynamic');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.id = 'qrScannerModalDynamic';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:500px;border-radius:20px;overflow:hidden;">
                <div class="modal-header" style="background:linear-gradient(135deg,#1e293b,#334155);color:white;padding:1.5rem 2rem;">
                    <h3 style="margin:0;font-size:1.15rem;display:flex;align-items:center;gap:10px;">
                        <i class="fas fa-camera"></i> Scanner QR Code
                    </h3>
                    <button class="modal-close" style="background:rgba(255,255,255,0.2);border:none;color:white;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:1.2rem;">&times;</button>
                </div>
                <div class="modal-body" style="padding:1.5rem;text-align:center;">
                    <div id="scannerViewport" style="position:relative;width:100%;max-width:400px;margin:0 auto;border-radius:16px;overflow:hidden;background:#000;">
                        <video id="qrScannerVideo" style="width:100%;display:block;" playsinline></video>
                        <canvas id="qrScannerCanvas" style="display:none;"></canvas>
                        <div id="scannerOverlay" style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;">
                            <div style="width:200px;height:200px;border:3px solid rgba(99,102,241,0.8);border-radius:16px;box-shadow:0 0 0 9999px rgba(0,0,0,0.4);"></div>
                        </div>
                        <div id="scannerStatus" style="position:absolute;bottom:12px;left:0;right:0;text-align:center;">
                            <span style="background:rgba(0,0,0,0.7);color:white;padding:6px 16px;border-radius:20px;font-size:0.85rem;">
                                <i class="fas fa-crosshairs"></i> Cadrez le QR code
                            </span>
                        </div>
                    </div>
                    <div id="scannerPlaceholder" style="width:100%;max-width:400px;margin:0 auto;height:300px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:3px dashed #d1d5db;border-radius:16px;background:#f9fafb;">
                        <i class="fas fa-camera" style="font-size:3rem;color:#6366f1;margin-bottom:1rem;"></i>
                        <p style="font-weight:600;color:#374151;">Prêt à scanner</p>
                        <small style="color:#6b7280;">Activez la caméra pour scanner un QR code</small>
                    </div>
                    <div style="display:flex;gap:0.75rem;margin-top:1.5rem;flex-wrap:wrap;justify-content:center;">
                        <button id="startCameraBtn" style="flex:1;min-width:140px;padding:12px;border-radius:12px;border:none;background:#6366f1;color:white;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;font-size:0.95rem;">
                            <i class="fas fa-play"></i> Démarrer la caméra
                        </button>
                        <button id="stopCameraBtn" style="flex:1;min-width:140px;padding:12px;border-radius:12px;border:none;background:#ef4444;color:white;font-weight:600;cursor:pointer;display:none;align-items:center;justify-content:center;gap:8px;font-size:0.95rem;">
                            <i class="fas fa-stop"></i> Arrêter
                        </button>
                        <button id="uploadQRImageBtn" style="padding:12px 20px;border-radius:12px;border:2px solid #e5e7eb;background:white;cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;font-size:0.95rem;">
                            <i class="fas fa-image"></i> Importer image
                        </button>
                        <input type="file" id="qrImageInput" accept="image/*" style="display:none;">
                    </div>
                    <div id="scanResult" style="display:none;margin-top:1.5rem;padding:1rem;background:#ecfdf5;border-radius:12px;border:2px solid #10b981;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                            <i class="fas fa-check-circle" style="color:#10b981;font-size:1.2rem;"></i>
                            <strong style="color:#065f46;">QR Code détecté!</strong>
                        </div>
                        <code id="scanResultText" style="display:block;word-break:break-all;font-size:0.9rem;color:#374151;background:#f0fdf4;padding:8px;border-radius:8px;"></code>
                        <button id="useScanResult" style="margin-top:12px;width:100%;padding:12px;border-radius:10px;border:none;background:#10b981;color:white;font-weight:600;cursor:pointer;font-size:0.95rem;">
                            <i class="fas fa-check"></i> Utiliser cette adresse
                        </button>
                    </div>
                </div>
            </div>`;

        document.body.appendChild(modal);

        const viewport = document.getElementById('scannerViewport');
        const placeholder = document.getElementById('scannerPlaceholder');
        viewport.style.display = 'none';

        // Événements
        document.getElementById('startCameraBtn').addEventListener('click', () => this.startCamera());
        document.getElementById('stopCameraBtn').addEventListener('click', () => this.stopCamera());
        document.getElementById('uploadQRImageBtn').addEventListener('click', () => document.getElementById('qrImageInput').click());
        document.getElementById('qrImageInput').addEventListener('change', (e) => this.handleQRImageUpload(e));

        modal.querySelector('.modal-close').addEventListener('click', () => {
            this.stopCamera();
            modal.remove();
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.stopCamera();
                modal.remove();
            }
        });
    }

    async startCamera() {
        try {
            const video = document.getElementById('qrScannerVideo');
            const viewport = document.getElementById('scannerViewport');
            const placeholder = document.getElementById('scannerPlaceholder');
            const startBtn = document.getElementById('startCameraBtn');
            const stopBtn = document.getElementById('stopCameraBtn');

            this.scannerStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
            });

            video.srcObject = this.scannerStream;
            await video.play();

            viewport.style.display = 'block';
            placeholder.style.display = 'none';
            startBtn.style.display = 'none';
            stopBtn.style.display = 'flex';

            this.scanQRFromVideo();
        } catch (error) {
            console.error('Erreur accès caméra:', error);
            window.app?.showNotification('Impossible d\'accéder à la caméra. Vérifiez les permissions.', 'error');
        }
    }

    stopCamera() {
        if (this.scannerStream) {
            this.scannerStream.getTracks().forEach(track => track.stop());
            this.scannerStream = null;
        }
        if (this.scannerAnimationId) {
            cancelAnimationFrame(this.scannerAnimationId);
            this.scannerAnimationId = null;
        }

        const viewport = document.getElementById('scannerViewport');
        const placeholder = document.getElementById('scannerPlaceholder');
        const startBtn = document.getElementById('startCameraBtn');
        const stopBtn = document.getElementById('stopCameraBtn');

        if (viewport) viewport.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
        if (startBtn) startBtn.style.display = 'flex';
        if (stopBtn) stopBtn.style.display = 'none';
    }

    scanQRFromVideo() {
        const video = document.getElementById('qrScannerVideo');
        const canvas = document.getElementById('qrScannerCanvas');
        if (!video || !canvas || typeof jsQR === 'undefined') return;

        const ctx = canvas.getContext('2d');

        const tick = () => {
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });

                if (code) {
                    this.handleScannedQR(code.data);
                    return;
                }
            }
            this.scannerAnimationId = requestAnimationFrame(tick);
        };
        tick();
    }

    handleQRImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                if (typeof jsQR !== 'undefined') {
                    const code = jsQR(imageData.data, imageData.width, imageData.height);
                    if (code) {
                        this.handleScannedQR(code.data);
                    } else {
                        window.app?.showNotification('Aucun QR code détecté dans l\'image', 'error');
                    }
                } else {
                    window.app?.showNotification('Bibliothèque de scan non chargée', 'error');
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    handleScannedQR(data) {
        console.log('📱 QR scanné:', data);
        this.stopCamera();

        // Parser les données QR
        let address = data;
        let amount = null;
        let memo = '';

        if (data.startsWith('pi://pay') || data.startsWith('pi://merchant')) {
            try {
                const url = new URL(data);
                address = url.searchParams.get('to') || data;
                amount = parseFloat(url.searchParams.get('amount')) || null;
                memo = url.searchParams.get('memo') || '';
            } catch (e) {
                // Pas une URL valide, utiliser les données brutes
            }
        }

        // Afficher le résultat
        const resultDiv = document.getElementById('scanResult');
        const resultText = document.getElementById('scanResultText');
        if (resultDiv && resultText) {
            resultDiv.style.display = 'block';
            let displayText = address;
            if (amount) displayText += `\nMontant: ${amount} π`;
            if (memo) displayText += `\nMémo: ${decodeURIComponent(memo)}`;
            resultText.textContent = displayText;
        }

        // Bouton utiliser — remplacer le listener précédent
        const useBtn = document.getElementById('useScanResult');
        if (useBtn) {
            const newBtn = useBtn.cloneNode(true);
            useBtn.parentNode.replaceChild(newBtn, useBtn);
            newBtn.addEventListener('click', () => {
                // Remplir le formulaire d'envoi
                const recipientInput = document.getElementById('recipientAddress');
                const amountInput = document.getElementById('sendAmount');
                const memoInput = document.getElementById('sendMemo');

                if (recipientInput) recipientInput.value = address;
                if (amount && amountInput) {
                    amountInput.value = amount;
                    this.calculateTransactionTotals();
                }
                if (memo && memoInput) memoInput.value = decodeURIComponent(memo);

                // Fermer le scanner
                const scannerModal = document.getElementById('qrScannerModalDynamic');
                if (scannerModal) scannerModal.remove();

                window.app?.showNotification('Adresse importée depuis le QR code!', 'success');
            });
        }
    }

    // ========================================================================
    // COPIER / PARTAGER
    // ========================================================================

    copyAddress(address) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(address)
                .then(() => {
                    window.app?.showNotification('Copié dans le presse-papier!', 'success');
                })
                .catch(() => this.fallbackCopy(address));
        } else {
            this.fallbackCopy(address);
        }
    }

    fallbackCopy(address) {
        const textArea = document.createElement('textarea');
        textArea.value = address;
        textArea.style.cssText = 'position:fixed;left:-999999px;top:-999999px;opacity:0;';
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        try {
            textArea.focus();
            textArea.select();
            textArea.setSelectionRange(0, address.length);
            const ok = document.execCommand('copy');
            if (ok) {
                window.app?.showNotification('Copié!', 'success');
            } else {
                throw new Error('execCommand échoué');
            }
        } catch (err) {
            window.app?.showNotification('Copie impossible. Copiez manuellement: ' + address.substring(0, 20) + '...', 'error');
        } finally {
            document.body.removeChild(textArea);
        }
    }

    shareAddress(text) {
        if (navigator.share) {
            navigator.share({
                title: 'Adresse Pi Wallet',
                text: typeof text === 'string' && text.includes('\n') ? text : `Mon adresse Pi Wallet:\n${text}\n\nRéseau: Pi Network`,
            }).catch(() => this.copyAddress(text));
        } else {
            this.copyAddress(text);
            window.app?.showNotification('Adresse copiée! Collez-la où vous voulez.', 'info');
        }
    }

    // ========================================================================
    // HISTORIQUE DES TRANSACTIONS
    // ========================================================================

    async showTransactionHistory() {
        if (!window.app?.currentUser) {
            window.app?.showNotification('Veuillez vous connecter pour voir l\'historique', 'warning');
            window.app?.showAuthModal('login');
            return;
        }

        const modal = document.getElementById('transactionHistoryModal');
        if (!modal) return;
        modal.classList.add('show');
        await this.loadDetailedTransactionHistory();
        this.setupHistoryModalEvents();
    }

    async loadDetailedTransactionHistory(page = 1) {
        try {
            const filter = document.getElementById('historyFilter')?.value || 'all';
            const startDate = document.getElementById('historyStartDate')?.value;
            const endDate = document.getElementById('historyEndDate')?.value;

            let url = `/wallet/transactions?page=${page}&limit=20`;
            if (filter !== 'all') url += `&type=${filter}`;
            if (startDate) url += `&startDate=${startDate}`;
            if (endDate) url += `&endDate=${endDate}`;

            const response = await window.app.apiCall(url);
            this.displayDetailedTransactions(response.transactions, page === 1);
            this.updateHistoryStats(response.transactions);

            const loadMoreBtn = document.getElementById('loadMoreHistory');
            if (loadMoreBtn) {
                if (page < response.totalPages) {
                    loadMoreBtn.style.display = 'block';
                    loadMoreBtn.onclick = () => this.loadDetailedTransactionHistory(page + 1);
                } else {
                    loadMoreBtn.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Erreur chargement historique:', error);
            window.app?.showNotification('Erreur lors du chargement de l\'historique', 'error');
        }
    }

    setupHistoryModalEvents() {
        const filterEl = document.getElementById('historyFilter');
        const applyBtn = document.getElementById('applyDateFilter');
        if (filterEl) filterEl.onchange = () => this.loadDetailedTransactionHistory(1);
        if (applyBtn) applyBtn.onclick = () => this.loadDetailedTransactionHistory(1);
    }

    updateHistoryStats(transactions) {
        if (!transactions) return;
        const countEl = document.getElementById('totalTransactionsCount');
        const volumeEl = document.getElementById('totalVolume');
        const netEl = document.getElementById('netFlow');
        if (countEl) countEl.textContent = transactions.length;
        let totalIn = 0, totalOut = 0;
        transactions.forEach(tx => {
            if (tx.toAddress === window.app?.currentUser?.walletAddress) {
                totalIn += tx.amount;
            } else {
                totalOut += tx.amount;
            }
        });
        if (volumeEl) volumeEl.textContent = `${(totalIn + totalOut).toFixed(2)} π`;
        if (netEl) netEl.textContent = `${(totalIn - totalOut).toFixed(2)} π`;
    }

    displayDetailedTransactions(transactions, clear = true) {
        const container = document.getElementById('detailedTransactionsList');
        if (!container) return;
        if (clear) container.innerHTML = '';

        if (!transactions || transactions.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:3rem;color:var(--text-secondary);">
                    <i class="fas fa-receipt" style="font-size:4rem;opacity:0.3;margin-bottom:1rem;"></i>
                    <p style="font-size:1.125rem;">Aucune transaction trouvée</p>
                </div>`;
            return;
        }

        transactions.forEach(tx => {
            const el = this.createDetailedTransactionElement(tx);
            container.appendChild(el);
        });
    }

    createDetailedTransactionElement(tx) {
        const div = document.createElement('div');
        div.className = 'transaction-item detailed';
        div.dataset.transactionId = tx._id;

        const isIncome = tx.toAddress === window.app.currentUser.walletAddress;
        const sign = isIncome ? '+' : '-';
        const icon = isIncome ? 'fa-arrow-down' : 'fa-arrow-up';
        const color = isIncome ? '#28a745' : '#dc3545';
        const bg = isIncome ? '#d4edda' : '#f8d7da';
        const date = new Date(tx.createdAt);

        div.innerHTML = `
            <div style="display:flex;align-items:center;gap:1rem;padding:1.25rem;border-bottom:1px solid var(--border-color);cursor:pointer;transition:background 0.2s;">
                <div style="width:45px;height:45px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;color:${color};font-size:1.125rem;">
                    <i class="fas ${icon}"></i>
                </div>
                <div style="flex:1;">
                    <div style="font-weight:600;margin-bottom:0.25rem;">${tx.memo || 'Transaction'}</div>
                    <div style="font-size:0.875rem;color:var(--text-secondary);">
                        ${date.toLocaleDateString('fr-FR')} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
                <div style="font-weight:700;font-size:1.125rem;color:${color};">
                    ${sign}${tx.amount.toFixed(2)} π
                </div>
            </div>`;
        return div;
    }

    showTransactionDetails(txId) {
        const tx = this.transactions.find(t => t._id === txId);
        if (!tx) return;

        const modal = document.getElementById('transactionDetailsModal');
        const content = document.getElementById('transactionDetailsContent');
        if (!modal || !content) return;

        const isIncome = tx.toAddress === window.app?.currentUser?.walletAddress;
        content.innerHTML = `
            <div style="padding:1rem;">
                <div style="text-align:center;margin-bottom:1.5rem;">
                    <div style="font-size:2rem;font-weight:700;color:${isIncome ? '#28a745' : '#dc3545'};">
                        ${isIncome ? '+' : '-'}${tx.amount.toFixed(2)} π
                    </div>
                    <div style="color:var(--text-secondary);margin-top:0.5rem;">${tx.memo || 'Transaction'}</div>
                </div>
                <div style="background:var(--bg-secondary);border-radius:12px;padding:1rem;">
                    <div style="display:flex;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid var(--border-color);">
                        <span style="color:var(--text-secondary);">Type</span>
                        <span style="font-weight:600;">${isIncome ? 'Reçu' : 'Envoyé'}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid var(--border-color);">
                        <span style="color:var(--text-secondary);">Date</span>
                        <span style="font-weight:600;">${new Date(tx.createdAt).toLocaleString('fr-FR')}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid var(--border-color);">
                        <span style="color:var(--text-secondary);">De</span>
                        <span style="font-weight:600;font-size:0.85rem;">${tx.fromAddress ? tx.fromAddress.substring(0, 8) + '...' : 'N/A'}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid var(--border-color);">
                        <span style="color:var(--text-secondary);">Vers</span>
                        <span style="font-weight:600;font-size:0.85rem;">${tx.toAddress ? tx.toAddress.substring(0, 8) + '...' : 'N/A'}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;padding:0.75rem 0;">
                        <span style="color:var(--text-secondary);">Statut</span>
                        <span style="font-weight:600;color:#10b981;">${tx.status || 'Confirmé'}</span>
                    </div>
                </div>
            </div>`;

        modal.classList.add('show');
    }
}