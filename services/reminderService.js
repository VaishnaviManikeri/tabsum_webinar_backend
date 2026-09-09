const db =
  require('../config/db');

const ReminderLogModel =
  require('../models/reminderLogModel');


// ======================================================
// REMINDER CONFIGURATION
// ======================================================

const REMINDER_TYPES = {

  REMINDER_24H:
    'reminder_24h',

  REMINDER_3H:
    'reminder_3h',

  REMINDER_30M:
    'reminder_30m'

};


const REMINDER_OFFSETS = {

  reminder_24h:
    24 * 60 * 60 * 1000,

  reminder_3h:
    3 * 60 * 60 * 1000,

  reminder_30m:
    30 * 60 * 1000

};


// ======================================================
// TIMEZONE
// ======================================================

const WEBINAR_TIMEZONE =
  'Asia/Kolkata';

const WEBINAR_TIMEZONE_OFFSET =
  '+05:30';


// ======================================================
// VALIDATE DATE
// ======================================================

const isValidDateString = (
  date
) => {

  if (!date) {

    return false;

  }


  const dateString =
    String(date).trim();


  const match =
    dateString.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );


  if (!match) {

    return false;

  }


  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);


  const testDate =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );


  return (

    testDate.getUTCFullYear() ===
      year &&

    testDate.getUTCMonth() ===
      month - 1 &&

    testDate.getUTCDate() ===
      day

  );

};


// ======================================================
// VALIDATE TIME
// ======================================================

const isValidTimeString = (
  time
) => {

  if (!time) {

    return false;

  }


  const timeString =
    String(time).trim();


  return (
    /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/
      .test(timeString)
  );

};


// ======================================================
// NORMALIZE TIME
// ======================================================

const normalizeTime = (
  time
) => {

  const timeString =
    String(time).trim();


  if (
    /^\d{2}:\d{2}$/.test(
      timeString
    )
  ) {

    return `${timeString}:00`;

  }


  return timeString;

};


// ======================================================
// CREATE WEBINAR DATE/TIME
// ======================================================

const createWebinarDateTime = ({
  webinarDate,
  webinarTime
}) => {

  if (
    !isValidDateString(
      webinarDate
    )
  ) {

    throw new Error(
      `Invalid webinar date: ${webinarDate}`
    );

  }


  if (
    !isValidTimeString(
      webinarTime
    )
  ) {

    throw new Error(
      `Invalid webinar time: ${webinarTime}`
    );

  }


  const normalizedTime =
    normalizeTime(
      webinarTime
    );


  const dateTimeString =
    `${String(webinarDate).trim()}T${normalizedTime}${WEBINAR_TIMEZONE_OFFSET}`;


  const webinarDateTime =
    new Date(
      dateTimeString
    );


  if (
    Number.isNaN(
      webinarDateTime.getTime()
    )
  ) {

    throw new Error(
      'Unable to create webinar date/time.'
    );

  }


  return webinarDateTime;

};


// ======================================================
// FORMAT DATE AS MYSQL DATETIME
// ======================================================

const formatMySQLDateTime = (
  date
) => {

  const formatter =
    new Intl.DateTimeFormat(
      'en-CA',
      {

        timeZone:
          WEBINAR_TIMEZONE,

        year:
          'numeric',

        month:
          '2-digit',

        day:
          '2-digit',

        hour:
          '2-digit',

        minute:
          '2-digit',

        second:
          '2-digit',

        hourCycle:
          'h23'

      }
    );


  const parts =
    formatter.formatToParts(
      date
    );


  const values = {};


  parts.forEach(
    part => {

      if (
        part.type !==
        'literal'
      ) {

        values[part.type] =
          part.value;

      }

    }
  );


  return (

    `${values.year}-${values.month}-${values.day}` +

    ` ${values.hour}:${values.minute}:${values.second}`

  );

};


// ======================================================
// CALCULATE REMINDER TIMES
// ======================================================

