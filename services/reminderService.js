const db = require("../config/db");
const ReminderLogModel = require("../models/reminderLogModel");

// ============================================================
// CONFIGURATION
// ============================================================

const TIMEZONE = "Asia/Kolkata";

const REMINDER_TYPES = {
  REMINDER_24H: "reminder_24h",
  REMINDER_3H: "reminder_3h",
  REMINDER_30M: "reminder_30m"
};

// ============================================================
// DATE HELPERS
// ============================================================

const normalizeDateString = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(
      value.getMonth() + 1
    ).padStart(2, "0");
    const day = String(
      value.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  const stringValue = String(value).trim();

  // YYYY-MM-DD
  const directMatch =
    stringValue.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

  if (directMatch) {
    return `${directMatch[1]}-${directMatch[2]}-${directMatch[3]}`;
  }

  // Try Date parsing
  const parsedDate = new Date(stringValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate
    .toISOString()
    .slice(0, 10);
};

// ============================================================
// VALIDATE DATE
// ============================================================

const isValidDateString = (value) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month, day] =
    value.split("-").map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

// ============================================================
// TIME PARSER
//
// Supported:
//
// 08:10
// 08:10:00
// 08:10PM
// 08:10 PM
// 08:10PM-10:00PM
// 08:10 PM - 10:00 PM
// ============================================================

const parseTimeTo24Hour = (timeValue) => {
  if (!timeValue) {
    return null;
  }

  let value = String(timeValue).trim();

  // If time range, use START time
  if (value.includes("-")) {
    value = value
      .split("-")[0]
      .trim();
  }

  // ----------------------------------------------------------
  // 24-hour format HH:mm
  // ----------------------------------------------------------

  let match = value.match(
    /^([01]\d|2[0-3]):([0-5]\d)$/
  );

  if (match) {
    return {
      hour: Number(match[1]),
      minute: Number(match[2]),
      second: 0
    };
  }

  // ----------------------------------------------------------
  // 24-hour format HH:mm:ss
  // ----------------------------------------------------------

  match = value.match(
    /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/
  );

  if (match) {
    return {
      hour: Number(match[1]),
      minute: Number(match[2]),
      second: Number(match[3])
    };
  }

  // ----------------------------------------------------------
  // 12-hour format
  // ----------------------------------------------------------

  match = value.match(
    /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
  );

  if (match) {
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const period =
      match[3].toUpperCase();

    if (hour < 1 || hour > 12) {
      return null;
    }

    if (period === "AM") {
      if (hour === 12) {
        hour = 0;
      }
    } else {
      if (hour !== 12) {
        hour += 12;
      }
    }

    return {
      hour,
      minute,
      second: 0
    };
  }

  return null;
};

// ============================================================
// VALIDATE TIME
// ============================================================

const isValidTimeString = (value) => {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return false;
  }

  const timeValue = value.trim();

  // ----------------------------------------------------------
  // If range, validate both start and end
  // ----------------------------------------------------------

  if (timeValue.includes("-")) {
    const parts =
      timeValue.split("-");

    if (parts.length !== 2) {
      return false;
    }

    const start = parseTimeTo24Hour(
      parts[0].trim()
    );

    const end = parseTimeTo24Hour(
      parts[1].trim()
    );

    return Boolean(start && end);
  }

  return Boolean(
    parseTimeTo24Hour(timeValue)
  );
};

// ============================================================
// IST DATE/TIME CREATION
// ============================================================

const createISTDate = (
  dateString,
  timeString
) => {
  const normalizedDate =
    normalizeDateString(dateString);

  const parsedTime =
    parseTimeTo24Hour(timeString);

  if (
    !normalizedDate ||
    !parsedTime
  ) {
    return null;
  }

  const {
    hour,
    minute,
    second
  } = parsedTime;

  /*
    Create UTC timestamp corresponding to
    the requested IST time.

    IST = UTC + 05:30
  */

  const isoString =
    `${normalizedDate}T` +
    `${String(hour).padStart(2, "0")}:` +
    `${String(minute).padStart(2, "0")}:` +
    `${String(second).padStart(2, "0")}+05:30`;

  const result =
    new Date(isoString);

  if (
    Number.isNaN(result.getTime())
  ) {
    return null;
  }

  return result;
};

