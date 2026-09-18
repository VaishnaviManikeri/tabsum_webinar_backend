const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');


// ==================================================
// LOAD ENVIRONMENT VARIABLES
// ==================================================

dotenv.config({
  path: [
    path.join(__dirname, '.env.local'),
    path.join(__dirname, '.env')
  ]
});


// ==================================================
// IMPORT ROUTES
// ==================================================

const adminRoutes =
  require('./routes/adminRoutes');

const webinarRoutes =
  require('./routes/webinarRoutes');

const aboutRoutes =
  require('./routes/aboutRoutes');

const sectionRoutes =
  require('./routes/sectionRoutes');

const settingsRoutes =
  require('./routes/settingsRoutes');


// ==================================================
// REGISTRATION / CRM / PAYMENT ROUTES
// ==================================================

const registrationRoutes =
  require('./routes/registrationRoutes');

const leadRoutes =
  require('./routes/leadRoutes');

const paymentRoutes =
  require('./routes/paymentRoutes');
const reminderRoutes =
  require('./routes/reminderRoutes');

const notificationStatusRoutes =
  require('./routes/notificationStatusRoutes');

// ==================================================
// EMAIL SERVICE - AMAZON SES
// ==================================================

const {
  verifyEmailConnection
} = require('./services/emailService');


// ==================================================
// EMAIL RETRY SERVICE
// ==================================================

const {
  processFailedEmails
} = require('./services/emailRetryService');


// ==================================================
// REMINDER WORKER
// ==================================================

const {
  processDueReminders
} = require('./services/reminderWorker');


// ==================================================
// CREATE EXPRESS APP
// ==================================================

const app = express();

const PORT =
  process.env.PORT || 5000;


// ==================================================
// CREATE UPLOADS DIRECTORY
// ==================================================

const uploadsDir =
  path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadsDir)) {

  fs.mkdirSync(
    uploadsDir,
    {
      recursive: true
    }
  );

}


// ==================================================
// CORS
// ==================================================

app.use(
  cors({

    origin: (origin, callback) => {

      const allowedOrigins =
        (
          process.env.FRONTEND_URL ||
          'http://localhost:5173'
        )
          .split(',')
          .map(
            value => value.trim()
          );


      // Allow requests without origin
      // Example: Postman

      if (
        !origin ||
        allowedOrigins.includes(origin)
      ) {

        return callback(
          null,
          true
        );

      }


      return callback(
        new Error(
          'Origin not allowed by CORS'
        )
      );

    },

    credentials: true

  })
);


// ==================================================
// BODY PARSERS
// ==================================================

app.use(
  express.json({
    limit: '10mb',

    verify: (req, res, buf) => {

      if (
        req.originalUrl ===
        '/api/payments/webhook'
      ) {

        req.rawBody =
          Buffer.from(buf);

      }

    }

  })
);

app.use(
  express.urlencoded({
    extended: true
  })
);


// ==================================================
// STATIC FILES
// ==================================================

app.use(
  '/uploads',
  express.static(uploadsDir)
);


// ==================================================
// HEALTH CHECK
// ==================================================

app.get(
  '/api/health',
  (req, res) => {

    res.json({

      success: true,

      message:
        'Backend is running'

    });

  }
);


// ==================================================
// EXISTING ROUTES
// ==================================================

app.use(
  '/api/admin',
  adminRoutes
);

app.use(
  '/api/webinar',
  webinarRoutes
);

app.use(
  '/api/about',
  aboutRoutes
);

app.use(
  '/api/sections',
  sectionRoutes
);

app.use(
  '/api/settings',
  settingsRoutes
);


// ==================================================
// REGISTRATION ROUTES
// ==================================================

app.use(
  '/api/registrations',
  registrationRoutes
);


// ==================================================
// LEAD / CRM ROUTES
// ==================================================

app.use(
  '/api/leads',
  leadRoutes
);


// ==================================================
// PAYMENT ROUTES
// ==================================================

app.use(
  '/api/payments',
  paymentRoutes
);

