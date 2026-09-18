const db = require('../config/db');
const RegistrationModel = require('../models/registrationModel');


// ==================================================
// DATE NORMALIZATION HELPER
// ==================================================

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  // MySQL DATE may come as JavaScript Date object.
  // Convert it to IST calendar date.
  if (value instanceof Date) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(value);
  }

  const stringValue = String(value).trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
    return stringValue;
  }

  // ISO / other date representation
  const parsedDate = new Date(stringValue);

  if (!Number.isNaN(parsedDate.getTime())) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(parsedDate);
  }

  return stringValue.slice(0, 10);
}


// ==================================================
// MAIN TEST
// ==================================================

async function runTest() {

  let registrationId = null;
  let leadId = null;

  let originalWebinar = null;

  const testEmail =
    `snapshot_test_${Date.now()}@example.com`;


  console.log('');
  console.log('========================================');
  console.log('REGISTRATION SNAPSHOT INTEGRITY TEST');
  console.log('========================================');


  try {

    // ==================================================
    // 1. GET CURRENT WEBINAR
    // ==================================================

    console.log('');
    console.log('1. Fetching current webinar...');

    const [webinarRows] =
      await db.query(`
        SELECT
          id,
          title,
          subtitle,
          DATE_FORMAT(date, '%Y-%m-%d') AS date,
          time,
          duration,
          language,
          platform,
          price
        FROM webinars
        ORDER BY id DESC
        LIMIT 1
      `);


    if (!webinarRows.length) {

      throw new Error(
        'No webinar found. Please create/configure a webinar first.'
      );

    }


    originalWebinar =
      webinarRows[0];


    console.log('✓ Webinar found');

    console.table([
      originalWebinar
    ]);


    // ==================================================
    // 2. CREATE TEST REGISTRATION
    // ==================================================

    console.log('');
    console.log(
      '2. Creating test registration...'
    );


    const registration =
      await RegistrationModel.createRegistration({

        firstName: 'Snapshot',

        lastName: 'Test',

        email: testEmail,

        phone: '9999999999',

        city: 'Pune',

        role: 'Snapshot Test User',

        goal:
          'Testing webinar snapshot architecture',

        consent: true,

        webinarId:
          originalWebinar.id,

        source:
          'Snapshot Test'

      });


    registrationId =
      registration.registrationId;


    leadId =
      registration.leadId;


    console.log(
      '✓ Test registration created'
    );

    console.log(
      `Registration ID: ${registrationId}`
    );

    console.log(
      `Lead ID: ${leadId}`
    );


    // ==================================================
    // 3. READ SAVED SNAPSHOT
    // ==================================================

    console.log('');
    console.log(
      '3. Checking saved webinar snapshot...'
    );


    const savedRegistration =
      await RegistrationModel.getRegistrationById(
        registrationId
      );


    if (!savedRegistration) {

      throw new Error(
        'Created registration could not be fetched.'
      );

    }


    const snapshot = {

      title:
        savedRegistration.webinar_title,

      subtitle:
        savedRegistration.webinar_subtitle,

      date:
        normalizeDate(
          savedRegistration.webinar_date
        ),

      time:
        savedRegistration.webinar_time,

      duration:
        savedRegistration.webinar_duration,

      language:
        savedRegistration.webinar_language,

      platform:
        savedRegistration.webinar_platform,

      price:
        Number(
          savedRegistration.webinar_price
        )

    };


    console.log(
      '✓ Snapshot retrieved'
    );

    console.table([
      snapshot
    ]);


    // ==================================================
    // 4. VERIFY SNAPSHOT AGAINST CURRENT WEBINAR
    // ==================================================

    console.log('');
    console.log(
      '4. Comparing snapshot with webinar...'
    );


    const originalDate =
      normalizeDate(
        originalWebinar.date
      );


    const snapshotMatches =
      snapshot.title ===
        String(
          originalWebinar.title || ''
        ) &&

      snapshot.subtitle ===
        String(
          originalWebinar.subtitle || ''
        ) &&

      snapshot.date ===
        originalDate &&

      snapshot.time ===
        String(
          originalWebinar.time || ''
        ) &&

      snapshot.duration ===
        String(
          originalWebinar.duration || ''
        ) &&

      snapshot.language ===
        String(
          originalWebinar.language || ''
        ) &&

      snapshot.platform ===
        String(
          originalWebinar.platform || ''
        ) &&

      snapshot.price ===
        Number(
          originalWebinar.price || 0
        );


    if (!snapshotMatches) {

      console.log('');
      console.log(
        'Expected webinar snapshot:'
      );

      console.table([
        {
          title:
            originalWebinar.title,

          subtitle:
            originalWebinar.subtitle,

          date:
            originalDate,

          time:
            originalWebinar.time,

          duration:
            originalWebinar.duration,

          language:
            originalWebinar.language,

          platform:
            originalWebinar.platform,

          price:
            Number(
              originalWebinar.price || 0
            )
        }
      ]);


      console.log('');
      console.log(
        'Actual registration snapshot:'
      );

      console.table([
        snapshot
      ]);


      throw new Error(
        'Initial webinar snapshot does not match current webinar.'
      );

    }


    console.log(
      '✓ All 8 snapshot values match successfully.'
    );


    // ==================================================
    // 5. CHANGE WEBINAR MASTER DATA
    // ==================================================

    console.log('');
    console.log(
      '5. Temporarily changing webinar master data...'
    );


    const temporaryTitle =
      `${originalWebinar.title} - SNAPSHOT TEST`;


    const temporaryPrice =
      Number(
        originalWebinar.price || 249
      ) + 51;


    const temporaryTime =
      originalWebinar.time ===
        '08:10PM-10:00PM'

        ? '09:00PM-11:00PM'

        : '08:10PM-10:00PM';


    await db.query(
      `
      UPDATE webinars
      SET
        title = ?,
        time = ?,
        price = ?
      WHERE id = ?
      `,
      [
        temporaryTitle,
        temporaryTime,
        temporaryPrice,
        originalWebinar.id
      ]
    );


    console.log(
      '✓ Webinar master data temporarily changed'
    );


    console.table([
      {
        title:
          temporaryTitle,

        time:
          temporaryTime,

        price:
          temporaryPrice
      }
    ]);


    // ==================================================
    // 6. FETCH OLD REGISTRATION AGAIN
    // ==================================================

    console.log('');
    console.log(
      '6. Fetching old registration after webinar change...'
    );


    const registrationAfterChange =
      await RegistrationModel.getRegistrationById(
        registrationId
      );


    if (!registrationAfterChange) {

      throw new Error(
        'Registration disappeared after webinar update.'
      );

    }


    const snapshotAfterChange = {

      title:
        registrationAfterChange.webinar_title,

      subtitle:
        registrationAfterChange.webinar_subtitle,

      date:
        normalizeDate(
          registrationAfterChange.webinar_date
        ),

      time:
        registrationAfterChange.webinar_time,

      duration:
        registrationAfterChange.webinar_duration,

      language:
        registrationAfterChange.webinar_language,

      platform:
        registrationAfterChange.webinar_platform,

      price:
        Number(
          registrationAfterChange.webinar_price
        )

    };


    const currentWebinarAfterChange = {

      title:
        registrationAfterChange.current_webinar_title,

      date:
        normalizeDate(
          registrationAfterChange.current_webinar_date
        ),

      time:
        registrationAfterChange.current_webinar_time,

      price:
        Number(
          registrationAfterChange.current_webinar_price
        )

    };


    console.log('');
    console.log(
      'Saved registration snapshot:'
    );

    console.table([
      snapshotAfterChange
    ]);


    console.log('');
    console.log(
      'Current webinar master:'
    );

    console.table([
      currentWebinarAfterChange
    ]);


    // ==================================================
    // 7. VERIFY SNAPSHOT DID NOT CHANGE
    // ==================================================

    console.log('');
    console.log(
      '7. Verifying snapshot immutability...'
    );


    const snapshotStillSame =

      snapshotAfterChange.title ===
        snapshot.title &&

      snapshotAfterChange.subtitle ===
        snapshot.subtitle &&

      snapshotAfterChange.date ===
        snapshot.date &&

      snapshotAfterChange.time ===
        snapshot.time &&

      snapshotAfterChange.duration ===
        snapshot.duration &&

      snapshotAfterChange.language ===
        snapshot.language &&

      snapshotAfterChange.platform ===
        snapshot.platform &&

      snapshotAfterChange.price ===
        snapshot.price;


    if (!snapshotStillSame) {

      throw new Error(
        'SNAPSHOT INTEGRITY FAILED: old registration changed.'
      );

    }


    console.log(
      '✓ OLD REGISTRATION SNAPSHOT REMAINED UNCHANGED'
    );


    // ==================================================
    // 8. VERIFY MASTER DATA ACTUALLY CHANGED
    // ==================================================

    const masterChanged =

      currentWebinarAfterChange.title ===
        temporaryTitle &&

      currentWebinarAfterChange.time ===
        temporaryTime &&

      currentWebinarAfterChange.price ===
        temporaryPrice;


    if (!masterChanged) {

      throw new Error(
        'Webinar master data did not change as expected.'
      );

    }


    console.log(
      '✓ Webinar master data changed successfully.'
    );


    // ==================================================
    // 9. RESTORE ORIGINAL WEBINAR
    // ==================================================

    console.log('');
    console.log(
      '8. Restoring original webinar configuration...'
    );


    await db.query(
      `
      UPDATE webinars
      SET
        title = ?,
        subtitle = ?,
        date = ?,
        time = ?,
        duration = ?,
        language = ?,
        platform = ?,
        price = ?
      WHERE id = ?
      `,
      [
        originalWebinar.title,
        originalWebinar.subtitle,
        originalWebinar.date,
        originalWebinar.time,
        originalWebinar.duration,
        originalWebinar.language,
        originalWebinar.platform,
        originalWebinar.price,
        originalWebinar.id
      ]
    );


    console.log(
      '✓ Original webinar configuration restored.'
    );


    // ==================================================
    // 10. CLEAN TEST DATA
    // ==================================================

    console.log('');
    console.log(
      '9. Cleaning test registration...'
    );


    if (registrationId) {

      await db.query(
        `
        DELETE FROM registrations
        WHERE id = ?
        `,
        [
          registrationId
        ]
      );

    }


    if (leadId) {

      await db.query(
        `
        DELETE FROM leads
        WHERE id = ?
        `,
        [
          leadId
        ]
      );

    }


    console.log(
      '✓ Test data removed'
    );


    // ==================================================
    // FINAL RESULT
    // ==================================================

    console.log('');
    console.log('========================================');
    console.log(
      'REGISTRATION SNAPSHOT TEST PASSED'
    );
    console.log('========================================');

    console.log('');

    console.log(
      'Verified:'
    );

    console.log(
      '✓ Webinar snapshot created'
    );

    console.log(
      '✓ Title snapshot'
    );

    console.log(
      '✓ Subtitle snapshot'
    );

    console.log(
      '✓ Date snapshot'
    );

    console.log(
      '✓ Time snapshot'
    );

    console.log(
      '✓ Duration snapshot'
    );

    console.log(
      '✓ Language snapshot'
    );

    console.log(
      '✓ Platform snapshot'
    );

    console.log(
      '✓ Price snapshot'
    );

    console.log(
      '✓ Webinar master can change'
    );

    console.log(
      '✓ Old registration remains unchanged'
    );

    console.log('');

    process.exit(0);

  } catch (error) {

    console.error('');
    console.error(
      'SNAPSHOT TEST FAILED:',
      error.message
    );


    // ==================================================
    // RESTORE WEBINAR AFTER FAILURE
    // ==================================================

    try {

      if (originalWebinar) {

        await db.query(
          `
          UPDATE webinars
          SET
            title = ?,
            subtitle = ?,
            date = ?,
            time = ?,
            duration = ?,
            language = ?,
            platform = ?,
            price = ?
          WHERE id = ?
          `,
          [
            originalWebinar.title,
            originalWebinar.subtitle,
            originalWebinar.date,
            originalWebinar.time,
            originalWebinar.duration,
            originalWebinar.language,
            originalWebinar.platform,
            originalWebinar.price,
            originalWebinar.id
          ]
        );


        console.log(
          '✓ Original webinar configuration restored after failure.'
        );

      }

    } catch (restoreError) {

      console.error(
        'WARNING: Failed to restore webinar:',
        restoreError.message
      );

    }


    // ==================================================
    // CLEAN TEST DATA AFTER FAILURE
    // ==================================================

    try {

      if (registrationId) {

        await db.query(
          `
          DELETE FROM registrations
          WHERE id = ?
          `,
          [
            registrationId
          ]
        );

      }


      if (leadId) {

        await db.query(
          `
          DELETE FROM leads
          WHERE id = ?
          `,
          [
            leadId
          ]
        );

      }


    } catch (cleanupError) {

      console.error(
        'WARNING: Test cleanup failed:',
        cleanupError.message
      );

    }


    console.log('');

    process.exit(1);

  }

}


// ==================================================
// START TEST
// ==================================================

runTest();