const calculateReminderTimes = ({
  webinarDate,
  webinarTime
}) => {

  const webinarDateTime =
    createWebinarDateTime({

      webinarDate,

      webinarTime

    });


  const webinarTimestamp =
    webinarDateTime.getTime();


  const reminderTimes = {

    reminder_24h:
      new Date(
        webinarTimestamp -
        REMINDER_OFFSETS.reminder_24h
      ),

    reminder_3h:
      new Date(
        webinarTimestamp -
        REMINDER_OFFSETS.reminder_3h
      ),

    reminder_30m:
      new Date(
        webinarTimestamp -
        REMINDER_OFFSETS.reminder_30m
      )

  };


  return {

    webinarDateTime,

    webinarDateTimeMySQL:
      formatMySQLDateTime(
        webinarDateTime
      ),

    reminder_24h:
      formatMySQLDateTime(
        reminderTimes.reminder_24h
      ),

    reminder_3h:
      formatMySQLDateTime(
        reminderTimes.reminder_3h
      ),

    reminder_30m:
      formatMySQLDateTime(
        reminderTimes.reminder_30m
      )

  };

};


// ======================================================
// GET REMINDER TYPE DETAILS
// ======================================================

const getReminderTypeDetails = (
  reminderType
) => {

  const offset =
    REMINDER_OFFSETS[
      reminderType
    ];


  if (!offset) {

    throw new Error(
      `Unsupported reminder type: ${reminderType}`
    );

  }


  return {

    reminderType,

    offsetMilliseconds:
      offset

  };

};


// ======================================================
// CREATE REMINDER LOGS FOR ONE REGISTRATION
// ======================================================

const createReminderLogsForRegistration =
  async (
    registration
  ) => {

    if (!registration) {

      throw new Error(
        'Registration details are required.'
      );

    }


    if (!registration.id) {

      throw new Error(
        'Registration ID is required.'
      );

    }


    // --------------------------------------------------
    // Only paid registrations
    // --------------------------------------------------

    if (
      registration.payment_status !==
      'paid'
    ) {

      return {

        success: true,

        skipped: true,

        reason:
          'Registration is not paid.',

        registrationId:
          registration.id,

        created: 0,

        reminders: []

      };

    }


    // --------------------------------------------------
    // Only active registrations
    // --------------------------------------------------

    if (
      registration.registration_status &&
      registration.registration_status !==
        'registered'
    ) {

      return {

        success: true,

        skipped: true,

        reason:
          'Registration is not active.',

        registrationId:
          registration.id,

        created: 0,

        reminders: []

      };

    }


    // --------------------------------------------------
    // Validate webinar date/time
    // --------------------------------------------------

    if (
      !isValidDateString(
        registration.webinar_date
      )
    ) {

      return {

        success: true,

        skipped: true,

        reason:
          'Webinar date is not configured.',

        registrationId:
          registration.id,

        created: 0,

        reminders: []

      };

    }


    if (
      !isValidTimeString(
        registration.webinar_time
      )
    ) {

      return {

        success: true,

        skipped: true,

        reason:
          'Webinar time is not configured.',

        registrationId:
          registration.id,

        created: 0,

        reminders: []

      };

    }


    // --------------------------------------------------
    // Calculate reminder times
    // --------------------------------------------------

    const reminderTimes =
      calculateReminderTimes({

        webinarDate:
          registration.webinar_date,

        webinarTime:
          registration.webinar_time

      });


    const now =
      Date.now();


    const reminders = [

      {

        reminderType:
          REMINDER_TYPES.REMINDER_24H,

        scheduledAt:
          reminderTimes.reminder_24h

      },

      {

        reminderType:
          REMINDER_TYPES.REMINDER_3H,

        scheduledAt:
          reminderTimes.reminder_3h

      },

      {

        reminderType:
          REMINDER_TYPES.REMINDER_30M,

        scheduledAt:
          reminderTimes.reminder_30m

      }

    ];


    const created =
      [];

    let skippedCount =
      0;


    // --------------------------------------------------
    // Create each reminder
    // --------------------------------------------------

    for (
      const reminder of reminders
    ) {

      const scheduledTimestamp =
        new Date(
          `${reminder.scheduledAt} Asia/Kolkata`
        ).getTime();


      // ------------------------------------------------
      // Skip reminders whose time has passed
      // ------------------------------------------------

      if (
        Number.isFinite(
          scheduledTimestamp
        ) &&
        scheduledTimestamp <=
          now
      ) {

        console.log(

          `Skipping ${reminder.reminderType} for registration ${registration.id} because scheduled time has passed.`

        );


        skippedCount++;

        continue;

      }


      // ------------------------------------------------
      // Create or get existing reminder
      // ------------------------------------------------

      const reminderLog =
        await ReminderLogModel
          .createOrGetReminderLog({

            registrationId:
              registration.id,

            reminderType:
              reminder.reminderType,

            scheduledAt:
              reminder.scheduledAt

          });


      created.push({

        reminderType:
          reminder.reminderType,

        scheduledAt:
          reminder.scheduledAt,

        logId:
          reminderLog?.id ||
          null,

        emailStatus:
          reminderLog?.email_status ||
          'pending',

        whatsappStatus:
          reminderLog?.whatsapp_status ||
          'pending',

        alreadyExists:
          Boolean(
            reminderLog?.id
          )

      });

    }


    return {

      success:
        true,

      skipped:
        false,

      registrationId:
        registration.id,

      webinarDate:
        registration.webinar_date,

      webinarTime:
        registration.webinar_time,

      created:
        created.length,

      skippedCount,

      reminders:
        created

    };

  };


