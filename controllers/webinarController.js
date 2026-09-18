const WebinarModel = require("../models/webinarModel");
const ReminderService = require("../services/reminderService");

// ============================================================
// GET WEBINAR
// Public
// ============================================================
const getWebinar = async (req, res) => {
  try {
    const webinar = await WebinarModel.getWebinar();

    if (!webinar) {
      return res.status(404).json({
        success: false,
        message: "Webinar not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: webinar
    });
  } catch (error) {
    console.error("Get webinar error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch webinar"
    });
  }
};

// ============================================================
// GET WEBINAR BY ID
// Admin
// ============================================================
const getWebinarById = async (req, res) => {
  try {
    const webinarId = Number(req.params.id);

    if (!Number.isInteger(webinarId) || webinarId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid webinar ID"
      });
    }

    const webinar =
      await WebinarModel.getWebinarById(webinarId);

    if (!webinar) {
      return res.status(404).json({
        success: false,
        message: "Webinar not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: webinar
    });
  } catch (error) {
    console.error(
      "Get webinar by ID error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch webinar"
    });
  }
};

// ============================================================
// CREATE WEBINAR
// Admin
// ============================================================
const createWebinar = async (req, res) => {
  try {
    const {
      title,
      subtitle,
      date,
      time,
      duration,
      language,
      platform,
      price,
      zoomMeetingId,
      zoomJoinUrl,
      zoomStartUrl,
      zoomPassword
    } = req.body;

    const uploadedBackgroundImage = req.file
      ? `/uploads/${req.file.filename}`
      : null;

    // ----------------------------------------------------------
    // Title validation
    // ----------------------------------------------------------
    if (
      typeof title !== "string" ||
      !title.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Webinar title is required"
      });
    }

    // ----------------------------------------------------------
    // Price validation
    // ----------------------------------------------------------
    let normalizedPrice = 0;

    if (
      price !== undefined &&
      price !== null &&
      price !== ""
    ) {
      normalizedPrice = Number(price);

      if (
        !Number.isFinite(normalizedPrice) ||
        normalizedPrice < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Price must be a valid non-negative number"
        });
      }
    }

    // ----------------------------------------------------------
    // Date validation
    // ----------------------------------------------------------
    let normalizedDate = null;

    if (date !== undefined && date !== null && date !== "") {
      normalizedDate = String(date).trim();

      if (
        !ReminderService.isValidDateString(
          normalizedDate
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid webinar date. Use YYYY-MM-DD format."
        });
      }
    }

    // ----------------------------------------------------------
    // Time validation
    // ----------------------------------------------------------
    let normalizedTime = null;

    if (time !== undefined && time !== null && time !== "") {
      normalizedTime = String(time).trim();

      if (
        !ReminderService.isValidTimeString(
          normalizedTime
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid webinar time. Use HH:mm, HH:mm:ss, 12-hour time, or a valid time range."
        });
      }
    }

    // ----------------------------------------------------------
    // Optional fields
    // ----------------------------------------------------------
    const normalizedSubtitle =
      typeof subtitle === "string" &&
      subtitle.trim()
        ? subtitle.trim()
        : null;

    const normalizedDuration =
      typeof duration === "string" &&
      duration.trim()
        ? duration.trim()
        : null;

    const normalizedLanguage =
      typeof language === "string" &&
      language.trim()
        ? language.trim()
        : null;

    const normalizedPlatform =
      typeof platform === "string" &&
      platform.trim()
        ? platform.trim()
        : null;

    // ----------------------------------------------------------
    // Create webinar
    // ----------------------------------------------------------
    const webinarId =
      await WebinarModel.createWebinar({
        title: title.trim(),
        subtitle: normalizedSubtitle,
        date: normalizedDate,
        time: normalizedTime,
        duration: normalizedDuration,
        language: normalizedLanguage,
        platform: normalizedPlatform,
        price: normalizedPrice,
        backgroundImage: uploadedBackgroundImage
      });

    const webinar =
      await WebinarModel.getWebinarById(
        webinarId
      );

    return res.status(201).json({
      success: true,
      message: "Webinar created successfully",
      data: webinar
    });
  } catch (error) {
    console.error(
      "Create webinar error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create webinar"
    });
  }
};

