// ServicesManager - Gestion complète de tous les services Pi SuperApp
class ServicesManager {
    constructor() {
        this.currentService = null;
        this.services = {
            recharge: {
                name: 'Recharge Mobile',
                icon: 'fa-mobile-alt',
                color: '#3b82f6'
            },
            ecommerce: {
                name: 'E-commerce',
                icon: 'fa-shopping-bag',
                color: '#10b981'
            },
            games: {
                name: 'Jeux',
                icon: 'fa-gamepad',
                color: '#f59e0b'
            },
            subscriptions: {
                name: 'Abonnements',
                icon: 'fa-newspaper',
                color: '#8b5cf6'
            },
            reservations: {
                name: 'Réservations',
                icon: 'fa-calendar-check',
                color: '#ef4444'
            },
            files: {
                name: 'Stockage Fichiers',
                icon: 'fa-cloud-upload-alt',
                color: '#06b6d4'
            }
        };
        
        this.init();
    }

    init() {
        this.initializeEventListeners();
        this.createServiceModals();
        console.log('✅ Services Manager initialisé');
    }

    initializeEventListeners() {
        // Boutons de service
        document.addEventListener('click', (e) => {
            const serviceBtn = e.target.closest('[data-action]');
            if (serviceBtn) {
                const serviceType = serviceBtn.getAttribute('data-action');
                this.handleServiceClick(serviceType);
            }
        });

        // Boutons dans les cartes de service
        document.querySelectorAll('.service-card .btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const serviceCard = e.target.closest('.service-card');
                const serviceType = serviceCard?.getAttribute('data-service');
                if (serviceType) {
                    this.handleServiceClick(serviceType);
                }
            });
        });
    }

    handleServiceClick(serviceType) {
        if (!app?.currentUser) {
            app?.showNotification('Veuillez vous connecter pour utiliser ce service', 'warning');
            app?.showAuthModal('login');
            return;
        }

        this.currentService = serviceType;
        
        switch (serviceType) {
            case 'recharge':
                this.openServiceModal('rechargeModal');
                this.loadRechargeData();
                break;
            case 'subscriptions':
                this.openServiceModal('subscriptionsModal');
                this.loadSubscriptions();
                break;
            case 'reservations':
                this.openServiceModal('reservationsModal');
                this.initializeReservationForm();
                break;
            case 'files':
                this.openServiceModal('filesModal');
                this.loadUserFiles();
                break;
            case 'ecommerce':
                app.showSection('marketplace');
                break;
            case 'games':
                app.showSection('games');
                break;
            default:
                console.warn('Service non reconnu:', serviceType);
        }
    }

    // === MODALS MANAGEMENT ===
    createServiceModals() {
        this.createRechargeModal();
        this.createSubscriptionsModal();
        this.createReservationsModal();
        this.createFilesModal();
        this.setupModalEvents();
    }

    createRechargeModal() {
        if (document.getElementById('rechargeModal')) return;

        const modal = document.createElement('div');
        modal.id = 'rechargeModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-mobile-alt"></i> Recharge Mobile</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="service-info">
                        <p>Rechargez votre crédit mobile, électricité, internet, TV avec Pi</p>
                    </div>
                    
                    <form id="rechargeForm" class="service-form">
                        <div class="form-group">
                            <label>Type de service</label>
                            <select id="rechargeType" required>
                                <option value="">Sélectionnez...</option>
                                <option value="mobile">Mobile</option>
                                <option value="electricity">Électricité</option>
                                <option value="internet">Internet</option>
                                <option value="tv">TV</option>
                                <option value="water">Eau</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Opérateur/Fournisseur</label>
                            <select id="rechargeProvider" required disabled>
                                <option value="">Sélectionnez d'abord le type</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Numéro/Compte</label>
                            <input type="text" id="rechargeNumber" required 
                                   placeholder="0612345678 ou numéro de compte">
                        </div>
                        
                        <div class="form-group">
                            <label>Montant (π)</label>
                            <div class="amount-selector">
                                <div class="amount-buttons">
                                    <button type="button" class="amount-btn" data-amount="10">10 π</button>
                                    <button type="button" class="amount-btn" data-amount="20">20 π</button>
                                    <button type="button" class="amount-btn" data-amount="50">50 π</button>
                                    <button type="button" class="amount-btn" data-amount="100">100 π</button>
                                </div>
                                <input type="number" id="rechargeAmount" required 
                                       min="1" step="0.1" placeholder="Montant personnalisé">
                            </div>
                        </div>
                        
                        <div class="balance-info">
                            <span>Votre solde:</span>
                            <span class="balance" id="rechargeBalance">0 π</span>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn btn-outline" id="cancelRecharge">Annuler</button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-bolt"></i>
                                Recharger
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    createSubscriptionsModal() {
        if (document.getElementById('subscriptionsModal')) return;

        const modal = document.createElement('div');
        modal.id = 'subscriptionsModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content modal-wide">
                <div class="modal-header">
                    <h3><i class="fas fa-newspaper"></i> Abonnements</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="tabs">
                        <button class="tab-btn active" data-tab="plans">Plans disponibles</button>
                        <button class="tab-btn" data-tab="my-subscriptions">Mes abonnements</button>
                    </div>
                    
                    <div class="tab-content active" id="plansTab">
                        <div class="subscriptions-grid" id="subscriptionsList">
                            <!-- Plans chargés dynamiquement -->
                        </div>
                    </div>
                    
                    <div class="tab-content" id="mySubscriptionsTab">
                        <div class="user-subscriptions" id="userSubscriptionsList">
                            <!-- Abonnements utilisateur chargés dynamiquement -->
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    createReservationsModal() {
        if (document.getElementById('reservationsModal')) return;

        const modal = document.createElement('div');
        modal.id = 'reservationsModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-calendar-check"></i> Réservations</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="service-info">
                        <p>Réservez des hôtels, restaurants, transports, événements avec Pi</p>
                    </div>
                    
                    <form id="reservationForm" class="service-form">
                        <div class="form-group">
                            <label>Type de réservation</label>
                            <select id="reservationType" required>
                                <option value="">Sélectionnez...</option>
                                <option value="hotel">Hôtel</option>
                                <option value="restaurant">Restaurant</option>
                                <option value="transport">Transport</option>
                                <option value="event">Événement</option>
                                <option value="other">Autre</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Nom du service</label>
                            <input type="text" id="serviceName" required 
                                   placeholder="Ex: Hôtel Paris Central">
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Date</label>
                                <input type="date" id="reservationDate" required>
                            </div>
                            <div class="form-group">
                                <label>Heure</label>
                                <input type="time" id="reservationTime" required>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Nombre de personnes</label>
                                <input type="number" id="participants" required min="1" value="1">
                            </div>
                            <div class="form-group">
                                <label>Durée (heures)</label>
                                <input type="number" id="duration" required min="1" value="1">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>Montant total (π)</label>
                            <input type="number" id="reservationAmount" required 
                                   min="1" step="0.1" placeholder="0.00">
                        </div>
                        
                        <div class="form-group">
                            <label>Demandes spéciales (optionnel)</label>
                            <textarea id="specialRequests" rows="2" 
                                      placeholder="Ex: Table près de la fenêtre..."></textarea>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn btn-outline" id="cancelReservation">Annuler</button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-calendar-plus"></i>
                                Réserver
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    createFilesModal() {
        if (document.getElementById('filesModal')) return;

        const modal = document.createElement('div');
        modal.id = 'filesModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content modal-wide">
                <div class="modal-header">
                    <h3><i class="fas fa-cloud-upload-alt"></i> Stockage Fichiers</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="files-container">
                        <div class="upload-section">
                            <div class="upload-area" id="uploadArea">
                                <i class="fas fa-cloud-upload-alt fa-3x"></i>
                                <p>Glissez-déposez vos fichiers ici</p>
                                <p class="upload-hint">ou cliquez pour parcourir</p>
                                <input type="file" id="fileInput" multiple style="display: none;">
                                <button class="btn btn-outline" id="browseFilesBtn">Parcourir</button>
                            </div>
                            
                            <div class="upload-options">
                                <div class="form-group">
                                    <label>Catégorie</label>
                                    <select id="fileCategory">
                                        <option value="document">Document</option>
                                        <option value="image">Image</option>
                                        <option value="video">Vidéo</option>
                                        <option value="other">Autre</option>
                                    </select>
                                </div>
                                
                                <div class="form-check">
                                    <input type="checkbox" id="isPublic" checked>
                                    <label for="isPublic">Fichier public</label>
                                </div>
                            </div>
                            
                            <div class="upload-progress" id="uploadProgress" style="display: none;">
                                <div class="progress-bar">
                                    <div class="progress-fill" id="progressFill"></div>
                                </div>
                                <div class="progress-info">
                                    <span id="progressText">0%</span>
                                    <span id="fileName"></span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="files-section">
                            <div class="section-header">
                                <h4>Mes Fichiers</h4>
                                <div class="file-actions">
                                    <select id="fileFilter">
                                        <option value="all">Tous les fichiers</option>
                                        <option value="document">Documents</option>
                                        <option value="image">Images</option>
                                        <option value="video">Vidéos</option>
                                    </select>
                                    <button class="btn btn-outline btn-small" id="refreshFiles">
                                        <i class="fas fa-sync-alt"></i>
                                    </button>
                                </div>
                            </div>
                            
                            <div class="files-grid" id="filesGrid">
                                <!-- Fichiers chargés dynamiquement -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    setupModalEvents() {
        // Fermer les modals
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeActiveModal();
            });
        });

        // Événements spécifiques à chaque modal
        this.setupRechargeModalEvents();
        this.setupSubscriptionsModalEvents();
        this.setupReservationsModalEvents();
        this.setupFilesModalEvents();
    }

    openServiceModal(modalId) {
        this.closeAllModals();
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    closeActiveModal() {
        document.querySelectorAll('.modal.show').forEach(modal => {
            modal.classList.remove('show');
        });
        document.body.style.overflow = 'auto';
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('show');
        });
        document.body.style.overflow = 'auto';
    }

    // === RECHARGE SERVICE ===
    setupRechargeModalEvents() {
        const modal = document.getElementById('rechargeModal');
        if (!modal) return;

        // Type change - load providers
        const typeSelect = modal.querySelector('#rechargeType');
        const providerSelect = modal.querySelector('#rechargeProvider');
        
        typeSelect.addEventListener('change', (e) => {
            this.loadRechargeProviders(e.target.value, providerSelect);
        });

        // Amount buttons
        modal.querySelectorAll('.amount-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const amount = e.target.getAttribute('data-amount');
                modal.querySelector('#rechargeAmount').value = amount;
            });
        });

        // Cancel button
        modal.querySelector('#cancelRecharge').addEventListener('click', () => {
            this.closeActiveModal();
        });

        // Form submission
        modal.querySelector('#rechargeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.processRecharge();
        });
    }

    async loadRechargeData() {
        try {
            // Load user balance
            if (app?.currentUser?.balance !== undefined) {
                document.getElementById('rechargeBalance').textContent = 
                    `${app.currentUser.balance.toFixed(2)} π`;
            }

            // Load available providers
            await this.loadRechargeProviders('mobile');
        } catch (error) {
            console.error('Error loading recharge data:', error);
        }
    }

    async loadRechargeProviders(type, selectElement = null) {
        const select = selectElement || document.getElementById('rechargeProvider');
        if (!select) return;

        const providers = {
            mobile: ['Orange', 'Free Mobile', 'SFR', 'Bouygues Telecom'],
            electricity: ['EDF', 'TotalEnergies', 'Engie'],
            internet: ['Orange', 'Free', 'SFR', 'Bouygues Telecom'],
            tv: ['Canal+', 'Netflix', 'Amazon Prime'],
            water: ['Veolia', 'Suez'],
            other: ['Autre fournisseur']
        };

        select.innerHTML = '<option value="">Sélectionnez un opérateur</option>';
        
        if (type && providers[type]) {
            providers[type].forEach(provider => {
                const option = document.createElement('option');
                option.value = provider;
                option.textContent = provider;
                select.appendChild(option);
            });
            select.disabled = false;
        } else {
            select.disabled = true;
        }
    }

    async processRecharge() {
        const form = document.getElementById('rechargeForm');
        if (!form) return;

        const type = form.querySelector('#rechargeType').value;
        const provider = form.querySelector('#rechargeProvider').value;
        const number = form.querySelector('#rechargeNumber').value;
        const amount = parseFloat(form.querySelector('#rechargeAmount').value);

        // Validation
        if (!type || !provider || !number || !amount) {
            app.showNotification('Veuillez remplir tous les champs', 'error');
            return;
        }

        if (amount <= 0) {
            app.showNotification('Le montant doit être supérieur à 0', 'error');
            return;
        }

        try {
            app.showLoading();
            
            const response = await app.apiCall('/api/recharge/recharges', {
                method: 'POST',
                body: JSON.stringify({
                    type,
                    provider,
                    amount,
                    recipient: number,
                    metadata: {
                        timestamp: new Date().toISOString()
                    }
                })
            });

            app.hideLoading();
            
            if (response.recharge) {
                app.showNotification('Recharge créée avec succès!', 'success');
                this.closeActiveModal();
                
                // Create payment for the recharge
                await this.createServicePayment(
                    amount,
                    `Recharge ${provider} - ${number}`,
                    'recharge',
                    response.recharge._id
                );
            }
        } catch (error) {
            app.hideLoading();
            console.error('Recharge error:', error);
            app.showNotification(
                error.error || 'Erreur lors de la recharge',
                'error'
            );
        }
    }

    // === SUBSCRIPTIONS SERVICE ===
    setupSubscriptionsModalEvents() {
        const modal = document.getElementById('subscriptionsModal');
        if (!modal) return;

        // Tabs
        modal.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.getAttribute('data-tab');
                this.switchSubscriptionTab(tab);
            });
        });

        // Refresh
        modal.querySelector('#refreshSubscriptions')?.addEventListener('click', () => {
            this.loadSubscriptions();
        });
    }

    switchSubscriptionTab(tabName) {
        const modal = document.getElementById('subscriptionsModal');
        if (!modal) return;

        // Update active tab button
        modal.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-tab') === tabName) {
                btn.classList.add('active');
            }
        });

        // Update active tab content
        modal.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
            if (content.id === `${tabName}Tab`) {
                content.classList.add('active');
            }
        });

        // Load data for the tab
        if (tabName === 'plans') {
            this.loadSubscriptionPlans();
        } else if (tabName === 'my-subscriptions') {
            this.loadUserSubscriptions();
        }
    }

    async loadSubscriptions() {
        await this.loadSubscriptionPlans();
        await this.loadUserSubscriptions();
    }

    async loadSubscriptionPlans() {
        try {
            const response = await app.apiCall('/api/subscriptions/subscriptions');
            const container = document.getElementById('subscriptionsList');
            
            if (!response.subscriptions || response.subscriptions.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-newspaper"></i>
                        <p>Aucun plan d'abonnement disponible</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = response.subscriptions.map(sub => `
                <div class="subscription-plan">
                    <div class="plan-header">
                        <h4>${sub.name}</h4>
                        <div class="plan-price">
                            <span class="amount">${sub.price} π</span>
                            <span class="period">/${sub.billingCycle}</span>
                        </div>
                    </div>
                    
                    <p class="plan-description">${sub.description}</p>
                    
                    <ul class="plan-features">
                        ${sub.features?.map(feat => `
                            <li>
                                <i class="fas ${feat.included ? 'fa-check' : 'fa-times'}"></i>
                                ${feat.name}
                            </li>
                        `).join('') || ''}
                    </ul>
                    
                    <button class="btn btn-primary btn-block" 
                            onclick="services.subscribeToPlan('${sub._id}')">
                        S'abonner
                    </button>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading subscription plans:', error);
        }
    }

    async loadUserSubscriptions() {
        try {
            const response = await app.apiCall('/api/subscriptions/user/subscriptions');
            const container = document.getElementById('userSubscriptionsList');
            
            if (!response.userSubscriptions || response.userSubscriptions.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-user-clock"></i>
                        <p>Vous n'avez aucun abonnement actif</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = response.userSubscriptions.map(sub => `
                <div class="user-subscription">
                    <div class="subscription-info">
                        <h5>${sub.subscription?.name || 'Abonnement'}</h5>
                        <div class="subscription-details">
                            <span class="status status-${sub.status}">${sub.status}</span>
                            <span class="price">${sub.subscription?.price || 0} π/${sub.subscription?.billingCycle || 'mois'}</span>
                        </div>
                        <p>Valable jusqu'au ${new Date(sub.endDate).toLocaleDateString()}</p>
                    </div>
                    
                    <div class="subscription-actions">
                        ${sub.status === 'active' ? `
                            <button class="btn btn-outline btn-small"
                                    onclick="services.cancelSubscription('${sub._id}')">
                                Annuler
                            </button>
                        ` : ''}
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading user subscriptions:', error);
        }
    }

    async subscribeToPlan(subscriptionId) {
        if (!app.currentUser) {
            app.showNotification('Veuillez vous connecter', 'warning');
            return;
        }

        try {
            app.showLoading();
            
            const response = await app.apiCall('/api/subscriptions/subscriptions', {
                method: 'POST',
                body: JSON.stringify({ subscriptionId })
            });

            app.hideLoading();
            
            if (response.userSubscription) {
                app.showNotification('Abonnement créé avec succès!', 'success');
                
                // Create payment
                await this.createServicePayment(
                    response.userSubscription.subscription.price,
                    `Abonnement ${response.userSubscription.subscription.name}`,
                    'subscription',
                    response.userSubscription._id
                );
                
                // Refresh the list
                this.loadUserSubscriptions();
            }
        } catch (error) {
            app.hideLoading();
            console.error('Subscription error:', error);
            app.showNotification(
                error.error || 'Erreur lors de la souscription',
                'error'
            );
        }
    }

    async cancelSubscription(subscriptionId) {
        const confirmed = await ui.showConfirmationModal(
            'Voulez-vous vraiment annuler cet abonnement?',
            'Cette action est irréversible.'
        );
        
        if (!confirmed) return;

        try {
            app.showLoading();
            
            await app.apiCall(`/api/subscriptions/subscriptions/${subscriptionId}/cancel`, {
                method: 'POST'
            });

            app.hideLoading();
            app.showNotification('Abonnement annulé avec succès', 'success');
            
            // Refresh the list
            this.loadUserSubscriptions();
        } catch (error) {
            app.hideLoading();
            console.error('Cancel subscription error:', error);
            app.showNotification('Erreur lors de l\'annulation', 'error');
        }
    }

    // === RESERVATIONS SERVICE ===
    setupReservationsModalEvents() {
        const modal = document.getElementById('reservationsModal');
        if (!modal) return;

        // Set minimum date to today
        const dateInput = modal.querySelector('#reservationDate');
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.min = today;
            dateInput.value = today;
        }

        // Cancel button
        modal.querySelector('#cancelReservation').addEventListener('click', () => {
            this.closeActiveModal();
        });

        // Form submission
        modal.querySelector('#reservationForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.processReservation();
        });
    }

    initializeReservationForm() {
        // Initialize form fields with default values
        const modal = document.getElementById('reservationsModal');
        if (!modal) return;

        const timeInput = modal.querySelector('#reservationTime');
        if (timeInput) {
            const now = new Date();
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            timeInput.value = `${hours}:${minutes}`;
        }
    }

    async processReservation() {
        const form = document.getElementById('reservationForm');
        if (!form) return;

        const type = form.querySelector('#reservationType').value;
        const serviceName = form.querySelector('#serviceName').value;
        const date = form.querySelector('#reservationDate').value;
        const time = form.querySelector('#reservationTime').value;
        const participants = parseInt(form.querySelector('#participants').value);
        const duration = parseInt(form.querySelector('#duration').value);
        const amount = parseFloat(form.querySelector('#reservationAmount').value);
        const requests = form.querySelector('#specialRequests').value;

        // Validation
        if (!type || !serviceName || !date || !time || !participants || !duration || !amount) {
            app.showNotification('Veuillez remplir tous les champs obligatoires', 'error');
            return;
        }

        if (amount <= 0) {
            app.showNotification('Le montant doit être supérieur à 0', 'error');
            return;
        }

        const reservationDate = new Date(`${date}T${time}`);

        try {
            app.showLoading();
            
            const response = await app.apiCall('/api/reservations/reservations', {
                method: 'POST',
                body: JSON.stringify({
                    serviceType: type,
                    serviceName,
                    date: reservationDate.toISOString(),
                    duration,
                    participants,
                    totalAmount: amount,
                    specialRequests: requests,
                    provider: app.currentUser._id // In real app, this would be the service provider
                })
            });

            app.hideLoading();
            
            if (response.reservation) {
                app.showNotification('Réservation créée avec succès!', 'success');
                this.closeActiveModal();
                
                // Create payment
                await this.createServicePayment(
                    amount,
                    `Réservation ${serviceName}`,
                    'reservation',
                    response.reservation._id
                );
            }
        } catch (error) {
            app.hideLoading();
            console.error('Reservation error:', error);
            app.showNotification(
                error.error || 'Erreur lors de la réservation',
                'error'
            );
        }
    }

    // === FILES SERVICE ===
    setupFilesModalEvents() {
        const modal = document.getElementById('filesModal');
        if (!modal) return;

        // Browse files
        const browseBtn = modal.querySelector('#browseFilesBtn');
        const fileInput = modal.querySelector('#fileInput');
        const uploadArea = modal.querySelector('#uploadArea');

        browseBtn.addEventListener('click', () => fileInput.click());
        
        fileInput.addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                this.handleFileUpload(e.dataTransfer.files);
            }
        });

        // Filter files
        const filterSelect = modal.querySelector('#fileFilter');
        filterSelect.addEventListener('change', () => {
            this.filterFiles(filterSelect.value);
        });

        // Refresh files
        const refreshBtn = modal.querySelector('#refreshFiles');
        refreshBtn.addEventListener('click', () => {
            this.loadUserFiles();
        });
    }

    async loadUserFiles() {
        try {
            const response = await app.apiCall('/api/files/files?limit=50');
            this.displayFiles(response.files || []);
        } catch (error) {
            console.error('Error loading files:', error);
            this.displayFiles([]);
        }
    }

    displayFiles(files) {
        const container = document.getElementById('filesGrid');
        
        if (!files || files.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <p>Aucun fichier uploadé</p>
                    <p class="hint">Glissez-déposez des fichiers pour commencer</p>
                </div>
            `;
            return;
        }

        container.innerHTML = files.map(file => `
            <div class="file-item" data-category="${file.category}">
                <div class="file-icon">
                    <i class="fas ${this.getFileIcon(file.mimeType)}"></i>
                </div>
                
                <div class="file-info">
                    <div class="file-name" title="${file.originalName}">
                        ${this.truncateFileName(file.originalName, 30)}
                    </div>
                    <div class="file-details">
                        <span>${this.formatFileSize(file.size)}</span>
                        <span>•</span>
                        <span>${new Date(file.createdAt).toLocaleDateString()}</span>
                        ${file.isPublic ? '<span class="public-badge">Public</span>' : ''}
                    </div>
                </div>
                
                <div class="file-actions">
                    <button class="btn-icon" onclick="services.downloadFile('${file._id}')" 
                            title="Télécharger">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="btn-icon" onclick="services.deleteFile('${file._id}')" 
                            title="Supprimer">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    filterFiles(category) {
        const files = document.querySelectorAll('.file-item');
        
        files.forEach(file => {
            if (category === 'all' || file.getAttribute('data-category') === category) {
                file.style.display = 'flex';
            } else {
                file.style.display = 'none';
            }
        });
    }

    async handleFileUpload(files) {
        const uploadProgress = document.getElementById('uploadProgress');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const fileName = document.getElementById('fileName');

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Validate file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                app.showNotification(`Fichier ${file.name} trop volumineux (max 10MB)`, 'error');
                continue;
            }

            // Show progress
            uploadProgress.style.display = 'block';
            fileName.textContent = file.name;

            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('category', document.getElementById('fileCategory').value);
                formData.append('isPublic', document.getElementById('isPublic').checked);

                // Simulate progress (in real app, use XMLHttpRequest with progress events)
                for (let progress = 0; progress <= 100; progress += 10) {
                    progressFill.style.width = `${progress}%`;
                    progressText.textContent = `${progress}%`;
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                const response = await fetch('/api/files/upload', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('pi_token')}`
                    },
                    body: formData
                });

                if (response.ok) {
                    const data = await response.json();
                    app.showNotification(`Fichier ${file.name} uploadé avec succès`, 'success');
                    
                    // Refresh files list
                    await this.loadUserFiles();
                } else {
                    throw new Error('Upload failed');
                }
            } catch (error) {
                console.error('Upload error:', error);
                app.showNotification(`Erreur upload ${file.name}`, 'error');
            }
        }

        // Hide progress
        setTimeout(() => {
            uploadProgress.style.display = 'none';
            progressFill.style.width = '0%';
            progressText.textContent = '0%';
            fileName.textContent = '';
        }, 2000);
    }

    // === UTILITY METHODS ===
    async createServicePayment(amount, memo, serviceType, serviceItemId) {
        try {
            const response = await app.apiCall('/api/payments/create', {
                method: 'POST',
                body: JSON.stringify({
                    amount,
                    memo,
                    serviceType,
                    serviceItem: serviceItemId,
                    metadata: {
                        userId: app.currentUser._id,
                        timestamp: new Date().toISOString()
                    }
                })
            });

            app.showNotification('Paiement créé! Approuvez dans votre app Pi', 'success');
            
            // Redirect to wallet to see the payment
            setTimeout(() => {
                app.showSection('wallet');
            }, 2000);

            return response;
        } catch (error) {
            console.error('Payment creation error:', error);
            app.showNotification('Erreur création paiement', 'error');
            throw error;
        }
    }

    getFileIcon(mimeType) {
        if (mimeType.startsWith('image/')) return 'fa-image';
        if (mimeType.startsWith('video/')) return 'fa-video';
        if (mimeType.startsWith('audio/')) return 'fa-music';
        if (mimeType.includes('pdf')) return 'fa-file-pdf';
        if (mimeType.includes('word') || mimeType.includes('document')) return 'fa-file-word';
        if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'fa-file-excel';
        if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'fa-file-archive';
        return 'fa-file';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    truncateFileName(name, maxLength) {
        if (name.length <= maxLength) return name;
        return name.substring(0, maxLength - 3) + '...';
    }

    // Public methods for global access
    downloadFile(fileId) {
        window.open(`/api/files/${fileId}/download`, '_blank');
    }

    async deleteFile(fileId) {
        const confirmed = await ui.showConfirmationModal(
            'Supprimer ce fichier?',
            'Cette action est irréversible.'
        );
        
        if (!confirmed) return;

        try {
            await app.apiCall(`/api/files/${fileId}`, {
                method: 'DELETE'
            });
            
            app.showNotification('Fichier supprimé avec succès', 'success');
            await this.loadUserFiles();
        } catch (error) {
            console.error('Delete file error:', error);
            app.showNotification('Erreur suppression fichier', 'error');
        }
    }
}

// Initialize services globally
let services;

document.addEventListener('DOMContentLoaded', function() {
    services = new ServicesManager();
    window.services = services;
    console.log('🚀 Services Manager initialisé et prêt!');
});