import express from "express";
import { body, validationResult } from "express-validator";
import User from "../models/User";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();

// Get user notifications
router.get("/", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user.notifications);
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Mark notification as read
router.put("/:id/read", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const notification = user.notifications.id(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    notification.read = true;
    await user.save();

    res.json(notification);
  } catch (error) {
    console.error("Mark notification as read error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Mark all notifications as read
router.put("/read-all", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.notifications.forEach((notification) => {
      notification.read = true;
    });

    await user.save();

    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Mark all notifications as read error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete notification
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const notification = user.notifications.id(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    notification.remove();
    await user.save();

    res.json({ message: "Notification deleted" });
  } catch (error) {
    console.error("Delete notification error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Clear all notifications
router.delete("/", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.notifications = [];
    await user.save();

    res.json({ message: "All notifications cleared" });
  } catch (error) {
    console.error("Clear notifications error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update notification preferences
router.put(
  "/preferences",
  authenticateToken,
  [
    body("priceAlerts").optional().isBoolean(),
    body("dealAlerts").optional().isBoolean(),
    body("negotiationUpdates").optional().isBoolean(),
    body("emailNotifications").optional().isBoolean(),
    body("pushNotifications").optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update notification preferences
      if (req.body.priceAlerts !== undefined) {
        user.preferences.priceAlerts = req.body.priceAlerts;
      }
      if (req.body.dealAlerts !== undefined) {
        user.preferences.dealAlerts = req.body.dealAlerts;
      }
      if (req.body.negotiationUpdates !== undefined) {
        user.preferences.negotiationUpdates = req.body.negotiationUpdates;
      }
      if (req.body.emailNotifications !== undefined) {
        user.preferences.emailNotifications = req.body.emailNotifications;
      }
      if (req.body.pushNotifications !== undefined) {
        user.preferences.pushNotifications = req.body.pushNotifications;
      }

      await user.save();

      res.json(user.preferences);
    } catch (error) {
      console.error("Update notification preferences error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

export default router;
