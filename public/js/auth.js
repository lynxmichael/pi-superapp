// Gestion de l'authentification (complément)
// Ce fichier étend les fonctionnalités d'authentification

// Vérifier la connexion au chargement
document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('pi_token');
    if (token) {
        // Vérifier la validité du token
        fetch('/api/auth/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }).then(response => {
            if (!response.ok) {
                localStorage.removeItem('pi_token');
            }
        }).catch(() => {
            localStorage.removeItem('pi_token');
        });
    }
});

// Gestion des erreurs d'authentification
function handleAuthError(error) {
    console.error('Erreur d\'authentification:', error);
    
    if (error.status === 401) {
        localStorage.removeItem('pi_token');
        app.showNotification('Session expirée. Veuillez vous reconnecter.', 'warning');
        app.showAuthModal('login');
    }
}

// Vérifier les permissions
function checkPermission(requiredRole) {
    if (!app.currentUser) {
        return false;
    }
    
    // Implémenter la logique des rôles si nécessaire
    return true;
}

// Redirection après authentification
function redirectAfterAuth(intendedPath = null) {
    const path = intendedPath || localStorage.getItem('intended_path') || 'wallet';
    localStorage.removeItem('intended_path');
    app.showSection(path);
}
