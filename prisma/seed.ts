import prisma from "../src/config/db";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcrypt";

//const prisma = new PrismaClient();

const permissions = [
  { key: "product:create", description: "Create new products" },
  { key: "product:read", description: "View products" },
  { key: "product:update", description: "Edit products" },
  { key: "product:delete", description: "Delete/deactivate products" },

  { key: "attribute:create", description: "Create attributes and values" },
  { key: "attribute:read", description: "View attributes and values" },
  { key: "attribute:update", description: "Edit attributes and values" },
  { key: "attribute:delete", description: "Delete attributes and values" },

  { key: "category:create", description: "Create categories" },
  { key: "category:read", description: "View categories" },
  { key: "category:update", description: "Edit categories" },
  { key: "category:delete", description: "Delete categories" },

  { key: "banner:create", description: "Create homepage banners" },
  { key: "banner:read", description: "View banners" },
  { key: "banner:update", description: "Edit banners" },
  { key: "banner:delete", description: "Delete banners" },

  { key: "order:create:pos", description: "Create POS orders" },
  { key: "order:read", description: "View orders" },
  { key: "order:update", description: "Update order status" },
  { key: "order:refund", description: "Refund orders" },

  { key: "settings:update", description: "Update store settings" },

  { key: "coupon:create", description: "Create coupons" },
  { key: "coupon:read", description: "View coupons" },
  { key: "coupon:update", description: "Edit coupons" },
  { key: "coupon:delete", description: "Delete coupons" },

  { key: "review:moderate", description: "Approve or reject reviews" },
  { key: "review:delete", description: "Delete any review" },
  { key: "return:view", description: "to return product" },
  { key: "return:manage", description: "to return product management" },
  { key: "dashboard:view", description: "to view dashboard" },
  { key: "customer:create", description: "to create customer in pos" },
  {
    key: "customer:search",
    description: "to search customer to create pos order",
  },
  { key: "staff:view", description: "to view staff details" },
  { key: "staff:manage", description: "to manage staff" },
  { key: "support:read", description: "View support tickets" },
  { key: "support:update", description: "Update support ticket status" },
  { key: "page:read", description: "View static pages content" },
  {
    key: "page:update",
    description: "Update static pages (About, T&C, Privacy, Return Policy)",
  },
  { key: "product:view:pos", description: "to view pos products" },
  { key: "report:sales:view", description: "to view reports of a products" },
   { key: "shift:manage", description: "to view reports of a products" },
   { key: "shift:view:all", description: "to view shift of all employee" },
   { key: "order:hold", description: "to create other orders when any customer is busy" },
   { key: "customer:read", description: "View customer list" },
   { key: "tax:manage", description: "To create tax class and rate"},
];

