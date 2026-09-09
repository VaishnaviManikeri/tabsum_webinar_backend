require('dotenv').config({
  path: ['.env.local', '.env']
});

const db = require('../config/db');
const EmailLogModel = require('../models/emailLogModel');

async function testEmailLogModel() {
  try {
    console.log('\nStarting Email Log Model Test...\n');

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

      console.error(
        'Please create at least one registration first.'
      );

      process.exit(1);
    }

    const registration = registrations[0];

    console.log('Using existing registration:');
    console.log({
      id: registration.id,
      name: `${registration.first_name} ${registration.last_name}`,
      email: registration.email
    });


    // --------------------------------------------------
    // STEP 2: CREATE EMAIL LOG
    // --------------------------------------------------

    const log = await EmailLogModel.createLog({
      registrationId: registration.id,
      email: registration.email,
      emailType: 'registration_confirmation'
    });

    console.log('\nCREATE LOG ✅');
    console.log(log);


    // --------------------------------------------------
    // STEP 3: GET LOG BY ID
    // --------------------------------------------------

    const foundLog = await EmailLogModel.getById(
      log.id
    );

    console.log('\nGET BY ID ✅');
    console.log(foundLog);


    // --------------------------------------------------
    // STEP 4: MARK AS SENT
    // --------------------------------------------------

    const sent = await EmailLogModel.markAsSent(
      log.id,
      'test-message-id-123'
    );

    console.log('\nMARK AS SENT ✅');
    console.log(sent);


    // --------------------------------------------------
    // STEP 5: CHECK ALREADY SENT
    // --------------------------------------------------

    const alreadySent =
      await EmailLogModel.isAlreadySent(
        registration.id,
        'registration_confirmation'
      );

    console.log('\nALREADY SENT CHECK ✅');
    console.log(alreadySent);


    // --------------------------------------------------
    // STEP 6: GET EMAIL LOG STATS
    // --------------------------------------------------

    const stats =
      await EmailLogModel.getStats();

    console.log('\nEMAIL LOG STATS ✅');
    console.log(stats);


    console.log(
      '\nEmail Log Model Test Completed Successfully ✅\n'
    );

    process.exit(0);

  } catch (error) {

    console.error(
      '\nEMAIL LOG MODEL TEST FAILED ❌'
    );

    console.error(error);

    process.exit(1);
  }
}

testEmailLogModel();