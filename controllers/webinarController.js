const WebinarModel = require('../models/webinarModel');
const path = require('path');
const fs = require('fs');

class WebinarController {
  static async getWebinar(req, res) {
    try {
      const webinar = await WebinarModel.getWebinar();
      
      if (!webinar) {
        return res.json({
          success: true,
          data: null,
          message: 'No webinar data found'
        });
      }

      res.json({
        success: true,
        data: webinar
      });
    } catch (error) {
      console.error('Get webinar error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async updateWebinar(req, res) {
    try {
      const {
        title, subtitle, date, time, duration,
        language, platform, price
      } = req.body;

      // Validate required fields
      if (!title || !subtitle) {
        return res.status(400).json({
          success: false,
          message: 'Title and subtitle are required'
        });
      }

      let backgroundImage = null;

      // Handle file upload
      if (req.file) {
        backgroundImage = `/uploads/${req.file.filename}`;
      }

      const data = {
        title,
        subtitle,
        date,
        time,
        duration,
        language,
        platform,
        price,
        backgroundImage
      };

      const result = await WebinarModel.updateWebinar(data);

      res.json({
        success: true,
        message: 'Webinar data updated successfully',
        data: result
      });
    } catch (error) {
      console.error('Update webinar error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

module.exports = WebinarController;