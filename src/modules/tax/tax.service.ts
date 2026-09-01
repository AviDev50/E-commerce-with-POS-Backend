import prisma from "../../config/db.js";
import { TaxApplyWhen } from "@prisma/client";

interface CreateTaxClassInput {
  name: string;
}

interface CreateTaxRateInput {
  taxClassId: string;
  country: string;
  state?: string;
  name: string;
  rate: number;
  appliesWhen: TaxApplyWhen;
  isCompound?: boolean;
  priority?: number;
}

interface UpdateTaxClassInput {
  name?: string;
}

interface UpdateTaxRateInput {
  country?: string;
  state?: string;
  name?: string;
  rate?: number;
  appliesWhen?: TaxApplyWhen;
  isCompound?: boolean;
  priority?: number;
}


export async function createTaxClassService(data: CreateTaxClassInput) {
  const existing = await prisma.taxClass.findUnique({ where: { name: data.name } });
  if (existing) {
    throw new Error("A tax class with this name already exists");
  }

  return prisma.taxClass.create({ data });
}

export async function getAllTaxClassesService() {
  return prisma.taxClass.findMany({
    include: { rates: true },
    orderBy: { name: "asc" },
  });
}

export async function deleteTaxClassService(id: string) {
  const existing = await prisma.taxClass.findUnique({
    where: { id },
    include: { _count: { select: { products: true, categories: true } } },
  });

  if (!existing) {
    throw new Error("Tax class not found");
  }

  if (existing._count.products > 0 || existing._count.categories > 0) {
    throw new Error("Cannot delete — this tax class is assigned to products or categories");
  }

  return prisma.taxClass.delete({ where: { id } });
}

export async function createTaxRateService(data: CreateTaxRateInput) {
  const taxClass = await prisma.taxClass.findUnique({ where: { id: data.taxClassId } });
  if (!taxClass) {
    throw new Error("Tax class not found");
  }

  return prisma.taxRate.create({
    data: {
      taxClassId: data.taxClassId,
      country: data.country,
      state: data.state,
      name: data.name,
      rate: data.rate,
      appliesWhen: data.appliesWhen,
      isCompound: data.isCompound ?? false,
      priority: data.priority ?? 0,
    },
  });
}

export async function getTaxRatesByClassService(taxClassId: string) {
  return prisma.taxRate.findMany({
    where: { taxClassId },
    orderBy: [{ country: "asc" }, { priority: "asc" }],
  });
}

export async function deleteTaxRateService(id: string) {
  const existing = await prisma.taxRate.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Tax rate not found");
  }

  return prisma.taxRate.delete({ where: { id } });
}

export async function updateTaxClassService(id: string, data: UpdateTaxClassInput) {
  const existing = await prisma.taxClass.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Tax class not found");
  }

  if (data.name) {
    const nameTaken = await prisma.taxClass.findFirst({ where: { name: data.name, NOT: { id } } });
    if (nameTaken) {
      throw new Error("A tax class with this name already exists");
    }
  }

  return prisma.taxClass.update({ where: { id }, data });
}

export async function updateTaxRateService(id: string, data: UpdateTaxRateInput) {
  const existing = await prisma.taxRate.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Tax rate not found");
  }

  return prisma.taxRate.update({ where: { id }, data });
}

interface ProvisionDefaultTaxInput {
  state: string;
  gstRate?: number; // total GST % — default 18, CGST/SGST isको half-half split karenge
}

export async function provisionDefaultIndiaTaxService(data: ProvisionDefaultTaxInput) {
  const gstRate = data.gstRate ?? 18;
  const halfRate = gstRate / 2;

  const existing = await prisma.taxClass.findUnique({
    where: { name: "Standard" },
  });

  if (existing) {
    const err: any = new Error("Tax data already provisioned for this store");
    err.statusCode = 409;
    throw err;
  }

  const standardClass = await prisma.taxClass.create({
    data: { name: "Standard" },
  });

  await prisma.taxRate.createMany({
    data: [
      {
        taxClassId: standardClass.id,
        country: "India",
        state: data.state,
        name: "CGST",
        rate: halfRate,
        appliesWhen: "ORIGIN_MATCH",
        priority: 1,
      },
      {
        taxClassId: standardClass.id,
        country: "India",
        state: data.state,
        name: "SGST",
        rate: halfRate,
        appliesWhen: "ORIGIN_MATCH",
        priority: 2,
      },
      {
        taxClassId: standardClass.id,
        country: "India",
        state: null,
        name: "IGST",
        rate: gstRate,
        appliesWhen: "ORIGIN_MISMATCH",
        priority: 1,
      },
    ],
  });

  return { message: `Default India tax data seeded for ${data.state} (${gstRate}% GST)`, taxClassId: standardClass.id };
}