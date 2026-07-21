import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
});
const prisma = new PrismaClient({ adapter });

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
};

async function seedBootstrapAdmin() {
  const existingAdmin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });

  if (existingAdmin) {
    console.log("ℹ️  Admin already exists, skipping bootstrap admin creation");
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

  console.log("Bootstrap admin created — phone: 9999999999, password: Admin@123");
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


  console.log("✅ Permissions seeded successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
