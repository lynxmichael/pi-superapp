const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const { Subscription, UserSubscription } = require('../models/Subscription');
const AppConfig = require('../models/AppConfig');

const seedDatabase = async () => {
  try {
    console.log('🌱 Début du seeding de la base de données...');

    // Vérifier si des données existent déjà
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log('✅ Base de données déjà initialisée, skip seeding');
      return;
    }

    // 1. Créer les plans d'abonnement
    console.log('📦 Création des plans d\'abonnement...');
    
    const subscriptions = [
      {
        name: 'Basic',
        description: 'Plan de base gratuit',
        price: 0,
        duration: 30,
        features: ['Accès limité', 'Support communautaire'],
        isActive: true
      },
      {
        name: 'Premium',
        description: 'Plan premium avec toutes les fonctionnalités',
        price: 9.99,
        duration: 30,
        features: ['Accès illimité', 'Support prioritaire', 'Pas de publicité'],
        isActive: true
      },
      {
        name: 'Business',
        description: 'Plan business pour les professionnels',
        price: 29.99,
        duration: 30,
        features: ['Accès illimité', 'Support 24/7', 'API Access', 'Analytics avancés'],
        isActive: true
      }
    ];

    for (const subData of subscriptions) {
      await Subscription.findOneAndUpdate(
        { name: subData.name },
        subData,
        { upsert: true, new: true }
      );
    }
    
    console.log('✅ Plans d\'abonnement créés');

    // 2. Créer un utilisateur de test
    console.log('👤 Création d\'un utilisateur de test...');
    
    const testUser = await User.findOneAndUpdate(
      { piUsername: 'testuser' },
      {
        piUsername: 'testuser',
        piUid: 'test_uid_123',
        walletAddress: 'test_wallet_address_123',
        email: 'test@example.com',
        balance: 100,
        totalEarned: 100,
        totalSpent: 0,
        isVerified: true,
        profile: {
          firstName: 'Test',
          lastName: 'User',
          avatar: null
        },
        preferences: {
          language: 'fr',
          currency: 'PI',
          notifications: true
        }
      },
      { upsert: true, new: true }
    );
    
    console.log('✅ Utilisateur de test créé');

    // 3. Créer des produits de test
    console.log('🛍️ Création de produits de test...');
    
    const products = [
      {
        name: 'Produit Test 1',
        description: 'Description du produit 1',
        price: 10,
        category: 'electronics',
        seller: testUser._id,
        stock: 50,
        images: [{
          url: 'https://via.placeholder.com/300',
          isPrimary: true
        }],
        isActive: true
      },
      {
        name: 'Produit Test 2',
        description: 'Description du produit 2',
        price: 25,
        category: 'fashion',
        seller: testUser._id,
        stock: 30,
        images: [{
          url: 'https://via.placeholder.com/300',
          isPrimary: true
        }],
        isActive: true
      }
    ];

    for (const prodData of products) {
      await Product.findOneAndUpdate(
        { name: prodData.name, seller: testUser._id },
        prodData,
        { upsert: true, new: true }
      );
    }
    
    console.log('✅ Produits de test créés');

    // 4. Créer la configuration de l'application
    console.log('⚙️ Création de la configuration...');
    
    await AppConfig.findOneAndUpdate(
      { key: 'app_settings' },
      {
        key: 'app_settings',
        settings: {
          maintenanceMode: false,
          registrationEnabled: true,
          maxFileSize: 10485760, // 10MB
          allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
          piPaymentEnabled: true
        }
      },
      { upsert: true, new: true }
    );
    
    console.log('✅ Configuration créée');

    console.log('🎉 Seeding terminé avec succès!');
    
  } catch (error) {
    console.error('❌ Erreur lors du seeding:', error);
    throw error;
  }
};

module.exports = seedDatabase;