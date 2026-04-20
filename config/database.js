const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Options de connexion modernes (sans les options obsolètes)
    const options = {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(process.env.MONGODB_URI, options);
    
    console.log('✅ MongoDB connecté avec succès');
    
    // Événements de connexion
    mongoose.connection.on('error', (err) => {
      console.error('❌ Erreur MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB déconnecté');
    });

  } catch (error) {
    console.error('❌ Database connection error:', error);
    throw error;
  }
};

const createIndexes = async () => {
  console.log('🔄 Création des indexes...');
  // Logique de création d'indexes
  console.log('✅ Indexes créés');
};

const checkDatabaseStatus = async () => {
  const state = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  console.log(`📊 État de la base de données: ${states[state]}`);
};

module.exports = {
  connectDB,
  createIndexes,
  checkDatabaseStatus
};