// ============================================================
// FORMAT MYSQL DATETIME
// ============================================================

const formatMySQLDateTime = (
  date
) => {
  if (!(date instanceof Date)) {
    return null;
  }

  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
      }
    ).formatToParts(date);

  const getPart = (type) =>
    parts.find(
      (part) =>
        part.type === type
    )?.value;

  return (
    `${getPart("year")}-` +
    `${getPart("month")}-` +
    `${getPart("day")} ` +
    `${getPart("hour")}:` +
    `${getPart("minute")}:` +
    `${getPart("second")}`
  );
};

// ============================================================
// CALCULATE REMINDER TIMES
// ============================================================

const calculateReminderTimes = ({
  webinarDate,
  webinarTime
}) => {
  const webinarDateTime =
    createISTDate(
      webinarDate,
      webinarTime
    );

  if (!webinarDateTime) {
    throw new Error(
      "Invalid webinar date/time"
    );
  }

  const reminder24h =
    new Date(
      webinarDateTime.getTime() -
        24 * 60 * 60 * 1000
    );

  const reminder3h =
    new Date(
      webinarDateTime.getTime() -
        3 * 60 * 60 * 1000
    );

  const reminder30m =
    new Date(
      webinarDateTime.getTime() -
        30 * 60 * 1000
    );

  return {
    webinarDateTime,

    reminder24h,
    reminder3h,
    reminder30m,

    reminder24hMySQL:
      formatMySQLDateTime(
        reminder24h
      ),

    reminder3hMySQL:
      formatMySQLDateTime(
        reminder3h
      ),

    reminder30mMySQL:
      formatMySQLDateTime(
        reminder30m
      )
  };
};

// ============================================================
// GET REMINDER TIME BY TYPE
// ============================================================

const getReminderDateByType = (
  reminderType,
  reminderTimes
) => {
  switch (reminderType) {
    case REMINDER_TYPES.REMINDER_24H:
      return reminderTimes.reminder24h;

    case REMINDER_TYPES.REMINDER_3H:
      return reminderTimes.reminder3h;

    case REMINDER_TYPES.REMINDER_30M:
      return reminderTimes.reminder30m;

    default:
      return null;
  }
};

// ============================================================
// CREATE REMINDER LOGS FOR REGISTRATION
// ============================================================

