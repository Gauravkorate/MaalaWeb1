import express from "express";
import { SubscriptionService } from "../services/subscriptionService";
import { authenticate } from "../middleware/auth";

const router = express.Router();

// Get subscription status
router.get("/status", authenticate, async (req, res) => {
  try {
    const { type } = req.query;
    if (!type || (type !== "seller" && type !== "buyer")) {
      return res.status(400).json({ error: "Invalid subscription type" });
    }

    const subscription = await SubscriptionService.getSubscriptionStatus(
      req.user.id,
      type
    );
    res.json(subscription);
  } catch (error) {
    res.status(500).json({ error: "Failed to get subscription status" });
  }
});

// Create new subscription
router.post("/create", authenticate, async (req, res) => {
  try {
    const { type } = req.body;
    if (!type || (type !== "seller" && type !== "buyer")) {
      return res.status(400).json({ error: "Invalid subscription type" });
    }

    const subscription = await SubscriptionService.createSubscription(
      req.user.id,
      type
    );
    res.status(201).json(subscription);
  } catch (error) {
    res.status(500).json({ error: "Failed to create subscription" });
  }
});

// Renew subscription
router.post("/renew", authenticate, async (req, res) => {
  try {
    const { type, amount, transactionId } = req.body;
    if (!type || !amount || !transactionId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const subscription = await SubscriptionService.renewSubscription(
      req.user.id,
      type,
      amount,
      transactionId
    );
    res.json(subscription);
  } catch (error) {
    res.status(500).json({ error: "Failed to renew subscription" });
  }
});

// Cancel subscription
router.post("/cancel", authenticate, async (req, res) => {
  try {
    const { type } = req.body;
    if (!type || (type !== "seller" && type !== "buyer")) {
      return res.status(400).json({ error: "Invalid subscription type" });
    }

    const subscription = await SubscriptionService.cancelSubscription(
      req.user.id,
      type
    );
    res.json(subscription);
  } catch (error) {
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

// Get trial days remaining
router.get("/trial-days", authenticate, async (req, res) => {
  try {
    const { type } = req.query;
    if (!type || (type !== "seller" && type !== "buyer")) {
      return res.status(400).json({ error: "Invalid subscription type" });
    }

    const daysRemaining = await SubscriptionService.getTrialDaysRemaining(
      req.user.id,
      type
    );
    res.json({ daysRemaining });
  } catch (error) {
    res.status(500).json({ error: "Failed to get trial days remaining" });
  }
});

// Get subscription history
router.get("/history", authenticate, async (req, res) => {
  try {
    const { type } = req.query;
    if (!type || (type !== "seller" && type !== "buyer")) {
      return res.status(400).json({ error: "Invalid subscription type" });
    }

    const history = await SubscriptionService.getSubscriptionHistory(
      req.user.id,
      type
    );
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Failed to get subscription history" });
  }
});

export default router;
