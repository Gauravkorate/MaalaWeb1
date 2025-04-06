import mongoose, { Schema, Document } from "mongoose";

export interface ISubscription extends Document {
  userId: string;
  type: "seller" | "buyer";
  status: "active" | "inactive" | "trial";
  startDate: Date;
  endDate: Date;
  isTrial: boolean;
  trialEndDate?: Date;
  paymentHistory: {
    amount: number;
    date: Date;
    transactionId: string;
    status: "success" | "failed" | "pending";
  }[];
  autoRenew: boolean;
  lastPaymentDate?: Date;
  nextPaymentDate?: Date;
}

const subscriptionSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, enum: ["seller", "buyer"], required: true },
    status: {
      type: String,
      enum: ["active", "inactive", "trial"],
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isTrial: { type: Boolean, default: false },
    trialEndDate: { type: Date },
    paymentHistory: [
      {
        amount: { type: Number, required: true },
        date: { type: Date, required: true },
        transactionId: { type: String, required: true },
        status: {
          type: String,
          enum: ["success", "failed", "pending"],
          required: true,
        },
      },
    ],
    autoRenew: { type: Boolean, default: true },
    lastPaymentDate: { type: Date },
    nextPaymentDate: { type: Date },
  },
  { timestamps: true }
);

// Index for efficient querying
subscriptionSchema.index({ userId: 1, type: 1 });
subscriptionSchema.index({ status: 1, endDate: 1 });

export const Subscription = mongoose.model<ISubscription>(
  "Subscription",
  subscriptionSchema
);
