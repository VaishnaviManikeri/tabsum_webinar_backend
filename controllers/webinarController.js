const WebinarModel = require('../models/webinarModel');

class WebinarController {
  // =========================================================
  // GET WEBINAR
  // Public API
  // =========================================================
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

      return res.json({
        success: true,
        data: webinar
      });
    } catch (error) {
      console.error('Get webinar error:', error);

      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // =========================================================
  // UPDATE WEBINAR
  // Protected API
  // =========================================================
  static async updateWebinar(req, res) {
    try {
      const {
        title,
        subtitle,
        date,
        time,
        duration,
        language,
        platform,
        price
      } = req.body;

      // -----------------------------------------------------
      // Validate required fields
      // -----------------------------------------------------
      if (!title || !subtitle) {
        return res.status(400).json({
          success: false,
          message: 'Title and subtitle are required'
        });
      }

      // -----------------------------------------------------
      // Handle background image upload
      // -----------------------------------------------------
      let backgroundImage = null;

      if (req.file) {
        backgroundImage = `/uploads/${req.file.filename}`;
      }

      // -----------------------------------------------------
      // Prepare webinar data
      // -----------------------------------------------------
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

      // -----------------------------------------------------
      // Update webinar
      // -----------------------------------------------------
      const result =
        await WebinarModel.updateWebinar(data);

      return res.json({
        success: true,
        message: 'Webinar data updated successfully',
        data: result
      });
    } catch (error) {
      console.error('Update webinar error:', error);

      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // =========================================================
  // CREATE ZOOM MEETING
  // Protected API
  // =========================================================
  static async createZoomMeeting(req, res) {
    try {
      const { id } = req.params;

      // -----------------------------------------------------
      // Validate webinar ID
      // -----------------------------------------------------
      if (!id || isNaN(Number(id))) {
        return res.status(400).json({
          success: false,
          message: 'Valid webinar ID is required'
        });
      }

      const webinarId = Number(id);

      console.log('');
      console.log('========================================');
      console.log('CREATE ZOOM MEETING API');
      console.log('========================================');
      console.log('Webinar ID:', webinarId);
      console.log('Admin:', req.admin?.email || 'Unknown');
      console.log('========================================');

      // -----------------------------------------------------
      // Create Zoom meeting
      // -----------------------------------------------------
      const result =
        await WebinarModel.createZoomMeetingForWebinar(
          webinarId
        );

      return res.status(200).json({
        success: true,
        message: result.alreadyExists
          ? 'Zoom meeting already exists for this webinar'
          : 'Zoom meeting created successfully',
        data: {
          webinarId: result.webinarId,
          meetingId: result.meetingId,
          joinUrl: result.joinUrl,
          startUrl: result.startUrl,
          password: result.password,
          zoomCreatedAt: result.zoomCreatedAt,
          alreadyExists: Boolean(result.alreadyExists),
          mock: Boolean(result.mock)
        }
      });
    } catch (error) {
      console.error(
        'Create Zoom meeting controller error:',
        error
      );

      // -----------------------------------------------------
      // Webinar not found
      // -----------------------------------------------------
      if (
        error.message &&
        error.message.includes('not found')
      ) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      // -----------------------------------------------------
      // Missing date/time
      // -----------------------------------------------------
      if (
        error.message &&
        (
          error.message.includes('date is required') ||
          error.message.includes('time is required') ||
          error.message.includes('Invalid webinar time')
        )
      ) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      // -----------------------------------------------------
      // Other server errors
      // -----------------------------------------------------
      return res.status(500).json({
        success: false,
        message:
          error.message ||
          'Failed to create Zoom meeting'
      });
    }
  }

  // =========================================================
  // GET ZOOM MEETING
  // Protected API
  // =========================================================
  static async getZoomMeeting(req, res) {
    try {
      const { id } = req.params;

      // -----------------------------------------------------
      // Validate webinar ID
      // -----------------------------------------------------
      if (!id || isNaN(Number(id))) {
        return res.status(400).json({
          success: false,
          message: 'Valid webinar ID is required'
        });
      }

      const webinarId = Number(id);

      console.log('');
      console.log('========================================');
      console.log('GET ZOOM MEETING API');
      console.log('========================================');
      console.log('Webinar ID:', webinarId);
      console.log('Admin:', req.admin?.email || 'Unknown');
      console.log('========================================');

      // -----------------------------------------------------
      // Get Zoom meeting
      // -----------------------------------------------------
      const result =
        await WebinarModel.getZoomMeetingForWebinar(
          webinarId
        );

      // -----------------------------------------------------
      // No Zoom meeting found
      // -----------------------------------------------------
      if (!result.success) {
        return res.status(404).json({
          success: false,
          message: result.message
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Zoom meeting details retrieved successfully',
        data: {
          webinarId: result.webinarId,
          meetingId: result.meetingId,
          joinUrl: result.joinUrl,
          startUrl: result.startUrl,
          password: result.password,
          zoomCreatedAt: result.zoomCreatedAt,
          zoom: result.zoom
        }
      });
    } catch (error) {
      console.error(
        'Get Zoom meeting controller error:',
        error
      );

      if (
        error.message &&
        error.message.includes('not found')
      ) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          'Failed to retrieve Zoom meeting'
      });
    }
  }

  // =========================================================
  // DELETE ZOOM MEETING
  // Protected API
  // =========================================================
  static async deleteZoomMeeting(req, res) {
    try {
      const { id } = req.params;

      // -----------------------------------------------------
      // Validate webinar ID
      // -----------------------------------------------------
      if (!id || isNaN(Number(id))) {
        return res.status(400).json({
          success: false,
          message: 'Valid webinar ID is required'
        });
      }

      const webinarId = Number(id);

      console.log('');
      console.log('========================================');
      console.log('DELETE ZOOM MEETING API');
      console.log('========================================');
      console.log('Webinar ID:', webinarId);
      console.log('Admin:', req.admin?.email || 'Unknown');
      console.log('========================================');

      // -----------------------------------------------------
      // Delete Zoom meeting
      // -----------------------------------------------------
      const result =
        await WebinarModel.deleteZoomMeetingForWebinar(
          webinarId
        );

      // -----------------------------------------------------
      // No Zoom meeting
      // -----------------------------------------------------
      if (!result.success) {
        return res.status(404).json({
          success: false,
          message: result.message
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Zoom meeting deleted successfully',
        data: {
          webinarId: result.webinarId,
          meetingId: result.meetingId
        }
      });
    } catch (error) {
      console.error(
        'Delete Zoom meeting controller error:',
        error
      );

      if (
        error.message &&
        error.message.includes('not found')
      ) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          'Failed to delete Zoom meeting'
      });
    }
  }
}

module.exports = WebinarController;