const defaultRoleMapping: Record<string, Role[]> = {
  "product:create": [Role.ADMIN, Role.MANAGER],
  "product:read": [Role.ADMIN, Role.MANAGER, Role.CASHIER],
  "product:update": [Role.ADMIN, Role.MANAGER],
  "product:delete": [Role.ADMIN],

  "attribute:create": [Role.ADMIN, Role.MANAGER],
  "attribute:read": [Role.ADMIN, Role.MANAGER, Role.CASHIER],
  "attribute:update": [Role.ADMIN, Role.MANAGER],
  "attribute:delete": [Role.ADMIN, Role.MANAGER],

  "category:create": [Role.ADMIN, Role.MANAGER],
  "category:read": [Role.ADMIN, Role.MANAGER, Role.CASHIER],
  "category:update": [Role.ADMIN, Role.MANAGER],
  "category:delete": [Role.ADMIN],

  "banner:create": [Role.ADMIN, Role.MANAGER],
  "banner:read": [Role.ADMIN, Role.MANAGER],
  "banner:update": [Role.ADMIN, Role.MANAGER],
  "banner:delete": [Role.ADMIN, Role.MANAGER],

  "order:create:pos": [Role.ADMIN, Role.MANAGER, Role.CASHIER],
  "order:read": [Role.ADMIN, Role.MANAGER, Role.CASHIER],
  "order:update": [Role.ADMIN, Role.MANAGER],
  "order:refund": [Role.ADMIN, Role.MANAGER],

  "settings:update": [Role.ADMIN],

  "coupon:create": [Role.ADMIN, Role.MANAGER],
  "coupon:read": [Role.ADMIN, Role.MANAGER, Role.CASHIER],
  "coupon:update": [Role.ADMIN, Role.MANAGER],
  "coupon:delete": [Role.ADMIN, Role.MANAGER],

  "review:moderate": [Role.ADMIN, Role.MANAGER],
  "review:delete": [Role.ADMIN, Role.MANAGER],
  "return:view": [Role.ADMIN, Role.MANAGER],
  "return:manage": [Role.ADMIN, Role.MANAGER],
  "dashboard:view": [Role.ADMIN, Role.MANAGER],
  "customer:create": [Role.ADMIN, Role.MANAGER, Role.CASHIER],
  "customer:search": [Role.ADMIN, Role.MANAGER, Role.CASHIER],
  "staff:view": [Role.ADMIN],
  "staff:manage": [Role.ADMIN],
  "support:read": [Role.ADMIN, Role.MANAGER],
  "support:update": [Role.ADMIN, Role.MANAGER],
  "page:read": [Role.ADMIN],
  "page:update": [Role.ADMIN],
  "product:view:pos": [Role.ADMIN, Role.MANAGER, Role.CASHIER],
  "report:sales:view": [Role.ADMIN, Role.CASHIER],
  "shift:manage": [Role.ADMIN, Role.CASHIER, Role.MANAGER],
  "shift:view:all": [Role.ADMIN],
  "order:hold": [Role.ADMIN, Role.MANAGER, Role.CASHIER],
  "customer:read": [Role.ADMIN, Role.MANAGER],
  "tax:manage":[Role.ADMIN]
};

async function seedBootstrapAdmin() {
  const existingAdmin = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
  });

  if (existingAdmin) {
    console.log("Admin already exists, skipping bootstrap admin creation");
    return;
  }

  const hashedPassword = await bcrypt.hash("Admin@123", 10);

  await prisma.user.create({
    data: {
      name: "Default Admin",
      phone: "9999999999",
      password: hashedPassword,
      role: Role.ADMIN,
    },
  });

  console.log(
    "Bootstrap admin created — phone: 9999999999, password: Admin@123",
  );
}

async function main() {
  for (const perm of permissions) {
    const permission = await prisma.permission.upsert({
      where: { key: perm.key },
      update: {},
      create: perm,
    });

    const roles = defaultRoleMapping[perm.key] || [];

    for (const role of roles) {
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role, permissionId: permission.id } },
        update: {},
        create: { role, permissionId: permission.id },
      });
    }
  }

  await seedBootstrapAdmin();
  await seedIndiaTax();

  console.log("Permissions seeded successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


//no needed now , we created api for this new one time onboarding api for new store
async function seedIndiaTax() {
  const existing = await prisma.taxClass.findUnique({
    where: { name: "Standard" },
  });
  if (existing) {
    console.log("Tax data already seeded, skipping");
    return;
  }

  const standardClass = await prisma.taxClass.create({
    data: { name: "Standard" },
  });

  await prisma.taxRate.createMany({
    data: [
      {
        taxClassId: standardClass.id,
        country: "India",
        state: "Uttar Pradesh", // apna StoreSettings.state jo bhi hai
        name: "CGST",
        rate: 9,
        appliesWhen: "ORIGIN_MATCH",
        priority: 1,
      },
      {
        taxClassId: standardClass.id,
        country: "India",
        state: "Uttar Pradesh",
        name: "SGST",
        rate: 9,
        appliesWhen: "ORIGIN_MATCH",
        priority: 2,
      },
      {
        taxClassId: standardClass.id,
        country: "India",
        state: null,
        name: "IGST",
        rate: 18,
        appliesWhen: "ORIGIN_MISMATCH",
        priority: 1,
      },
    ],
  });

  console.log("Default India tax data seeded (Standard class — 18% GST)");
}
