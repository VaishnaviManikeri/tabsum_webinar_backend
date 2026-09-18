const RegistrationModel =
  require('../models/registrationModel');

const db =
  require('../config/db');


// ==================================================
// REGISTRATION CONTROLLER
// ==================================================

class RegistrationController {


  // ==================================================
  // CREATE REGISTRATION
  // ==================================================

  static async createRegistration(
    req,
    res
  ) {

    try {

      const {
        firstName,
        lastName,
        email,
        phone,
        city,
        role,
        goal,
        consent,
        webinarId,
        source
      } = req.body;


      // ==================================================
      // REQUIRED FIELDS VALIDATION
      // ==================================================

      if (
        !firstName ||
        !lastName ||
        !email ||
        !phone ||
        !role
      ) {

        return res.status(400).json({
          success: false,
          message:
            'Please fill all required fields.'
        });

      }


      // ==================================================
      // DATA TYPE VALIDATION
      // ==================================================

      if (
        typeof firstName !== 'string' ||
        typeof lastName !== 'string' ||
        typeof email !== 'string' ||
        typeof phone !== 'string' ||
        typeof role !== 'string'
      ) {

        return res.status(400).json({
          success: false,
          message:
            'Invalid registration data.'
        });

      }


      // ==================================================
      // WHITESPACE / EMPTY STRING VALIDATION
      // ==================================================

      if (
        firstName.trim() === '' ||
        lastName.trim() === '' ||
        email.trim() === '' ||
        phone.trim() === '' ||
        role.trim() === ''
      ) {

        return res.status(400).json({
          success: false,
          message:
            'Required fields cannot be empty.'
        });

      }


      // ==================================================
      // CITY VALIDATION
      // ==================================================

      if (
        city !== undefined &&
        city !== null &&
        typeof city !== 'string'
      ) {

        return res.status(400).json({
          success: false,
          message:
            'Invalid city.'
        });

      }


      // ==================================================
      // GOAL VALIDATION
      // ==================================================

      if (
        goal !== undefined &&
        goal !== null &&
        typeof goal !== 'string'
      ) {

        return res.status(400).json({
          success: false,
          message:
            'Invalid goal.'
        });

      }


      // ==================================================
      // SOURCE VALIDATION
      // ==================================================

      if (
        source !== undefined &&
        source !== null &&
        typeof source !== 'string'
      ) {

        return res.status(400).json({
          success: false,
          message:
            'Invalid source.'
        });

      }


      // ==================================================
      // CONSENT VALIDATION
      // ==================================================

      if (consent !== true) {

        return res.status(400).json({
          success: false,
          message:
            'Please accept the registration consent.'
        });

      }


      // ==================================================
      // EMAIL VALIDATION
      // ==================================================

      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


      if (
        !emailRegex.test(
          email.trim()
        )
      ) {

        return res.status(400).json({
          success: false,
          message:
            'Please enter a valid email address.'
        });

      }


      // ==================================================
      // WEBINAR VALIDATION
      // ==================================================

      let validatedWebinarId =
        null;


      // --------------------------------------------------
      // If webinarId is provided
      // --------------------------------------------------

      if (
        webinarId !== undefined &&
        webinarId !== null &&
        webinarId !== ''
      ) {

        const parsedWebinarId =
          Number(webinarId);


        // ------------------------------------------------
        // Validate webinar ID format
        // ------------------------------------------------

        if (
          !Number.isInteger(
            parsedWebinarId
          ) ||
          parsedWebinarId <= 0
        ) {

          return res.status(400).json({
            success: false,
            message:
              'Please provide a valid webinar ID.'
          });

        }


        // ------------------------------------------------
        // Check webinar exists
        // ------------------------------------------------

        const [webinarRows] =
          await db.query(
            `
            SELECT id
            FROM webinars
            WHERE id = ?
            LIMIT 1
            `,
            [parsedWebinarId]
          );


        if (
          webinarRows.length === 0
        ) {

          return res.status(404).json({
            success: false,
            message:
              'Webinar not found.'
          });

        }


        validatedWebinarId =
          parsedWebinarId;

      }


      // ==================================================
      // CREATE REGISTRATION
      // ==================================================

      const result =
        await RegistrationModel.createRegistration({

          firstName:
            firstName.trim(),

          lastName:
            lastName.trim(),

          email:
            email.trim().toLowerCase(),

          phone:
            phone.trim(),

          city:
            city?.trim() || null,

          role:
            role.trim(),

          goal:
            goal?.trim() || null,

          consent:
            true,

          webinarId:
            validatedWebinarId,

          source:
            source?.trim() ||
            'Website'

        });


      // ==================================================
      // SUCCESS RESPONSE
      // ==================================================

      return res.status(201).json({

        success: true,

        message:
          'Registration completed successfully.',

        data: result

      });


    } catch (error) {

      console.error(
        'Create registration error:',
        error
      );


      // ==================================================
      // DUPLICATE EMAIL
      // ==================================================

      if (
        error.code ===
        'ER_DUP_ENTRY'
      ) {

        return res.status(409).json({

          success: false,

          message:
            'This email is already registered.'

        });

      }


      // ==================================================
      // WEBINAR NOT FOUND
      // ==================================================

      if (
        error.message ===
        'Webinar not found.'
      ) {

        return res.status(404).json({

          success: false,

          message:
            'Webinar not found.'

        });

      }


      // ==================================================
      // NO WEBINAR AVAILABLE
      // ==================================================

      if (
        error.message ===
        'No webinar is available for registration.'
      ) {

        return res.status(400).json({

          success: false,

          message:
            error.message

        });

      }


      // ==================================================
      // SERVER ERROR
      // ==================================================

      return res.status(500).json({

        success: false,

        message:
          'Unable to complete registration. Please try again.'

      });

    }

  }


