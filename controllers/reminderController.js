const ReminderLogModel =
  require('../models/reminderLogModel');


// ======================================================
// REMINDER CONTROLLER
// ======================================================


// ======================================================
// HELPER: SAFE NUMBER
// ======================================================

const toSafeNumber = (
  value,
  defaultValue = 0
) => {

  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return defaultValue;
  }

  return number;
};


// ======================================================
// HELPER: NORMALIZE STATS
// ======================================================

const normalizeStats = (
  stats
) => {

  const data =
    stats || {};

  return {
    total:
      toSafeNumber(data.total),

    reminder_24h:
      toSafeNumber(data.reminder_24h),

    reminder_3h:
      toSafeNumber(data.reminder_3h),

    reminder_30m:
      toSafeNumber(data.reminder_30m),

    email_sent:
      toSafeNumber(data.email_sent),

    email_failed:
      toSafeNumber(data.email_failed),

    email_pending:
      toSafeNumber(data.email_pending),

    whatsapp_sent:
      toSafeNumber(data.whatsapp_sent),

    whatsapp_failed:
      toSafeNumber(data.whatsapp_failed),

    whatsapp_pending:
      toSafeNumber(data.whatsapp_pending),

    completed:
      toSafeNumber(data.completed),

    failed:
      toSafeNumber(data.failed),

    pending:
      toSafeNumber(data.pending)
  };
};


// ======================================================
// GET ALL REMINDER LOGS
// ======================================================
//
// GET /api/reminders
//
// Query parameters:
//
// ?page=1
// ?limit=20
// ?reminderType=reminder_24h
// ?emailStatus=sent
// ?whatsappStatus=pending
// ?paymentStatus=paid
// ?search=vaishnavi
//
// ======================================================

const getAllReminders =
  async (
    req,
    res
  ) => {

    try {

      const page =
        Math.max(
          1,
          parseInt(
            req.query.page,
            10
          ) || 1
        );

      const limit =
        Math.max(
          1,
          Math.min(
            parseInt(
              req.query.limit,
              10
            ) || 20,
            100
          )
        );

      const offset =
        (page - 1) * limit;


      const reminderType =
        req.query.reminderType ||
        null;

      const emailStatus =
        req.query.emailStatus ||
        null;

      const whatsappStatus =
        req.query.whatsappStatus ||
        null;

      const paymentStatus =
        req.query.paymentStatus ||
        null;

      const search =
        req.query.search
          ? String(
              req.query.search
            ).trim()
          : null;


      const [
        reminders,
        total
      ] = await Promise.all([

        ReminderLogModel.getAll({
          limit,
          offset,
          reminderType,
          emailStatus,
          whatsappStatus,
          paymentStatus,
          search
        }),

        ReminderLogModel.getCount({
          reminderType,
          emailStatus,
          whatsappStatus,
          paymentStatus,
          search
        })

      ]);


      const totalPages =
        Math.ceil(
          total / limit
        );


      return res.status(200).json({

        success: true,

        message:
          'Reminder logs fetched successfully',

        data: reminders,

        pagination: {
          page,
          limit,
          offset,
          total,
          totalPages,
          hasNextPage:
            page < totalPages,
          hasPreviousPage:
            page > 1
        }

      });

    } catch (error) {

      console.error(
        'Get all reminders error:',
        error
      );

      return res.status(500).json({

        success: false,

        message:
          'Failed to fetch reminder logs',

        error:
          process.env.NODE_ENV ===
          'production'
            ? undefined
            : error.message

      });
    }
  };


// ======================================================
// GET REMINDER BY ID
// ======================================================
//
// GET /api/reminders/:id
//
// ======================================================

const getReminderById =
  async (
    req,
    res
  ) => {

    try {

      const reminderId =
        parseInt(
          req.params.id,
          10
        );


      if (
        !Number.isInteger(
          reminderId
        ) ||
        reminderId <= 0
      ) {

        return res.status(400).json({

          success: false,

          message:
            'Invalid reminder ID'

        });
      }


      const reminder =
        await ReminderLogModel.getById(
          reminderId
        );


      if (!reminder) {

        return res.status(404).json({

          success: false,

          message:
            'Reminder log not found'

        });
      }


      return res.status(200).json({

        success: true,

        message:
          'Reminder log fetched successfully',

        data:
          reminder

      });

    } catch (error) {

      console.error(
        'Get reminder by ID error:',
        error
      );

      return res.status(500).json({

        success: false,

        message:
          'Failed to fetch reminder log',

        error:
          process.env.NODE_ENV ===
          'production'
            ? undefined
            : error.message

      });
    }
  };


