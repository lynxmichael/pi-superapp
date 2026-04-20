// Gestion de l'authentification
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔐 Module Auth chargé');
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }

    const sendCodeBtn = document.getElementById('sendCodeBtn');
    if (sendCodeBtn) {
        sendCodeBtn.addEventListener('click', sendVerificationCode);
    }

    const registerVerificationCode = document.getElementById('registerVerificationCode');
    if (registerVerificationCode) {
        registerVerificationCode.addEventListener('input', handleCodeInput);
    }
});

// CONNEXION
async function handleLogin(e) {
    e.preventDefault();
    
    const identifier = document.getElementById('loginIdentifier')?.value.trim();
    
    if (!identifier) {
        showNotification('Veuillez entrer votre identifiant', 'error');
        return;
    }

    try {
        showLoading();
        
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                piUsername: identifier,
                walletAddress: identifier
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erreur de connexion');
        }

        localStorage.setItem('pi_token', data.token);
        localStorage.setItem('pi_session', JSON.stringify({
            user: data.user,
            timestamp: new Date().getTime()
        }));

        updateUIAfterLogin(data.user);
        hideAuthModal();
        
        showNotification(`✅ Bienvenue ${data.user.piUsername} !`, 'success');
        
        if (window.app) {
            window.app.currentUser = data.user;
            window.app.showSection('wallet');
        }
        
    } catch (error) {
        console.error('❌ Erreur connexion:', error);
        showNotification(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// ENVOI CODE DE VÉRIFICATION
async function sendVerificationCode() {
    const email = document.getElementById('registerEmail')?.value.trim();
    const username = document.getElementById('registerUsername')?.value.trim();
    
    if (!email || !username) {
        showNotification('Veuillez remplir l\'email et le nom d\'utilisateur', 'warning');
        return;
    }

    if (!validateEmail(email)) {
        showNotification('Format d\'email invalide', 'error');
        return;
    }

    try {
        showLoading();
        
        const response = await fetch('/api/auth/request-verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, piUsername: username })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erreur lors de l\'envoi du code');
        }

        const codeGroup = document.getElementById('verificationCodeGroup');
        const sendBtn = document.getElementById('sendCodeBtn');
        
        if (codeGroup) codeGroup.style.display = 'block';
        if (sendBtn) sendBtn.style.display = 'none';
        
        showNotification('✅ Code envoyé à votre email', 'success');
        
    } catch (error) {
        console.error('❌ Erreur:', error);
        showNotification(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// GESTION DU CODE
async function handleCodeInput(e) {
    const input = e.target;
    let value = input.value.replace(/\D/g, '');
    
    if (value.length > 6) {
        value = value.substring(0, 6);
    }
    
    input.value = value;
    
    if (value.length === 6) {
        await verifyCode(value);
    }
}

async function verifyCode(code) {
    const email = document.getElementById('registerEmail')?.value.trim();
    
    if (!email || !code) return;

    try {
        showLoading();
        
        const response = await fetch('/api/auth/verify-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Code incorrect');
        }

        if (data.verified) {
            showNotification('✅ Email vérifié avec succès !', 'success');
            
            const codeInput = document.getElementById('registerVerificationCode');
            if (codeInput) {
                codeInput.style.borderColor = '#10b981';
                codeInput.style.backgroundColor = '#f0fdf4';
                codeInput.disabled = true;
            }
            
            const submitBtn = document.querySelector('#registerForm button[type="submit"]');
            if (submitBtn) {
                submitBtn.textContent = '✅ Finaliser l\'inscription';
                submitBtn.disabled = false;
            }
        }
        
    } catch (error) {
        console.error('❌ Erreur vérification:', error);
        showNotification(error.message, 'error');
        
        const codeInput = document.getElementById('registerVerificationCode');
        if (codeInput) {
            codeInput.value = '';
            codeInput.style.borderColor = '#ef4444';
            codeInput.style.backgroundColor = '#fef2f2';
            
            setTimeout(() => {
                codeInput.style.borderColor = '';
                codeInput.style.backgroundColor = '';
            }, 2000);
        }
    } finally {
        hideLoading();
    }
}

// INSCRIPTION
async function handleRegister(e) {
    e.preventDefault();
    
    const formData = {
        piUsername: document.getElementById('registerUsername')?.value.trim(),
        piUid: document.getElementById('registerUid')?.value.trim(),
        walletAddress: document.getElementById('registerWallet')?.value.trim(),
        email: document.getElementById('registerEmail')?.value.trim(),
        phone: document.getElementById('registerPhone')?.value.trim() || '',
        verificationCode: document.getElementById('registerVerificationCode')?.value.trim()
    };

    if (!formData.piUsername || !formData.piUid || !formData.walletAddress || !formData.email) {
        showNotification('Veuillez remplir tous les champs obligatoires (*)', 'error');
        return;
    }

    if (!formData.verificationCode) {
        showNotification('Veuillez d\'abord demander et entrer le code de vérification', 'warning');
        return;
    }

    if (!validateWalletAddress(formData.walletAddress)) {
        showNotification('Adresse wallet invalide (doit commencer par G)', 'error');
        return;
    }

    try {
        showLoading();
        
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erreur d\'inscription');
        }

        localStorage.setItem('pi_token', data.token);
        localStorage.setItem('pi_session', JSON.stringify({
            user: data.user,
            timestamp: new Date().getTime()
        }));

        updateUIAfterLogin(data.user);
        hideAuthModal();
        
        showNotification(`🎉 Bienvenue ${data.user.piUsername} !`, 'success');
        
        if (window.app) {
            window.app.currentUser = data.user;
            window.app.showSection('profile');
        }
        
    } catch (error) {
        console.error('❌ Erreur inscription:', error);
        showNotification(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// UTILITAIRES
function updateUIAfterLogin(user) {
    const authButtons = document.getElementById('authButtons');
    const userMenu = document.getElementById('userMenu');
    
    if (authButtons) authButtons.style.display = 'none';
    if (userMenu) userMenu.style.display = 'flex';
    
    const username = document.getElementById('username');
    if (username) username.textContent = user.piUsername;
    
    const avatarImg = document.getElementById('avatarImg');
    if (avatarImg && user.profile?.avatar) {
        avatarImg.src = user.profile.avatar;
        avatarImg.style.display = 'block';
    }
}

function hideAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('show');
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateWalletAddress(address) {
    return address && address.startsWith('G') && address.length >= 20;
}

function showLoading() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.classList.add('show');
}

function hideLoading() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.classList.remove('show');
}

function showNotification(message, type = 'info') {
    if (window.app && window.app.showNotification) {
        window.app.showNotification(message, type);
    } else {
        console.log(`${type.toUpperCase()}: ${message}`);
    }
}