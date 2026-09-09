require('dotenv').config({
  path: ['.env.local', '.env']
});

const db = require('../config/db');
const EmailLogModel = require('../models/emailLogModel');

async function testDuplicateEmailLog() {
  let testLogId = null;

  try {
    console.log('\n======================================');
    console.log('DUPLICATE EMAIL LOG TEST');
    console.log('======================================\n');


    // --------------------------------------------------
    // STEP 1: FIND EXISTING REGISTRATION
    // --------------------------------------------------

    const [registrations] = await db.query(
      `
      SELECT
        id,
        first_name,
        last_name,
        email
      FROM registrations
      ORDER BY id ASC
      LIMIT 1
      `
    );


    if (registrations.length === 0) {
      console.error(
        '❌ No registration found in registrations table.'
      );

      process.exit(1);
    }


    const registration = registrations[0];


    console.log('Using registration:');
    console.log({
      id: registration.id,
      name: `${registration.first_name} ${registration.last_name}`,
      email: registration.email
    });


    // --------------------------------------------------
    // TEST EMAIL TYPE
    // --------------------------------------------------
    // We use a separate test type so that the existing
    // registration_confirmation record is not affected.
    // --------------------------------------------------

    const emailType = 'duplicate_test';


    // --------------------------------------------------
    // STEP 2: FIRST createOrGetLog()
    // --------------------------------------------------

    const firstLog =
      await EmailLogModel.createOrGetLog({
        registrationId: registration.id,
        email: registration.email,
        emailType
      });


    console.log('\nFIRST CALL ✅');

    console.log({
      id: firstLog.id,
      registration_id: firstLog.registration_id,
      email: firstLog.email,
      email_type: firstLog.email_type,
      status: firstLog.status
    });


    testLogId = firstLog.id;


    // --------------------------------------------------
    // STEP 3: SECOND createOrGetLog()
    // --------------------------------------------------

    const secondLog =
      await EmailLogModel.createOrGetLog({
        registrationId: registration.id,
        email: registration.email,
        emailType
      });


    console.log('\nSECOND CALL ✅');

    console.log({
      id: secondLog.id,
      registration_id: secondLog.registration_id,
      email: secondLog.email,
      email_type: secondLog.email_type,
      status: secondLog.status
    });


    // --------------------------------------------------
    // STEP 4: COMPARE IDS
    // --------------------------------------------------

    if (firstLog.id === secondLog.id) {

      console.log(
        '\nDUPLICATE PROTECTION WORKING ✅'
      );

      console.log(
        `Both calls returned the same log ID: ${firstLog.id}`
      );

    } else {

      console.error(
        '\nDUPLICATE PROTECTION FAILED ❌'
      );

      console.error(
        `First ID: ${firstLog.id}`
      );

      console.error(
        `Second ID: ${secondLog.id}`
      );

      process.exit(1);
    }


    // --------------------------------------------------
    // STEP 5: COUNT RECORDS
    // --------------------------------------------------

    const [rows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM email_logs
      WHERE registration_id = ?
        AND email_type = ?
      `,
      [
        registration.id,
        emailType
      ]
    );


    const totalRecords =
      Number(rows[0].total);


    console.log('\nDATABASE RECORD COUNT:');
    console.log(totalRecords);


    if (totalRecords === 1) {

      console.log(
        '\nONLY ONE DATABASE RECORD EXISTS ✅'
      );

    } else {

      console.error(
        '\nDUPLICATE RECORD FOUND ❌'
      );

      console.error(
        `Expected: 1`
      );

      console.error(
        `Found: ${totalRecords}`
      );

      process.exit(1);
    }


    // --------------------------------------------------
    // STEP 6: CLEANUP TEST RECORD
    // --------------------------------------------------

    if (testLogId) {

      await db.query(
        `
        DELETE FROM email_logs
        WHERE id = ?
        `,
        [testLogId]
      );

      console.log(
        '\nTEST RECORD CLEANED UP ✅'
      );
    }


    // --------------------------------------------------
    // FINAL RESULT
    // --------------------------------------------------

    console.log(
      '\n======================================'
    );

    console.log(
      'DUPLICATE EMAIL LOG TEST PASSED ✅'
    );

    console.log(
      '======================================\n'
    );


    process.exit(0);


  } catch (error) {

    console.error(
      '\nDUPLICATE EMAIL LOG TEST FAILED ❌'
    );

    console.error(error);


    // Cleanup if something failed after creation

    if (testLogId) {

      try {

        await db.query(
          `
          DELETE FROM email_logs
          WHERE id = ?
          `,
          [testLogId]
        );

        console.log(
          'Test record cleaned up.'
        );

      } catch (cleanupError) {

        console.error(
          'Cleanup failed:',
          cleanupError
        );
      }
    }


    process.exit(1);
  }
}


testDuplicateEmailLog();