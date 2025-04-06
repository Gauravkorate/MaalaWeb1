import express from "express";
import { body, validationResult } from "express-validator";
import User from "../models/User";
import { authenticateToken } from "../middleware/auth";
import rateLimit from "express-rate-limit";
import { sanitize } from "express-mongo-sanitize";
import helmet from "helmet";
import { check } from "express-validator";
import crypto from "crypto";

const router = express.Router();

// Rate limiting for sensitive operations
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs
  message: "Too many attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for regular operations
const regularLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  sanitize(req.body);
  sanitize(req.query);
  sanitize(req.params);
  next();
};

// Enhanced security middleware
const securityMiddleware = [
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  }),
  helmet.hsts({
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  }),
  helmet.frameguard({ action: "deny" }),
  helmet.xssFilter(),
  helmet.noSniff(),
];

// Get user profile
router.get(
  "/profile",
  authenticateToken,
  regularLimiter,
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  }),
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId)
        .select("-password -__v -updatedAt")
        .lean();

      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      // Calculate user activity stats
      const stats = {
        totalSearches: user.searchHistory.length,
        totalFavorites: user.favorites.length,
        totalNegotiations: user.negotiationHistory.length,
        successfulNegotiations: user.negotiationHistory.filter(
          (n) => n.status === "success"
        ).length,
        totalSavedSearches: user.savedSearches.length,
        lastActive: user.updatedAt,
      };

      // Add helpful tips based on user activity
      const tips = [];
      if (user.negotiationHistory.length < 5) {
        tips.push({
          type: "negotiation",
          message: "Try negotiating on more products to improve your skills",
          priority: "low",
        });
      }
      if (user.favorites.length > 20) {
        tips.push({
          type: "favorites",
          message: "Consider organizing your favorites into categories",
          priority: "medium",
        });
      }

      res.json({
        ...user,
        stats,
        tips,
        _links: {
          self: `/api/users/profile`,
          preferences: `/api/users/preferences`,
          activity: `/api/users/activity-feed`,
        },
      });
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json({
        message: "An error occurred while fetching your profile",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Update user profile
router.put(
  "/profile",
  authenticateToken,
  sensitiveLimiter,
  sanitizeInput,
  [
    body("name")
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage("Name must be between 2 and 50 characters")
      .matches(/^[a-zA-Z\s]*$/)
      .withMessage("Name can only contain letters and spaces"),
    body("avatar")
      .optional()
      .isURL()
      .withMessage("Avatar must be a valid URL")
      .matches(/\.(jpg|jpeg|png|gif)$/i)
      .withMessage("Avatar must be an image URL"),
    body("language")
      .optional()
      .isIn(["en", "es", "fr", "zh", "ja"])
      .withMessage("Invalid language selection"),
    body("currency")
      .optional()
      .isIn(["USD", "EUR", "GBP", "JPY", "CNY"])
      .withMessage("Invalid currency selection"),
    body("timezone")
      .optional()
      .matches(/^[A-Za-z]+\/[A-Za-z_]+$/)
      .withMessage("Invalid timezone format"),
    body("socialLinks")
      .optional()
      .isObject()
      .custom((value) => {
        const validPlatforms = ["twitter", "facebook", "linkedin", "instagram"];
        return Object.keys(value).every((key) => validPlatforms.includes(key));
      })
      .withMessage("Invalid social media platform"),
    body("bio")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Bio must not exceed 500 characters")
      .escape(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation failed",
          errors: errors.array(),
          code: "VALIDATION_ERROR",
          suggestion: "Please check your input and try again",
        });
      }

      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      // Update profile fields with validation
      const updates = {};
      if (req.body.name) updates.name = req.body.name;
      if (req.body.avatar) updates.avatar = req.body.avatar;
      if (req.body.language)
        updates["preferences.language"] = req.body.language;
      if (req.body.currency)
        updates["preferences.currency"] = req.body.currency;
      if (req.body.timezone)
        updates["preferences.timezone"] = req.body.timezone;
      if (req.body.socialLinks) updates.socialLinks = req.body.socialLinks;
      if (req.body.bio) updates.bio = req.body.bio;

      // Use findOneAndUpdate for atomic updates
      const updatedUser = await User.findOneAndUpdate(
        { _id: req.user.userId },
        { $set: updates },
        { new: true, runValidators: true }
      ).select("-password -__v");

      res.json({
        message: "Profile updated successfully",
        user: updatedUser,
        _links: {
          self: `/api/users/profile`,
          preferences: `/api/users/preferences`,
        },
      });
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({
        message: "An error occurred while updating your profile",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Get user search history
router.get(
  "/search-history",
  authenticateToken,
  regularLimiter,
  sanitizeInput,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "timestamp",
        sortOrder = "desc",
        query,
      } = req.query;

      // Validate query parameters
      if (isNaN(Number(page)) || isNaN(Number(limit))) {
        return res.status(400).json({
          message: "Invalid pagination parameters",
          code: "INVALID_PARAMETERS",
          suggestion: "Please provide valid page and limit values",
        });
      }

      const user = await User.findById(req.user.userId).select("searchHistory");
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      // Filter search history if query is provided
      let filteredHistory = user.searchHistory;
      if (query) {
        filteredHistory = filteredHistory.filter((history) =>
          history.query.toLowerCase().includes(query.toLowerCase())
        );
      }

      // Sort search history
      const sortedHistory = filteredHistory.sort((a, b) => {
        if (sortOrder === "asc") {
          return a[sortBy] - b[sortBy];
        }
        return b[sortBy] - a[sortBy];
      });

      // Paginate results
      const startIndex = (Number(page) - 1) * Number(limit);
      const endIndex = startIndex + Number(limit);
      const paginatedHistory = sortedHistory.slice(startIndex, endIndex);

      // Set cache headers
      res.set("Cache-Control", "private, max-age=300"); // 5 minutes cache

      res.json({
        history: paginatedHistory,
        pagination: {
          total: filteredHistory.length,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(filteredHistory.length / Number(limit)),
        },
        _links: {
          self: `/api/users/search-history?page=${page}&limit=${limit}`,
          next:
            endIndex < filteredHistory.length
              ? `/api/users/search-history?page=${
                  Number(page) + 1
                }&limit=${limit}`
              : null,
          prev:
            startIndex > 0
              ? `/api/users/search-history?page=${
                  Number(page) - 1
                }&limit=${limit}`
              : null,
        },
      });
    } catch (error) {
      console.error("Get search history error:", error);
      res.status(500).json({
        message: "An error occurred while fetching your search history",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Clear search history
router.delete("/search-history", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.searchHistory = [];
    await user.save();

    res.json({ message: "Search history cleared" });
  } catch (error) {
    console.error("Clear search history error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get user preferences
router.get(
  "/preferences",
  authenticateToken,
  ...securityMiddleware,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId).select("preferences");
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      res.json({
        language: user.preferences?.language || "en",
        currency: user.preferences?.currency || "USD",
        timezone: user.preferences?.timezone || "UTC",
        theme: user.preferences?.theme || "light",
        notifications: {
          email: user.preferences?.notifications?.email || true,
          push: user.preferences?.notifications?.push || true,
          priceAlerts: user.preferences?.notifications?.priceAlerts || true,
          dealAlerts: user.preferences?.notifications?.dealAlerts || true,
          negotiationUpdates:
            user.preferences?.notifications?.negotiationUpdates || true,
        },
        _links: {
          self: "/api/users/preferences",
          update: "/api/users/preferences",
        },
      });
    } catch (error) {
      console.error("Get preferences error:", error);
      res.status(500).json({
        message: "An error occurred while fetching preferences",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Update user preferences
router.put(
  "/preferences",
  authenticateToken,
  regularLimiter,
  ...securityMiddleware,
  [
    body("language").optional().isIn(["en", "es", "fr", "zh", "ja"]),
    body("currency").optional().isIn(["USD", "EUR", "GBP", "JPY", "CNY"]),
    body("timezone").optional().isString(),
    body("theme").optional().isIn(["light", "dark", "system"]),
    body("notifications.email").optional().isBoolean(),
    body("notifications.push").optional().isBoolean(),
    body("notifications.priceAlerts").optional().isBoolean(),
    body("notifications.dealAlerts").optional().isBoolean(),
    body("notifications.negotiationUpdates").optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation failed",
          errors: errors.array(),
          code: "VALIDATION_ERROR",
          suggestion: "Please check your input and try again",
        });
      }

      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      const updates = {};
      if (req.body.language)
        updates["preferences.language"] = req.body.language;
      if (req.body.currency)
        updates["preferences.currency"] = req.body.currency;
      if (req.body.timezone)
        updates["preferences.timezone"] = req.body.timezone;
      if (req.body.theme) updates["preferences.theme"] = req.body.theme;
      if (req.body.notifications) {
        Object.keys(req.body.notifications).forEach((key) => {
          updates[`preferences.notifications.${key}`] =
            req.body.notifications[key];
        });
      }

      await User.findOneAndUpdate(
        { _id: req.user.userId },
        { $set: updates },
        { new: true, runValidators: true }
      );

      res.json({
        message: "Preferences updated successfully",
        _links: {
          self: "/api/users/preferences",
          profile: "/api/users/profile",
        },
      });
    } catch (error) {
      console.error("Update preferences error:", error);
      res.status(500).json({
        message: "An error occurred while updating preferences",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Get user notifications
router.get(
  "/notifications",
  authenticateToken,
  regularLimiter,
  ...securityMiddleware,
  async (req, res) => {
    try {
      const { page = 1, limit = 10, unread } = req.query;
      const user = await User.findById(req.user.userId).select("notifications");
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      let notifications = user.notifications || [];
      if (unread === "true") {
        notifications = notifications.filter((n) => !n.read);
      }

      const startIndex = (Number(page) - 1) * Number(limit);
      const endIndex = startIndex + Number(limit);
      const paginatedNotifications = notifications.slice(startIndex, endIndex);

      res.json({
        notifications: paginatedNotifications,
        pagination: {
          total: notifications.length,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(notifications.length / Number(limit)),
        },
        _links: {
          self: `/api/users/notifications?page=${page}&limit=${limit}`,
          markAllRead: "/api/users/notifications/read-all",
          preferences: "/api/users/preferences",
        },
      });
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({
        message: "An error occurred while fetching notifications",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Mark notification as read
router.put(
  "/notifications/:id/read",
  authenticateToken,
  regularLimiter,
  ...securityMiddleware,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      const notification = user.notifications.id(req.params.id);
      if (!notification) {
        return res.status(404).json({
          message: "Notification not found",
          code: "NOTIFICATION_NOT_FOUND",
          suggestion: "Please check the notification ID and try again",
        });
      }

      notification.read = true;
      notification.readAt = new Date();
      await user.save();

      res.json({
        message: "Notification marked as read",
        _links: {
          self: `/api/users/notifications/${req.params.id}/read`,
          notifications: "/api/users/notifications",
        },
      });
    } catch (error) {
      console.error("Mark notification as read error:", error);
      res.status(500).json({
        message: "An error occurred while marking notification as read",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Mark all notifications as read
router.put(
  "/notifications/read-all",
  authenticateToken,
  regularLimiter,
  ...securityMiddleware,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      const now = new Date();
      user.notifications.forEach((notification) => {
        if (!notification.read) {
          notification.read = true;
          notification.readAt = now;
        }
      });

      await user.save();

      res.json({
        message: "All notifications marked as read",
        _links: {
          self: "/api/users/notifications/read-all",
          notifications: "/api/users/notifications",
        },
      });
    } catch (error) {
      console.error("Mark all notifications as read error:", error);
      res.status(500).json({
        message: "An error occurred while marking notifications as read",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Delete notification
router.delete(
  "/notifications/:id",
  authenticateToken,
  regularLimiter,
  ...securityMiddleware,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      const notification = user.notifications.id(req.params.id);
      if (!notification) {
        return res.status(404).json({
          message: "Notification not found",
          code: "NOTIFICATION_NOT_FOUND",
          suggestion: "Please check the notification ID and try again",
        });
      }

      notification.remove();
      await user.save();

      res.json({
        message: "Notification deleted successfully",
        _links: {
          notifications: "/api/users/notifications",
        },
      });
    } catch (error) {
      console.error("Delete notification error:", error);
      res.status(500).json({
        message: "An error occurred while deleting notification",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Clear all notifications
router.delete(
  "/notifications",
  authenticateToken,
  regularLimiter,
  ...securityMiddleware,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      user.notifications = [];
      await user.save();

      res.json({
        message: "All notifications cleared successfully",
        _links: {
          notifications: "/api/users/notifications",
        },
      });
    } catch (error) {
      console.error("Clear all notifications error:", error);
      res.status(500).json({
        message: "An error occurred while clearing notifications",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Get user activity feed
router.get(
  "/activity-feed",
  authenticateToken,
  regularLimiter,
  ...securityMiddleware,
  async (req, res) => {
    try {
      const { page = 1, limit = 20, type } = req.query;
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      // Combine all activities
      const activities = [
        ...user.searchHistory.map((s) => ({
          type: "search",
          timestamp: s.timestamp,
          data: {
            query: s.query,
            category: s.category,
            results: s.results,
          },
        })),
        ...user.favorites.map((f) => ({
          type: "favorite",
          timestamp: f.addedAt,
          data: {
            productId: f.productId,
            title: f.title,
            price: f.price,
            category: f.category,
          },
        })),
        ...user.negotiationHistory.map((n) => ({
          type: "negotiation",
          timestamp: n.completedAt,
          data: {
            productId: n.productId,
            title: n.productTitle,
            status: n.status,
            initialPrice: n.initialPrice,
            finalPrice: n.finalPrice,
          },
        })),
      ];

      // Filter by type if specified
      const filteredActivities = type
        ? activities.filter((a) => a.type === type)
        : activities;

      // Sort by timestamp
      filteredActivities.sort((a, b) => b.timestamp - a.timestamp);

      // Paginate results
      const startIndex = (Number(page) - 1) * Number(limit);
      const endIndex = startIndex + Number(limit);
      const paginatedActivities = filteredActivities.slice(
        startIndex,
        endIndex
      );

      res.json({
        activities: paginatedActivities,
        pagination: {
          total: filteredActivities.length,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(filteredActivities.length / Number(limit)),
        },
        _links: {
          self: `/api/users/activity-feed?page=${page}&limit=${limit}${
            type ? `&type=${type}` : ""
          }`,
          next:
            endIndex < filteredActivities.length
              ? `/api/users/activity-feed?page=${
                  Number(page) + 1
                }&limit=${limit}${type ? `&type=${type}` : ""}`
              : null,
          prev:
            startIndex > 0
              ? `/api/users/activity-feed?page=${
                  Number(page) - 1
                }&limit=${limit}${type ? `&type=${type}` : ""}`
              : null,
        },
      });
    } catch (error) {
      console.error("Get activity feed error:", error);
      res.status(500).json({
        message: "An error occurred while fetching activity feed",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Get user analytics
router.get(
  "/analytics",
  authenticateToken,
  regularLimiter,
  ...securityMiddleware,
  async (req, res) => {
    try {
      const { period = "month" } = req.query;
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      const now = new Date();
      let startDate;
      switch (period) {
        case "week":
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case "month":
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case "year":
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
        default:
          startDate = new Date(now.setMonth(now.getMonth() - 1));
      }

      const analytics = {
        search: {
          total: user.searchHistory.filter((s) => s.timestamp >= startDate)
            .length,
          byCategory: Object.entries(
            user.searchHistory
              .filter((s) => s.timestamp >= startDate)
              .reduce((acc, s) => {
                acc[s.category] = (acc[s.category] || 0) + 1;
                return acc;
              }, {})
          ).map(([category, count]) => ({ category, count })),
          trend: Array.from({ length: 7 }, (_, i) => {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            return {
              date,
              count: user.searchHistory.filter(
                (s) =>
                  new Date(s.timestamp).toDateString() === date.toDateString()
              ).length,
            };
          }),
        },
        negotiation: {
          total: user.negotiationHistory.filter(
            (n) => n.completedAt >= startDate
          ).length,
          successRate:
            user.negotiationHistory.filter((n) => n.completedAt >= startDate)
              .length > 0
              ? (user.negotiationHistory.filter(
                  (n) => n.status === "success" && n.completedAt >= startDate
                ).length /
                  user.negotiationHistory.filter(
                    (n) => n.completedAt >= startDate
                  ).length) *
                100
              : 0,
          averageSavings:
            user.negotiationHistory.filter((n) => n.completedAt >= startDate)
              .length > 0
              ? user.negotiationHistory
                  .filter((n) => n.completedAt >= startDate)
                  .reduce(
                    (acc, n) => acc + (n.initialPrice - n.finalPrice),
                    0
                  ) /
                user.negotiationHistory.filter(
                  (n) => n.completedAt >= startDate
                ).length
              : 0,
          byCategory: Object.entries(
            user.negotiationHistory
              .filter((n) => n.completedAt >= startDate)
              .reduce((acc, n) => {
                acc[n.category] = (acc[n.category] || 0) + 1;
                return acc;
              }, {})
          ).map(([category, count]) => ({ category, count })),
        },
        favorites: {
          total: user.favorites.filter((f) => f.addedAt >= startDate).length,
          byCategory: Object.entries(
            user.favorites
              .filter((f) => f.addedAt >= startDate)
              .reduce((acc, f) => {
                acc[f.category] = (acc[f.category] || 0) + 1;
                return acc;
              }, {})
          ).map(([category, count]) => ({ category, count })),
          totalValue: user.favorites
            .filter((f) => f.addedAt >= startDate)
            .reduce((acc, f) => acc + f.price, 0),
        },
      };

      res.json({
        period,
        startDate,
        analytics,
        _links: {
          self: `/api/users/analytics?period=${period}`,
          activity: "/api/users/activity-feed",
          insights: "/api/users/insights",
        },
      });
    } catch (error) {
      console.error("Get analytics error:", error);
      res.status(500).json({
        message: "An error occurred while fetching analytics",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Export user data
router.get(
  "/export",
  authenticateToken,
  sensitiveLimiter,
  ...securityMiddleware,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      const exportData = {
        profile: {
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          preferences: user.preferences,
          privacy: user.privacy,
          security: {
            twoFactorEnabled: user.security?.twoFactorEnabled,
            lastPasswordChange: user.security?.lastPasswordChange,
          },
        },
        activity: {
          searchHistory: user.searchHistory.map((s) => ({
            query: s.query,
            category: s.category,
            timestamp: s.timestamp,
            results: s.results,
          })),
          favorites: user.favorites.map((f) => ({
            productId: f.productId,
            title: f.title,
            price: f.price,
            category: f.category,
            addedAt: f.addedAt,
          })),
          negotiationHistory: user.negotiationHistory.map((n) => ({
            productId: n.productId,
            title: n.productTitle,
            status: n.status,
            initialPrice: n.initialPrice,
            finalPrice: n.finalPrice,
            completedAt: n.completedAt,
          })),
          savedSearches: user.savedSearches.map((s) => ({
            query: s.query,
            filters: s.filters,
            name: s.name,
            savedAt: s.savedAt,
            lastUsed: s.lastUsed,
          })),
        },
        metadata: {
          exportDate: new Date(),
          dataVersion: "1.0",
        },
      };

      res.json(exportData);
    } catch (error) {
      console.error("Export data error:", error);
      res.status(500).json({
        message: "An error occurred while exporting data",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Get user favorites
router.get("/favorites", authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "addedAt",
      sortOrder = "desc",
      minPrice,
      maxPrice,
    } = req.query;

    const user = await User.findById(req.user.userId).select("favorites");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Filter favorites by price range
    let filteredFavorites = user.favorites;
    if (minPrice) {
      filteredFavorites = filteredFavorites.filter(
        (f) => f.price >= Number(minPrice)
      );
    }
    if (maxPrice) {
      filteredFavorites = filteredFavorites.filter(
        (f) => f.price <= Number(maxPrice)
      );
    }

    // Sort favorites
    filteredFavorites.sort((a, b) => {
      if (sortOrder === "asc") {
        return a[sortBy] - b[sortBy];
      }
      return b[sortBy] - a[sortBy];
    });

    // Paginate results
    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);
    const paginatedFavorites = filteredFavorites.slice(startIndex, endIndex);

    res.json({
      favorites: paginatedFavorites,
      pagination: {
        total: filteredFavorites.length,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(filteredFavorites.length / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Get favorites error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Add to favorites
router.post(
  "/favorites",
  authenticateToken,
  [
    body("productId").isMongoId(),
    body("title").trim().notEmpty(),
    body("price").isNumeric(),
    body("image").optional().isURL(),
    body("url").optional().isURL(),
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

      // Check if product is already in favorites
      const existingFavorite = user.favorites.find(
        (favorite) => favorite.productId.toString() === req.body.productId
      );
      if (existingFavorite) {
        return res
          .status(400)
          .json({ message: "Product already in favorites" });
      }

      user.favorites.push({
        productId: req.body.productId,
        title: req.body.title,
        price: req.body.price,
        image: req.body.image,
        url: req.body.url,
        addedAt: new Date(),
      });

      await user.save();

      res.json(user.favorites);
    } catch (error) {
      console.error("Add to favorites error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Remove from favorites
router.delete("/favorites/:productId", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.favorites = user.favorites.filter(
      (favorite) => favorite.productId.toString() !== req.params.productId
    );

    await user.save();

    res.json(user.favorites);
  } catch (error) {
    console.error("Remove from favorites error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get saved searches
router.get("/saved-searches", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("savedSearches");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user.savedSearches);
  } catch (error) {
    console.error("Get saved searches error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Save search
router.post(
  "/saved-searches",
  authenticateToken,
  [
    body("query").trim().notEmpty(),
    body("filters").optional().isObject(),
    body("name").optional().trim().notEmpty(),
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

      user.savedSearches.push({
        query: req.body.query,
        filters: req.body.filters || {},
        name: req.body.name || req.body.query,
        savedAt: new Date(),
      });

      await user.save();

      res.json(user.savedSearches);
    } catch (error) {
      console.error("Save search error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Delete saved search
router.delete("/saved-searches/:id", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.savedSearches = user.savedSearches.filter(
      (search) => search._id.toString() !== req.params.id
    );

    await user.save();

    res.json(user.savedSearches);
  } catch (error) {
    console.error("Delete saved search error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get negotiation history
router.get("/negotiation-history", authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, startDate, endDate } = req.query;

    const user = await User.findById(req.user.userId).select(
      "negotiationHistory"
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Filter negotiations
    let filteredHistory = user.negotiationHistory;
    if (status) {
      filteredHistory = filteredHistory.filter((n) => n.status === status);
    }
    if (startDate) {
      filteredHistory = filteredHistory.filter(
        (n) => n.completedAt >= new Date(startDate)
      );
    }
    if (endDate) {
      filteredHistory = filteredHistory.filter(
        (n) => n.completedAt <= new Date(endDate)
      );
    }

    // Calculate analytics
    const analytics = {
      totalNegotiations: filteredHistory.length,
      successRate:
        filteredHistory.length > 0
          ? (filteredHistory.filter((n) => n.status === "success").length /
              filteredHistory.length) *
            100
          : 0,
      averageDuration:
        filteredHistory.length > 0
          ? filteredHistory.reduce((acc, n) => acc + n.duration, 0) /
            filteredHistory.length
          : 0,
      averagePriceReduction:
        filteredHistory.length > 0
          ? filteredHistory.reduce(
              (acc, n) => acc + (n.initialPrice - n.finalPrice),
              0
            ) / filteredHistory.length
          : 0,
    };

    // Paginate results
    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);
    const paginatedHistory = filteredHistory.slice(startIndex, endIndex);

    res.json({
      history: paginatedHistory,
      analytics,
      pagination: {
        total: filteredHistory.length,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(filteredHistory.length / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Get negotiation history error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Add negotiation history
router.post(
  "/negotiation-history",
  authenticateToken,
  [
    body("productId").isMongoId(),
    body("productTitle").trim().notEmpty(),
    body("initialPrice").isNumeric(),
    body("finalPrice").isNumeric(),
    body("status").isIn(["success", "failed", "pending"]),
    body("duration").isNumeric(),
    body("messages").isArray(),
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

      user.negotiationHistory.push({
        productId: req.body.productId,
        productTitle: req.body.productTitle,
        initialPrice: req.body.initialPrice,
        finalPrice: req.body.finalPrice,
        status: req.body.status,
        duration: req.body.duration,
        messages: req.body.messages,
        completedAt: new Date(),
      });

      await user.save();

      res.json(user.negotiationHistory);
    } catch (error) {
      console.error("Add negotiation history error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Clear negotiation history
router.delete("/negotiation-history", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.negotiationHistory = [];
    await user.save();

    res.json({ message: "Negotiation history cleared" });
  } catch (error) {
    console.error("Clear negotiation history error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get user security settings
router.get(
  "/security",
  authenticateToken,
  ...securityMiddleware,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId).select("security");
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      res.json({
        twoFactorEnabled: user.security?.twoFactorEnabled || false,
        lastPasswordChange: user.security?.lastPasswordChange,
        loginHistory: user.security?.loginHistory || [],
        activeSessions: user.security?.activeSessions || [],
        securityQuestions: user.security?.securityQuestions || [],
      });
    } catch (error) {
      console.error("Get security settings error:", error);
      res.status(500).json({
        message: "An error occurred while fetching security settings",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Update security settings
router.put(
  "/security",
  authenticateToken,
  sensitiveLimiter,
  ...securityMiddleware,
  [
    body("twoFactorEnabled").optional().isBoolean(),
    body("securityQuestions").optional().isArray(),
    body("securityQuestions.*.question").isString(),
    body("securityQuestions.*.answer").isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation failed",
          errors: errors.array(),
          code: "VALIDATION_ERROR",
          suggestion: "Please check your input and try again",
        });
      }

      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      const updates = {};
      if (req.body.twoFactorEnabled !== undefined) {
        updates["security.twoFactorEnabled"] = req.body.twoFactorEnabled;
      }
      if (req.body.securityQuestions) {
        updates["security.securityQuestions"] = req.body.securityQuestions.map(
          (q) => ({
            question: q.question,
            answer: crypto.createHash("sha256").update(q.answer).digest("hex"),
          })
        );
      }

      await User.findOneAndUpdate(
        { _id: req.user.userId },
        { $set: updates },
        { new: true, runValidators: true }
      );

      res.json({
        message: "Security settings updated successfully",
        _links: {
          self: "/api/users/security",
          profile: "/api/users/profile",
        },
      });
    } catch (error) {
      console.error("Update security settings error:", error);
      res.status(500).json({
        message: "An error occurred while updating security settings",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Get user privacy settings
router.get(
  "/privacy",
  authenticateToken,
  ...securityMiddleware,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId).select("privacy");
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      res.json({
        profileVisibility: user.privacy?.profileVisibility || "private",
        activityVisibility: user.privacy?.activityVisibility || "private",
        searchHistoryVisibility:
          user.privacy?.searchHistoryVisibility || "private",
        negotiationHistoryVisibility:
          user.privacy?.negotiationHistoryVisibility || "private",
        dataSharing: user.privacy?.dataSharing || false,
        marketingEmails: user.privacy?.marketingEmails || false,
      });
    } catch (error) {
      console.error("Get privacy settings error:", error);
      res.status(500).json({
        message: "An error occurred while fetching privacy settings",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Update privacy settings
router.put(
  "/privacy",
  authenticateToken,
  sensitiveLimiter,
  ...securityMiddleware,
  [
    body("profileVisibility").optional().isIn(["public", "private", "friends"]),
    body("activityVisibility")
      .optional()
      .isIn(["public", "private", "friends"]),
    body("searchHistoryVisibility")
      .optional()
      .isIn(["public", "private", "friends"]),
    body("negotiationHistoryVisibility")
      .optional()
      .isIn(["public", "private", "friends"]),
    body("dataSharing").optional().isBoolean(),
    body("marketingEmails").optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation failed",
          errors: errors.array(),
          code: "VALIDATION_ERROR",
          suggestion: "Please check your input and try again",
        });
      }

      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      const updates = {};
      if (req.body.profileVisibility)
        updates["privacy.profileVisibility"] = req.body.profileVisibility;
      if (req.body.activityVisibility)
        updates["privacy.activityVisibility"] = req.body.activityVisibility;
      if (req.body.searchHistoryVisibility)
        updates["privacy.searchHistoryVisibility"] =
          req.body.searchHistoryVisibility;
      if (req.body.negotiationHistoryVisibility)
        updates["privacy.negotiationHistoryVisibility"] =
          req.body.negotiationHistoryVisibility;
      if (req.body.dataSharing !== undefined)
        updates["privacy.dataSharing"] = req.body.dataSharing;
      if (req.body.marketingEmails !== undefined)
        updates["privacy.marketingEmails"] = req.body.marketingEmails;

      await User.findOneAndUpdate(
        { _id: req.user.userId },
        { $set: updates },
        { new: true, runValidators: true }
      );

      res.json({
        message: "Privacy settings updated successfully",
        _links: {
          self: "/api/users/privacy",
          profile: "/api/users/profile",
        },
      });
    } catch (error) {
      console.error("Update privacy settings error:", error);
      res.status(500).json({
        message: "An error occurred while updating privacy settings",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Get user activity summary
router.get(
  "/activity-summary",
  authenticateToken,
  regularLimiter,
  ...securityMiddleware,
  async (req, res) => {
    try {
      const { period = "month" } = req.query;
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      const now = new Date();
      let startDate;
      switch (period) {
        case "week":
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case "month":
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case "year":
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
        default:
          startDate = new Date(now.setMonth(now.getMonth() - 1));
      }

      const summary = {
        searches: {
          total: user.searchHistory.filter((s) => s.timestamp >= startDate)
            .length,
          byCategory: {}, // Add category-based counts
          trend: [], // Add daily/weekly trend
        },
        negotiations: {
          total: user.negotiationHistory.filter(
            (n) => n.completedAt >= startDate
          ).length,
          successful: user.negotiationHistory.filter(
            (n) => n.status === "success" && n.completedAt >= startDate
          ).length,
          averageSavings: 0, // Calculate average savings
          trend: [], // Add daily/weekly trend
        },
        favorites: {
          total: user.favorites.filter((f) => f.addedAt >= startDate).length,
          byCategory: {}, // Add category-based counts
          trend: [], // Add daily/weekly trend
        },
        savedSearches: {
          total: user.savedSearches.filter((s) => s.savedAt >= startDate)
            .length,
          active: user.savedSearches.filter(
            (s) => s.savedAt >= startDate && s.lastUsed >= startDate
          ).length,
        },
      };

      res.json({
        period,
        startDate,
        summary,
        _links: {
          self: `/api/users/activity-summary?period=${period}`,
          detailed: "/api/users/activity-feed",
          analytics: "/api/users/analytics",
        },
      });
    } catch (error) {
      console.error("Get activity summary error:", error);
      res.status(500).json({
        message: "An error occurred while fetching activity summary",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Get user achievements
router.get(
  "/achievements",
  authenticateToken,
  regularLimiter,
  ...securityMiddleware,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      const achievements = {
        negotiation: {
          expertNegotiator: {
            title: "Expert Negotiator",
            description: "Successfully negotiated 50 deals",
            progress:
              user.negotiationHistory.filter((n) => n.status === "success")
                .length / 50,
            unlocked:
              user.negotiationHistory.filter((n) => n.status === "success")
                .length >= 50,
          },
          savingsMaster: {
            title: "Savings Master",
            description: "Saved over $1000 through negotiations",
            progress:
              user.negotiationHistory.reduce(
                (acc, n) => acc + (n.initialPrice - n.finalPrice),
                0
              ) / 1000,
            unlocked:
              user.negotiationHistory.reduce(
                (acc, n) => acc + (n.initialPrice - n.finalPrice),
                0
              ) >= 1000,
          },
        },
        search: {
          searchExpert: {
            title: "Search Expert",
            description: "Performed 100 searches",
            progress: user.searchHistory.length / 100,
            unlocked: user.searchHistory.length >= 100,
          },
          categoryExplorer: {
            title: "Category Explorer",
            description: "Searched in 10 different categories",
            progress:
              new Set(user.searchHistory.map((s) => s.category)).size / 10,
            unlocked:
              new Set(user.searchHistory.map((s) => s.category)).size >= 10,
          },
        },
        favorites: {
          collector: {
            title: "Product Collector",
            description: "Added 50 products to favorites",
            progress: user.favorites.length / 50,
            unlocked: user.favorites.length >= 50,
          },
          organized: {
            title: "Organized Shopper",
            description: "Created 5 favorite categories",
            progress: new Set(user.favorites.map((f) => f.category)).size / 5,
            unlocked: new Set(user.favorites.map((f) => f.category)).size >= 5,
          },
        },
      };

      res.json({
        achievements,
        totalUnlocked: Object.values(achievements).reduce(
          (acc, category) =>
            acc + Object.values(category).filter((a) => a.unlocked).length,
          0
        ),
        totalAvailable: Object.values(achievements).reduce(
          (acc, category) => acc + Object.values(category).length,
          0
        ),
        _links: {
          self: "/api/users/achievements",
          profile: "/api/users/profile",
        },
      });
    } catch (error) {
      console.error("Get achievements error:", error);
      res.status(500).json({
        message: "An error occurred while fetching achievements",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Get user insights
router.get(
  "/insights",
  authenticateToken,
  regularLimiter,
  ...securityMiddleware,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      const insights = {
        negotiation: {
          successRate:
            user.negotiationHistory.length > 0
              ? (user.negotiationHistory.filter((n) => n.status === "success")
                  .length /
                  user.negotiationHistory.length) *
                100
              : 0,
          averageSavings:
            user.negotiationHistory.length > 0
              ? user.negotiationHistory.reduce(
                  (acc, n) => acc + (n.initialPrice - n.finalPrice),
                  0
                ) / user.negotiationHistory.length
              : 0,
          bestCategory:
            user.negotiationHistory.length > 0
              ? Object.entries(
                  user.negotiationHistory.reduce((acc, n) => {
                    acc[n.category] = (acc[n.category] || 0) + 1;
                    return acc;
                  }, {})
                ).sort((a, b) => b[1] - a[1])[0][0]
              : null,
        },
        search: {
          mostSearched:
            user.searchHistory.length > 0
              ? Object.entries(
                  user.searchHistory.reduce((acc, s) => {
                    acc[s.query] = (acc[s.query] || 0) + 1;
                    return acc;
                  }, {})
                ).sort((a, b) => b[1] - a[1])[0][0]
              : null,
          favoriteCategories:
            user.searchHistory.length > 0
              ? Object.entries(
                  user.searchHistory.reduce((acc, s) => {
                    acc[s.category] = (acc[s.category] || 0) + 1;
                    return acc;
                  }, {})
                )
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 3)
                  .map(([category]) => category)
              : [],
        },
        favorites: {
          totalValue: user.favorites.reduce((acc, f) => acc + f.price, 0),
          averagePrice:
            user.favorites.length > 0
              ? user.favorites.reduce((acc, f) => acc + f.price, 0) /
                user.favorites.length
              : 0,
          mostCommonCategory:
            user.favorites.length > 0
              ? Object.entries(
                  user.favorites.reduce((acc, f) => {
                    acc[f.category] = (acc[f.category] || 0) + 1;
                    return acc;
                  }, {})
                ).sort((a, b) => b[1] - a[1])[0][0]
              : null,
        },
      };

      res.json({
        insights,
        lastUpdated: new Date(),
        _links: {
          self: "/api/users/insights",
          activity: "/api/users/activity-summary",
          analytics: "/api/users/analytics",
        },
      });
    } catch (error) {
      console.error("Get insights error:", error);
      res.status(500).json({
        message: "An error occurred while fetching insights",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Get personalized recommendations
router.get(
  "/recommendations",
  authenticateToken,
  regularLimiter,
  ...securityMiddleware,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      // Get user's favorite categories
      const favoriteCategories = new Set([
        ...user.favorites.map((f) => f.category),
        ...user.searchHistory.map((s) => s.category),
      ]);

      // Get user's price range preferences
      const priceRanges = user.favorites.map((f) => f.price);
      const minPrice = Math.min(...priceRanges);
      const maxPrice = Math.max(...priceRanges);

      // Get user's preferred merchants
      const preferredMerchants = new Set([
        ...user.favorites.map((f) => f.merchant),
        ...user.searchHistory.map((s) => s.merchant),
      ]);

      const recommendations = {
        basedOnFavorites: {
          title: "Similar to your favorites",
          products: [], // Add products similar to user's favorites
        },
        trending: {
          title: "Trending in your categories",
          products: [], // Add trending products in user's favorite categories
        },
        deals: {
          title: "Great deals for you",
          products: [], // Add products with good discounts in user's price range
        },
        newArrivals: {
          title: "New arrivals you might like",
          products: [], // Add new products in user's favorite categories
        },
      };

      res.json({
        recommendations,
        preferences: {
          categories: Array.from(favoriteCategories),
          priceRange: { min: minPrice, max: maxPrice },
          merchants: Array.from(preferredMerchants),
        },
        _links: {
          self: "/api/users/recommendations",
          favorites: "/api/users/favorites",
          search: "/api/search",
        },
      });
    } catch (error) {
      console.error("Get recommendations error:", error);
      res.status(500).json({
        message: "An error occurred while fetching recommendations",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Get user goals
router.get(
  "/goals",
  authenticateToken,
  regularLimiter,
  ...securityMiddleware,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      const goals = {
        negotiation: {
          monthlyTarget: user.goals?.negotiation?.monthlyTarget || 10,
          currentProgress: user.negotiationHistory.filter(
            (n) => n.completedAt >= new Date(new Date().setDate(1))
          ).length,
          streak: user.goals?.negotiation?.streak || 0,
          bestStreak: user.goals?.negotiation?.bestStreak || 0,
        },
        savings: {
          monthlyTarget: user.goals?.savings?.monthlyTarget || 100,
          currentProgress: user.negotiationHistory
            .filter((n) => n.completedAt >= new Date(new Date().setDate(1)))
            .reduce((acc, n) => acc + (n.initialPrice - n.finalPrice), 0),
          totalSaved: user.negotiationHistory.reduce(
            (acc, n) => acc + (n.initialPrice - n.finalPrice),
            0
          ),
        },
        search: {
          monthlyTarget: user.goals?.search?.monthlyTarget || 50,
          currentProgress: user.searchHistory.filter(
            (s) => s.timestamp >= new Date(new Date().setDate(1))
          ).length,
          categoriesExplored: new Set(user.searchHistory.map((s) => s.category))
            .size,
        },
      };

      res.json({
        goals,
        lastUpdated: new Date(),
        _links: {
          self: "/api/users/goals",
          update: "/api/users/goals",
          achievements: "/api/users/achievements",
        },
      });
    } catch (error) {
      console.error("Get goals error:", error);
      res.status(500).json({
        message: "An error occurred while fetching goals",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Update user goals
router.put(
  "/goals",
  authenticateToken,
  regularLimiter,
  ...securityMiddleware,
  [
    body("negotiation.monthlyTarget").optional().isInt({ min: 1 }),
    body("savings.monthlyTarget").optional().isInt({ min: 1 }),
    body("search.monthlyTarget").optional().isInt({ min: 1 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation failed",
          errors: errors.array(),
          code: "VALIDATION_ERROR",
          suggestion: "Please check your input and try again",
        });
      }

      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      const updates = {};
      if (req.body.negotiation?.monthlyTarget) {
        updates["goals.negotiation.monthlyTarget"] =
          req.body.negotiation.monthlyTarget;
      }
      if (req.body.savings?.monthlyTarget) {
        updates["goals.savings.monthlyTarget"] = req.body.savings.monthlyTarget;
      }
      if (req.body.search?.monthlyTarget) {
        updates["goals.search.monthlyTarget"] = req.body.search.monthlyTarget;
      }

      await User.findOneAndUpdate(
        { _id: req.user.userId },
        { $set: updates },
        { new: true, runValidators: true }
      );

      res.json({
        message: "Goals updated successfully",
        _links: {
          self: "/api/users/goals",
          achievements: "/api/users/achievements",
        },
      });
    } catch (error) {
      console.error("Update goals error:", error);
      res.status(500).json({
        message: "An error occurred while updating goals",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Get user rewards
router.get(
  "/rewards",
  authenticateToken,
  regularLimiter,
  ...securityMiddleware,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      const rewards = {
        points: {
          total: user.rewards?.points || 0,
          earnedThisMonth: user.rewards?.monthlyPoints || 0,
          history: user.rewards?.pointHistory || [],
        },
        badges: user.rewards?.badges || [],
        level: {
          current: user.rewards?.level || 1,
          progress: user.rewards?.levelProgress || 0,
          nextLevelPoints: (user.rewards?.level || 1) * 1000,
        },
        availableRewards: [
          {
            id: "discount-5",
            type: "discount",
            value: 5,
            points: 500,
            description: "5% discount on your next purchase",
          },
          {
            id: "discount-10",
            type: "discount",
            value: 10,
            points: 1000,
            description: "10% discount on your next purchase",
          },
          {
            id: "free-shipping",
            type: "shipping",
            value: "free",
            points: 750,
            description: "Free shipping on your next order",
          },
        ],
      };

      res.json({
        rewards,
        lastUpdated: new Date(),
        _links: {
          self: "/api/users/rewards",
          redeem: "/api/users/rewards/redeem",
          history: "/api/users/rewards/history",
        },
      });
    } catch (error) {
      console.error("Get rewards error:", error);
      res.status(500).json({
        message: "An error occurred while fetching rewards",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Redeem reward
router.post(
  "/rewards/redeem",
  authenticateToken,
  regularLimiter,
  ...securityMiddleware,
  [body("rewardId").isString().notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation failed",
          errors: errors.array(),
          code: "VALIDATION_ERROR",
          suggestion: "Please check your input and try again",
        });
      }

      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      const reward = {
        "discount-5": { points: 500, type: "discount", value: 5 },
        "discount-10": { points: 1000, type: "discount", value: 10 },
        "free-shipping": { points: 750, type: "shipping", value: "free" },
      }[req.body.rewardId];

      if (!reward) {
        return res.status(400).json({
          message: "Invalid reward ID",
          code: "INVALID_REWARD",
          suggestion: "Please check the reward ID and try again",
        });
      }

      if (user.rewards?.points < reward.points) {
        return res.status(400).json({
          message: "Insufficient points",
          code: "INSUFFICIENT_POINTS",
          suggestion: "Earn more points to redeem this reward",
        });
      }

      // Update user's points and add reward to history
      await User.findOneAndUpdate(
        { _id: req.user.userId },
        {
          $inc: { "rewards.points": -reward.points },
          $push: {
            "rewards.rewardHistory": {
              rewardId: req.body.rewardId,
              type: reward.type,
              value: reward.value,
              redeemedAt: new Date(),
            },
          },
        },
        { new: true, runValidators: true }
      );

      res.json({
        message: "Reward redeemed successfully",
        reward: {
          type: reward.type,
          value: reward.value,
        },
        _links: {
          self: "/api/users/rewards/redeem",
          rewards: "/api/users/rewards",
        },
      });
    } catch (error) {
      console.error("Redeem reward error:", error);
      res.status(500).json({
        message: "An error occurred while redeeming reward",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Get user social connections
router.get(
  "/social",
  authenticateToken,
  regularLimiter,
  ...securityMiddleware,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      const connections = {
        followers: user.social?.followers || [],
        following: user.social?.following || [],
        pendingRequests: user.social?.pendingRequests || [],
        blockedUsers: user.social?.blockedUsers || [],
        activityVisibility: user.social?.activityVisibility || "public",
        profileVisibility: user.social?.profileVisibility || "public",
      };

      res.json({
        connections,
        stats: {
          followersCount: connections.followers.length,
          followingCount: connections.following.length,
          pendingRequestsCount: connections.pendingRequests.length,
        },
        _links: {
          self: "/api/users/social",
          follow: "/api/users/social/follow",
          unfollow: "/api/users/social/unfollow",
          block: "/api/users/social/block",
          unblock: "/api/users/social/unblock",
        },
      });
    } catch (error) {
      console.error("Get social connections error:", error);
      res.status(500).json({
        message: "An error occurred while fetching social connections",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Follow user
router.post(
  "/social/follow",
  authenticateToken,
  regularLimiter,
  ...securityMiddleware,
  [body("userId").isMongoId()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation failed",
          errors: errors.array(),
          code: "VALIDATION_ERROR",
          suggestion: "Please check your input and try again",
        });
      }

      const user = await User.findById(req.user.userId);
      const targetUser = await User.findById(req.body.userId);

      if (!user || !targetUser) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check the user ID and try again",
        });
      }

      if (user.social?.blockedUsers?.includes(req.body.userId)) {
        return res.status(403).json({
          message: "Cannot follow blocked user",
          code: "USER_BLOCKED",
          suggestion: "Unblock the user first to follow them",
        });
      }

      if (targetUser.social?.profileVisibility === "private") {
        await User.findByIdAndUpdate(req.body.userId, {
          $addToSet: { "social.pendingRequests": req.user.userId },
        });
        return res.json({
          message: "Follow request sent",
          status: "pending",
          _links: {
            self: "/api/users/social/follow",
            social: "/api/users/social",
          },
        });
      }

      await User.findByIdAndUpdate(req.user.userId, {
        $addToSet: { "social.following": req.body.userId },
      });
      await User.findByIdAndUpdate(req.body.userId, {
        $addToSet: { "social.followers": req.user.userId },
      });

      res.json({
        message: "Successfully followed user",
        status: "following",
        _links: {
          self: "/api/users/social/follow",
          social: "/api/users/social",
        },
      });
    } catch (error) {
      console.error("Follow user error:", error);
      res.status(500).json({
        message: "An error occurred while following user",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Get user advanced analytics
router.get(
  "/advanced-analytics",
  authenticateToken,
  regularLimiter,
  ...securityMiddleware,
  async (req, res) => {
    try {
      const { period = "month", granularity = "daily" } = req.query;
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          suggestion: "Please check your authentication and try again",
        });
      }

      const now = new Date();
      let startDate;
      switch (period) {
        case "week":
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case "month":
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case "year":
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
        default:
          startDate = new Date(now.setMonth(now.getMonth() - 1));
      }

      const analytics = {
        search: {
          total: user.searchHistory.filter((s) => s.timestamp >= startDate)
            .length,
          byCategory: Object.entries(
            user.searchHistory
              .filter((s) => s.timestamp >= startDate)
              .reduce((acc, s) => {
                acc[s.category] = (acc[s.category] || 0) + 1;
                return acc;
              }, {})
          ).map(([category, count]) => ({ category, count })),
          trend: generateTrendData(
            user.searchHistory,
            startDate,
            granularity,
            "timestamp"
          ),
          successRate: calculateSearchSuccessRate(
            user.searchHistory,
            startDate
          ),
          averageResults: calculateAverageResults(
            user.searchHistory,
            startDate
          ),
        },
        negotiation: {
          total: user.negotiationHistory.filter(
            (n) => n.completedAt >= startDate
          ).length,
          successRate: calculateNegotiationSuccessRate(
            user.negotiationHistory,
            startDate
          ),
          averageSavings: calculateAverageSavings(
            user.negotiationHistory,
            startDate
          ),
          byCategory: Object.entries(
            user.negotiationHistory
              .filter((n) => n.completedAt >= startDate)
              .reduce((acc, n) => {
                acc[n.category] = (acc[n.category] || 0) + 1;
                return acc;
              }, {})
          ).map(([category, count]) => ({ category, count })),
          trend: generateTrendData(
            user.negotiationHistory,
            startDate,
            granularity,
            "completedAt"
          ),
          bestDeals: findBestDeals(user.negotiationHistory, startDate),
        },
        favorites: {
          total: user.favorites.filter((f) => f.addedAt >= startDate).length,
          byCategory: Object.entries(
            user.favorites
              .filter((f) => f.addedAt >= startDate)
              .reduce((acc, f) => {
                acc[f.category] = (acc[f.category] || 0) + 1;
                return acc;
              }, {})
          ).map(([category, count]) => ({ category, count })),
          trend: generateTrendData(
            user.favorites,
            startDate,
            granularity,
            "addedAt"
          ),
          totalValue: user.favorites
            .filter((f) => f.addedAt >= startDate)
            .reduce((acc, f) => acc + f.price, 0),
          averagePrice: calculateAveragePrice(user.favorites, startDate),
        },
        insights: {
          peakActivity: findPeakActivity(user, startDate),
          favoriteCategories: findFavoriteCategories(user, startDate),
          negotiationStrengths: findNegotiationStrengths(
            user.negotiationHistory,
            startDate
          ),
          searchPatterns: analyzeSearchPatterns(user.searchHistory, startDate),
        },
      };

      res.json({
        period,
        granularity,
        startDate,
        analytics,
        _links: {
          self: `/api/users/advanced-analytics?period=${period}&granularity=${granularity}`,
          activity: "/api/users/activity-feed",
          insights: "/api/users/insights",
        },
      });
    } catch (error) {
      console.error("Get advanced analytics error:", error);
      res.status(500).json({
        message: "An error occurred while fetching advanced analytics",
        code: "SERVER_ERROR",
        suggestion:
          "Please try again later or contact support if the problem persists",
      });
    }
  }
);

// Helper functions for analytics
function generateTrendData(data, startDate, granularity, dateField) {
  const intervals =
    granularity === "daily" ? 7 : granularity === "weekly" ? 4 : 12;
  return Array.from({ length: intervals }, (_, i) => {
    const date = new Date(startDate);
    if (granularity === "daily") {
      date.setDate(date.getDate() + i);
    } else if (granularity === "weekly") {
      date.setDate(date.getDate() + i * 7);
    } else {
      date.setMonth(date.getMonth() + i);
    }
    return {
      date,
      count: data.filter((d) => {
        const itemDate = new Date(d[dateField]);
        return granularity === "daily"
          ? itemDate.toDateString() === date.toDateString()
          : granularity === "weekly"
          ? isSameWeek(itemDate, date)
          : itemDate.getMonth() === date.getMonth() &&
            itemDate.getFullYear() === date.getFullYear();
      }).length,
    };
  });
}

function calculateSearchSuccessRate(searchHistory, startDate) {
  const relevantSearches = searchHistory.filter(
    (s) => s.timestamp >= startDate
  );
  if (relevantSearches.length === 0) return 0;
  return (
    (relevantSearches.filter((s) => s.results > 0).length /
      relevantSearches.length) *
    100
  );
}

function calculateAverageResults(searchHistory, startDate) {
  const relevantSearches = searchHistory.filter(
    (s) => s.timestamp >= startDate
  );
  if (relevantSearches.length === 0) return 0;
  return (
    relevantSearches.reduce((acc, s) => acc + s.results, 0) /
    relevantSearches.length
  );
}

function calculateNegotiationSuccessRate(negotiationHistory, startDate) {
  const relevantNegotiations = negotiationHistory.filter(
    (n) => n.completedAt >= startDate
  );
  if (relevantNegotiations.length === 0) return 0;
  return (
    (relevantNegotiations.filter((n) => n.status === "success").length /
      relevantNegotiations.length) *
    100
  );
}

function calculateAverageSavings(negotiationHistory, startDate) {
  const relevantNegotiations = negotiationHistory.filter(
    (n) => n.completedAt >= startDate
  );
  if (relevantNegotiations.length === 0) return 0;
  return (
    relevantNegotiations.reduce(
      (acc, n) => acc + (n.initialPrice - n.finalPrice),
      0
    ) / relevantNegotiations.length
  );
}

function findBestDeals(negotiationHistory, startDate) {
  return negotiationHistory
    .filter((n) => n.completedAt >= startDate && n.status === "success")
    .sort(
      (a, b) => b.initialPrice - b.finalPrice - (a.initialPrice - a.finalPrice)
    )
    .slice(0, 5)
    .map((n) => ({
      productId: n.productId,
      title: n.productTitle,
      initialPrice: n.initialPrice,
      finalPrice: n.finalPrice,
      savings: n.initialPrice - n.finalPrice,
      completedAt: n.completedAt,
    }));
}

function findPeakActivity(user, startDate) {
  const activities = [
    ...user.searchHistory.map((s) => ({
      type: "search",
      timestamp: s.timestamp,
    })),
    ...user.negotiationHistory.map((n) => ({
      type: "negotiation",
      timestamp: n.completedAt,
    })),
    ...user.favorites.map((f) => ({ type: "favorite", timestamp: f.addedAt })),
  ].filter((a) => a.timestamp >= startDate);

  const hourlyActivity = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: activities.filter((a) => new Date(a.timestamp).getHours() === hour)
      .length,
  }));

  return {
    busiestHour: hourlyActivity.reduce(
      (max, curr) => (curr.count > max.count ? curr : max),
      hourlyActivity[0]
    ),
    dailyPattern: hourlyActivity,
  };
}

function findFavoriteCategories(user, startDate) {
  const categories = new Set([
    ...user.searchHistory.map((s) => s.category),
    ...user.negotiationHistory.map((n) => n.category),
    ...user.favorites.map((f) => f.category),
  ]);

  return Array.from(categories).map((category) => ({
    category,
    searchCount: user.searchHistory.filter(
      (s) => s.category === category && s.timestamp >= startDate
    ).length,
    negotiationCount: user.negotiationHistory.filter(
      (n) => n.category === category && n.completedAt >= startDate
    ).length,
    favoriteCount: user.favorites.filter(
      (f) => f.category === category && f.addedAt >= startDate
    ).length,
  }));
}

function findNegotiationStrengths(negotiationHistory, startDate) {
  const relevantNegotiations = negotiationHistory.filter(
    (n) => n.completedAt >= startDate
  );
  const byCategory = relevantNegotiations.reduce((acc, n) => {
    if (!acc[n.category]) {
      acc[n.category] = { total: 0, successful: 0, totalSavings: 0 };
    }
    acc[n.category].total++;
    if (n.status === "success") {
      acc[n.category].successful++;
      acc[n.category].totalSavings += n.initialPrice - n.finalPrice;
    }
    return acc;
  }, {});

  return Object.entries(byCategory).map(([category, stats]) => ({
    category,
    successRate: (stats.successful / stats.total) * 100,
    averageSavings:
      stats.successful > 0 ? stats.totalSavings / stats.successful : 0,
    totalNegotiations: stats.total,
  }));
}

function analyzeSearchPatterns(searchHistory, startDate) {
  const relevantSearches = searchHistory.filter(
    (s) => s.timestamp >= startDate
  );
  const patterns = {
    mostCommonQueries: Object.entries(
      relevantSearches.reduce((acc, s) => {
        acc[s.query] = (acc[s.query] || 0) + 1;
        return acc;
      }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([query, count]) => ({ query, count })),
    searchFrequency:
      (relevantSearches.length / (new Date() - startDate)) *
      (1000 * 60 * 60 * 24), // searches per day
    averageQueryLength:
      relevantSearches.reduce((acc, s) => acc + s.query.length, 0) /
      relevantSearches.length,
  };

  return patterns;
}

function isSameWeek(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const week1 = Math.floor(d1.getTime() / (7 * 24 * 60 * 60 * 1000));
  const week2 = Math.floor(d2.getTime() / (7 * 24 * 60 * 60 * 1000));
  return week1 === week2;
}

export default router;