  // ==================================================
  // GET ALL REGISTRATIONS
  // ==================================================

  static async getAllRegistrations(
    req,
    res
  ) {

    try {

      const registrations =
        await RegistrationModel.getAllRegistrations();


      return res.json({

        success: true,

        data:
          registrations

      });


    } catch (error) {

      console.error(
        'Get registrations error:',
        error
      );


      return res.status(500).json({

        success: false,

        message:
          'Unable to fetch registrations.'

      });

    }

  }


  // ==================================================
  // GET SINGLE REGISTRATION
  // ==================================================

  static async getRegistrationById(
    req,
    res
  ) {

    try {

      const {
        id
      } = req.params;


      const registration =
        await RegistrationModel.getRegistrationById(
          id
        );


      if (!registration) {

        return res.status(404).json({

          success: false,

          message:
            'Registration not found.'

        });

      }


      return res.json({

        success: true,

        data:
          registration

      });


    } catch (error) {

      console.error(
        'Get registration error:',
        error
      );


      return res.status(500).json({

        success: false,

        message:
          'Unable to fetch registration.'

      });

    }

  }


  // ==================================================
  // GET REGISTRATION STATS
  // ==================================================

  static async getRegistrationStats(
    req,
    res
  ) {

    try {

      const stats =
        await RegistrationModel.getRegistrationStats();


      return res.json({

        success: true,

        data:
          stats

      });


    } catch (error) {

      console.error(
        'Get registration stats error:',
        error
      );


      return res.status(500).json({

        success: false,

        message:
          'Unable to fetch registration statistics.'

      });

    }

  }


  // ==================================================
  // UPDATE PAYMENT STATUS
  // ==================================================

  static async updatePaymentStatus(
    req,
    res
  ) {

    try {

      const {
        id
      } = req.params;


      const {
        payment_status
      } = req.body;


      const allowedStatuses = [
        'pending',
        'paid',
        'failed'
      ];


      if (
        !allowedStatuses.includes(
          payment_status
        )
      ) {

        return res.status(400).json({

          success: false,

          message:
            'Invalid payment status.'

        });

      }


      const updated =
        await RegistrationModel.updatePaymentStatus(
          id,
          payment_status
        );


      if (!updated) {

        return res.status(404).json({

          success: false,

          message:
            'Registration not found.'

        });

      }


      return res.json({

        success: true,

        message:
          'Payment status updated successfully.',

        data:
          updated

      });


    } catch (error) {

      console.error(
        'Update payment status error:',
        error
      );


      return res.status(500).json({

        success: false,

        message:
          'Unable to update payment status.'

      });

    }

  }


  // ==================================================
  // UPDATE REGISTRATION STATUS
  // ==================================================

  static async updateRegistrationStatus(
    req,
    res
  ) {

    try {

      const {
        id
      } = req.params;


      const {
        registration_status
      } = req.body;


      const allowedStatuses = [
        'registered',
        'cancelled'
      ];


      if (
        !allowedStatuses.includes(
          registration_status
        )
      ) {

        return res.status(400).json({

          success: false,

          message:
            'Invalid registration status.'

        });

      }


      const updated =
        await RegistrationModel.updateRegistrationStatus(
          id,
          registration_status
        );


      if (!updated) {

        return res.status(404).json({

          success: false,

          message:
            'Registration not found.'

        });

      }


      return res.json({

        success: true,

        message:
          'Registration status updated successfully.',

        data:
          updated

      });


    } catch (error) {

      console.error(
        'Update registration status error:',
        error
      );


      return res.status(500).json({

        success: false,

        message:
          'Unable to update registration status.'

      });

    }

  }

}


// ==================================================
// EXPORT
// ==================================================

module.exports =
  RegistrationController;