// ======================================================
// GET REMINDER STATISTICS
// ======================================================
//
// GET /api/reminders/stats
//
// ======================================================

const getReminderStats =
  async (
    req,
    res
  ) => {

    try {

      const stats =
        await ReminderLogModel.getStats();


      const normalizedStats =
        normalizeStats(
          stats
        );


      return res.status(200).json({

        success: true,

        message:
          'Reminder statistics fetched successfully',

        data:
          normalizedStats

      });

    } catch (error) {

      console.error(
        'Get reminder stats error:',
        error
      );

      return res.status(500).json({

        success: false,

        message:
          'Failed to fetch reminder statistics',

        error:
          process.env.NODE_ENV ===
          'production'
            ? undefined
            : error.message

      });
    }
  };


// ======================================================
// GET PENDING REMINDERS
// ======================================================
//
// GET /api/reminders/pending
//
// Query:
// ?limit=20
//
// ======================================================

const getPendingReminders =
  async (
    req,
    res
  ) => {

    try {

      const limit =
        Math.max(
          1,
          Math.min(
            parseInt(
              req.query.limit,
              10
            ) || 20,
            100
          )
        );


      const reminders =
        await ReminderLogModel
          .getPendingReminders({
            limit
          });


      return res.status(200).json({

        success: true,

        message:
          'Pending reminders fetched successfully',

        data:
          reminders,

        count:
          reminders.length

      });

    } catch (error) {

      console.error(
        'Get pending reminders error:',
        error
      );

      return res.status(500).json({

        success: false,

        message:
          'Failed to fetch pending reminders',

        error:
          process.env.NODE_ENV ===
          'production'
            ? undefined
            : error.message

      });
    }
  };


// ======================================================
// GET UPCOMING REMINDERS
// ======================================================
//
// GET /api/reminders/upcoming
//
// Query:
//
// ?minutes=60
// ?limit=100
//
// ======================================================

const getUpcomingReminders =
  async (
    req,
    res
  ) => {

    try {

      const minutes =
        Math.max(
          1,
          Math.min(
            parseInt(
              req.query.minutes,
              10
            ) || 60,
            1440
          )
        );


      const limit =
        Math.max(
          1,
          Math.min(
            parseInt(
              req.query.limit,
              10
            ) || 100,
            500
          )
        );


      const reminders =
        await ReminderLogModel
          .getUpcomingReminders({
            minutes,
            limit
          });


      return res.status(200).json({

        success: true,

        message:
          'Upcoming reminders fetched successfully',

        data:
          reminders,

        count:
          reminders.length,

        window: {
          minutes,
          limit
        }

      });

    } catch (error) {

      console.error(
        'Get upcoming reminders error:',
        error
      );

      return res.status(500).json({

        success: false,

        message:
          'Failed to fetch upcoming reminders',

        error:
          process.env.NODE_ENV ===
          'production'
            ? undefined
            : error.message

      });
    }
  };


// ======================================================
// DELETE REMINDER LOG
// ======================================================
//
// DELETE /api/reminders/:id
//
// NOTE:
// Route authentication will be added later.
//
// ======================================================

const deleteReminder =
  async (
    req,
    res
  ) => {

    try {

      const reminderId =
        parseInt(
          req.params.id,
          10
        );


      if (
        !Number.isInteger(
          reminderId
        ) ||
        reminderId <= 0
      ) {

        return res.status(400).json({

          success: false,

          message:
            'Invalid reminder ID'

        });
      }


      const reminder =
        await ReminderLogModel.getById(
          reminderId
        );


      if (!reminder) {

        return res.status(404).json({

          success: false,

          message:
            'Reminder log not found'

        });
      }


      const deleted =
        await ReminderLogModel
          .deleteById(
            reminderId
          );


      if (!deleted) {

        return res.status(500).json({

          success: false,

          message:
            'Failed to delete reminder log'

        });
      }


      return res.status(200).json({

        success: true,

        message:
          'Reminder log deleted successfully',

        data: {
          id:
            reminderId
        }

      });

    } catch (error) {

      console.error(
        'Delete reminder error:',
        error
      );

      return res.status(500).json({

        success: false,

        message:
          'Failed to delete reminder log',

        error:
          process.env.NODE_ENV ===
          'production'
            ? undefined
            : error.message

      });
    }
  };


// ======================================================
// EXPORT CONTROLLER
// ======================================================

module.exports = {

  getAllReminders,

  getReminderById,

  getReminderStats,

  getPendingReminders,

  getUpcomingReminders,

  deleteReminder

};