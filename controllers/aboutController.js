const AboutModel = require('../models/aboutModel');

class AboutController {
  static async getAll(req, res) {
    try {
      res.json({ success: true, data: await AboutModel.getAll() });
    } catch (error) {
      console.error('Get about content error:', error);
      res.status(500).json({ success: false, message: 'Could not load About content' });
    }
  }

  static async create(req, res) {
    try {
      if (!req.body.title || !req.body.subtitle) {
        return res.status(400).json({ success: false, message: 'Title and subtitle are required' });
      }
      const data = await AboutModel.create(req.body);
      res.status(201).json({ success: true, message: 'About content created', data });
    } catch (error) {
      console.error('Create about content error:', error);
      res.status(500).json({ success: false, message: 'Could not create About content' });
    }
  }

  static async update(req, res) {
    try {
      if (!req.body.title || !req.body.subtitle) {
        return res.status(400).json({ success: false, message: 'Title and subtitle are required' });
      }
      const data = await AboutModel.update(req.params.id, req.body);
      if (!data) return res.status(404).json({ success: false, message: 'About content not found' });
      res.json({ success: true, message: 'About content updated', data });
    } catch (error) {
      console.error('Update about content error:', error);
      res.status(500).json({ success: false, message: 'Could not update About content' });
    }
  }

  static async remove(req, res) {
    try {
      const removed = await AboutModel.remove(req.params.id);
      if (!removed) return res.status(404).json({ success: false, message: 'About content not found' });
      res.json({ success: true, message: 'About content deleted' });
    } catch (error) {
      console.error('Delete about content error:', error);
      res.status(500).json({ success: false, message: 'Could not delete About content' });
    }
  }
}

module.exports = AboutController;
