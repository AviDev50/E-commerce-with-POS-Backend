import { array } from "node:stream/iter";
import prisma from "../../config/db";
import { register } from "node:module";

interface CreateReviewInput {
  productId: string;
  customerId: string;
  rating: number;
  comment?: string;
}

export async function createReviewService(data: CreateReviewInput) {
  if (data.rating < 1 || data.rating > 5) {
    throw new Error("Rating must be between 1 and 5");
  }

  // Verified purchase check — customer ne is product ka koi COMPLETED order kiya ho
  const purchase = await prisma.orderItem.findFirst({
    where: {
      productId: data.productId,
      order: {
        customerId: data.customerId,
        status: "COMPLETED",
      },
    },
  });

  if (!purchase) {
    throw new Error("You can only review products you have purchased");
  }

  const existingReview = await prisma.review.findFirst({
    where: { productId: data.productId, customerId: data.customerId },
  });

  if (existingReview) {
    throw new Error("You have already reviewed this product");
  }

  return prisma.review.create({
    data: {
      productId: data.productId,
      customerId: data.customerId,
      rating: data.rating,
      comment: data.comment,
      isApproved: false, // moderation ke baad hi live hoga
    },
  });
}

export async function getReviewsByProductService(productId: string, includeUnapproved: boolean) {
  return prisma.review.findMany({
    where: {
      productId,
      ...(includeUnapproved ? {} : { isApproved: true }),
    },
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function moderateReviewService(id: string, isApproved: boolean) {
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) {
    throw new Error("Review not found");
  }

  return prisma.review.update({ where: { id }, data: { isApproved } });
}

export async function deleteReviewService(id: string, requesterCustomerId?: string) {
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) {
    throw new Error("Review not found");
  }

  // Agar customer khud delete kar raha hai, to sirf apna review delete kar sakta hai
  if (requesterCustomerId && review.customerId !== requesterCustomerId) {
    throw new Error("You can only delete your own review");
  }

  return prisma.review.delete({ where: { id } });
}

//only for user which want to give review for purched product 