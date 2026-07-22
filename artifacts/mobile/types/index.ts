export type Category = "cars" | "equipment" | "services";
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "accepted"
  | "scheduled"
  | "started"
  | "cancel_requested"
  | "refund_pending"
  | "refunded"
  | "disputed"
  | "closed"
  | "draft";
export type PaymentStatus = "pending" | "paid" | "refunded";
export type PriceUnit = "per_day" | "per_hour";

export interface Listing {
  id: string;
  providerId: string;
  providerName: string | null;
  providerPhone: string | null;
  providerRating: number | null;
  providerReviewCount: number;
  category: Category;
  subcategory: string | null;
  title: string;
  description: string | null;
  price: number;
  priceUnit: PriceUnit;
  images: string[];
  location: string;
  rating: number | null;
  reviewCount: number;
  isAvailable: boolean;
  operatorIncluded: boolean | null;
  fuelIncluded: boolean | null;
  deliveryCharges: number | null;
  createdAt: string;
}

export interface Booking {
  id: string;
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
  providerId: string;
  listingId: string;
  listingTitle: string | null;
  listingCategory: string | null;
  listingImage: string | null;
  startDate: string;
  endDate: string;
  totalDays: number;
  totalAmount: number;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  notes: string | null;
  bookingDate: string | null;
  timeSlot: string | null;
  serviceType: string | null;
  createdAt: string;
}

export interface Review {
  id: string;
  userId: string;
  userName: string | null;
  providerId: string | null;
  listingId: string | null;
  bookingId: string | null;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface Chat {
  id: string;
  participants: string[];
  otherUserId: string | null;
  otherUserName: string | null;
  otherUserPhone: string | null;
  listingId: string | null;
  listingTitle: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  createdAt: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string | null;
  content: string;
  createdAt: string;
}
