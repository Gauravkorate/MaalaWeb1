import { Subscription, ISubscription } from "../models/subscription";
import { addMonths, isAfter, isBefore } from "date-fns";

export class SubscriptionService {
  // Create a new subscription
  static async createSubscription(
    userId: string,
    type: "seller" | "buyer"
  ): Promise<ISubscription> {
    const startDate = new Date();
    const endDate = addMonths(startDate, 3); // 3-month trial
    const trialEndDate = endDate;

    return Subscription.create({
      userId,
      type,
      status: "trial",
      startDate,
      endDate,
      isTrial: true,
      trialEndDate,
      paymentHistory: [],
      autoRenew: true,
    });
  }

  // Get subscription status
  static async getSubscriptionStatus(
    userId: string,
    type: "seller" | "buyer"
  ): Promise<ISubscription | null> {
    return Subscription.findOne({ userId, type });
  }

  // Check if subscription is active
  static async isSubscriptionActive(
    userId: string,
    type: "seller" | "buyer"
  ): Promise<boolean> {
    const subscription = await Subscription.findOne({
      userId,
      type,
      status: { $in: ["active", "trial"] },
      endDate: { $gt: new Date() },
    });
    return !!subscription;
  }

  // Renew subscription
  static async renewSubscription(
    userId: string,
    type: "seller" | "buyer",
    amount: number,
    transactionId: string
  ): Promise<ISubscription> {
    const subscription = await Subscription.findOne({ userId, type });
    if (!subscription) {
      throw new Error("Subscription not found");
    }

    const now = new Date();
    const newEndDate = addMonths(now, 1);

    subscription.status = "active";
    subscription.isTrial = false;
    subscription.endDate = newEndDate;
    subscription.lastPaymentDate = now;
    subscription.nextPaymentDate = newEndDate;
    subscription.paymentHistory.push({
      amount,
      date: now,
      transactionId,
      status: "success",
    });

    return subscription.save();
  }

  // Cancel subscription
  static async cancelSubscription(
    userId: string,
    type: "seller" | "buyer"
  ): Promise<ISubscription> {
    const subscription = await Subscription.findOne({ userId, type });
    if (!subscription) {
      throw new Error("Subscription not found");
    }

    subscription.autoRenew = false;
    return subscription.save();
  }

  // Get days remaining in trial
  static async getTrialDaysRemaining(
    userId: string,
    type: "seller" | "buyer"
  ): Promise<number | null> {
    const subscription = await Subscription.findOne({
      userId,
      type,
      isTrial: true,
    });
    if (!subscription || !subscription.trialEndDate) {
      return null;
    }

    const now = new Date();
    if (isAfter(now, subscription.trialEndDate)) {
      return 0;
    }

    const diffTime = subscription.trialEndDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Get subscription history
  static async getSubscriptionHistory(
    userId: string,
    type: "seller" | "buyer"
  ): Promise<ISubscription[]> {
    return Subscription.find({ userId, type }).sort({ createdAt: -1 }).exec();
  }

  // Update subscription status (for background jobs)
  static async updateSubscriptionStatus(): Promise<void> {
    const now = new Date();
    await Subscription.updateMany(
      {
        endDate: { $lt: now },
        status: { $in: ["active", "trial"] },
      },
      { status: "inactive" }
    );
  }
}