// ============================================================
// UPDATE WEBINAR
// Admin
// ============================================================
const updateWebinar = async (req, res) => {
  try {
    const webinarId = Number(req.params.id);

    // ----------------------------------------------------------
    // Validate ID
    // ----------------------------------------------------------
    if (
      !Number.isInteger(webinarId) ||
      webinarId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid webinar ID"
      });
    }

    // ----------------------------------------------------------
    // Get existing webinar
    // ----------------------------------------------------------
    const existingWebinar =
      await WebinarModel.getWebinarById(
        webinarId
      );

    if (!existingWebinar) {
      return res.status(404).json({
        success: false,
        message: "Webinar not found"
      });
    }

    const {
      title,
      subtitle,
      date,
      time,
      duration,
      language,
      platform,
      price,
      zoomMeetingId,
      zoomJoinUrl,
      zoomStartUrl,
      zoomPassword
    } = req.body;

    const uploadedBackgroundImage = req.file
      ? `/uploads/${req.file.filename}`
      : undefined;

    // ----------------------------------------------------------
    // Title validation
    // ----------------------------------------------------------
    if (
      typeof title !== "string" ||
      !title.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Webinar title is required"
      });
    }

    // ----------------------------------------------------------
    // Price validation
    // ----------------------------------------------------------
    let normalizedPrice;

    if (
      price === undefined ||
      price === null ||
      price === ""
    ) {
      normalizedPrice = Number(
        existingWebinar.price || 0
      );
    } else {
      normalizedPrice = Number(price);

      if (
        !Number.isFinite(normalizedPrice) ||
        normalizedPrice < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Price must be a valid non-negative number"
        });
      }
    }

    // ----------------------------------------------------------
    // Normalize date
    // ----------------------------------------------------------
    let normalizedDate;

    if (
      date === undefined
    ) {
      normalizedDate =
        existingWebinar.date;
    } else if (
      date === null ||
      date === ""
    ) {
      normalizedDate = null;
    } else {
      normalizedDate = String(date).trim();

      if (
        !ReminderService.isValidDateString(
          normalizedDate
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid webinar date. Use YYYY-MM-DD format."
        });
      }
    }

    // ----------------------------------------------------------
    // Normalize time
    // ----------------------------------------------------------
    let normalizedTime;

    if (
      time === undefined
    ) {
      normalizedTime =
        existingWebinar.time;
    } else if (
      time === null ||
      time === ""
    ) {
      normalizedTime = null;
    } else {
      normalizedTime = String(time).trim();

      if (
        !ReminderService.isValidTimeString(
          normalizedTime
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid webinar time. Use HH:mm, HH:mm:ss, 12-hour time, or a valid time range."
        });
      }
    }

    // ----------------------------------------------------------
    // Optional fields
    // ----------------------------------------------------------
    const normalizedSubtitle =
      subtitle === undefined
        ? existingWebinar.subtitle
        : subtitle === null ||
          subtitle === ""
        ? null
        : String(subtitle).trim();

    const normalizedDuration =
      duration === undefined
        ? existingWebinar.duration
        : duration === null ||
          duration === ""
        ? null
        : String(duration).trim();

    const normalizedLanguage =
      language === undefined
        ? existingWebinar.language
        : language === null ||
          language === ""
        ? null
        : String(language).trim();

    const normalizedPlatform =
      platform === undefined
        ? existingWebinar.platform
        : platform === null ||
          platform === ""
        ? null
        : String(platform).trim();

    const normalizedZoomMeetingId =
      zoomMeetingId === undefined
        ? existingWebinar.zoom_meeting_id
        : zoomMeetingId === null || zoomMeetingId === ''
        ? null
        : String(zoomMeetingId).trim();

    const normalizedZoomJoinUrl =
      zoomJoinUrl === undefined
        ? existingWebinar.zoom_join_url
        : zoomJoinUrl === null || zoomJoinUrl === ''
        ? null
        : String(zoomJoinUrl).trim();

    const normalizedZoomStartUrl =
      zoomStartUrl === undefined
        ? existingWebinar.zoom_start_url
        : zoomStartUrl === null || zoomStartUrl === ''
        ? null
        : String(zoomStartUrl).trim();

    const normalizedZoomPassword =
      zoomPassword === undefined
        ? existingWebinar.zoom_password
        : zoomPassword === null || zoomPassword === ''
        ? null
        : String(zoomPassword).trim();

    // ----------------------------------------------------------
    // Detect schedule change
    // ----------------------------------------------------------
    const oldDate =
      existingWebinar.date
        ? String(existingWebinar.date).slice(
            0,
            10
          )
        : null;

    const oldTime =
      existingWebinar.time
        ? String(existingWebinar.time).trim()
        : null;

    const scheduleChanged =
      oldDate !== normalizedDate ||
      oldTime !== normalizedTime;

    // ----------------------------------------------------------
    // Update webinar
    // ----------------------------------------------------------
    const finalBackgroundImage =
      uploadedBackgroundImage !== undefined
        ? uploadedBackgroundImage
        : existingWebinar.background_image || null;

    await WebinarModel.updateWebinar(
      webinarId,
      {
        title: title.trim(),
        subtitle: normalizedSubtitle,
        date: normalizedDate,
        time: normalizedTime,
        duration: normalizedDuration,
        language: normalizedLanguage,
        platform: normalizedPlatform,
        price: normalizedPrice,
        backgroundImage: finalBackgroundImage,
        zoomMeetingId: normalizedZoomMeetingId,
        zoomJoinUrl: normalizedZoomJoinUrl,
        zoomStartUrl: normalizedZoomStartUrl,
        zoomPassword: normalizedZoomPassword
      }
    );

    // ----------------------------------------------------------
    // Get updated webinar
    // ----------------------------------------------------------
    const updatedWebinar =
      await WebinarModel.getWebinarById(
        webinarId
      );

    // ----------------------------------------------------------
    // Reschedule pending reminders
    //
    // IMPORTANT:
    // Only schedule-related changes trigger this.
    // Price/title/etc. changes do not reschedule reminders.
    // ----------------------------------------------------------
    let reminderResult = null;

    if (
      scheduleChanged &&
      updatedWebinar
    ) {
      reminderResult =
        await ReminderService.reschedulePendingRemindersForWebinar(
          {
            webinarId:
              updatedWebinar.id,
            webinarDate:
              updatedWebinar.date,
            webinarTime:
              updatedWebinar.time
          }
        );
    }

    return res.status(200).json({
      success: true,
      message:
        "Webinar updated successfully",
      data: updatedWebinar,
      reminders: reminderResult
    });
  } catch (error) {
    console.error(
      "Update webinar error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update webinar",
      error:
        process.env.NODE_ENV ===
        "development"
          ? error.message
          : undefined
    });
  }
};