const createReminderLogsForRegistration =
  async (registrationId) => {
    if (!registrationId) {
      throw new Error(
        "Registration ID is required"
      );
    }

    // ----------------------------------------------------------
    // Get registration + webinar snapshot
    // ----------------------------------------------------------

    const [rows] = await db.query(
      `
      SELECT
        r.id,
        r.webinar_id,
        r.registration_status,
        r.payment_status,

        COALESCE(
          r.webinar_date_snapshot,
          w.date
        ) AS webinar_date,

        COALESCE(
          r.webinar_time_snapshot,
          w.time
        ) AS webinar_time

      FROM registrations r

      LEFT JOIN webinars w
        ON r.webinar_id = w.id

      WHERE r.id = ?

      LIMIT 1
      `,
      [registrationId]
    );

    if (!rows.length) {
      throw new Error(
        "Registration not found"
      );
    }

    const registration =
      rows[0];

    // ----------------------------------------------------------
    // Only paid registrations get reminders
    // ----------------------------------------------------------

    if (
      registration.payment_status !==
      "paid"
    ) {
      return {
        success: true,
        skipped: true,
        reason:
          "Registration is not paid",
        created: 0
      };
    }

    // ----------------------------------------------------------
    // Only registered users
    // ----------------------------------------------------------

    if (
      registration.registration_status !==
      "registered"
    ) {
      return {
        success: true,
        skipped: true,
        reason:
          "Registration is not active",
        created: 0
      };
    }

    // ----------------------------------------------------------
    // Validate webinar date/time
    // ----------------------------------------------------------

    if (
      !registration.webinar_date ||
      !registration.webinar_time
    ) {
      return {
        success: true,
        skipped: true,
        reason:
          "Webinar date/time is not configured",
        created: 0
      };
    }

    const reminderTimes =
      calculateReminderTimes({
        webinarDate:
          registration.webinar_date,
        webinarTime:
          registration.webinar_time
      });

    const now = new Date();

    const reminderDefinitions = [
      {
        type:
          REMINDER_TYPES.REMINDER_24H,
        scheduledAt:
          reminderTimes.reminder24h
      },
      {
        type:
          REMINDER_TYPES.REMINDER_3H,
        scheduledAt:
          reminderTimes.reminder3h
      },
      {
        type:
          REMINDER_TYPES.REMINDER_30M,
        scheduledAt:
          reminderTimes.reminder30m
      }
    ];

    let created = 0;
    let skipped = 0;

    // ----------------------------------------------------------
    // Create each reminder
    // ----------------------------------------------------------

    for (
      const reminder of reminderDefinitions
    ) {
      // Do not create reminders whose window has passed
      if (
        reminder.scheduledAt <= now
      ) {
        skipped++;
        continue;
      }

      try {
        const existing =
          await ReminderLogModel.getByRegistrationAndType(
            registrationId,
            reminder.type
          );

        if (existing) {
          continue;
        }

        await ReminderLogModel.create({
          registrationId,
          reminderType:
            reminder.type,
          scheduledAt:
            formatMySQLDateTime(
              reminder.scheduledAt
            )
        });

        created++;
      } catch (error) {
        // Duplicate entry can happen because of
        // unique(registration_id, reminder_type)
        if (
          error.code ===
          "ER_DUP_ENTRY"
        ) {
          continue;
        }

        throw error;
      }
    }

    return {
      success: true,
      skipped: false,
      created,
      skippedPastWindows: skipped
    };
  };

// ============================================================
// CREATE REMINDER LOGS FOR ALL PAID REGISTRATIONS
// ============================================================

const createReminderLogsForPaidRegistrations =
  async (webinarId) => {
    if (!webinarId) {
      throw new Error(
        "Webinar ID is required"
      );
    }

    const [registrations] =
      await db.query(
        `
        SELECT id
        FROM registrations
        WHERE webinar_id = ?
          AND payment_status = 'paid'
          AND registration_status = 'registered'
        ORDER BY id ASC
        `,
        [webinarId]
      );

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (
      const registration
      of registrations
    ) {
      try {
        const result =
          await createReminderLogsForRegistration(
            registration.id
          );

        created +=
          result.created || 0;

        skipped +=
          result.skippedPastWindows ||
          0;
      } catch (error) {
        failed++;

        console.error(
          `Failed creating reminders for registration ${registration.id}:`,
          error.message
        );
      }
    }

    return {
      success: true,
      webinarId,
      registrations:
        registrations.length,
      created,
      skipped,
      failed
    };
  };

// ============================================================
// RESCHEDULE PENDING REMINDERS FOR WEBINAR
//
// Called automatically when Admin changes
// webinar date/time.
//
// IMPORTANT:
// - Already SENT channels stay SENT.
// - Pending/failed/skipped channels are rescheduled.
// - If reminder window has already passed,
//   unsent channel becomes SKIPPED.
// - Already sent reminders are NEVER resent.
// ============================================================

