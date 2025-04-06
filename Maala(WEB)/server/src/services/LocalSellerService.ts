import { ILocalSeller } from "../models/LocalSeller";
import LocalSeller from "../models/LocalSeller";
import { calculateDistance } from "../utils/geolocation";
import { validateGSTIN } from "../utils/validation";
import { sendVerificationEmail } from "../utils/email";
import { uploadDocument } from "../utils/storage";

export class LocalSellerService {
  static async registerSeller(sellerData: Partial<ILocalSeller>) {
    // Validate business documents
    if (sellerData.verification?.documents) {
      for (const doc of sellerData.verification.documents) {
        if (doc.type === "GSTIN" && !validateGSTIN(doc.number)) {
          throw new Error("Invalid GSTIN number");
        }
      }
    }

    // Upload verification documents
    if (sellerData.verification?.documents) {
      for (const doc of sellerData.verification.documents) {
        if (doc.file) {
          const fileUrl = await uploadDocument(doc.file, "verification");
          doc.file = fileUrl;
        }
      }
    }

    const seller = new LocalSeller(sellerData);
    await seller.save();

    // Send verification email
    await sendVerificationEmail(seller.email, {
      businessName: seller.businessName,
      verificationLink: `${process.env.FRONTEND_URL}/verify-seller/${seller._id}`,
    });

    return seller;
  }

  static async findNearbySellers(
    latitude: number,
    longitude: number,
    radius: number = 10, // in kilometers
    filters: any = {}
  ) {
    const sellers = await LocalSeller.find({
      "address.coordinates": {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          $maxDistance: radius * 1000, // Convert to meters
        },
      },
      status: "active",
      ...filters,
    })
      .populate("products")
      .lean();

    // Calculate exact distances
    return sellers.map((seller) => ({
      ...seller,
      distance: calculateDistance(
        latitude,
        longitude,
        seller.address.coordinates.latitude,
        seller.address.coordinates.longitude
      ),
    }));
  }

  static async searchLocalSellers(
    query: string,
    city: string,
    filters: any = {}
  ) {
    return LocalSeller.find({
      $and: [
        {
          $or: [
            { businessName: { $regex: query, $options: "i" } },
            { "address.city": { $regex: city, $options: "i" } },
          ],
        },
        { status: "active" },
        filters,
      ],
    })
      .populate("products")
      .lean();
  }

  static async updateSellerStatus(
    sellerId: string,
    status: "active" | "inactive" | "suspended",
    reason?: string
  ) {
    const seller = await LocalSeller.findByIdAndUpdate(
      sellerId,
      {
        status,
        $push: {
          statusHistory: {
            status,
            reason,
            changedAt: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!seller) {
      throw new Error("Seller not found");
    }

    return seller;
  }

  static async addProduct(sellerId: string, productId: string) {
    return LocalSeller.findByIdAndUpdate(
      sellerId,
      { $addToSet: { products: productId } },
      { new: true }
    );
  }

  static async removeProduct(sellerId: string, productId: string) {
    return LocalSeller.findByIdAndUpdate(
      sellerId,
      { $pull: { products: productId } },
      { new: true }
    );
  }

  static async addReview(
    sellerId: string,
    userId: string,
    rating: number,
    comment?: string
  ) {
    const seller = await LocalSeller.findById(sellerId);
    if (!seller) {
      throw new Error("Seller not found");
    }

    // Update average rating
    const totalRatings = seller.ratings.count;
    const currentAverage = seller.ratings.average;
    const newAverage =
      (currentAverage * totalRatings + rating) / (totalRatings + 1);

    seller.ratings.average = newAverage;
    seller.ratings.count = totalRatings + 1;
    seller.ratings.reviews.push({
      userId,
      rating,
      comment,
      createdAt: new Date(),
    });

    await seller.save();
    return seller;
  }

  static async getSellerStats(sellerId: string) {
    const seller = await LocalSeller.findById(sellerId)
      .populate("products")
      .lean();

    if (!seller) {
      throw new Error("Seller not found");
    }

    return {
      totalProducts: seller.products.length,
      averageRating: seller.ratings.average,
      totalReviews: seller.ratings.count,
      verificationStatus: seller.verification.status,
      activeSince: seller.createdAt,
    };
  }
}
