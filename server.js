const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const fs = require('fs');


// ==================================================
// LOAD ENVIRONMENT VARIABLES
// ==================================================

dotenv.config({
  path: ['.env.local', '.env']
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


// NEW
const registrationRoutes =
  require('./routes/registrationRoutes');

const leadRoutes = require('./routes/leadRoutes');
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
    { recursive: true }
  );

}


// ==================================================
// CORS
// ==================================================

app.use(
  cors({

    origin: (origin, callback) => {

      const allowedOrigins =
        (process.env.FRONTEND_URL ||
          'http://localhost:5173')
          .split(',')
          .map(value => value.trim());


      // Allow requests without origin
      // Example: Postman

      if (
        !origin ||
        allowedOrigins.includes(origin)
      ) {

        return callback(null, true);

      }


      return callback(
        new Error('Origin not allowed by CORS')
      );

    },

    credentials: true

  })
);


// ==================================================
// BODY PARSERS
// ==================================================

app.use(
  express.json()
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

app.use('/api/leads', leadRoutes);
// ==================================================
// NEW REGISTRATION ROUTES
// ==================================================

app.use(
  '/api/registrations',
  registrationRoutes
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

  }
);