const reschedulePendingRemindersForWebinar =
  async ({
    webinarId,
    webinarDate,
    webinarTime
  }) => {
    if (!webinarId) {
      throw new Error(
        "Webinar ID is required"
      );
    }

    if (
      !webinarDate ||
      !webinarTime
    ) {
      return {
        success: true,
        webinarId,
        updated: 0,
        skipped: 0,
        reason:
          "Webinar date/time is not configured"
      };
    }

    const reminderTimes =
      calculateReminderTimes({
        webinarDate,
        webinarTime
      });

    const [registrations] =
      await db.query(
        `
        SELECT
          id
        FROM registrations
        WHERE webinar_id = ?
          AND payment_status = 'paid'
          AND registration_status = 'registered'
        ORDER BY id ASC
        `,
        [webinarId]
      );

    const now = new Date();

    let created = 0;
    let updated = 0;
    let skipped = 0;

    const definitions = [
      {
        type:
          REMINDER_TYPES.REMINDER_24H,
        scheduledAt:
          reminderTimes.reminder24h
      },
      {
        type:
          REMINDER_TYPES.REMINDER_3H,
        scheduledAt:
          reminderTimes.reminder3h
      },
      {
        type:
          REMINDER_TYPES.REMINDER_30M,
        scheduledAt:
          reminderTimes.reminder30m
      }
    ];

    // ----------------------------------------------------------
    // Process every paid registration
    // ----------------------------------------------------------

    for (
      const registration
      of registrations
    ) {
      for (
        const definition
        of definitions
      ) {
        const existing =
          await ReminderLogModel.getByRegistrationAndType(
            registration.id,
            definition.type
          );

        // ------------------------------------------------------
        // If no reminder log exists, create it
        // ------------------------------------------------------

        if (!existing) {
          if (
            definition.scheduledAt <= now
          ) {
            skipped++;
            continue;
          }

          try {
            await ReminderLogModel.create({
              registrationId:
                registration.id,

              reminderType:
                definition.type,

              scheduledAt:
                formatMySQLDateTime(
                  definition.scheduledAt
                )
            });

            created++;
          } catch (error) {
            if (
              error.code ===
              "ER_DUP_ENTRY"
            ) {
              // Another process may have created it
              continue;
            }

            throw error;
          }

          continue;
        }

        // ------------------------------------------------------
        // If both channels already sent:
        // NEVER modify / resend
        // ------------------------------------------------------

        const emailSent =
          existing.email_status ===
          "sent";

        const whatsappSent =
          existing.whatsapp_status ===
          "sent";

        if (
          emailSent &&
          whatsappSent
        ) {
          continue;
        }

        // ------------------------------------------------------
        // Reschedule pending/unsent channels
        // ------------------------------------------------------

        const shouldSkip =
          definition.scheduledAt <= now;

        await ReminderLogModel.reschedulePendingReminder(
          {
            reminderId:
              existing.id,

            scheduledAt:
              formatMySQLDateTime(
                definition.scheduledAt
              ),

            skipIfWindowPassed:
              shouldSkip
          }
        );

        if (shouldSkip) {
          skipped++;
        } else {
          updated++;
        }
      }
    }

    return {
      success: true,
      webinarId,
      registrations:
        registrations.length,
      created,
      updated,
      skipped
    };
  };

// ============================================================
// GET DUE REMINDERS
// ============================================================

const getDueReminders =
  async () => {
    return ReminderLogModel.getDueReminders();
  };

// ============================================================
// GET UPCOMING REMINDERS
// ============================================================

const getUpcomingReminders =
  async (minutes = 60) => {
    return ReminderLogModel.getUpcomingReminders(
      minutes
    );
  };

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  TIMEZONE,

  REMINDER_TYPES,

  normalizeDateString,

  isValidDateString,

  parseTimeTo24Hour,

  isValidTimeString,

  createISTDate,

  formatMySQLDateTime,

  calculateReminderTimes,

  getReminderDateByType,

  createReminderLogsForRegistration,

  createReminderLogsForPaidRegistrations,

  reschedulePendingRemindersForWebinar,

  getDueReminders,

  getUpcomingReminders
};