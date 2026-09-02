const SettingsModel = require('../models/settingsModel');
const defaults = { headingFont: 'Playfair Display', headingSize: 'balanced', subheadingFont: 'Inter', subheadingSize: 'balanced', bodyFont: 'Inter', bodySize: 'balanced' };
class SettingsController {
  static async getTypography(req, res) { try { res.json({ success: true, data: { ...defaults, ...(await SettingsModel.get('typography') || {}) } }); } catch (error) { console.error(error); res.status(500).json({ success: false, message: 'Could not load typography settings' }); } }
  static async updateTypography(req, res) { try { const { headingFont, headingSize, subheadingFont, subheadingSize, bodyFont, bodySize } = req.body; if (!headingFont || !headingSize || !subheadingFont || !subheadingSize || !bodyFont || !bodySize) return res.status(400).json({ success: false, message: 'Font family and size are required for every category' }); const data = await SettingsModel.set('typography', { headingFont, headingSize, subheadingFont, subheadingSize, bodyFont, bodySize }); res.json({ success: true, message: 'Typography updated', data }); } catch (error) { console.error(error); res.status(500).json({ success: false, message: 'Could not update typography settings' }); } }
}
module.exports = SettingsController;
