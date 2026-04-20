// main.js - Initialisation centralisée de l'application
(function() {
    'use strict';

    // Attendre que tout soit chargé
    window.addEventListener('DOMContentLoaded', function() {
        console.log('📦 Initialisation de Pi SuperApp...');

        // Vérifier que tous les éléments nécessaires sont présents
        const requiredElements = [
            'navMenu',
            'authModal',
            'loadingSpinner'
        ];

        const missingElements = requiredElements.filter(id => !document.getElementById(id));
        
        if (missingElements.length > 0) {
            console.warn('⚠️ Éléments manquants:', missingElements);
        }

        // Créer le conteneur pour les modals de services s'il n'existe pas
        if (!document.getElementById('serviceModals')) {
            const serviceModalsContainer = document.createElement('div');
            serviceModalsContainer.id = 'serviceModals';
            document.body.appendChild(serviceModalsContainer);
            console.log('✅ Conteneur serviceModals créé');
        }

        // Initialiser les modules dans le bon ordre
        try {
            // 1. App principale (déjà initialisée dans app.js)
            if (window.app) {
                console.log('✅ App principale initialisée');
            }

            // 2. Marketplace
            if (typeof Marketplace !== 'undefined') {
                window.marketplace = new Marketplace();
                console.log('✅ Marketplace initialisé');
            } else {
                console.warn('⚠️ Classe Marketplace non trouvée');
            }

            // 3. Wallet
            if (typeof Wallet !== 'undefined') {
                window.wallet = new Wallet();
                console.log('✅ Wallet initialisé');
            } else {
                console.warn('⚠️ Classe Wallet non trouvée');
            }

            // 4. Services Manager
            if (typeof ServicesManager !== 'undefined') {
                window.services = new ServicesManager();
                console.log('✅ Services Manager initialisé');
            } else {
                console.warn('⚠️ Classe ServicesManager non trouvée');
            }

            // 5. UI
            if (typeof UI !== 'undefined') {
                window.ui = new UI();
                console.log('✅ UI initialisée');
            } else {
                console.warn('⚠️ Classe UI non trouvée');
            }

            console.log('🎉 Tous les modules sont initialisés !');

        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
        }
    });

    // Gérer les erreurs globales
    window.addEventListener('error', function(event) {
        console.error('Erreur globale:', event.error);
    });

    // Gérer les promesses non capturées
    window.addEventListener('unhandledrejection', function(event) {
        console.error('Promise non capturée:', event.reason);
    });

})();