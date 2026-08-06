import prisma from "../../config/db.js"; // apna actual prisma client import path daalo

// ==================== GET PROFILE ====================
export async function getProfile(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      dob: true,
      gender: true,
      createdAt: true,
    },
  });

  if (!customer) {
    const err: any = new Error("Customer not found");
    err.statusCode = 404;
    throw err;
  }

  return customer;
}

// ==================== UPDATE PROFILE ====================
export async function updateProfile(customerId: string, body: any) {
  const { name, email, dob, gender } = body;

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email;
  if (dob !== undefined) updateData.dob = new Date(dob);
  if (gender !== undefined) {
    if (!["MALE", "FEMALE", "OTHER"].includes(gender)) {
      const err: any = new Error("Invalid gender value");
      err.statusCode = 400;
      throw err;
    }
    updateData.gender = gender;
  }
  // phone aur password isse update NAHI honge — alag endpoints (OTP verify / change-password flow)

  const customer = await prisma.customer.update({
    where: { id: customerId },
    data: updateData,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      dob: true,
      gender: true,
      updatedAt: true,
    },
  });

  return customer;
}

// ==================== DELETE PROFILE (HARD DELETE) ====================
export async function deleteProfile(customerId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });

  if (!customer) {
    const err: any = new Error("Customer not found");
    err.statusCode = 404;
    throw err;
  }

  await prisma.customer.delete({ where: { id: customerId } });
  // cascade rules schema me set hai, isliye related rows (address, review, wishlist, cart, refreshToken)
  // auto delete ho jayenge aur orders ka customerId/addressId auto null ho jayega — koi manual transaction nahi chahiye
}