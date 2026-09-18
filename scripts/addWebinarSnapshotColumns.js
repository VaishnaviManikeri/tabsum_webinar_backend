const db = require('../config/db');

const SNAPSHOT_COLUMNS = [
  {
    name: 'webinar_title_snapshot',
    definition: 'VARCHAR(255) NULL'
  },
  {
    name: 'webinar_subtitle_snapshot',
    definition: 'TEXT NULL'
  },
  {
    name: 'webinar_date_snapshot',
    definition: 'DATE NULL'
  },
  {
    name: 'webinar_time_snapshot',
    definition: 'VARCHAR(50) NULL'
  },
  {
    name: 'webinar_duration_snapshot',
    definition: 'VARCHAR(100) NULL'
  },
  {
    name: 'webinar_language_snapshot',
    definition: 'VARCHAR(100) NULL'
  },
  {
    name: 'webinar_platform_snapshot',
    definition: 'VARCHAR(100) NULL'
  },
  {
    name: 'webinar_price_snapshot',
    definition: 'DECIMAL(10,2) NULL'
  }
];

async function columnExists(connection, columnName) {
  const [rows] = await connection.query(
    `
    SELECT COUNT(*) AS count
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'registrations'
      AND COLUMN_NAME = ?
    `,
    [columnName]
  );

  return Number(rows[0]?.count || 0) > 0;
}

async function runMigration() {
  let connection;

  try {
    console.log('');
    console.log('========================================');
    console.log('WEBINAR SNAPSHOT DATABASE MIGRATION');
    console.log('========================================');

    connection = await db.getConnection();

    for (const column of SNAPSHOT_COLUMNS) {
      const exists = await columnExists(
        connection,
        column.name
      );

      if (exists) {
        console.log(
          `✓ ${column.name} already exists`
        );

        continue;
      }

      await connection.query(
        `
        ALTER TABLE registrations
        ADD COLUMN ${column.name} ${column.definition}
        `
      );

      console.log(
        `✓ Added ${column.name}`
      );
    }

    console.log('');
    console.log(
      'Webinar snapshot migration completed successfully.'
    );
    console.log('========================================');
    console.log('');

  } catch (error) {
    console.error('');
    console.error(
      'Webinar snapshot migration failed:',
      error
    );
    console.error('');

    process.exitCode = 1;

  } finally {
    if (connection) {
      connection.release();
    }
  }
}

runMigration();