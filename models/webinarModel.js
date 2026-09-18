const db = require("../config/db");
const zoomService = require("../services/zoomService");

const WebinarModel = {
  // ============================================================
  // GET LATEST WEBINAR
  // ============================================================
  getWebinar: async () => {
    const [rows] = await db.query(
      `
      SELECT *
      FROM webinars
      ORDER BY id DESC
      LIMIT 1
      `
    );

    return rows[0] || null;
  },

  // ============================================================
  // GET WEBINAR BY ID
  // ============================================================
  getWebinarById: async (id) => {
    const [rows] = await db.query(
      `
      SELECT *
      FROM webinars
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

    return rows[0] || null;
  },

  // ============================================================
  // CREATE WEBINAR
  // ============================================================
  createWebinar: async ({
    title,
    subtitle = null,
    date = null,
    time = null,
    duration = null,
    language = null,
    platform = null,
    price = 0,
    backgroundImage = null,
    zoomMeetingId = null,
    zoomJoinUrl = null,
    zoomStartUrl = null,
    zoomPassword = null
  }) => {
    const [result] = await db.query(
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
        price,
        background_image,
        zoom_meeting_id,
        zoom_join_url,
        zoom_start_url,
        zoom_password
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        title,
        subtitle,
        date,
        time,
        duration,
        language,
        platform,
        price,
        backgroundImage,
        zoomMeetingId,
        zoomJoinUrl,
        zoomStartUrl,
        zoomPassword
      ]
    );

    return result.insertId;
  },

  // ============================================================
  // UPDATE WEBINAR
  // ============================================================
  updateWebinar: async (
    id,
    {
      title,
      subtitle,
      date,
      time,
      duration,
      language,
      platform,
      price,
      backgroundImage = null,
      zoomMeetingId = null,
      zoomJoinUrl = null,
      zoomStartUrl = null,
      zoomPassword = null
    }
  ) => {
    const normalizedSubtitle =
      subtitle === undefined || subtitle === ""
        ? null
        : subtitle;

    const normalizedDate =
      date === undefined || date === ""
        ? null
        : date;

    const normalizedTime =
      time === undefined || time === ""
        ? null
        : time;

    const normalizedDuration =
      duration === undefined || duration === ""
        ? null
        : duration;

    const normalizedLanguage =
      language === undefined || language === ""
        ? null
        : language;

    const normalizedPlatform =
      platform === undefined || platform === ""
        ? null
        : platform;

    const [result] = await db.query(
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
        price = ?,
        background_image = ?,
        zoom_meeting_id = ?,
        zoom_join_url = ?,
        zoom_start_url = ?,
        zoom_password = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [
        title,
        normalizedSubtitle,
        normalizedDate,
        normalizedTime,
        normalizedDuration,
        normalizedLanguage,
        normalizedPlatform,
        price,
        backgroundImage,
        zoomMeetingId,
        zoomJoinUrl,
        zoomStartUrl,
        zoomPassword,
        id
      ]
    );

    return result;
  },

  // ============================================================
  // DELETE WEBINAR
  // ============================================================
  deleteWebinar: async (id) => {
    const webinar = await WebinarModel.getWebinarById(id);

    if (!webinar) {
      return {
        affectedRows: 0,
        meetingId: null
      };
    }

    const originalMeetingId = webinar.zoom_meeting_id || null;

    // Delete Zoom meeting if available
    if (originalMeetingId) {
      try {
        await zoomService.deleteMeeting(originalMeetingId);
      } catch (error) {
        console.error(
          "Zoom meeting deletion failed:",
          error.message
        );
      }
    }

    const [result] = await db.query(
      `
      DELETE FROM webinars
      WHERE id = ?
      `,
      [id]
    );

    return {
      affectedRows: result.affectedRows,
      meetingId: originalMeetingId
    };
  },

  // ============================================================
  // CREATE ZOOM MEETING
  // ============================================================
  createZoomMeeting: async (webinarId) => {
    const webinar = await WebinarModel.getWebinarById(webinarId);

    if (!webinar) {
      throw new Error("Webinar not found");
    }

    if (webinar.zoom_meeting_id) {
      return {
        alreadyExists: true,
        meetingId: webinar.zoom_meeting_id,
        joinUrl: webinar.zoom_join_url,
        startUrl: webinar.zoom_start_url
      };
    }

    if (!webinar.date) {
      throw new Error(
        "Webinar date is required before creating Zoom meeting"
      );
    }

    if (!webinar.time) {
      throw new Error(
        "Webinar time is required before creating Zoom meeting"
      );
    }

    // ------------------------------------------------------------
    // Normalize webinar date
    // ------------------------------------------------------------
    let webinarDate = webinar.date;

    if (webinarDate instanceof Date) {
      webinarDate = webinarDate.toISOString().slice(0, 10);
    } else {
      webinarDate = String(webinarDate).slice(0, 10);
    }

    // ------------------------------------------------------------
    // Normalize webinar time
    //
    // Supported:
    // 08:10
    // 08:10:00
    // 08:10PM
    // 08:10 PM
    // 08:10PM-10:00PM
    // 08:10 PM - 10:00 PM
    //
    // For time range, Zoom uses the START time.
    // ------------------------------------------------------------
    let webinarTime = String(webinar.time).trim();

    if (webinarTime.includes("-")) {
      webinarTime = webinarTime.split("-")[0].trim();
    }

    let startTime = webinarTime;

    // ------------------------------------------------------------
    // 24-hour format HH:mm
    // ------------------------------------------------------------
    const twentyFourHourMatch = startTime.match(
      /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/
    );

    if (twentyFourHourMatch) {
      startTime = `${twentyFourHourMatch[1]}:${twentyFourHourMatch[2]}:${twentyFourHourMatch[3] || "00"}`;
    } else {
      // ----------------------------------------------------------
      // 12-hour format
      // ----------------------------------------------------------
      const twelveHourMatch = startTime.match(
        /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
      );

      if (twelveHourMatch) {
        let hour = parseInt(
          twelveHourMatch[1],
          10
        );

        const minute = twelveHourMatch[2];
        const period = twelveHourMatch[3].toUpperCase();

        if (hour < 1 || hour > 12) {
          throw new Error(
            `Invalid webinar time: ${webinar.time}`
          );
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

        startTime = `${String(hour).padStart(2, "0")}:${minute}:00`;
      } else {
        throw new Error(
          `Invalid webinar time format: ${webinar.time}`
        );
      }
    }

    // ------------------------------------------------------------
    // Calculate duration
    // ------------------------------------------------------------
    let durationMinutes = 120;

    if (webinar.duration) {
      const durationText = String(
        webinar.duration
      ).toLowerCase();

      const hourMatch = durationText.match(
        /(\d+(?:\.\d+)?)\s*hour/
      );

      const minuteMatch = durationText.match(
        /(\d+)\s*minute/
      );

      if (hourMatch) {
        durationMinutes =
          Number(hourMatch[1]) * 60;
      }

      if (minuteMatch) {
        durationMinutes =
          Number(minuteMatch[1]);
      }

      // Examples:
      // "2 Hours"
      // "2 Hours / Day"
      // "120 Minutes"
      //
      // If duration is only numeric:
      if (
        !hourMatch &&
        !minuteMatch &&
        !Number.isNaN(Number(webinar.duration))
      ) {
        durationMinutes =
          Number(webinar.duration);
      }
    }

    // ------------------------------------------------------------
    // Create Zoom meeting
    // ------------------------------------------------------------
    const zoomMeeting =
      await zoomService.createMeeting({
        topic: webinar.title,
        date: webinarDate,
        time: startTime,
        duration: durationMinutes,
        timezone: "Asia/Kolkata"
      });

    if (!zoomMeeting) {
      throw new Error(
        "Zoom meeting creation failed"
      );
    }

    const meetingId =
      zoomMeeting.id ||
      zoomMeeting.meetingId ||
      null;

    const joinUrl =
      zoomMeeting.join_url ||
      zoomMeeting.joinUrl ||
      null;

    const startUrl =
      zoomMeeting.start_url ||
      zoomMeeting.startUrl ||
      null;

    // ------------------------------------------------------------
    // Save Zoom information
    // ------------------------------------------------------------
    await db.query(
      `
      UPDATE webinars
      SET
        zoom_meeting_id = ?,
        zoom_join_url = ?,
        zoom_start_url = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [
        meetingId,
        joinUrl,
        startUrl,
        webinarId
      ]
    );

    return {
      alreadyExists: false,
      meetingId,
      joinUrl,
      startUrl
    };
  },

  // ============================================================
  // GET ZOOM MEETING
  // ============================================================
  getZoomMeeting: async (webinarId) => {
    const webinar =
      await WebinarModel.getWebinarById(
        webinarId
      );

    if (!webinar) {
      throw new Error("Webinar not found");
    }

    if (!webinar.zoom_meeting_id) {
      return null;
    }

    try {
      const meeting =
        await zoomService.getMeeting(
          webinar.zoom_meeting_id
        );

      return meeting;
    } catch (error) {
      console.error(
        "Failed to get Zoom meeting:",
        error.message
      );

      return {
        id: webinar.zoom_meeting_id,
        join_url: webinar.zoom_join_url,
        start_url: webinar.zoom_start_url
      };
    }
  },

  // ============================================================
  // DELETE ZOOM MEETING
  // ============================================================
  deleteZoomMeeting: async (webinarId) => {
    const webinar =
      await WebinarModel.getWebinarById(
        webinarId
      );

    if (!webinar) {
      throw new Error("Webinar not found");
    }

    const meetingId =
      webinar.zoom_meeting_id;

    if (!meetingId) {
      return {
        success: true,
        message: "No Zoom meeting exists"
      };
    }

    await zoomService.deleteMeeting(
      meetingId
    );

    await db.query(
      `
      UPDATE webinars
      SET
        zoom_meeting_id = NULL,
        zoom_join_url = NULL,
        zoom_start_url = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [webinarId]
    );

    return {
      success: true,
      meetingId
    };
  }
};

module.exports = WebinarModel;