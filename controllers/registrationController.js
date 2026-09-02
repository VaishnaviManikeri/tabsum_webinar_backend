const RegistrationModel = require('../models/registrationModel');

class RegistrationController {

  // =====================================================
  // GET ALL REGISTRATIONS
  // =====================================================

  static async getRegistrations(req, res) {

    try {

      const {
        search = '',
        payment_status = 'all',
        registration_status = 'all'
      } = req.query;


      const registrations =
        await RegistrationModel.getAllRegistrations({
          search,
          payment_status,
          registration_status
        });


      res.json({
        success: true,
        count: registrations.length,
        registrations
      });


    } catch (error) {

      console.error(
        'Get registrations error:',
        error
      );


      res.status(500).json({
        success: false,
        message: 'Failed to fetch registrations'
      });

    }
  }


  // =====================================================
  // GET REGISTRATION BY ID
  // =====================================================

  static async getRegistration(req, res) {

    try {

      const { id } = req.params;


      const registration =
        await RegistrationModel.getRegistrationById(
          id
        );


      if (!registration) {

        return res.status(404).json({
          success: false,
          message: 'Registration not found'
        });

      }


      res.json({
        success: true,
        registration
      });


    } catch (error) {

      console.error(
        'Get registration error:',
        error
      );


      res.status(500).json({
        success: false,
        message: 'Failed to fetch registration'
      });

    }
  }


  // =====================================================
  // GET REGISTRATION STATS
  // =====================================================

  static async getStats(req, res) {

    try {

      const stats =
        await RegistrationModel.getStats();


      res.json({
        success: true,
        stats
      });


    } catch (error) {

      console.error(
        'Registration stats error:',
        error
      );


      res.status(500).json({
        success: false,
        message: 'Failed to fetch registration statistics'
      });

    }
  }


  // =====================================================
  // UPDATE PAYMENT STATUS
  // =====================================================

  static async updatePaymentStatus(req, res) {

    try {

      const { id } = req.params;

      const {
        payment_status
      } = req.body;


      if (!payment_status) {

        return res.status(400).json({
          success: false,
          message: 'Payment status is required'
        });

      }


      const registration =
        await RegistrationModel.getRegistrationById(
          id
        );


      if (!registration) {

        return res.status(404).json({
          success: false,
          message: 'Registration not found'
        });

      }


      await RegistrationModel.updatePaymentStatus(
        id,
        payment_status
      );


      const updatedRegistration =
        await RegistrationModel.getRegistrationById(
          id
        );


      res.json({
        success: true,
        message: 'Payment status updated successfully',
        registration: updatedRegistration
      });


    } catch (error) {

      console.error(
        'Update payment status error:',
        error
      );


      if (
        error.message ===
        'Invalid payment status'
      ) {

        return res.status(400).json({
          success: false,
          message: error.message
        });

      }


      res.status(500).json({
        success: false,
        message: 'Failed to update payment status'
      });

    }
  }


  // =====================================================
  // UPDATE REGISTRATION STATUS
  // =====================================================

  static async updateRegistrationStatus(
    req,
    res
  ) {

    try {

      const { id } = req.params;

      const {
        registration_status
      } = req.body;


      if (!registration_status) {

        return res.status(400).json({
          success: false,
          message: 'Registration status is required'
        });

      }


      const registration =
        await RegistrationModel.getRegistrationById(
          id
        );


      if (!registration) {

        return res.status(404).json({
          success: false,
          message: 'Registration not found'
        });

      }


      await RegistrationModel.updateRegistrationStatus(
        id,
        registration_status
      );


      const updatedRegistration =
        await RegistrationModel.getRegistrationById(
          id
        );


      res.json({
        success: true,
        message: 'Registration status updated successfully',
        registration: updatedRegistration
      });


    } catch (error) {

      console.error(
        'Update registration status error:',
        error
      );


      if (
        error.message ===
        'Invalid registration status'
      ) {

        return res.status(400).json({
          success: false,
          message: error.message
        });

      }


      res.status(500).json({
        success: false,
        message: 'Failed to update registration status'
      });

    }
  }

}


module.exports = RegistrationController;