// ============================================================
// DELETE WEBINAR
// Admin
// ============================================================
const deleteWebinar = async (req, res) => {
  try {
    const webinarId = Number(req.params.id);

    if (
      !Number.isInteger(webinarId) ||
      webinarId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid webinar ID"
      });
    }

    const webinar =
      await WebinarModel.getWebinarById(
        webinarId
      );

    if (!webinar) {
      return res.status(404).json({
        success: false,
        message: "Webinar not found"
      });
    }

    const result =
      await WebinarModel.deleteWebinar(
        webinarId
      );

    return res.status(200).json({
      success: true,
      message:
        "Webinar deleted successfully",
      data: result
    });
  } catch (error) {
    console.error(
      "Delete webinar error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to delete webinar"
    });
  }
};

// ============================================================
// CREATE ZOOM MEETING
// Admin
// ============================================================
const createZoomMeeting = async (req, res) => {
  try {
    const webinarId = Number(req.params.id);

    if (
      !Number.isInteger(webinarId) ||
      webinarId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid webinar ID"
      });
    }

    const result =
      await WebinarModel.createZoomMeeting(
        webinarId
      );

    return res.status(200).json({
      success: true,
      message: result.alreadyExists
        ? "Zoom meeting already exists"
        : "Zoom meeting created successfully",
      data: result
    });
  } catch (error) {
    console.error(
      "Create Zoom meeting error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to create Zoom meeting"
    });
  }
};

// ============================================================
// GET ZOOM MEETING
// Admin
// ============================================================
const getZoomMeeting = async (req, res) => {
  try {
    const webinarId = Number(req.params.id);

    if (
      !Number.isInteger(webinarId) ||
      webinarId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid webinar ID"
      });
    }

    const result =
      await WebinarModel.getZoomMeeting(
        webinarId
      );

    if (!result) {
      return res.status(404).json({
        success: false,
        message:
          "Zoom meeting not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error(
      "Get Zoom meeting error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch Zoom meeting"
    });
  }
};

// ============================================================
// DELETE ZOOM MEETING
// Admin
// ============================================================
const deleteZoomMeeting = async (req, res) => {
  try {
    const webinarId = Number(req.params.id);

    if (
      !Number.isInteger(webinarId) ||
      webinarId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid webinar ID"
      });
    }

    const result =
      await WebinarModel.deleteZoomMeeting(
        webinarId
      );

    return res.status(200).json({
      success: true,
      message:
        "Zoom meeting deleted successfully",
      data: result
    });
  } catch (error) {
    console.error(
      "Delete Zoom meeting error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to delete Zoom meeting"
    });
  }
};

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  getWebinar,
  getWebinarById,
  createWebinar,
  updateWebinar,
  deleteWebinar,
  createZoomMeeting,
  getZoomMeeting,
  deleteZoomMeeting
};