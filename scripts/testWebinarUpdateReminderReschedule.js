const db = require("../config/db");
const ReminderService = require("../services/reminderService");
const ReminderLogModel = require("../models/reminderLogModel");

async function runTest() {
  let webinarId = null;
  let leadId = null;
  let registrationId = null;
  const reminderIds = [];

  try {
    console.log("\n==========================================");
    console.log("WEBINAR REMINDER RESCHEDULE TEST");
    console.log("==========================================\n");

    // ========================================================
    // 1. CREATE TEST WEBINAR
    // ========================================================

    const [webinarResult] = await db.query(
      `
      INSERT INTO webinars
      (
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
        "TEST Webinar - Reschedule",
        "Testing reminder rescheduling",
        "2099-12-20",
        "08:10PM-10:00PM",
        "2 Hours",
        "English",
        "Zoom",
        249
      ]
    );

    webinarId = webinarResult.insertId;

    console.log(
      `✓ Test webinar created: ${webinarId}`
    );

    // ========================================================
    // 2. CREATE TEST LEAD
    // ========================================================

    const [leadResult] = await db.query(
      `
      INSERT INTO leads
      (
        first_name,
        last_name,
        email,
        phone
      )
      VALUES (?, ?, ?, ?)
      `,
      [
        "Reminder",
        "Test",
        `reminder-test-${Date.now()}@example.com`,
        "9999999999"
      ]
    );

    leadId = leadResult.insertId;

    console.log(
      `✓ Test lead created: ${leadId}`
    );

    // ========================================================
    // 3. CREATE REGISTRATION WITH SNAPSHOT
    // ========================================================

    const [registrationResult] =
      await db.query(
        `
        INSERT INTO registrations
        (
          lead_id,
          webinar_id,
          first_name,
          last_name,
          email,
          phone,
          city,
          role,
          goal,
          consent,
          registration_status,
          payment_status,

          webinar_title_snapshot,
          webinar_subtitle_snapshot,
          webinar_date_snapshot,
          webinar_time_snapshot,
          webinar_duration_snapshot,
          webinar_language_snapshot,
          webinar_platform_snapshot,
          webinar_price_snapshot
        )
        VALUES
        (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          'registered',
          'paid',
          ?, ?, ?, ?, ?, ?, ?, ?
        )
        `,
        [
          leadId,
          webinarId,
          "Reminder",
          "Test",
          `reminder-test-${Date.now()}@example.com`,
          "9999999999",
          "Pune",
          "Test User",
          "Reminder testing",
          true,

          "TEST Webinar - Reschedule",
          "Testing reminder rescheduling",
          "2099-12-20",
          "08:10PM-10:00PM",
          "2 Hours",
          "English",
          "Zoom",
          249
        ]
      );

    registrationId =
      registrationResult.insertId;

    console.log(
      `✓ Paid test registration created: ${registrationId}`
    );

    // ========================================================
    // 4. CREATE REMINDER LOGS
    // ========================================================

    const reminderTypes = [
      "reminder_24h",
      "reminder_3h",
      "reminder_30m"
    ];

    for (const type of reminderTypes) {
      const result =
        await ReminderLogModel.createReminderLog(
          {
            registrationId,
            reminderType: type,
            scheduledAt:
              "2099-12-19 00:00:00"
          }
        );

      reminderIds.push(result.id);

      console.log(
        `✓ Created ${type}: ${result.id}`
      );
    }

    // ========================================================
    // 5. MARK 24H AS COMPLETELY SENT
    // ========================================================

    await ReminderLogModel.markEmailAsSent({
      reminderId: reminderIds[0],
      messageId: "test-email-24h"
    });

    await ReminderLogModel.markWhatsAppAsSent({
      reminderId: reminderIds[0],
      messageId: "test-whatsapp-24h"
    });

    console.log(
      "✓ 24h reminder marked as Email + WhatsApp SENT"
    );

    // ========================================================
    // 6. MARK 3H EMAIL AS SENT
    // ========================================================

    await ReminderLogModel.markEmailAsSent({
      reminderId: reminderIds[1],
      messageId: "test-email-3h"
    });

    console.log(
      "✓ 3h Email marked as SENT"
    );

    // ========================================================
    // 7. KEEP 3H WHATSAPP PENDING
    // ========================================================

    console.log(
      "✓ 3h WhatsApp remains PENDING"
    );

    // ========================================================
    // 8. 30M BOTH PENDING
    // ========================================================

    console.log(
      "✓ 30m Email + WhatsApp remain PENDING"
    );

    // ========================================================
    // 9. CHANGE WEBINAR DATE/TIME
    // ========================================================

    await db.query(
      `
      UPDATE webinars
      SET
        date = ?,
        time = ?
      WHERE id = ?
      `,
      [
        "2099-12-25",
        "10:00PM-11:30PM",
        webinarId
      ]
    );

    console.log(
      "✓ Webinar date/time changed"
    );

    // ========================================================
    // 10. RESCHEDULE REMINDERS
    // ========================================================

    const rescheduleResult =
      await ReminderService
        .reschedulePendingRemindersForWebinar({
          webinarId,
          webinarDate: "2099-12-25",
          webinarTime: "10:00PM-11:30PM"
        });

    console.log(
      "\nReschedule result:"
    );

    console.log(
      JSON.stringify(
        rescheduleResult,
        null,
        2
      )
    );

    // ========================================================
    // 11. FETCH UPDATED REMINDERS
    // ========================================================

    const reminders = [];

    for (const reminderId of reminderIds) {
      const reminder =
        await ReminderLogModel.getById(
          reminderId
        );

      reminders.push(reminder);
    }

    console.log(
      "\nUpdated reminder statuses:"
    );

    reminders.forEach(
      (reminder) => {
        console.log(
          `\n${reminder.reminder_type}`
        );

        console.log(
          `Email: ${reminder.email_status}`
        );

        console.log(
          `WhatsApp: ${reminder.whatsapp_status}`
        );

        console.log(
          `Scheduled: ${reminder.scheduled_at}`
        );
      }
    );

    // ========================================================
    // 12. ASSERTIONS
    // ========================================================

    const reminder24 =
      reminders[0];

    const reminder3 =
      reminders[1];

    const reminder30 =
      reminders[2];

    // 24h must remain completely sent
    if (
      reminder24.email_status !== "sent"
    ) {
      throw new Error(
        "FAILED: 24h Email was changed"
      );
    }

    if (
      reminder24.whatsapp_status !== "sent"
    ) {
      throw new Error(
        "FAILED: 24h WhatsApp was changed"
      );
    }

    console.log(
      "\n✓ 24h sent reminder remained SENT"
    );

    // 3h email must remain sent
    if (
      reminder3.email_status !== "sent"
    ) {
      throw new Error(
        "FAILED: 3h Email was changed"
      );
    }

    // 3h WhatsApp must become pending
    if (
      reminder3.whatsapp_status !==
      "pending"
    ) {
      throw new Error(
        "FAILED: 3h WhatsApp was not rescheduled to pending"
      );
    }

    console.log(
      "✓ 3h Email remained SENT"
    );

    console.log(
      "✓ 3h WhatsApp remained/was set PENDING"
    );

    // 30m both must be pending
    if (
      reminder30.email_status !==
      "pending"
    ) {
      throw new Error(
        "FAILED: 30m Email is not pending"
      );
    }

    if (
      reminder30.whatsapp_status !==
      "pending"
    ) {
      throw new Error(
        "FAILED: 30m WhatsApp is not pending"
      );
    }

    console.log(
      "✓ 30m Email + WhatsApp are PENDING"
    );

    // ========================================================
    // 13. TIME RANGE TEST
    // ========================================================

    const parsed =
      ReminderService.parseTimeTo24Hour(
        "10:00PM-11:30PM"
      );

    if (!parsed) {
      throw new Error(
        "FAILED: Time range parsing"
      );
    }

    if (
      parsed.hour !== 22 ||
      parsed.minute !== 0
    ) {
      throw new Error(
        "FAILED: Time range start time incorrect"
      );
    }

    console.log(
      "✓ Time range parsing works"
    );

    // ========================================================
    // SUCCESS
    // ========================================================

    console.log(
      "\n=========================================="
    );

    console.log(
      "✓ REMINDER RESCHEDULE TEST PASSED"
    );

    console.log(
      "==========================================\n"
    );

  } catch (error) {

    console.error(
      "\n=========================================="
    );

    console.error(
      "✗ REMINDER RESCHEDULE TEST FAILED"
    );

    console.error(
      "=========================================="
    );

    console.error(
      error.message
    );

    console.error(
      error.stack
    );

    process.exitCode = 1;

  } finally {

    // ========================================================
    // CLEANUP
    // ========================================================

    try {

      if (registrationId) {
        await db.query(
          `
          DELETE FROM webinar_reminder_logs
          WHERE registration_id = ?
          `,
          [registrationId]
        );

        await db.query(
          `
          DELETE FROM registrations
          WHERE id = ?
          `,
          [registrationId]
        );
      }

      if (leadId) {
        await db.query(
          `
          DELETE FROM leads
          WHERE id = ?
          `,
          [leadId]
        );
      }

      if (webinarId) {
        await db.query(
          `
          DELETE FROM webinars
          WHERE id = ?
          `,
          [webinarId]
        );
      }

      console.log(
        "✓ Test data cleaned successfully"
      );

    } catch (cleanupError) {

      console.error(
        "Cleanup error:",
        cleanupError.message
      );
    }

    // Close pool
    if (
      db &&
      typeof db.end === "function"
    ) {
      await db.end();
    }
  }
}

runTest();