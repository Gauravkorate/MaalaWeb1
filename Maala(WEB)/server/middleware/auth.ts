import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface AuthRequest extends Request {
  user?: {
    userId: string;
  };
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    ) as { userId: string };

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid token" });
  }
};

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // This is a placeholder for admin role check
  // You would typically check the user's role from the database
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  // Example: Check if user is admin
  // const user = await User.findById(req.user.userId);
  // if (!user || !user.isAdmin) {
  //   return res.status(403).json({ message: 'Admin access required' });
  // }

  next();
};
