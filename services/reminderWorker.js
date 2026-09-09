const ReminderLogModel =
  require('../models/reminderLogModel');

const {
  sendReminderEmail
} = require('./reminderEmailService');

const {
  sendReminderWhatsApp
} = require('./reminderWhatsAppService');


// ======================================================
// CONFIGURATION
// ======================================================

const DEFAULT_BATCH_SIZE = 20;


// ======================================================
// PROCESS ONE REMINDER
// ======================================================

const processReminder = async (
  reminder
) => {

  if (!reminder) {

    throw new Error(
      'Reminder details are required.'
    );

  }


  const reminderId =
    reminder.id;

  const registrationId =
    reminder.registration_id;

  const reminderType =
    reminder.reminder_type;


  console.log(
    '\n========================================'
  );

  console.log(
    'PROCESSING WEBINAR REMINDER'
  );

  console.log(
    '========================================'
  );

  console.log(
    'Reminder ID:',
    reminderId
  );

  console.log(
    'Registration ID:',
    registrationId
  );

  console.log(
    'Reminder Type:',
    reminderType
  );

  console.log(
    'Scheduled At:',
    reminder.scheduled_at
  );


  // ====================================================
  // EMAIL
  // ====================================================

  let emailResult = null;

  let emailError = null;


  if (
    reminder.email_status !==
    'sent'
  ) {

    try {

      emailResult =
        await sendReminderEmail({

          registration: {

            id:
              reminder.registration_id,

            first_name:
              reminder.first_name,

            last_name:
              reminder.last_name,

            email:
              reminder.email,

            phone:
              reminder.phone,

            payment_status:
              reminder.payment_status,

            registration_status:
              reminder.registration_status,

            webinar_id:
              reminder.webinar_id,

            webinar_title:
              reminder.webinar_title,

            webinar_date:
              reminder.webinar_date,

            webinar_time:
              reminder.webinar_time,

            webinar_duration:
              reminder.webinar_duration,

            webinar_platform:
              reminder.webinar_platform,

            zoom_meeting_id:
              reminder.zoom_meeting_id,

            zoom_join_url:
              reminder.zoom_join_url,

            zoom_start_url:
              reminder.zoom_start_url,

            zoom_password:
              reminder.zoom_password,

            zoom_created_at:
              reminder.zoom_created_at

          },

          reminderLog:
            reminder,

          reminderType

        });


      console.log(
        'Reminder email processed successfully.'
      );

    }


    catch (error) {

      emailError =
        error;


      console.error(
        'Reminder email failed:',
        error.message
      );

    }

  }

  else {

    console.log(
      'Reminder email already sent. Skipping.'
    );

  }


  // ====================================================
  // WHATSAPP
  // ====================================================

  let whatsappResult = null;

  let whatsappError = null;


  // Refresh reminder from database after email
  // because email status may have changed.

  const latestReminder =
    await ReminderLogModel.getById(
      reminderId
    );


  if (!latestReminder) {

    throw new Error(
      `Reminder ${reminderId} not found after email processing.`
    );

  }


  if (
    latestReminder.whatsapp_status !==
    'sent'
  ) {

    try {

      whatsappResult =
        await sendReminderWhatsApp({

          registration: {

            id:
              reminder.registration_id,

            first_name:
              reminder.first_name,

            last_name:
              reminder.last_name,

            email:
              reminder.email,

            phone:
              reminder.phone,

            payment_status:
              reminder.payment_status,

            registration_status:
              reminder.registration_status,

            webinar_id:
              reminder.webinar_id,

            webinar_title:
              reminder.webinar_title,

            webinar_date:
              reminder.webinar_date,

            webinar_time:
              reminder.webinar_time,

            webinar_duration:
              reminder.webinar_duration,

            webinar_platform:
              reminder.webinar_platform,

            zoom_meeting_id:
              reminder.zoom_meeting_id,

            zoom_join_url:
              reminder.zoom_join_url,

            zoom_start_url:
              reminder.zoom_start_url,

            zoom_password:
              reminder.zoom_password,

            zoom_created_at:
              reminder.zoom_created_at

          },

          reminderLog:
            latestReminder,

          reminderType

        });


      console.log(
        'Reminder WhatsApp processed successfully.'
      );

    }


    catch (error) {

      whatsappError =
        error;


      console.error(
        'Reminder WhatsApp failed:',
        error.message
      );

    }

  }

  else {

    console.log(
      'Reminder WhatsApp already sent. Skipping.'
    );

  }


  // ====================================================
  // FINAL STATUS
  // ====================================================

  const finalReminder =
    await ReminderLogModel.getById(
      reminderId
    );


  const emailSent =
    finalReminder?.email_status ===
    'sent';


  const whatsappSent =
    finalReminder?.whatsapp_status ===
    'sent';


  const complete =
    emailSent &&
    whatsappSent;


  console.log(
    '\nREMINDER FINAL STATUS'
  );

  console.log({

    reminderId,

    reminderType,

    emailStatus:
      finalReminder?.email_status,

    whatsappStatus:
      finalReminder?.whatsapp_status,

    complete

  });


  return {

    success:
      complete,

    reminderId,

    registrationId,

    reminderType,

    email: {

      status:
        finalReminder?.email_status,

      success:
        Boolean(emailResult?.success),

      error:
        emailError?.message ||
        null

    },

    whatsapp: {

      status:
        finalReminder?.whatsapp_status,

      success:
        Boolean(whatsappResult?.success),

      error:
        whatsappError?.message ||
        null

    },

    complete

  };

};


// ======================================================
// PROCESS DUE REMINDERS
// ======================================================

const processDueReminders = async ({
  limit = DEFAULT_BATCH_SIZE
} = {}) => {

  console.log(
    '\n========================================'
  );

  console.log(
    'REMINDER WORKER STARTED'
  );

  console.log(
    '========================================'
  );


  try {

    const reminders =
      await ReminderLogModel
        .getPendingReminders({

          limit

        });


    if (
      !reminders.length
    ) {

      console.log(
        'No due reminders found.'
      );


      return {

        success: true,

        processed: 0,

        completed: 0,

        partial: 0,

        failed: 0

      };

    }


    console.log(
      `Due reminders found: ${reminders.length}`
    );


    let completed = 0;

    let partial = 0;

    let failed = 0;


    const results = [];


    for (
      const reminder
      of reminders
    ) {

      try {

        const result =
          await processReminder(
            reminder
          );


        results.push(
          result
        );


        if (
          result.complete
        ) {

          completed++;

        }

        else if (
          result.email.success ||
          result.whatsapp.success
        ) {

          partial++;

        }

        else {

          failed++;

        }

      }


      catch (error) {

        failed++;


        console.error(

          `Reminder ${reminder.id} processing failed:`,

          error.message

        );


        results.push({

          success: false,

          reminderId:
            reminder.id,

          registrationId:
            reminder.registration_id,

          reminderType:
            reminder.reminder_type,

          error:
            error.message

        });

      }

    }


    console.log(
      '\n========================================'
    );

    console.log(
      'REMINDER WORKER COMPLETED'
    );

    console.log(
      '========================================'
    );

    console.log({

      processed:
        reminders.length,

      completed,

      partial,

      failed

    });


    return {

      success: true,

      processed:
        reminders.length,

      completed,

      partial,

      failed,

      results

    };

  }


  catch (error) {

    console.error(
      'Reminder worker error:',
      error
    );


    return {

      success: false,

      processed: 0,

      completed: 0,

      partial: 0,

      failed: 0,

      error:
        error.message

    };

  }

};


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

  processReminder,

  processDueReminders

};