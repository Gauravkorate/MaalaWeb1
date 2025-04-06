import express from "express";
import { body, query, validationResult } from "express-validator";
import Product from "../models/Product";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();

// Get all products with pagination and filtering
router.get(
  "/",
  [
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
    query("minPrice").optional().isFloat({ min: 0 }).toFloat(),
    query("maxPrice").optional().isFloat({ min: 0 }).toFloat(),
    query("merchant").optional().isString(),
    query("category").optional().isString(),
    query("brand").optional().isString(),
    query("sortBy").optional().isIn(["price", "rating", "discount", "date"]),
    query("sortOrder").optional().isIn(["asc", "desc"]),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        page = 1,
        limit = 20,
        minPrice,
        maxPrice,
        merchant,
        category,
        brand,
        sortBy = "date",
        sortOrder = "desc",
      } = req.query;

      const query: any = {};

      if (minPrice !== undefined) query.price = { $gte: minPrice };
      if (maxPrice !== undefined) {
        query.price = query.price || {};
        query.price.$lte = maxPrice;
      }
      if (merchant) query.merchant = merchant;
      if (category) query.category = category;
      if (brand) query.brand = brand;

      const sortOptions: any = {};
      sortOptions[sortBy as string] = sortOrder === "asc" ? 1 : -1;

      const products = await Product.find(query)
        .sort(sortOptions)
        .skip(((page as number) - 1) * (limit as number))
        .limit(limit as number);

      const total = await Product.countDocuments(query);

      res.json({
        products,
        pagination: {
          total,
          page: page as number,
          limit: limit as number,
          pages: Math.ceil(total / (limit as number)),
        },
      });
    } catch (error) {
      console.error("Get products error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Get product by ID
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    console.error("Get product error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update product price
router.put(
  "/:id/price",
  authenticateToken,
  [
    body("price").isFloat({ min: 0 }),
    body("originalPrice").isFloat({ min: 0 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { price, originalPrice } = req.body;
      const discount = ((originalPrice - price) / originalPrice) * 100;

      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Add to price history
      product.priceHistory.push({
        price,
        date: new Date(),
      });

      // Update current price
      product.price = price;
      product.originalPrice = originalPrice;
      product.discount = discount;

      await product.save();

      res.json(product);
    } catch (error) {
      console.error("Update price error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Get price history
router.get("/:id/price-history", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product.priceHistory);
  } catch (error) {
    console.error("Get price history error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Search products
router.get(
  "/search",
  [
    query("q").notEmpty(),
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { q, page = 1, limit = 20 } = req.query;

      const products = await Product.find(
        { $text: { $search: q as string } },
        { score: { $meta: "textScore" } }
      )
        .sort({ score: { $meta: "textScore" } })
        .skip(((page as number) - 1) * (limit as number))
        .limit(limit as number);

      const total = await Product.countDocuments({
        $text: { $search: q as string },
      });

      res.json({
        products,
        pagination: {
          total,
          page: page as number,
          limit: limit as number,
          pages: Math.ceil(total / (limit as number)),
        },
      });
    } catch (error) {
      console.error("Search products error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

export default router;
