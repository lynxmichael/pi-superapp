// ============================================================================
// GESTION COMPLÈTE DU PROFIL UTILISATEUR + KYC MULTI-ÉTAPES
// ============================================================================

class ProfileManager {
    constructor() {
        this.currentTab = 'info';
        this.currentUser = null;
        this.isEditing = false;
        this.kycStep = 1;
        this.kycData = {};
        this.selfieStream = null;
        console.log('👤 Profile Manager créé');
    }

    init() {
        console.log('👤 Profile Manager initialisé');
        this.setupEventListeners();
        this.loadUserProfile();
    }

    setupEventListeners() {
        // Onglets du profil
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchTab(btn.getAttribute('data-tab'));
            });
        });

        // Formulaires
        this.setupFormListener('profileForm', (e) => this.updateProfile(e));
        this.setupFormListener('preferencesForm', (e) => this.updatePreferences(e));
        this.setupFormListener('securityForm', (e) => this.updateSecurity(e));

        // Boutons info view/edit toggle
        const editBtn = document.getElementById('editProfileBtn');
        const cancelBtn = document.getElementById('cancelEditBtn');
        if (editBtn) editBtn.addEventListener('click', () => this.toggleEditMode(true));
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.toggleEditMode(false));

        // Bio char count
        const bioField = document.getElementById('profileBio');
        if (bioField) {
            bioField.addEventListener('input', () => {
                const counter = document.getElementById('bioCharCount');
                if (counter) counter.textContent = `${bioField.value.length}/500`;
            });
        }

        // KYC
        const startKycBtn = document.getElementById('startKycBtn');
        if (startKycBtn) startKycBtn.addEventListener('click', () => this.startKYCProcess());

        // KYC step navigation
        this.setupKYCStepNavigation();

        // KYC document upload zones
        this.setupUploadZone('uploadFrontZone', 'kycDocFront', 'frontPreview', 'frontPlaceholder');
        this.setupUploadZone('uploadBackZone', 'kycDocBack', 'backPreview', 'backPlaceholder');

        // KYC selfie
        this.setupSelfieHandlers();

        // KYC submit checkbox
        const confirmCheck = document.getElementById('kycConfirmAccuracy');
        const submitBtn = document.getElementById('kycSubmitBtn');
        if (confirmCheck && submitBtn) {
            confirmCheck.addEventListener('change', () => {
                submitBtn.disabled = !confirmCheck.checked;
            });
        }
        if (submitBtn) submitBtn.addEventListener('click', () => this.submitKYC());

        // Avatar
        const editAvatarBtn = document.querySelector('.edit-avatar-btn');
        if (editAvatarBtn) editAvatarBtn.addEventListener('click', (e) => { e.preventDefault(); this.showAvatarUploadModal(); });
    }

    setupFormListener(formId, handler) {
        const form = document.getElementById(formId);
        if (form) form.addEventListener('submit', handler);
    }

    // ========================================================================
    // CHARGEMENT DU PROFIL
    // ========================================================================

    async loadUserProfile() {
        try {
            this.showLoading('Chargement du profil...');
            const response = await window.api.getProfile();
            this.currentUser = response.user;
            this.populateProfileData(response.user);
            await this.loadUserStats();
        } catch (error) {
            console.error('❌ Erreur chargement profil:', error);
            if (error.message?.includes('401')) {
                window.app?.clearSession();
                window.app?.showNotification('Session expirée.', 'warning');
                window.app?.showAuthModal('login');
            }
        } finally {
            this.hideLoading();
        }
    }

    populateProfileData(user) {
        // Header
        this.setText('profileUsername', user.piUsername || 'Utilisateur Pi');
        this.setText('profileWallet', this.formatWallet(user.walletAddress));
        this.setImage('profileAvatar', user.profile?.avatar);
        this.setImage('avatarImg', user.profile?.avatar);

        // Info list (mode lecture)
        this.setText('infoUsername', user.piUsername || '—');
        this.setText('infoEmail', user.email || '—');
        this.setText('infoPhone', user.phone || 'Non renseigné');
        this.setText('infoFirstName', user.profile?.firstName || 'Non renseigné');
        this.setText('infoLastName', user.profile?.lastName || 'Non renseigné');
        this.setText('infoDateOfBirth', user.profile?.dateOfBirth ? new Date(user.profile.dateOfBirth).toLocaleDateString('fr-FR') : 'Non renseigné');
        this.setText('infoGender', this.getGenderLabel(user.profile?.gender));
        this.setText('infoLocation', [user.profile?.city, user.profile?.country].filter(Boolean).join(', ') || 'Non renseigné');
        this.setText('infoAddress', user.profile?.address || 'Non renseigné');
        this.setText('infoBio', user.profile?.bio || 'Non renseigné');
        this.setText('infoWallet', user.walletAddress || '—');

        // Formulaire d'édition
        this.setVal('piUsername', user.piUsername);
        this.setVal('profileEmail', user.email);
        this.setVal('profilePhone', user.phone);
        this.setVal('profileFirstName', user.profile?.firstName);
        this.setVal('profileLastName', user.profile?.lastName);
        this.setVal('profileDateOfBirth', user.profile?.dateOfBirth ? user.profile.dateOfBirth.substring(0, 10) : '');
        this.setVal('profileGender', user.profile?.gender || '');
        this.setVal('profileCountry', user.profile?.country);
        this.setVal('profileCity', user.profile?.city);
        this.setVal('profileAddress', user.profile?.address);
        this.setVal('profileBio', user.profile?.bio);

        // Préférences
        this.setVal('prefLanguage', user.preferences?.language || 'fr');
        this.setVal('prefCurrency', user.preferences?.currency || 'PI');
        const prefNotif = document.getElementById('prefNotifications');
        if (prefNotif) prefNotif.checked = user.preferences?.notifications !== false;

        // Sécurité
        const twoFactor = document.getElementById('twoFactorEnabled');
        if (twoFactor) twoFactor.checked = user.security?.twoFactorEnabled || false;

        // KYC Status
        this.updateKYCStatus(user.verification?.kycStatus || 'none');

        // KYC pré-remplir identité si disponible
        this.setVal('kycFirstName', user.profile?.firstName);
        this.setVal('kycLastName', user.profile?.lastName);
        this.setVal('kycPhone', user.phone);
        if (user.profile?.dateOfBirth) this.setVal('kycDateOfBirth', user.profile.dateOfBirth.substring(0, 10));
    }

    async loadUserStats() {
        try {
            const response = await window.api.getStats();
            if (response.stats) {
                const memberSince = document.getElementById('memberSince');
                if (memberSince && response.stats.joinedAt) {
                    memberSince.textContent = new Date(response.stats.joinedAt).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
                }
                this.setText('loginCount', response.stats.loginCount || 0);
            }
        } catch (error) {
            console.error('❌ Erreur stats:', error);
        }
    }

    // ========================================================================
    // INFORMATIONS - MODE LECTURE / ÉDITION
    // ========================================================================

    toggleEditMode(editing) {
        const viewEl = document.getElementById('profileInfoView');
        const editEl = document.getElementById('profileInfoEdit');
        if (viewEl) viewEl.style.display = editing ? 'none' : 'block';
        if (editEl) editEl.style.display = editing ? 'block' : 'none';
        this.isEditing = editing;
    }

    async updateProfile(e) {
        e.preventDefault();
        const formData = {
            phone: document.getElementById('profilePhone')?.value.trim() || '',
            profile: {
                firstName: document.getElementById('profileFirstName')?.value.trim() || '',
                lastName: document.getElementById('profileLastName')?.value.trim() || '',
                bio: document.getElementById('profileBio')?.value.trim() || '',
                dateOfBirth: document.getElementById('profileDateOfBirth')?.value || undefined,
                gender: document.getElementById('profileGender')?.value || undefined,
                country: document.getElementById('profileCountry')?.value.trim() || '',
                city: document.getElementById('profileCity')?.value.trim() || '',
                address: document.getElementById('profileAddress')?.value.trim() || ''
            }
        };

        if (formData.phone && !this.validatePhone(formData.phone)) {
            this.showError('Format de téléphone invalide');
            return;
        }

        try {
            this.showLoading('Mise à jour...');
            const response = await window.api.updateProfile(formData);
            this.currentUser = response.user;
            this.populateProfileData(response.user);
            this.updateLocalSession(response.user);
            this.toggleEditMode(false);
            this.showSuccess('Profil mis à jour avec succès');
        } catch (error) {
            this.showError(error.message || 'Erreur lors de la mise à jour');
        } finally {
            this.hideLoading();
        }
    }

    async updatePreferences(e) {
        e.preventDefault();
        try {
            this.showLoading('Mise à jour des préférences...');
            const formData = {
                language: document.getElementById('prefLanguage')?.value || 'fr',
                currency: document.getElementById('prefCurrency')?.value || 'PI',
                notifications: document.getElementById('prefNotifications')?.checked || false
            };
            const response = await window.api.updatePreferences(formData);
            if (this.currentUser) {
                this.currentUser.preferences = response.preferences;
                this.updateLocalSession(this.currentUser);
            }
            this.showSuccess('Préférences mises à jour');
        } catch (error) {
            this.showError(error.message || 'Erreur');
        } finally {
            this.hideLoading();
        }
    }

    async updateSecurity(e) {
        e.preventDefault();
        const newPin = document.getElementById('securityPin')?.value.trim();
        const currentPin = document.getElementById('currentPin')?.value.trim();
        const twoFactor = document.getElementById('twoFactorEnabled')?.checked || false;

        if (newPin && !/^\d{6}$/.test(newPin)) {
            this.showError('Le PIN doit contenir exactement 6 chiffres');
            return;
        }

        const formData = { twoFactorEnabled: twoFactor };
        if (newPin) {
            formData.loginPin = newPin;
            if (currentPin) formData.currentPin = currentPin;
        }

        try {
            this.showLoading('Mise à jour de la sécurité...');
            await window.api.updateSecurity(formData);
            this.showSuccess('Paramètres de sécurité mis à jour');
            this.setVal('securityPin', '');
            this.setVal('currentPin', '');
        } catch (error) {
            this.showError(error.message || 'Erreur');
        } finally {
            this.hideLoading();
        }
    }

    // ========================================================================
    // KYC - PROCESSUS MULTI-ÉTAPES
    // ========================================================================

    startKYCProcess() {
        const stepper = document.getElementById('kycStepper');
        const startBtn = document.getElementById('startKycBtn');
        if (stepper) stepper.style.display = 'block';
        if (startBtn) startBtn.style.display = 'none';
        this.kycStep = 1;
        this.showKYCStep(1);
    }

    setupKYCStepNavigation() {
        const nav = {
            'kycNextStep1': () => this.validateAndGoStep(2),
            'kycPrevStep2': () => this.showKYCStep(1),
            'kycNextStep2': () => this.validateAndGoStep(3),
            'kycPrevStep3': () => this.showKYCStep(2),
            'kycNextStep3': () => this.validateAndGoStep(4),
            'kycPrevStep4': () => this.showKYCStep(3)
        };
        Object.entries(nav).forEach(([id, handler]) => {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', handler);
        });
    }

    showKYCStep(step) {
        this.kycStep = step;
        // Cacher toutes les étapes
        for (let i = 1; i <= 4; i++) {
            const el = document.getElementById(`kycStep${i}`);
            if (el) el.style.display = i === step ? 'block' : 'none';
        }
        // Mettre à jour le stepper visuel
        this.updateStepperVisual(step);
        // Si étape 4, générer le récapitulatif
        if (step === 4) this.generateKYCSummary();
    }

    updateStepperVisual(currentStep) {
        for (let i = 1; i <= 4; i++) {
            const stepEl = document.getElementById(`step${i}`);
            if (!stepEl) continue;
            const num = stepEl.querySelector('.step-number');
            if (!num) continue;

            if (i < currentStep) {
                // Complété
                num.style.background = '#10b981';
                num.style.borderColor = '#10b981';
                num.style.color = 'white';
                num.innerHTML = '<i class="fas fa-check"></i>';
            } else if (i === currentStep) {
                // Actif
                num.style.background = 'var(--primary-color, #6366f1)';
                num.style.borderColor = 'var(--primary-color, #6366f1)';
                num.style.color = 'white';
                num.textContent = i;
            } else {
                // Pas encore
                num.style.background = 'white';
                num.style.borderColor = 'var(--border-color, #e5e7eb)';
                num.style.color = 'var(--text-secondary, #6b7280)';
                num.textContent = i;
            }
        }
        // Progress bar
        const progress = document.getElementById('stepperProgress');
        if (progress) {
            const pct = ((currentStep - 1) / 3) * 100;
            progress.style.width = `${pct}%`;
        }
    }

    validateAndGoStep(nextStep) {
        if (nextStep === 2) {
            // Valider étape 1: identité
            const firstName = document.getElementById('kycFirstName')?.value.trim();
            const lastName = document.getElementById('kycLastName')?.value.trim();
            const dob = document.getElementById('kycDateOfBirth')?.value;
            const nationality = document.getElementById('kycNationality')?.value.trim();
            const address = document.getElementById('kycAddress')?.value.trim();
            const phone = document.getElementById('kycPhone')?.value.trim();

            if (!firstName || !lastName || !dob || !nationality || !address || !phone) {
                this.showError('Veuillez remplir tous les champs obligatoires');
                return;
            }
            this.kycData.firstName = firstName;
            this.kycData.lastName = lastName;
            this.kycData.dateOfBirth = dob;
            this.kycData.nationality = nationality;
            this.kycData.address = address;
            this.kycData.phone = phone;
        }

        if (nextStep === 3) {
            // Valider étape 2: document
            const docType = document.getElementById('kycDocumentType')?.value;
            const docNumber = document.getElementById('kycDocumentNumber')?.value.trim();
            const frontFile = document.getElementById('kycDocFront')?.files[0];
            const backFile = document.getElementById('kycDocBack')?.files[0];

            if (!docType || !docNumber) {
                this.showError('Veuillez sélectionner un type de document et entrer son numéro');
                return;
            }
            if (!frontFile) {
                this.showError('Veuillez photographier le recto de votre document');
                return;
            }
            if (!backFile) {
                this.showError('Veuillez photographier le verso de votre document');
                return;
            }
            this.kycData.documentType = docType;
            this.kycData.documentNumber = docNumber;
            this.kycData.frontFile = frontFile;
            this.kycData.backFile = backFile;
        }

        if (nextStep === 4) {
            // Valider étape 3: selfie
            const selfiePreview = document.getElementById('selfiePreview');
            if (!selfiePreview || selfiePreview.style.display === 'none' || !selfiePreview.src) {
                this.showError('Veuillez prendre ou importer un selfie');
                return;
            }
            this.kycData.selfieData = selfiePreview.src;
        }

        this.showKYCStep(nextStep);
    }

    // Upload zones
    setupUploadZone(zoneId, inputId, previewId, placeholderId) {
        const zone = document.getElementById(zoneId);
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewId);
        const placeholder = document.getElementById(placeholderId);
        if (!zone || !input) return;

        zone.addEventListener('click', () => input.click());

        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.style.borderColor = 'var(--primary-color, #6366f1)';
            zone.style.background = 'rgba(99,102,241,0.05)';
        });
        zone.addEventListener('dragleave', () => {
            zone.style.borderColor = 'var(--border-color)';
            zone.style.background = 'var(--bg-secondary)';
        });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.style.borderColor = 'var(--border-color)';
            zone.style.background = 'var(--bg-secondary)';
            if (e.dataTransfer.files.length) {
                input.files = e.dataTransfer.files;
                this.handleFilePreview(input.files[0], preview, placeholder);
            }
        });

        input.addEventListener('change', () => {
            if (input.files[0]) this.handleFilePreview(input.files[0], preview, placeholder);
        });
    }

    handleFilePreview(file, previewEl, placeholderEl) {
        if (!file || !file.type.match('image.*')) {
            this.showError('Format non supporté. Utilisez JPG ou PNG.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            this.showError('Image trop volumineuse (max 5 MB)');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            if (previewEl) { previewEl.src = e.target.result; previewEl.style.display = 'block'; }
            if (placeholderEl) placeholderEl.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    // Selfie
    setupSelfieHandlers() {
        const startBtn = document.getElementById('startSelfieCamera');
        const captureBtn = document.getElementById('captureSelfie');
        const uploadBtn = document.getElementById('uploadSelfieBtn');
        const fileInput = document.getElementById('selfieFileInput');
        const retakeBtn = document.getElementById('retakeSelfie');

        if (startBtn) startBtn.addEventListener('click', () => this.startSelfieCamera());
        if (captureBtn) captureBtn.addEventListener('click', () => this.captureSelfie());
        if (uploadBtn) uploadBtn.addEventListener('click', () => fileInput?.click());
        if (fileInput) fileInput.addEventListener('change', (e) => this.handleSelfieUpload(e));
        if (retakeBtn) retakeBtn.addEventListener('click', () => this.retakeSelfie());
    }

    async startSelfieCamera() {
        try {
            const video = document.getElementById('selfieVideo');
            const placeholder = document.getElementById('selfiePlaceholder');
            const guide = document.getElementById('selfieGuide');
            const startBtn = document.getElementById('startSelfieCamera');
            const captureBtn = document.getElementById('captureSelfie');

            this.selfieStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 640 } }
            });

            video.srcObject = this.selfieStream;
            await video.play();
            video.style.display = 'block';
            if (placeholder) placeholder.style.display = 'none';
            if (guide) guide.style.display = 'block';
            if (startBtn) startBtn.style.display = 'none';
            if (captureBtn) captureBtn.style.display = 'inline-flex';
        } catch (error) {
            this.showError('Impossible d\'accéder à la caméra. Importez une photo.');
        }
    }

    captureSelfie() {
        const video = document.getElementById('selfieVideo');
        const canvas = document.getElementById('selfieCanvas');
        const preview = document.getElementById('selfiePreview');
        const guide = document.getElementById('selfieGuide');
        const captureBtn = document.getElementById('captureSelfie');
        const retakeBtn = document.getElementById('retakeSelfie');

        if (!video || !canvas) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        if (preview) { preview.src = dataUrl; preview.style.display = 'block'; }
        video.style.display = 'none';
        if (guide) guide.style.display = 'none';
        if (captureBtn) captureBtn.style.display = 'none';
        if (retakeBtn) retakeBtn.style.display = 'inline-flex';

        this.stopSelfieCamera();
    }

    handleSelfieUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const preview = document.getElementById('selfiePreview');
        const placeholder = document.getElementById('selfiePlaceholder');
        const startBtn = document.getElementById('startSelfieCamera');
        const retakeBtn = document.getElementById('retakeSelfie');

        this.handleFilePreview(file, preview, placeholder);
        if (startBtn) startBtn.style.display = 'none';
        if (retakeBtn) retakeBtn.style.display = 'inline-flex';
        this.kycData.selfieFile = file;
    }

    retakeSelfie() {
        const preview = document.getElementById('selfiePreview');
        const placeholder = document.getElementById('selfiePlaceholder');
        const startBtn = document.getElementById('startSelfieCamera');
        const retakeBtn = document.getElementById('retakeSelfie');
        const captureBtn = document.getElementById('captureSelfie');

        if (preview) { preview.style.display = 'none'; preview.src = ''; }
        if (placeholder) placeholder.style.display = 'block';
        if (startBtn) startBtn.style.display = 'inline-flex';
        if (retakeBtn) retakeBtn.style.display = 'none';
        if (captureBtn) captureBtn.style.display = 'none';
        this.kycData.selfieData = null;
        this.kycData.selfieFile = null;
    }

    stopSelfieCamera() {
        if (this.selfieStream) {
            this.selfieStream.getTracks().forEach(t => t.stop());
            this.selfieStream = null;
        }
    }

    // Récapitulatif KYC
    generateKYCSummary() {
        const container = document.getElementById('kycSummary');
        if (!container) return;

        const docTypes = { id_card: "Carte d'identité", passport: 'Passeport', driver_license: 'Permis de conduire' };
        const selfiePreview = document.getElementById('selfiePreview');

        container.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                <div>
                    <h4 style="font-size:0.85rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-secondary);margin-bottom:0.75rem;">Identité</h4>
                    <div style="line-height:2;">
                        <div><strong>Nom:</strong> ${this.esc(this.kycData.lastName)}</div>
                        <div><strong>Prénom:</strong> ${this.esc(this.kycData.firstName)}</div>
                        <div><strong>Naissance:</strong> ${this.kycData.dateOfBirth ? new Date(this.kycData.dateOfBirth).toLocaleDateString('fr-FR') : '—'}</div>
                        <div><strong>Nationalité:</strong> ${this.esc(this.kycData.nationality)}</div>
                        <div><strong>Téléphone:</strong> ${this.esc(this.kycData.phone)}</div>
                    </div>
                </div>
                <div>
                    <h4 style="font-size:0.85rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-secondary);margin-bottom:0.75rem;">Document</h4>
                    <div style="line-height:2;">
                        <div><strong>Type:</strong> ${docTypes[this.kycData.documentType] || '—'}</div>
                        <div><strong>Numéro:</strong> ${this.esc(this.kycData.documentNumber)}</div>
                        <div><strong>Recto:</strong> ${this.kycData.frontFile ? '✅ Uploadé' : '❌ Manquant'}</div>
                        <div><strong>Verso:</strong> ${this.kycData.backFile ? '✅ Uploadé' : '❌ Manquant'}</div>
                    </div>
                </div>
            </div>
            <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border-color);">
                <h4 style="font-size:0.85rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-secondary);margin-bottom:0.75rem;">Selfie</h4>
                <div style="display:flex;align-items:center;gap:1rem;">
                    ${selfiePreview?.src ? `<img src="${selfiePreview.src}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid var(--primary-color,#6366f1);">` : ''}
                    <span>${selfiePreview?.src ? '✅ Photo capturée' : '❌ Pas de selfie'}</span>
                </div>
            </div>
        `;
    }

    // Soumettre KYC
    async submitKYC() {
        try {
            this.showLoading('Soumission de la demande KYC...');

            const formData = new FormData();
            formData.append('firstName', this.kycData.firstName);
            formData.append('lastName', this.kycData.lastName);
            formData.append('dateOfBirth', this.kycData.dateOfBirth);
            formData.append('nationality', this.kycData.nationality);
            formData.append('address', this.kycData.address);
            formData.append('phone', this.kycData.phone);
            formData.append('documentType', this.kycData.documentType);
            formData.append('documentNumber', this.kycData.documentNumber);

            if (this.kycData.frontFile) formData.append('docFront', this.kycData.frontFile);
            if (this.kycData.backFile) formData.append('docBack', this.kycData.backFile);

            // Selfie: fichier ou base64
            if (this.kycData.selfieFile) {
                formData.append('selfie', this.kycData.selfieFile);
            } else if (this.kycData.selfieData) {
                // Convertir base64 en blob
                const blob = await fetch(this.kycData.selfieData).then(r => r.blob());
                formData.append('selfie', blob, 'selfie.jpg');
            }

            const token = localStorage.getItem('pi_token');
            const response = await fetch('/api/auth/kyc', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Erreur lors de la soumission');
            }

            this.showSuccess('Demande KYC soumise! Vous recevrez un SMS de confirmation.');
            this.updateKYCStatus('pending');
            this.stopSelfieCamera();

        } catch (error) {
            console.error('❌ Erreur KYC:', error);
            this.showError(error.message || 'Erreur lors de la soumission KYC');
        } finally {
            this.hideLoading();
        }
    }

    // KYC Status
    updateKYCStatus(status) {
        const banner = document.getElementById('kycStatusBanner');
        const icon = document.getElementById('kycStatusIcon');
        const title = document.getElementById('kycStatusTitle');
        const desc = document.getElementById('kycStatusDesc');
        const badge = document.getElementById('kycStatusText');
        const headerBadge = document.getElementById('kycBadgeHeader');
        const stepper = document.getElementById('kycStepper');
        const startBtn = document.getElementById('startKycBtn');
        const pendingMsg = document.getElementById('kycPendingMessage');
        const approvedMsg = document.getElementById('kycApprovedMessage');

        // Reset visibility
        if (stepper) stepper.style.display = 'none';
        if (startBtn) startBtn.style.display = 'none';
        if (pendingMsg) pendingMsg.style.display = 'none';
        if (approvedMsg) approvedMsg.style.display = 'none';

        const configs = {
            none: {
                iconBg: '#e5e7eb', iconColor: '#6b7280', iconClass: 'fa-id-card',
                titleText: 'Non vérifié', descText: 'Complétez la vérification pour débloquer toutes les fonctionnalités',
                badgeText: 'Non vérifié', badgeClass: 'none', showStart: true
            },
            pending: {
                iconBg: '#fef3c7', iconColor: '#f59e0b', iconClass: 'fa-clock',
                titleText: 'Vérification en cours', descText: 'Un administrateur examine votre demande. Vous recevrez un SMS.',
                badgeText: 'En attente', badgeClass: 'pending', showPending: true
            },
            approved: {
                iconBg: '#d1fae5', iconColor: '#10b981', iconClass: 'fa-check-circle',
                titleText: 'Identité vérifiée', descText: 'Votre identité est confirmée. Accès complet activé.',
                badgeText: 'Vérifié ✓', badgeClass: 'approved', showApproved: true
            },
            rejected: {
                iconBg: '#fee2e2', iconColor: '#ef4444', iconClass: 'fa-times-circle',
                titleText: 'Vérification refusée', descText: 'Votre demande a été rejetée. Vous pouvez soumettre à nouveau.',
                badgeText: 'Rejeté', badgeClass: 'rejected', showStart: true
            }
        };

        const cfg = configs[status] || configs.none;

        if (icon) { icon.style.background = cfg.iconBg; icon.style.color = cfg.iconColor; icon.innerHTML = `<i class="fas ${cfg.iconClass}"></i>`; }
        if (title) title.textContent = cfg.titleText;
        if (desc) desc.textContent = cfg.descText;
        if (badge) { badge.textContent = cfg.badgeText; badge.className = `status-badge ${cfg.badgeClass}`; }
        if (headerBadge) { headerBadge.textContent = cfg.badgeText; headerBadge.className = `status-badge ${cfg.badgeClass}`; }
        if (cfg.showStart && startBtn) startBtn.style.display = 'block';
        if (cfg.showPending && pendingMsg) pendingMsg.style.display = 'block';
        if (cfg.showApproved && approvedMsg) approvedMsg.style.display = 'block';
    }

    // ========================================================================
    // AVATAR UPLOAD
    // ========================================================================

    showAvatarUploadModal() {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.id = 'avatarUploadModal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:500px;">
                <div class="modal-header">
                    <h3><i class="fas fa-camera"></i> Modifier l'avatar</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body" style="text-align:center;">
                    <img id="avatarPreviewModal" src="${this.currentUser?.profile?.avatar || 'https://via.placeholder.com/150'}"
                         style="width:150px;height:150px;border-radius:50%;object-fit:cover;border:3px solid var(--primary-color);margin-bottom:1.5rem;">
                    <input type="file" id="avatarFile" accept="image/*" style="display:none;">
                    <div style="display:flex;gap:1rem;justify-content:center;margin-bottom:1rem;">
                        <button class="btn btn-outline" id="chooseAvatarBtn"><i class="fas fa-folder-open"></i> Choisir</button>
                        <button class="btn btn-primary" id="saveAvatarBtn"><i class="fas fa-save"></i> Enregistrer</button>
                    </div>
                    <small style="color:var(--text-secondary);">Max 5MB — JPG, PNG, GIF</small>
                </div>
            </div>`;
        document.body.appendChild(modal);

        let selectedFile = null;
        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('#chooseAvatarBtn').addEventListener('click', () => modal.querySelector('#avatarFile').click());
        modal.querySelector('#avatarFile').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type.match('image.*') && file.size <= 5 * 1024 * 1024) {
                selectedFile = file;
                const reader = new FileReader();
                reader.onload = (ev) => { modal.querySelector('#avatarPreviewModal').src = ev.target.result; };
                reader.readAsDataURL(file);
            }
        });
        modal.querySelector('#saveAvatarBtn').addEventListener('click', async () => {
            if (!selectedFile) { this.showError('Sélectionnez une image'); return; }
            await this.uploadAvatar(selectedFile);
            modal.remove();
        });
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }

    async uploadAvatar(file) {
        try {
            this.showLoading('Upload de l\'avatar...');
            const formData = new FormData();
            formData.append('avatar', file);
            const token = localStorage.getItem('pi_token');
            const response = await fetch('/api/auth/avatar', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (!response.ok) throw new Error('Erreur upload');
            const data = await response.json();
            this.setImage('profileAvatar', data.avatarUrl);
            this.setImage('avatarImg', data.avatarUrl);
            if (this.currentUser) {
                if (!this.currentUser.profile) this.currentUser.profile = {};
                this.currentUser.profile.avatar = data.avatarUrl;
                this.updateLocalSession(this.currentUser);
            }
            this.showSuccess('Avatar mis à jour');
        } catch (error) {
            this.showError(error.message || 'Erreur upload');
        } finally {
            this.hideLoading();
        }
    }

    // ========================================================================
    // UTILITAIRES
    // ========================================================================

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        const btn = document.querySelector(`[data-tab="${tabName}"]`);
        const pane = document.getElementById(`${tabName}-tab`);
        if (btn) btn.classList.add('active');
        if (pane) pane.classList.add('active');
        this.currentTab = tabName;
    }

    setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val ?? '—'; }
    setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val || ''; }
    setImage(id, src) {
        const el = document.getElementById(id);
        if (el) { el.src = src || 'https://via.placeholder.com/150'; el.onerror = function() { this.src = 'https://via.placeholder.com/150'; }; }
    }
    esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
    formatWallet(addr) { if (!addr) return 'Non défini'; return addr.length > 20 ? `${addr.substring(0, 8)}...${addr.substring(addr.length - 8)}` : addr; }
    validatePhone(phone) { return /^\+?[0-9]{8,15}$/.test(phone.replace(/\s/g, '')); }
    getGenderLabel(g) { return { male: 'Homme', female: 'Femme', other: 'Autre', prefer_not_to_say: 'Non précisé' }[g] || 'Non renseigné'; }
    updateLocalSession(user) {
        const s = localStorage.getItem('pi_session');
        if (s) { const d = JSON.parse(s); d.user = user; d.timestamp = Date.now(); localStorage.setItem('pi_session', JSON.stringify(d)); }
    }
    showLoading(msg) { window.app?.showLoading?.(msg); }
    hideLoading() { window.app?.hideLoading?.(); }
    showError(msg) { window.app?.showNotification?.(msg, 'error') || alert(msg); }
    showSuccess(msg) { window.app?.showNotification?.(msg, 'success'); }
}

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    const initProfileManager = () => {
        if (!localStorage.getItem('pi_token')) return;
        if (!document.getElementById('profile')) return;
        if (!window.profileManager) {
            window.profileManager = new ProfileManager();
            window.profileManager.init();
        } else {
            window.profileManager.loadUserProfile();
        }
    };

    const profileNav = document.querySelector('[data-section="profile"]');
    if (profileNav) profileNav.addEventListener('click', () => setTimeout(initProfileManager, 100));

    const profileSection = document.getElementById('profile');
    if (profileSection) {
        new MutationObserver((mutations) => {
            mutations.forEach(m => { if (m.target.classList.contains('active')) setTimeout(initProfileManager, 50); });
        }).observe(profileSection, { attributes: true, attributeFilter: ['class'] });
        if (profileSection.classList.contains('active')) setTimeout(initProfileManager, 500);
    }
});