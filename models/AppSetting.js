const mongoose = require('mongoose');

/** Réglages modifiables par l'admin (un seul document). */
const appSettingSchema = new mongoose.Schema({
  _id: { type: String, default: 'main' },

  // Recharge : combien de FCFA (ou autre monnaie locale) vaut 1 π. Vide = service fermé.
  rechargeRate: { type: Number, min: 0, default: null },
  rechargeCurrency: { type: String, default: 'FCFA', maxlength: 10 },
  rechargeFeePercent: { type: Number, min: 0, max: 50, default: 0 },
  rechargeMin: { type: Number, min: 0, default: 100 },
  rechargeMax: { type: Number, min: 0, default: 100000 },

  // Commissions prélevées par l'app sur les ventes et les offres des commerçants
  marketCommissionPercent: { type: Number, min: 0, max: 50, default: 0 },
  offersCommissionPercent: { type: Number, min: 0, max: 50, default: 0 }
}, {
  timestamps: true,
  collection: 'app_settings'
});

const EDITABLE = ['rechargeRate', 'rechargeCurrency', 'rechargeFeePercent', 'rechargeMin', 'rechargeMax',
  'marketCommissionPercent', 'offersCommissionPercent'];

appSettingSchema.statics.EDITABLE = EDITABLE;

appSettingSchema.statics.current = async function () {
  const doc = await this.findById('main').lean();
  if (doc) return doc;
  return new this({ _id: 'main' }).toObject();
};

module.exports = mongoose.model('AppSetting', appSettingSchema);
