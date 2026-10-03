const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');


// =====================================================
// LOAD ENVIRONMENT VARIABLES
// =====================================================

dotenv.config();


// =====================================================
// MYSQL CONNECTION POOL
// =====================================================

const pool = mysql.createPool({

  host:
    process.env.DB_HOST ||
    'localhost',

  user:
    process.env.DB_USER ||
    'root',

  password:
    process.env.DB_PASSWORD ||
    '',

  database:
    process.env.DB_NAME ||
    'webinar_db',

  waitForConnections:
    true,

  connectionLimit:
    10,

  queueLimit:
    0,

  // Helps with MySQL connection stability
  enableKeepAlive:
    true,

  keepAliveInitialDelay:
    0

});


// =====================================================
// DATABASE INITIALIZATION
// =====================================================

const initializeDatabase = async () => {

  let connection;


  try {

    connection =
      await pool
        .promise()
        .getConnection();


    console.log(
      'Connected to MySQL database'
    );


    // =================================================
    // ADMINS TABLE
    // =================================================

    await connection.query(`
      CREATE TABLE IF NOT EXISTS admins (

        id INT AUTO_INCREMENT PRIMARY KEY,

        email VARCHAR(255) NOT NULL UNIQUE,

        password VARCHAR(255) NOT NULL,

        created_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP

      )
    `);


    // =================================================
    // WEBINARS TABLE
    // =================================================

    await connection.query(`
      CREATE TABLE IF NOT EXISTS webinars (

        id INT AUTO_INCREMENT PRIMARY KEY,

        title VARCHAR(255) NOT NULL,

        subtitle TEXT NOT NULL,

        date VARCHAR(100),

        time VARCHAR(100),

        duration VARCHAR(100),

        language VARCHAR(50),

        platform VARCHAR(50),

        price VARCHAR(50),

        background_image VARCHAR(500),

        recording_url TEXT NULL,

        created_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP

      )
    `);

    // Existing databases were created before recording links were supported.
    // Add the column once without affecting webinar data already in use.
    const [recordingUrlColumn] =
      await connection.query(
        `
        SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'webinars'
          AND COLUMN_NAME = 'recording_url'
        `
      );

    if (recordingUrlColumn.length === 0) {
      await connection.query(
        `
        ALTER TABLE webinars
        ADD COLUMN recording_url TEXT NULL
        AFTER background_image
        `
      );
    }


    // =================================================
    // ABOUT SECTIONS TABLE
    // =================================================

    await connection.query(`
      CREATE TABLE IF NOT EXISTS about_sections (

        id INT AUTO_INCREMENT PRIMARY KEY,

        title VARCHAR(255),

        content TEXT,

        image VARCHAR(500),

        created_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP

      )
    `);


    // =================================================
    // CONTENT SECTIONS TABLE
    // =================================================

    await connection.query(`
      CREATE TABLE IF NOT EXISTS content_sections (

        id INT AUTO_INCREMENT PRIMARY KEY,

        slug VARCHAR(100) NOT NULL UNIQUE,

        label VARCHAR(255),

        content JSON,

        created_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP

      )
    `);


    // =================================================
    // SITE SETTINGS TABLE
    // =================================================

    await connection.query(`
      CREATE TABLE IF NOT EXISTS site_settings (

        id INT AUTO_INCREMENT PRIMARY KEY,

        setting_key VARCHAR(100) NOT NULL UNIQUE,

        setting_value JSON,

        created_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP

      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS notification_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        channel ENUM('email', 'whatsapp') NOT NULL,
        message_type VARCHAR(100) NOT NULL,
        template_name VARCHAR(255),
        language_code VARCHAR(20),
        subject VARCHAR(500),
        body TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_notification_template (channel, message_type)
      )
    `);

    await connection.query(`
      INSERT IGNORE INTO notification_templates
        (channel, message_type, template_name, language_code, subject, body)
      VALUES
        ('email', 'confirmation', NULL, 'en_US', 'Registration Confirmed — The Abundance Crossroad™', 'Your registration has been confirmed.'),
        ('email', 'reminder_24h', NULL, 'en_US', '24-Hour Reminder — The Abundance Crossroad™', 'Your webinar is happening tomorrow. We are excited to have you with us!'),
        ('email', 'reminder_3h', NULL, 'en_US', '3-Hour Reminder — The Abundance Crossroad™', 'Your webinar starts in 3 hours. Please keep your Zoom link ready.'),
        ('email', 'reminder_30m', NULL, 'en_US', '30-Minute Reminder — The Abundance Crossroad™', 'Your webinar starts in 30 minutes. Please join on time.'),
        ('whatsapp', 'confirmation', 'registration_confirmation', 'en_US', NULL, 'Personalized confirmation with participant, webinar, schedule and Zoom details.'),
        ('whatsapp', 'community_invite', 'community_invite', 'en_US', NULL, 'Community invite with participant name, webinar title and invite URL.'),
        ('whatsapp', 'reminder_24h', 'reminder_24h', 'en_US', NULL, 'Your webinar is happening tomorrow. We are excited to have you with us!'),
        ('whatsapp', 'reminder_3h', 'reminder_3h', 'en_US', NULL, 'Your webinar starts in 3 hours. Please keep your Zoom details ready.'),
        ('whatsapp', 'reminder_30m', 'reminder_30m', 'en_US', NULL, 'Your webinar starts in 30 minutes. Please join on time.')
    `);


    // =================================================
    // LEADS TABLE
    // =================================================

    await connection.query(`
      CREATE TABLE IF NOT EXISTS leads (

        id INT AUTO_INCREMENT PRIMARY KEY,

        first_name VARCHAR(100) NOT NULL,

        last_name VARCHAR(100) NOT NULL,

        email VARCHAR(255) NOT NULL UNIQUE,

        phone VARCHAR(30) NOT NULL,

        city VARCHAR(100),

        role VARCHAR(150),

        source VARCHAR(100)
          DEFAULT 'website',

        lead_status ENUM(
          'new',
          'registered',
          'interested',
          'converted',
          'lost'
        )
          DEFAULT 'new',

        created_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP

      )
    `);


    // =================================================
    // REGISTRATIONS TABLE
    // =================================================

    await connection.query(`
      CREATE TABLE IF NOT EXISTS registrations (

        id INT AUTO_INCREMENT PRIMARY KEY,

        lead_id INT NOT NULL,

        webinar_id INT NOT NULL,

        first_name VARCHAR(100) NOT NULL,

        last_name VARCHAR(100) NOT NULL,

        email VARCHAR(255) NOT NULL,

        phone VARCHAR(30) NOT NULL,

        city VARCHAR(100),

        role VARCHAR(150),

        goal TEXT,

        consent BOOLEAN
          DEFAULT FALSE,

        registration_status ENUM(
          'registered',
          'cancelled'
        )
          DEFAULT 'registered',

        payment_status ENUM(
          'pending',
          'paid',
          'failed'
        )
          DEFAULT 'pending',

        registered_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP,

        created_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_registration_lead

          FOREIGN KEY (lead_id)

          REFERENCES leads(id)

          ON DELETE CASCADE,

        CONSTRAINT fk_registration_webinar

          FOREIGN KEY (webinar_id)

          REFERENCES webinars(id)

          ON DELETE CASCADE

      )
    `);


    // =================================================
    // PAYMENTS TABLE
    // =================================================

    await connection.query(`
      CREATE TABLE IF NOT EXISTS payments (

        id INT AUTO_INCREMENT PRIMARY KEY,

        registration_id INT NOT NULL,

        order_id VARCHAR(255) UNIQUE,

        payment_id VARCHAR(255) UNIQUE,

        amount DECIMAL(10,2)
          NOT NULL
          DEFAULT 249.00,

        currency VARCHAR(10)
          NOT NULL
          DEFAULT 'INR',

        status ENUM(
          'pending',
          'paid',
          'failed'
        )
          NOT NULL
          DEFAULT 'pending',

        method VARCHAR(50),

        paid_at DATETIME,

        created_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_payment_registration

          FOREIGN KEY (registration_id)

          REFERENCES registrations(id)

          ON DELETE CASCADE

      )
    `);


    console.log(
      'Payments table checked successfully'
    );
// =====================================================
// PAYMENT WEBHOOK LOGS TABLE
// =====================================================
//
// Stores Razorpay webhook events.
//
// UNIQUE event_id prevents the same webhook
// event from being processed more than once.
//
// =====================================================

await connection.query(`
  CREATE TABLE IF NOT EXISTS payment_webhook_logs (

    id INT AUTO_INCREMENT PRIMARY KEY,

    event_id VARCHAR(255) NOT NULL UNIQUE,

    event_type VARCHAR(100) NOT NULL,

    payment_id VARCHAR(255) NULL,

    order_id VARCHAR(255) NULL,

    signature_valid BOOLEAN NOT NULL DEFAULT FALSE,

    processing_status ENUM(
      'received',
      'processed',
      'failed',
      'skipped'
    ) NOT NULL DEFAULT 'received',

    error_message TEXT NULL,

    processed_at DATETIME NULL,

    created_at TIMESTAMP
      DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
      DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_webhook_event_type
      (event_type),

    INDEX idx_webhook_payment_id
      (payment_id),

    INDEX idx_webhook_order_id
      (order_id),

    INDEX idx_webhook_status
      (processing_status)

  )
`);

console.log(
  'Payment webhook logs table checked successfully'
);

    // =================================================
    // WEBINAR ATTENDANCE TABLE
    // =================================================
    //
    // One row per paid registration. Zoom synchronisation
    // identifies attendees, while an admin can correct a
    // status when Zoom does not expose a participant email.
    // The same row also prevents duplicate recording emails.
    //
    // =================================================

    await connection.query(`
      CREATE TABLE IF NOT EXISTS webinar_attendance (

        id INT AUTO_INCREMENT PRIMARY KEY,

        registration_id INT NOT NULL,

        webinar_id INT NOT NULL,

        attendance_status ENUM(
          'pending',
          'attended',
          'absent'
        ) NOT NULL DEFAULT 'pending',

        attendance_source ENUM(
          'zoom',
          'manual'
        ) NULL,

        participant_email VARCHAR(255) NULL,

        joined_at DATETIME NULL,

        left_at DATETIME NULL,

        duration_minutes INT NULL,

        last_synced_at DATETIME NULL,

        recording_email_status ENUM(
          'not_required',
          'pending',
          'sent',
          'failed'
        ) NOT NULL DEFAULT 'not_required',

        recording_url TEXT NULL,

        recording_email_message_id VARCHAR(500) NULL,

        recording_email_sent_at DATETIME NULL,

        recording_email_retry_count INT NOT NULL DEFAULT 0,

        recording_email_error TEXT NULL,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_attendance_registration
          FOREIGN KEY (registration_id)
          REFERENCES registrations(id)
          ON DELETE CASCADE,

        CONSTRAINT fk_attendance_webinar
          FOREIGN KEY (webinar_id)
          REFERENCES webinars(id)
          ON DELETE CASCADE,

        UNIQUE KEY unique_attendance_registration
          (registration_id),

        INDEX idx_attendance_webinar_status
          (webinar_id, attendance_status),

        INDEX idx_attendance_recording_status
          (recording_email_status)

      )
    `);

    console.log(
      'Webinar attendance table checked successfully'
    );

    // =================================================
    // WEBINAR REMINDER LOGS TABLE
    // =================================================
    //
    // This table tracks:
    //
    // 24-hour reminder
    // 3-hour reminder
    // 30-minute reminder
    //
    // for every paid registration.
    //
    // Unique protection:
    //
    // registration_id + reminder_type
    //
    // This prevents the same reminder from being
    // created more than once for one registration.
    //
    // =================================================

    await connection.query(`
      CREATE TABLE IF NOT EXISTS webinar_reminder_logs (

        id INT AUTO_INCREMENT PRIMARY KEY,

        registration_id INT NOT NULL,

        reminder_type ENUM(
          'reminder_24h',
          'reminder_3h',
          'reminder_30m'
        ) NOT NULL,

        email_status ENUM(
          'pending',
          'sent',
          'failed',
          'skipped'
        )
          NOT NULL
          DEFAULT 'pending',

        whatsapp_status ENUM(
          'pending',
          'sent',
          'failed',
          'skipped'
        )
          NOT NULL
          DEFAULT 'pending',

        email_message_id VARCHAR(500) NULL,

        whatsapp_message_id VARCHAR(500) NULL,

        email_sent_at DATETIME NULL,

        whatsapp_sent_at DATETIME NULL,

        retry_count INT NOT NULL
          DEFAULT 0,

        error_message TEXT NULL,

        scheduled_at DATETIME NOT NULL,

        created_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_reminder_registration

          FOREIGN KEY (registration_id)

          REFERENCES registrations(id)

          ON DELETE CASCADE,

        UNIQUE KEY
          unique_registration_reminder
          (
            registration_id,
            reminder_type
          ),

        INDEX
          idx_reminder_registration_id
          (
            registration_id
          ),

        INDEX
          idx_reminder_type
          (
            reminder_type
          ),

        INDEX
          idx_reminder_email_status
          (
            email_status
          ),

        INDEX
          idx_reminder_whatsapp_status
          (
            whatsapp_status
          ),

        INDEX
          idx_reminder_scheduled_at
          (
            scheduled_at
          )

      )
    `);


    console.log(
      'Webinar reminder logs table checked successfully'
    );


    // =================================================
    // DEFAULT ADMIN
    // =================================================

    const adminEmail =
      process.env.ADMIN_EMAIL ||
      'admin@example.com';

    const adminPassword =
      process.env.ADMIN_PASSWORD ||
      'admin123';


    const [existingAdmins] =
      await connection.query(
        `
        SELECT id
        FROM admins
        WHERE email = ?
        LIMIT 1
        `,
        [adminEmail]
      );


    if (
      existingAdmins.length === 0
    ) {

      const hashedPassword =
        await bcrypt.hash(
          adminPassword,
          10
        );


      await connection.query(
        `
        INSERT INTO admins (
          email,
          password
        )
        VALUES (?, ?)
        `,
        [
          adminEmail,
          hashedPassword
        ]
      );


      console.log(
        `Default admin created: ${adminEmail}`
      );

    }

    else {

      console.log(
        `Admin already exists: ${adminEmail}`
      );

    }


    // =================================================
    // DEFAULT WEBINAR
    // =================================================

    const [existingWebinars] =
      await connection.query(
        `
        SELECT id
        FROM webinars
        ORDER BY id DESC
        LIMIT 1
        `
      );


    if (
      existingWebinars.length === 0
    ) {

      await connection.query(
        `
        INSERT INTO webinars (
          title,
          subtitle,
          date,
          time,
          duration,
          language,
          platform,
          price
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [

          'The Abundance Crossroad™',

          'The 2-Day Experience That Will Transform the Way You Make Decisions About Money, Success, Leadership and Life.',

          'To be updated',

          'To be updated',

          '2 Hours Each Day',

          'English',

          'Zoom',

          '₹249'

        ]
      );


      console.log(
        'Default webinar created'
      );

    }

    else {

      console.log(
        'Webinar already exists'
      );

    }


    // =================================================
    // DATABASE INITIALIZATION COMPLETE
    // =================================================

    console.log(
      'Database initialization completed successfully'
    );

  }


  catch (error) {

    console.error(
      'Database initialization error:',
      error
    );


    throw error;

  }


  finally {

    if (connection) {

      connection.release();

    }

  }

};


// =====================================================
// INITIALIZE DATABASE
// =====================================================

initializeDatabase();


// =====================================================
// EXPORT PROMISE POOL
// =====================================================

module.exports =
  pool.promise();
