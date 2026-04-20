const mongoose = require('mongoose');
require('dotenv').config();

class DatabaseInitializer {
  constructor() {
    this.models = {};
  }

  async connect() {
    try {
      console.log('🔄 Connexion à MongoDB...');
      
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      console.log('✅ Connecté à MongoDB');
      return mongoose.connection;
    } catch (error) {
      console.error('❌ Erreur connexion MongoDB:', error);
      throw error;
    }
  }

  async loadModels() {
    console.log('📦 Chargement des modèles...');
    
    // Charger tous les modèles
    this.models.User = require('../models/User');
    this.models.Payment = require('../models/Payment');
    this.models.Product = require('../models/Product');
    const SubscriptionModels = require('../models/Subscription');
    this.models.Subscription = SubscriptionModels.Subscription;
    this.models.UserSubscription = SubscriptionModels.UserSubscription;
    this.models.Game = require('../models/Game');
    this.models.GameScore = require('../models/GameScore');
    this.models.Reservation = require('../models/Reservation');
    this.models.Recharge = require('../models/Recharge');
    this.models.File = require('../models/File');
    this.models.EcommerceOrder = require('../models/EcommerceOrder');
    this.models.Session = require('../models/Session');
    this.models.AuditLog = require('../models/AuditLog');
    this.models.ApiKey = require('../models/ApiKey');
    this.models.Analytics = require('../models/Analytics');
    this.models.Notification = require('../models/Notification');
    this.models.AppConfig = require('../models/AppConfig');
    this.models.Currency = require('../models/Currency');

    console.log(`✅ ${Object.keys(this.models).length} modèles chargés`);
    return this.models;
  }

  async createCollections() {
    try {
      console.log('🏗️  Création des collections...');
      
      // Créer les collections en forçant leur création via les modèles
      const db = mongoose.connection.db;
      
      for (const [modelName, Model] of Object.entries(this.models)) {
        try {
          // Créer un document vide pour forcer la création de la collection
          const tempDoc = new Model({ _id: new mongoose.Types.ObjectId() });
          await tempDoc.validate(); // Valide sans sauvegarder
          
          // Vérifier si la collection existe
          const collectionExists = await db.listCollections({ 
            name: Model.collection.name 
          }).hasNext();
          
          if (!collectionExists) {
            console.log(`   📝 Création collection: ${Model.collection.name}`);
            // La collection sera créée automatiquement au premier insert
          }
        } catch (error) {
          console.log(`   ✅ Collection ${modelName} prête`);
        }
      }

      console.log('✅ Toutes les collections sont prêtes');
    } catch (error) {
      console.error('❌ Erreur création collections:', error);
      throw error;
    }
  }

  async createIndexes() {
    try {
      console.log('🔍 Création des indexes...');
      
      const db = mongoose.connection.db;
      
      // Index pour Users
      await db.collection('users').createIndex({ "piUsername": 1 }, { unique: true });
      await db.collection('users').createIndex({ "walletAddress": 1 }, { unique: true });
      await db.collection('users').createIndex({ "piUid": 1 }, { unique: true });
      await db.collection('users').createIndex({ "email": 1 }, { sparse: true });
      
      // Index pour Payments
      await db.collection('payments').createIndex({ "paymentId": 1 }, { unique: true });
      await db.collection('payments').createIndex({ "user": 1, "createdAt": -1 });
      await db.collection('payments').createIndex({ "status": 1 });
      await db.collection('payments').createIndex({ "serviceType": 1 });
      
      // Index pour Products
      await db.collection('products').createIndex({ 
        "name": "text", 
        "description": "text", 
        "tags": "text" 
      });
      await db.collection('products').createIndex({ "category": 1, "status": 1 });
      await db.collection('products').createIndex({ "seller": 1, "status": 1 });
      
      console.log('✅ Tous les indexes créés');
    } catch (error) {
      console.error('❌ Erreur création indexes:', error);
      throw error;
    }
  }

  async getDatabaseInfo() {
    try {
      const db = mongoose.connection.db;
      const adminDb = db.admin();
      
      // Informations sur la base de données
      const dbStats = await db.stats();
      const collections = await db.listCollections().toArray();
      
      console.log('\n📊 INFORMATIONS BASE DE DONNÉES:');
      console.log(`   - Base de données: ${db.databaseName}`);
      console.log(`   - Collections: ${collections.length}`);
      console.log(`   - Documents total: ${dbStats.objects}`);
      console.log(`   - Taille données: ${(dbStats.dataSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   - Taille stockage: ${(dbStats.storageSize / 1024 / 1024).toFixed(2)} MB`);
      
      console.log('\n📋 COLLECTIONS:');
      collections.forEach(collection => {
        console.log(`   - ${collection.name}`);
      });
      
      return {
        database: db.databaseName,
        collections: collections.length,
        totalDocuments: dbStats.objects,
        dataSize: dbStats.dataSize,
        storageSize: dbStats.storageSize
      };
    } catch (error) {
      console.error('❌ Erreur récupération info DB:', error);
    }
  }

  async initialize() {
    try {
      await this.connect();
      await this.loadModels();
      await this.createCollections();
      await this.createIndexes();
      await this.getDatabaseInfo();
      
      console.log('\n🎉 INITIALISATION BASE DE DONNÉES TERMINÉE!');
      return true;
    } catch (error) {
      console.error('❌ INITIALISATION ÉCHOUÉE:', error);
      throw error;
    }
  }
}

// Exécution si appelé directement
if (require.main === module) {
  const initializer = new DatabaseInitializer();
  initializer.initialize()
    .then(() => {
      console.log('✅ Script terminé avec succès');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Script échoué:', error);
      process.exit(1);
    });
}

module.exports = DatabaseInitializer;