// ======================================================
// CREATE REMINDER LOGS FOR ALL PAID REGISTRATIONS
// ======================================================

const createReminderLogsForPaidRegistrations =
  async () => {

    try {

      const [registrations] =
        await db.query(

          `
          SELECT

            r.id,

            r.first_name,

            r.last_name,

            r.email,

            r.phone,

            r.registration_status,

            r.payment_status,

            r.webinar_id,

            w.title AS webinar_title,

            w.date AS webinar_date,

            w.time AS webinar_time,

            w.duration AS webinar_duration,

            w.platform AS webinar_platform,

            w.zoom_meeting_id,

            w.zoom_join_url,

            w.zoom_start_url,

            w.zoom_password,

            w.zoom_created_at

          FROM registrations r

          INNER JOIN webinars w

            ON r.webinar_id = w.id

          WHERE

            r.payment_status = 'paid'

            AND r.registration_status = 'registered'

          ORDER BY

            r.id ASC

          `

        );


      const results =
        [];

      let createdCount =
        0;

      let skippedCount =
        0;


      for (
        const registration
        of registrations
      ) {

        try {

          const result =
            await createReminderLogsForRegistration(
              registration
            );


          results.push(
            result
          );


          if (
            result.skipped
          ) {

            skippedCount++;

          }

          else {

            createdCount +=
              result.created ||
              0;

          }

        }


        catch (error) {

          console.error(

            `Failed to create reminders for registration ${registration.id}:`,

            error.message

          );


          results.push({

            success:
              false,

            registrationId:
              registration.id,

            error:
              error.message

          });

        }

      }


      return {

        success:
          true,

        totalRegistrations:
          registrations.length,

        createdReminders:
          createdCount,

        skippedRegistrations:
          skippedCount,

        results

      };

    }


    catch (error) {

      console.error(
        'Create paid registration reminders error:',
        error
      );


      return {

        success:
          false,

        totalRegistrations:
          0,

        createdReminders:
          0,

        skippedRegistrations:
          0,

        results: [],

        error:
          error.message

      };

    }

  };


// ======================================================
// GET UPCOMING REMINDERS
// ======================================================

const getUpcomingReminders =
  async ({
    minutes = 60,
    limit = 100
  } = {}) => {

    return ReminderLogModel
      .getUpcomingReminders({

        minutes,

        limit

      });

  };


// ======================================================
// GET DUE REMINDERS
// ======================================================

const getDueReminders =
  async ({
    limit = 20
  } = {}) => {

    return ReminderLogModel
      .getPendingReminders({

        limit

      });

  };


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

  REMINDER_TYPES,

  REMINDER_OFFSETS,

  WEBINAR_TIMEZONE,

  isValidDateString,

  isValidTimeString,

  normalizeTime,

  createWebinarDateTime,

  formatMySQLDateTime,

  calculateReminderTimes,

  getReminderTypeDetails,

  createReminderLogsForRegistration,

  createReminderLogsForPaidRegistrations,

  getUpcomingReminders,

  getDueReminders

};