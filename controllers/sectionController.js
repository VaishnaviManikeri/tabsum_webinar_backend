const SectionModel = require('../models/sectionModel');
const allowed = new Set(['speaker', 'benefits', 'agenda', 'testimonials', 'cta']);

const validSlug = (req, res) => {
  if (allowed.has(req.params.slug)) return true;
  res.status(404).json({ success: false, message: 'Unknown content section' });
  return false;
};

class SectionController {
  static async get(req, res) { if (!validSlug(req, res)) return; try { res.json({ success: true, data: await SectionModel.get(req.params.slug) }); } catch (error) { console.error(error); res.status(500).json({ success: false, message: 'Could not load section content' }); } }
  static async create(req, res) { if (!validSlug(req, res)) return; try { if (await SectionModel.get(req.params.slug)) return res.status(409).json({ success: false, message: 'Section already exists; update it instead' }); const data = await SectionModel.create(req.params.slug, req.body); res.status(201).json({ success: true, message: 'Section created', data }); } catch (error) { console.error(error); res.status(500).json({ success: false, message: 'Could not create section' }); } }
  static async update(req, res) { if (!validSlug(req, res)) return; try { const data = await SectionModel.update(req.params.slug, req.body); if (!data) return res.status(404).json({ success: false, message: 'Section not found' }); res.json({ success: true, message: 'Section updated', data }); } catch (error) { console.error(error); res.status(500).json({ success: false, message: 'Could not update section' }); } }
  static async remove(req, res) { if (!validSlug(req, res)) return; try { const removed = await SectionModel.remove(req.params.slug); if (!removed) return res.status(404).json({ success: false, message: 'Section not found' }); res.json({ success: true, message: 'Section deleted' }); } catch (error) { console.error(error); res.status(500).json({ success: false, message: 'Could not delete section' }); } }
}
module.exports = SectionController;
