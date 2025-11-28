const Product = require('../models/Product');
const { validationResult } = require('express-validator');

// Créer un produit
const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      condition,
      tags,
      attributes,
      stock,
      shipping
    } = req.body;

    // Traiter les images uploadées
    const images = req.files ? req.files.map((file, index) => ({
      url: file.path,
      publicId: file.filename,
      isPrimary: index === 0
    })) : [];

    const product = new Product({
      name,
      description,
      price: parseFloat(price),
      category,
      condition: condition || 'new',
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      attributes: attributes ? JSON.parse(attributes) : {},
      stock: parseInt(stock) || 0,
      shipping: shipping ? JSON.parse(shipping) : { required: false, cost: 0 },
      images,
      seller: req.user._id
    });

    await product.save();

    res.status(201).json({
      message: 'Produit créé avec succès',
      product
    });
  } catch (error) {
    console.error('Erreur création produit:', error);
    res.status(500).json({ error: 'Erreur lors de la création du produit' });
  }
};

// Mettre à jour un produit
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const product = await Product.findOne({ _id: id, seller: req.user._id });

    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    // Traiter les nouvelles images
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => ({
        url: file.path,
        publicId: file.filename,
        isPrimary: false
      }));
      product.images = [...product.images, ...newImages];
    }

    // Mettre à jour les autres champs
    Object.keys(updates).forEach(key => {
      if (key !== 'images') {
        product[key] = updates[key];
      }
    });

    await product.save();

    res.json({
      message: 'Produit mis à jour avec succès',
      product
    });
  } catch (error) {
    console.error('Erreur mise à jour produit:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du produit' });
  }
};

// Supprimer un produit
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findOneAndUpdate(
      { _id: id, seller: req.user._id },
      { status: 'deleted' },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    res.json({ message: 'Produit supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression produit:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du produit' });
  }
};

// Obtenir les produits
const getProducts = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category, 
      minPrice, 
      maxPrice,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = { status: 'active' };

    if (category) filter.category = category;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const products = await Product.find(filter)
      .populate('seller', 'piUsername profile.avatar')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(filter);

    res.json({
      products,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Erreur récupération produits:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des produits' });
  }
};

// Obtenir un produit spécifique
const getProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findOne({ _id: id, status: 'active' })
      .populate('seller', 'piUsername profile.avatar stats.joinedAt');

    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    // Incrémenter les vues
    product.stats.views += 1;
    await product.save();

    res.json({ product });
  } catch (error) {
    console.error('Erreur récupération produit:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du produit' });
  }
};

// Obtenir les produits de l'utilisateur
const getUserProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    
    const filter = { seller: req.user._id };
    if (status) filter.status = status;

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(filter);

    res.json({
      products,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Erreur récupération produits utilisateur:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de vos produits' });
  }
};

// Rechercher des produits
const searchProducts = async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Terme de recherche requis' });
    }

    const products = await Product.find({
      status: 'active',
      $text: { $search: q }
    })
    .populate('seller', 'piUsername profile.avatar')
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const total = await Product.countDocuments({
      status: 'active',
      $text: { $search: q }
    });

    res.json({
      products,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
      query: q
    });
  } catch (error) {
    console.error('Erreur recherche produits:', error);
    res.status(500).json({ error: 'Erreur lors de la recherche' });
  }
};

// Aimer un produit
const likeProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    product.stats.likes += 1;
    await product.save();

    res.json({ 
      message: 'Produit aimé avec succès',
      likes: product.stats.likes 
    });
  } catch (error) {
    console.error('Erreur like produit:', error);
    res.status(500).json({ error: 'Erreur lors de l\'ajout du like' });
  }
};

// Obtenir les catégories
const getCategories = async (req, res) => {
  try {
    const categories = await Product.distinct('category', { status: 'active' });
    
    res.json({ categories });
  } catch (error) {
    console.error('Erreur récupération catégories:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des catégories' });
  }
};

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
  getProducts,
  getProduct,
  getUserProducts,
  searchProducts,
  likeProduct,
  getCategories
};