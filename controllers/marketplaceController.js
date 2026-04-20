const Product = require('../models/Product');
const cloudinary = require("cloudinary").v2;

// ==============================
//  CONFIG CLOUDINARY
// ==============================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Fonction upload Cloudinary via Buffer
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "marketplace/products",
        resource_type: "image"
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(fileBuffer);
  });
};

// ==============================
//  Créer un produit
// ==============================
const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      condition = 'new',
      tags,
      attributes,
      stock,
      shipping
    } = req.body;

    // Upload des images Cloudinary
    let images = [];

    if (req.files?.length) {
      for (let i = 0; i < req.files.length; i++) {
        const uploaded = await uploadToCloudinary(req.files[i].buffer);
        images.push({
          url: uploaded.secure_url,
          publicId: uploaded.public_id,
          isPrimary: i === 0
        });
      }
    }

    const product = new Product({
      name,
      description,
      price: Number(price),
      category,
      condition,
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      attributes: attributes ? JSON.parse(attributes) : {},
      stock: Number(stock) || 0,
      shipping: shipping ? JSON.parse(shipping) : { required: false, cost: 0 },
      images,
      seller: req.user._id
    });

    await product.save();

    res.status(201).json({
      message: "Produit créé avec succès",
      product
    });

  } catch (error) {
    console.error("Erreur création produit:", error);
    res.status(500).json({ error: "Erreur lors de la création du produit" });
  }
};

// ==============================
//  Mettre à jour un produit
// ==============================
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const allowedFields = [
      'name', 'description', 'price', 'category', 'condition', 'tags',
      'attributes', 'stock', 'shipping', 'status'
    ];

    const product = await Product.findOne({
      _id: id,
      seller: req.user._id
    });

    if (!product) {
      return res.status(404).json({ error: "Produit non trouvé" });
    }

    // Upload des nouvelles images Cloudinary
    if (req.files?.length) {
      for (let file of req.files) {
        const uploaded = await uploadToCloudinary(file.buffer);

        product.images.push({
          url: uploaded.secure_url,
          publicId: uploaded.public_id,
          isPrimary: false
        });
      }
    }

    // Mise à jour des champs autorisés
    Object.keys(req.body).forEach(key => {
      if (!allowedFields.includes(key)) return;

      if (key === "tags") {
        product.tags = req.body.tags.split(",").map(t => t.trim());
      } else if (key === "attributes") {
        product.attributes = JSON.parse(req.body.attributes);
      } else if (key === "shipping") {
        product.shipping = JSON.parse(req.body.shipping);
      } else {
        product[key] = req.body[key];
      }
    });

    await product.save();

    res.json({
      message: "Produit mis à jour avec succès",
      product
    });

  } catch (error) {
    console.error("Erreur mise à jour produit:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour du produit" });
  }
};

// ==============================
//  Supprimer un produit (soft delete)
// ==============================
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findOneAndUpdate(
      { _id: id, seller: req.user._id },
      { status: "deleted" },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ error: "Produit non trouvé" });
    }

    res.json({ message: "Produit supprimé avec succès" });

  } catch (error) {
    console.error("Erreur suppression produit:", error);
    res.status(500).json({ error: "Erreur lors de la suppression du produit" });
  }
};

// ==============================
//  Autres fonctions (inchangées)
// ==============================
const getProducts = async (req, res) => { /* ... inchangé ... */ };
const getProduct = async (req, res) => { /* ... inchangé ... */ };
const getUserProducts = async (req, res) => { /* ... inchangé ... */ };
const searchProducts = async (req, res) => { /* ... inchangé ... */ };
const likeProduct = async (req, res) => { /* ... inchangé ... */ };
const getCategories = async (req, res) => { /* ... inchangé ... */ };

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
