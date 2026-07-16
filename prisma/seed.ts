import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
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
};

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