const mongoose = require('mongoose');
require('dotenv').config();

async function checkDatabaseStatus() {
  try {
    console.log('🔍 Vérification du statut de la base de données...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    // Statut de connexion
    const connectionState = mongoose.connection.readyState;
    const states = {
      0: '❌ Déconnecté',
      1: '✅ Connecté', 
      2: '🔄 Connexion en cours',
      3: '⏳ Déconnexion en cours'
    };
    
    console.log(`\n📊 STATUT BASE DE DONNÉES:`);
    console.log(`   - Connexion: ${states[connectionState]}`);
    console.log(`   - Base: ${db.databaseName}`);
    console.log(`   - Hôte: ${mongoose.connection.host}`);
    
    // Collections et statistiques
    const collections = await db.listCollections().toArray();
    const dbStats = await db.stats();
    
    console.log(`\n📋 COLLECTIONS (${collections.length}):`);
    
    for (const collection of collections) {
      try {
        const collStats = await db.collection(collection.name).stats();
        console.log(`   - ${collection.name}: ${collStats.count} documents`);
      } catch (error) {
        console.log(`   - ${collection.name}: ❌ Erreur statistiques`);
      }
    }
    
    console.log(`\n📈 STATISTIQUES GLOBALES:`);
    console.log(`   - Documents total: ${dbStats.objects}`);
    console.log(`   - Taille données: ${(dbStats.dataSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   - Taille stockage: ${(dbStats.storageSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   - Taille index: ${(dbStats.indexSize / 1024 / 1024).toFixed(2)} MB`);
    
    // Vérifier les indexes
    console.log(`\n🔍 INDEXES CRITIQUES:`);
    const criticalIndexes = {
      'users': ['piUsername', 'walletAddress', 'piUid'],
      'payments': ['paymentId'],
      'products': ['name_text_description_text_tags_text']
    };
    
    for (const [collectionName, indexes] of Object.entries(criticalIndexes)) {
      try {
        const collectionIndexes = await db.collection(collectionName).indexes();
        const existingIndexes = collectionIndexes.map(idx => idx.name);
        
        console.log(`   - ${collectionName}:`);
        indexes.forEach(index => {
          const exists = existingIndexes.some(idx => idx.includes(index));
          console.log(`     ${exists ? '✅' : '❌'} ${index}`);
        });
      } catch (error) {
        console.log(`   - ${collectionName}: ❌ Collection non accessible`);
      }
    }
    
    await mongoose.connection.close();
    console.log('\n✅ Vérification terminée');
    
  } catch (error) {
    console.error('❌ Erreur vérification statut:', error);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  checkDatabaseStatus();
}

module.exports = checkDatabaseStatus;