app.use(
  '/api/reminders',
  reminderRoutes
);

app.use(
  '/api/notification-status',
  notificationStatusRoutes
);
// ==================================================
// EMAIL RETRY SCHEDULER
// ==================================================

/*
  Email retry worker runs every 5 minutes.

  Flow:

  Failed Email
       ↓
  email_logs
       ↓
  next_retry_at
       ↓
  Cron every 5 minutes
       ↓
  processFailedEmails()
       ↓
  Retry Email
*/

cron.schedule(
  '*/5 * * * *',
  async () => {

    console.log(
      '\n========================================'
    );

    console.log(
      'EMAIL RETRY WORKER STARTED'
    );

    console.log(
      '========================================'
    );

    try {

      const result =
        await processFailedEmails();

      console.log(
        'Email Retry Worker Result:',
        result
      );

    } catch (error) {

      console.error(
        'Email Retry Worker Error:',
        error
      );

    }

    console.log(
      '========================================\n'
    );

  }
);


// ==================================================
// WEBINAR REMINDER SCHEDULER
// ==================================================

/*
  Webinar reminder worker runs every 1 minute.

  Flow:

  Paid Registration
       ↓
  webinar_reminder_logs
       ↓
  scheduled_at <= NOW()
       ↓
  Cron every 1 minute
       ↓
  processDueReminders()
       ↓
  ┌──────────────────────┐
  ↓                      ↓
  Reminder Email     Reminder WhatsApp
  ↓                      ↓
  Amazon SES          WhatsApp API
*/

cron.schedule(
  '* * * * *',
  async () => {

    console.log(
      '\n========================================'
    );

    console.log(
      'REMINDER CRON WORKER STARTED'
    );

    console.log(
      '========================================'
    );

    try {

      const result =
        await processDueReminders({
          limit: 20
        });

      console.log(
        'Reminder Worker Result:',
        result
      );

    } catch (error) {

      console.error(
        'Reminder Cron Worker Error:',
        error
      );

    }

    console.log(
      '========================================\n'
    );

  }
);


// ==================================================
// ERROR HANDLER
// ==================================================

app.use(
  (err, req, res, next) => {

    console.error(
      'Error:',
      err
    );


    // --------------------------------------------------
    // REQUEST BODY TOO LARGE
    // --------------------------------------------------

    if (
      err.type === 'entity.too.large'
    ) {

      return res.status(413).json({

        success: false,

        message:
          'Content is too large. Please use an image smaller than 7MB.'

      });

    }


    // --------------------------------------------------
    // MULTER ERROR
    // --------------------------------------------------

    if (
      err instanceof multer.MulterError
    ) {

      if (
        err.code === 'FILE_TOO_LARGE'
      ) {

        return res.status(400).json({

          success: false,

          message:
            'File too large. Maximum size is 5MB.'

        });

      }

    }


    // --------------------------------------------------
    // CORS ERROR
    // --------------------------------------------------

    if (
      err.message ===
      'Origin not allowed by CORS'
    ) {

      return res.status(403).json({

        success: false,

        message:
          'Origin not allowed by CORS.'

      });

    }


    // --------------------------------------------------
    // DEFAULT ERROR
    // --------------------------------------------------

    res.status(500).json({

      success: false,

      message:
        err.message ||
        'Internal server error'

    });

  }
);


// ==================================================
// START SERVER
// ==================================================

app.listen(
  PORT,
  () => {

    console.log(
      `Server is running on port ${PORT}`
    );

    console.log(
      `API URL: http://localhost:${PORT}/api`
    );


    // ==================================================
    // AMAZON SES SMTP CONNECTION TEST
    // ==================================================

    verifyEmailConnection();


    // ==================================================
    // EMAIL RETRY WORKER STATUS
    // ==================================================

    console.log(
      'Email retry worker scheduled: Every 5 minutes'
    );


    // ==================================================
    // REMINDER WORKER STATUS
    // ==================================================

    console.log(
      'Reminder worker scheduled: Every 1 minute'
    );

  }
);