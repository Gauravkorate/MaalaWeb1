import mongoose, { Document, Schema } from "mongoose";

export interface ILocalSeller extends Document {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    pincode: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  businessType: "individual" | "registered";
  verification: {
    status: "pending" | "verified" | "rejected";
    documents: {
      type: "GSTIN" | "Aadhar" | "PAN" | "BusinessLicense";
      number: string;
      verifiedAt?: Date;
    }[];
  };
  preferences: {
    languages: string[];
    negotiationEnabled: boolean;
    deliveryOptions: {
      localDelivery: boolean;
      pickup: boolean;
      cod: boolean;
      freeDeliveryRadius: number; // in kilometers
    };
    workingHours: {
      start: string;
      end: string;
      days: number[]; // 0-6 for Sunday-Saturday
    };
  };
  products: mongoose.Types.ObjectId[];
  ratings: {
    average: number;
    count: number;
    reviews: {
      userId: mongoose.Types.ObjectId;
      rating: number;
      comment: string;
      createdAt: Date;
    }[];
  };
  status: "active" | "inactive" | "suspended";
  createdAt: Date;
  updatedAt: Date;
}

const LocalSellerSchema = new Schema<ILocalSeller>(
  {
    businessName: { type: String, required: true },
    ownerName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      country: { type: String, required: true, default: "India" },
      pincode: { type: String, required: true },
      coordinates: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
      },
    },
    businessType: {
      type: String,
      enum: ["individual", "registered"],
      required: true,
    },
    verification: {
      status: {
        type: String,
        enum: ["pending", "verified", "rejected"],
        default: "pending",
      },
      documents: [
        {
          type: {
            type: String,
            enum: ["GSTIN", "Aadhar", "PAN", "BusinessLicense"],
            required: true,
          },
          number: { type: String, required: true },
          verifiedAt: { type: Date },
        },
      ],
    },
    preferences: {
      languages: [{ type: String }],
      negotiationEnabled: { type: Boolean, default: true },
      deliveryOptions: {
        localDelivery: { type: Boolean, default: true },
        pickup: { type: Boolean, default: true },
        cod: { type: Boolean, default: true },
        freeDeliveryRadius: { type: Number, default: 5 },
      },
      workingHours: {
        start: { type: String, required: true },
        end: { type: String, required: true },
        days: [{ type: Number, min: 0, max: 6 }],
      },
    },
    products: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    ratings: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
      reviews: [
        {
          userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
          rating: { type: Number, required: true, min: 1, max: 5 },
          comment: { type: String },
          createdAt: { type: Date, default: Date.now },
        },
      ],
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

// Index for geospatial queries
LocalSellerSchema.index({ "address.coordinates": "2dsphere" });

// Index for search
LocalSellerSchema.index({
  businessName: "text",
  "address.city": "text",
  "address.state": "text",
});

export default mongoose.model<ILocalSeller>("LocalSeller", LocalSellerSchema);
