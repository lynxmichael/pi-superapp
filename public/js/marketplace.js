// Gestion du marketplace
class Marketplace {
    constructor() {
        this.currentPage = 1;
        this.hasMore = true;
        this.currentFilters = {};
        this.init();
    }

    init() {
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Recherche de produits
        const searchInput = document.getElementById('productSearch');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(() => {
                this.currentFilters.search = searchInput.value;
                this.currentPage = 1;
                this.loadProducts();
            }, 500));
        }

        // Filtre par catégorie
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => {
                this.currentFilters.category = categoryFilter.value;
                this.currentPage = 1;
                this.loadProducts();
            });
        }

        // Bouton ajouter produit
        const addProductBtn = document.getElementById('addProductBtn');
        if (addProductBtn) {
            addProductBtn.addEventListener('click', () => {
                this.showAddProductModal();
            });
        }

        // Charger plus de produits
        const loadMoreBtn = document.getElementById('loadMoreProducts');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                this.loadMoreProducts();
            });
        }
    }

    // Charger les produits
    async loadProducts() {
        try {
            app.showLoading();
            
            const queryParams = new URLSearchParams({
                page: this.currentPage,
                limit: 12,
                ...this.currentFilters
            });

            const response = await app.apiCall(`/marketplace/products?${queryParams}`);
            
            const productsGrid = document.getElementById('productsGrid');
            
            if (this.currentPage === 1) {
                productsGrid.innerHTML = '';
            }

            if (response.products && response.products.length > 0) {
                this.displayProducts(response.products);
                this.hasMore = this.currentPage < response.totalPages;
                
                const loadMore = document.getElementById('loadMoreProducts');
                if (loadMore) {
                    loadMore.style.display = this.hasMore ? 'block' : 'none';
                }
            } else {
                productsGrid.innerHTML = `
                    <div class="no-products">
                        <i class="fas fa-search"></i>
                        <h3>Aucun produit trouvé</h3>
                        <p>Essayez de modifier vos critères de recherche</p>
                    </div>
                `;
                
                const loadMore = document.getElementById('loadMoreProducts');
                if (loadMore) {
                    loadMore.style.display = 'none';
                }
            }

            // Charger les catégories si nécessaire
            if (!document.getElementById('categoryFilter').options.length > 1) {
                this.loadCategories();
            }

        } catch (error) {
            console.error('Erreur chargement produits:', error);
            app.showNotification('Erreur lors du chargement des produits', 'error');
        } finally {
            app.hideLoading();
        }
    }

    // Charger plus de produits
    async loadMoreProducts() {
        this.currentPage++;
        await this.loadProducts();
    }

    // Afficher les produits
    displayProducts(products) {
        const productsGrid = document.getElementById('productsGrid');
        
        products.forEach(product => {
            const productCard = this.createProductCard(product);
            productsGrid.appendChild(productCard);
        });
    }

    // Créer une carte produit
    createProductCard(product) {
        const card = document.createElement('div');
        card.className = 'product-card fade-in';
        
        const primaryImage = product.images.find(img => img.isPrimary) || product.images[0];
        const imageUrl = primaryImage ? primaryImage.url : '/images/placeholder-product.jpg';
        
        card.innerHTML = `
            <img src="${imageUrl}" alt="${product.name}" class="product-image" onerror="this.src='/images/placeholder-product.jpg'">
            <div class="product-info">
                <h3 class="product-title">${product.name}</h3>
                <div class="product-price">${product.price} π</div>
                <div class="product-seller">
                    Vendu par ${product.seller?.piUsername || 'Utilisateur'}
                </div>
                <div class="product-actions">
                    <button class="btn btn-primary btn-block" onclick="marketplace.viewProduct('${product._id}')">
                        <i class="fas fa-eye"></i>
                        Voir détails
                    </button>
                </div>
            </div>
        `;

        return card;
    }

    // Voir un produit
    viewProduct(productId) {
        // Implémentation de la vue détaillée du produit
        app.showNotification('Fonctionnalité à venir!', 'info');
    }

    // Charger les catégories
    async loadCategories() {
        try {
            const response = await app.apiCall('/marketplace/products/categories');
            const categoryFilter = document.getElementById('categoryFilter');
            
            response.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = this.formatCategoryName(category);
                categoryFilter.appendChild(option);
            });
        } catch (error) {
            console.error('Erreur chargement catégories:', error);
        }
    }

    // Formater le nom de catégorie
    formatCategoryName(category) {
        const names = {
            'electronics': 'Électronique',
            'fashion': 'Mode',
            'home': 'Maison',
            'sports': 'Sports',
            'books': 'Livres',
            'digital': 'Digital',
            'services': 'Services',
            'other': 'Autre'
        };
        return names[category] || category;
    }

    // Afficher le modal d'ajout de produit
    showAddProductModal() {
        if (!app.currentUser) {
            app.showNotification('Veuillez vous connecter pour ajouter un produit', 'warning');
            app.showAuthModal('login');
            return;
        }

        // Implémentation du modal d'ajout de produit
        app.showNotification('Modal d\'ajout de produit à venir!', 'info');
    }

    // Debounce pour la recherche
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}