import { Request, Response, NextFunction } from "express";
import { SubscriptionService } from "../services/subscriptionService";

export const requireSubscription = (type: "seller" | "buyer") => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isActive = await SubscriptionService.isSubscriptionActive(
        req.user.id,
        type
      );

      if (!isActive) {
        if (type === "seller") {
          return res.status(403).json({
            error: "Subscription required",
            message:
              "Please subscribe to continue listing your products. ₹79/month",
            subscriptionType: "seller",
            price: 79,
          });
        } else {
          return res.status(403).json({
            error: "Subscription required",
            message:
              "Please subscribe to access product details and negotiations. ₹59/month",
            subscriptionType: "buyer",
            price: 59,
          });
        }
      }

      next();
    } catch (error) {
      res.status(500).json({ error: "Failed to check subscription status" });
    }
  };
};

export const checkTrialStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const daysRemaining = await SubscriptionService.getTrialDaysRemaining(
      req.user.id,
      "seller"
    );

    if (daysRemaining !== null) {
      res.locals.trialDaysRemaining = daysRemaining;
    }

    next();
  } catch (error) {
    next();
  }
};
