import express from "express";
import { query, validationResult } from "express-validator";
import Product from "../models/Product";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();

// Search products with AI-powered ranking
router.get(
  "/",
  [
    query("q").notEmpty(),
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
    query("minPrice").optional().isFloat({ min: 0 }).toFloat(),
    query("maxPrice").optional().isFloat({ min: 0 }).toFloat(),
    query("merchant").optional().isString(),
    query("category").optional().isString(),
    query("brand").optional().isString(),
    query("sortBy")
      .optional()
      .isIn(["price", "rating", "discount", "relevance"]),
    query("sortOrder").optional().isIn(["asc", "desc"]),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        q,
        page = 1,
        limit = 20,
        minPrice,
        maxPrice,
        merchant,
        category,
        brand,
        sortBy = "relevance",
        sortOrder = "desc",
      } = req.query;

      // Build search query
      const searchQuery: any = {
        $text: { $search: q as string },
      };

      // Add filters
      if (minPrice !== undefined) searchQuery.price = { $gte: minPrice };
      if (maxPrice !== undefined) {
        searchQuery.price = searchQuery.price || {};
        searchQuery.price.$lte = maxPrice;
      }
      if (merchant) searchQuery.merchant = merchant;
      if (category) searchQuery.category = category;
      if (brand) searchQuery.brand = brand;

      // Build sort options
      const sortOptions: any = {};
      if (sortBy === "relevance") {
        sortOptions.score = { $meta: "textScore" };
      } else {
        sortOptions[sortBy as string] = sortOrder === "asc" ? 1 : -1;
      }

      // Execute search
      const products = await Product.find(searchQuery, {
        score: { $meta: "textScore" },
      })
        .sort(sortOptions)
        .skip(((page as number) - 1) * (limit as number))
        .limit(limit as number);

      const total = await Product.countDocuments(searchQuery);

      // AI-powered ranking (placeholder for actual AI implementation)
      const rankedProducts = products.map((product) => {
        // Calculate AI score based on various factors
        const aiScore =
          (product.rating * 0.3 + // Product rating
            (product.discount / 100) * 0.3 + // Discount percentage
            (1 - product.price / product.originalPrice) * 0.2 + // Price drop
            (product.reviews / 1000) * 0.2) * // Review count
          100;

        return {
          ...product.toObject(),
          aiScore,
        };
      });

      // Sort by AI score if relevance is selected
      if (sortBy === "relevance") {
        rankedProducts.sort((a, b) => b.aiScore - a.aiScore);
      }

      res.json({
        products: rankedProducts,
        pagination: {
          total,
          page: page as number,
          limit: limit as number,
          pages: Math.ceil(total / (limit as number)),
        },
      });
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Get search suggestions
router.get("/suggestions", [query("q").notEmpty()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { q } = req.query;

    const suggestions = await Product.aggregate([
      {
        $match: {
          $text: { $search: q as string },
        },
      },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 5,
      },
    ]);

    res.json(suggestions);
  } catch (error) {
    console.error("Get suggestions error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get price prediction for a product
router.get("/:id/prediction", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Placeholder for actual price prediction AI
    const prediction = {
      currentPrice: product.price,
      predictedPrice: product.price * 0.95, // Example prediction
      confidence: 0.85,
      timeframe: "7 days",
      factors: [
        {
          name: "Seasonal demand",
          impact: "negative",
          weight: 0.3,
        },
        {
          name: "Competitor pricing",
          impact: "positive",
          weight: 0.4,
        },
        {
          name: "Historical trends",
          impact: "negative",
          weight: 0.3,
        },
      ],
    };

    res.json(prediction);
  } catch (error) {
    console.error("Get prediction error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Start AI negotiation
router.post("/:id/negotiate", authenticateToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Placeholder for actual AI negotiation
    const negotiation = {
      productId: product._id,
      currentPrice: product.price,
      targetPrice: product.price * 0.9, // Example target price
      status: "in_progress",
      messages: [
        {
          role: "ai",
          content: "I can help you get a better price for this product.",
          timestamp: new Date(),
        },
      ],
      nextSteps: [
        "Analyzing competitor prices",
        "Checking historical price trends",
        "Evaluating merchant policies",
      ],
    };

    res.json(negotiation);
  } catch (error) {
    console.error("Start negotiation error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
