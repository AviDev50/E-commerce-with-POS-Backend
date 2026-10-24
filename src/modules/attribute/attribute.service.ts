import prisma from "../../config/db.js";

interface CreateAttributeInput {
  name: string;
}

interface CreateAttributeValueInput {
  attributeId: string;
  value: string;
}

export const createAttributeService = async (data: CreateAttributeInput) => {
  const existing = await prisma.attribute.findUnique({
    where: { name: data.name },
  });

  if (existing) {
    throw new Error("Attribute with this name already exists");
  }

  return prisma.attribute.create({ data });
};

export const getAllAttributesService = async () => {
  return prisma.attribute.findMany({
    include: { values: true },
    orderBy: { name: "asc" },
  });
};

export const addAttributeValueService = async (
  data: CreateAttributeValueInput,
) => {
  const attribute = await prisma.attribute.findUnique({
    where: { id: data.attributeId },
  });

  if (!attribute) {
    throw new Error("Attribute not found");
  }

  const existingValue = await prisma.attributeValue.findFirst({
    where: {
      attributeId: data.attributeId,
      value: { equals: data.value },
    },
  });

  if (existingValue) {
    throw new Error("This value already exists for the attribute");
  }

  return prisma.attributeValue.create({
    data: {
      attributeId: data.attributeId,
      value: data.value,
    },
  });
};

// Reusable helper — "Find or Create" pattern (jaisa humne discuss kiya tha)
export const findOrCreateAttributeValueService = async (
  attributeId: string,
  value: string,
) => {
  const existingValue = await prisma.attributeValue.findFirst({
    where: {
      attributeId,
      value: { equals: value },
    },
  });

  if (existingValue) {
    return existingValue;
  }

  return prisma.attributeValue.create({
    data: { attributeId, value },
  });
};

export const deleteAttributeValueService = async (id: string) => {
  const existing = await prisma.attributeValue.findUnique({ where: { id } });

  if (!existing) {
    throw new Error("Attribute value not found");
  }

  return prisma.attributeValue.delete({ where: { id } });
};

export const deleteAttributeService = async (id: string) => {
  const existing = await prisma.attribute.findUnique({ where: { id } });

  if (!existing) {
    throw new Error("Attribute not found");
  }

  return prisma.attribute.delete({ where: { id } });
};
