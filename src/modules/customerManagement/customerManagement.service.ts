import prisma from "../../config/db.js";

interface QuickCreateInput {
  name: string;
  phone: string;
}

export async function searchCustomerByPhone(phone: string) {
  return prisma.customer.findMany({
    where: {
      phone: { contains: phone },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      createdAt: true,
    },
    take: 10,
  });
}

export async function quickCreateCustomerService(data: QuickCreateInput) {
  const existing = await prisma.customer.findUnique({
    where: { phone: data.phone },
  });

  if (existing) {
    const err: any = new Error(
      "Customer with this phone already exists. Please search instead.",
    );
    err.statusCode = 409;
    throw err;
  }

  return prisma.customer.create({
    data: {
      name: data.name,
      phone: data.phone,
      password: null,
      dob: null,
      gender: null,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      createdAt: true,
    },
  });
}

interface GetAllCustomersFilters {
  search?: string;
}

export async function getAllCustomersService(filters: GetAllCustomersFilters) {
  return prisma.customer.findMany({
    where: filters.search
      ? {
          OR: [{ phone: { contains: filters.search } }],
        }
      : {},
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
