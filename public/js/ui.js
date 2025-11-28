// Gestion de l'interface utilisateur
class UI {
    constructor() {
        this.init();
    }

    init() {
        this.initializeComponents();
        this.setupAnimations();
    }

    initializeComponents() {
        // Tooltips
        this.initializeTooltips();
        
        // Dropdowns
        this.initializeDropdowns();
        
        // Modals
        this.initializeModals();
    }

    initializeTooltips() {
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        
        tooltipElements.forEach(element => {
            element.addEventListener('mouseenter', this.showTooltip);
            element.addEventListener('mouseleave', this.hideTooltip);
        });
    }

    showTooltip(e) {
        const tooltipText = this.getAttribute('data-tooltip');
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = tooltipText;
        
        document.body.appendChild(tooltip);
        
        const rect = this.getBoundingClientRect();
        tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = rect.top - tooltip.offsetHeight - 5 + 'px';
    }

    hideTooltip() {
        const tooltip = document.querySelector('.tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }

    initializeDropdowns() {
        // Dropdowns supplémentaires peuvent être initialisés ici
    }

    initializeModals() {
        // Gestion des modals supplémentaires
    }

    setupAnimations() {
        // Animation au scroll
        this.setupScrollAnimations();
        
        // Animations d'entrée
        this.setupEntryAnimations();
    }

    setupScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        }, observerOptions);

        // Observer les éléments à animer
        document.querySelectorAll('.feature-card, .service-card, .product-card').forEach(el => {
            observer.observe(el);
        });
    }

    setupEntryAnimations() {
        // Ajouter des classes d'animation aux éléments
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                document.body.classList.add('loaded');
            }, 100);
        });
    }

    // Afficher un modal de confirmation
    showConfirmationModal(message, onConfirm, onCancel = null) {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Confirmation</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <div class="modal-footer" style="display: flex; gap: 1rem; justify-content: flex-end; padding: 1rem; border-top: 1px solid var(--border-color);">
                    <button class="btn btn-outline" id="confirmCancel">Annuler</button>
                    <button class="btn btn-primary" id="confirmOk">Confirmer</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Gestion des événements
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.remove();
            if (onCancel) onCancel();
        });

        modal.querySelector('#confirmCancel').addEventListener('click', () => {
            modal.remove();
            if (onCancel) onCancel();
        });

        modal.querySelector('#confirmOk').addEventListener('click', () => {
            modal.remove();
            onConfirm();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                if (onCancel) onCancel();
            }
        });
    }

    // Afficher un modal d'information
    showInfoModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                <div class="modal-footer" style="display: flex; justify-content: flex-end; padding: 1rem; border-top: 1px solid var(--border-color);">
                    <button class="btn btn-primary" id="infoOk">OK</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Fermer le modal
        const closeModal = () => modal.remove();
        
        modal.querySelector('.modal-close').addEventListener('click', closeModal);
        modal.querySelector('#infoOk').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }
}

// Initialiser l'UI
const ui = new UI();

// Styles pour les tooltips
const tooltipStyles = document.createElement('style');
tooltipStyles.textContent = `
    .tooltip {
        position: fixed;
        background: var(--text-primary);
        color: var(--bg-primary);
        padding: 0.5rem 1rem;
        border-radius: 4px;
        font-size: 0.875rem;
        z-index: 10000;
        pointer-events: none;
        white-space: nowrap;
    }

    .tooltip::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 5px solid transparent;
        border-top-color: var(--text-primary);
    }

    .animate-in {
        animation: fadeInUp 0.6s ease-out;
    }

    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    body.loaded .hero-title {
        animation: fadeInUp 0.8s ease-out;
    }

    body.loaded .hero-subtitle {
        animation: fadeInUp 0.8s ease-out 0.2s both;
    }

    body.loaded .hero-actions {
        animation: fadeInUp 0.8s ease-out 0.4s both;
    }
`;
document.head.appendChild(tooltipStyles);