const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();


// =====================================================
// MYSQL CONNECTION POOL
// =====================================================

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'webinar_db',

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  // Helps with MySQL connection stability
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});


// =====================================================
// DATABASE INITIALIZATION
// =====================================================

const initializeDatabase = async () => {

  let connection;

  try {

    connection = await pool.promise().getConnection();

    console.log('Connected to MySQL database');


    // =================================================
    // ADMINS TABLE
    // =================================================

    await connection.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,

        email VARCHAR(255) NOT NULL UNIQUE,

        password VARCHAR(255) NOT NULL,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

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

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP
      )
    `);


    // =================================================
    // ABOUT SECTIONS TABLE
    // =================================================

    await connection.query(`
      CREATE TABLE IF NOT EXISTS about_sections (
        id INT AUTO_INCREMENT PRIMARY KEY,

        title VARCHAR(255),

        content TEXT,

        image VARCHAR(500),

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

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

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

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

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP
      )
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

        source VARCHAR(100) DEFAULT 'website',

        lead_status ENUM(
          'new',
          'registered',
          'interested',
          'converted',
          'lost'
        ) DEFAULT 'new',

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

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

        consent BOOLEAN DEFAULT FALSE,

        registration_status ENUM(
          'registered',
          'cancelled'
        ) DEFAULT 'registered',

        payment_status ENUM(
          'pending',
          'paid',
          'failed'
        ) DEFAULT 'pending',

        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

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
    // DEFAULT ADMIN
    // =================================================

    const adminEmail =
      process.env.ADMIN_EMAIL || 'admin@example.com';

    const adminPassword =
      process.env.ADMIN_PASSWORD || 'admin123';


    const [existingAdmins] = await connection.query(
      `
      SELECT id
      FROM admins
      WHERE email = ?
      LIMIT 1
      `,
      [adminEmail]
    );


    if (existingAdmins.length === 0) {

      const hashedPassword =
        await bcrypt.hash(adminPassword, 10);

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

    } else {

      console.log(
        `Admin already exists: ${adminEmail}`
      );

    }


    // =================================================
    // DEFAULT WEBINAR
    // =================================================

    const [existingWebinars] = await connection.query(
      `
      SELECT id
      FROM webinars
      ORDER BY id DESC
      LIMIT 1
      `
    );


    if (existingWebinars.length === 0) {

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

      console.log('Default webinar created');

    } else {

      console.log('Webinar already exists');

    }


    console.log('Database initialization completed successfully');

  } catch (error) {

    console.error(
      'Database initialization error:',
      error
    );

    throw error;

  } finally {

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

module.exports = pool.promise();