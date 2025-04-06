import express from "express";
import { body, param, query } from "express-validator";
import { LocalSellerService } from "../services/LocalSellerService";
import { authenticateToken, isAdmin } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";

const router = express.Router();

// Register new local seller
router.post(
  "/register",
  [
    body("businessName").notEmpty().withMessage("Business name is required"),
    body("ownerName").notEmpty().withMessage("Owner name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("phone").notEmpty().withMessage("Phone number is required"),
    body("address.street").notEmpty().withMessage("Street address is required"),
    body("address.city").notEmpty().withMessage("City is required"),
    body("address.state").notEmpty().withMessage("State is required"),
    body("address.pincode").notEmpty().withMessage("Pincode is required"),
    body("address.coordinates.latitude")
      .isNumeric()
      .withMessage("Valid latitude is required"),
    body("address.coordinates.longitude")
      .isNumeric()
      .withMessage("Valid longitude is required"),
    body("businessType")
      .isIn(["individual", "registered"])
      .withMessage("Valid business type is required"),
    body("verification.documents")
      .isArray()
      .withMessage("Verification documents are required"),
    body("preferences.languages")
      .isArray()
      .withMessage("Languages are required"),
    body("preferences.workingHours.start")
      .notEmpty()
      .withMessage("Working hours start time is required"),
    body("preferences.workingHours.end")
      .notEmpty()
      .withMessage("Working hours end time is required"),
    body("preferences.workingHours.days")
      .isArray()
      .withMessage("Working days are required"),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const seller = await LocalSellerService.registerSeller(req.body);
      res.status(201).json({
        message: "Seller registered successfully",
        seller,
        _links: {
          self: `/api/local-sellers/${seller._id}`,
          verify: `/api/local-sellers/${seller._id}/verify`,
          products: `/api/local-sellers/${seller._id}/products`,
        },
      });
    } catch (error) {
      res.status(400).json({
        message: "Registration failed",
        error: error.message,
        code: "REGISTRATION_ERROR",
        suggestion: "Please check your input and try again",
      });
    }
  }
);

// Get nearby sellers
router.get(
  "/nearby",
  [
    query("latitude").isNumeric().withMessage("Valid latitude is required"),
    query("longitude").isNumeric().withMessage("Valid longitude is required"),
    query("radius")
      .optional()
      .isNumeric()
      .withMessage("Valid radius is required"),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const sellers = await LocalSellerService.findNearbySellers(
        parseFloat(req.query.latitude as string),
        parseFloat(req.query.longitude as string),
        req.query.radius ? parseFloat(req.query.radius as string) : undefined
      );

      res.json({
        sellers,
        _links: {
          self: "/api/local-sellers/nearby",
          search: "/api/local-sellers/search",
        },
      });
    } catch (error) {
      res.status(400).json({
        message: "Failed to find nearby sellers",
        error: error.message,
        code: "SEARCH_ERROR",
        suggestion: "Please check your location and try again",
      });
    }
  }
);

// Search local sellers
router.get(
  "/search",
  [
    query("query").notEmpty().withMessage("Search query is required"),
    query("city").notEmpty().withMessage("City is required"),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const sellers = await LocalSellerService.searchLocalSellers(
        req.query.query as string,
        req.query.city as string
      );

      res.json({
        sellers,
        _links: {
          self: "/api/local-sellers/search",
          nearby: "/api/local-sellers/nearby",
        },
      });
    } catch (error) {
      res.status(400).json({
        message: "Search failed",
        error: error.message,
        code: "SEARCH_ERROR",
        suggestion: "Please check your search parameters and try again",
      });
    }
  }
);

// Get seller details
router.get(
  "/:sellerId",
  [param("sellerId").isMongoId().withMessage("Valid seller ID is required")],
  validateRequest,
  async (req, res) => {
    try {
      const seller = await LocalSeller.findById(req.params.sellerId)
        .populate("products")
        .lean();

      if (!seller) {
        return res.status(404).json({
          message: "Seller not found",
          code: "SELLER_NOT_FOUND",
          suggestion: "Please check the seller ID and try again",
        });
      }

      res.json({
        seller,
        _links: {
          self: `/api/local-sellers/${seller._id}`,
          products: `/api/local-sellers/${seller._id}/products`,
          reviews: `/api/local-sellers/${seller._id}/reviews`,
        },
      });
    } catch (error) {
      res.status(400).json({
        message: "Failed to get seller details",
        error: error.message,
        code: "FETCH_ERROR",
        suggestion: "Please try again later",
      });
    }
  }
);

// Add review for seller
router.post(
  "/:sellerId/reviews",
  [
    param("sellerId").isMongoId().withMessage("Valid seller ID is required"),
    body("rating")
      .isInt({ min: 1, max: 5 })
      .withMessage("Rating must be between 1 and 5"),
    body("comment")
      .optional()
      .isString()
      .withMessage("Comment must be a string"),
  ],
  validateRequest,
  authenticateToken,
  async (req, res) => {
    try {
      const seller = await LocalSellerService.addReview(
        req.params.sellerId,
        req.user.userId,
        req.body.rating,
        req.body.comment
      );

      res.status(201).json({
        message: "Review added successfully",
        seller,
        _links: {
          self: `/api/local-sellers/${seller._id}/reviews`,
          seller: `/api/local-sellers/${seller._id}`,
        },
      });
    } catch (error) {
      res.status(400).json({
        message: "Failed to add review",
        error: error.message,
        code: "REVIEW_ERROR",
        suggestion: "Please check your input and try again",
      });
    }
  }
);

// Admin routes
router.use(authenticateToken, isAdmin);

// Update seller status
router.patch(
  "/:sellerId/status",
  [
    param("sellerId").isMongoId().withMessage("Valid seller ID is required"),
    body("status")
      .isIn(["active", "inactive", "suspended"])
      .withMessage("Valid status is required"),
    body("reason").optional().isString().withMessage("Reason must be a string"),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const seller = await LocalSellerService.updateSellerStatus(
        req.params.sellerId,
        req.body.status,
        req.body.reason
      );

      res.json({
        message: "Seller status updated successfully",
        seller,
        _links: {
          self: `/api/local-sellers/${seller._id}/status`,
          seller: `/api/local-sellers/${seller._id}`,
        },
      });
    } catch (error) {
      res.status(400).json({
        message: "Failed to update seller status",
        error: error.message,
        code: "UPDATE_ERROR",
        suggestion: "Please check your input and try again",
      });
    }
  }
);

// Get seller statistics
router.get(
  "/:sellerId/stats",
  [param("sellerId").isMongoId().withMessage("Valid seller ID is required")],
  validateRequest,
  async (req, res) => {
    try {
      const stats = await LocalSellerService.getSellerStats(
        req.params.sellerId
      );

      res.json({
        stats,
        _links: {
          self: `/api/local-sellers/${req.params.sellerId}/stats`,
          seller: `/api/local-sellers/${req.params.sellerId}`,
        },
      });
    } catch (error) {
      res.status(400).json({
        message: "Failed to get seller statistics",
        error: error.message,
        code: "STATS_ERROR",
        suggestion: "Please try again later",
      });
    }
  }
);

export default router;
