import { PrismaClient, UserRole, UserStatus, OrganizationStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const GB = 1024 * 1024 * 1024;

async function seedPlans() {
  const plans = [
    {
      code: "FREE",
      name: "Free",
      tier: "FREE" as const,
      description: "1 domain, 2 mailboxes, 1 GB storage",
      maxDomains: 1,
      maxMailboxes: 2,
      storageQuotaBytes: BigInt(1 * GB),
      aliasesEnabled: false,
      forwardersEnabled: false,
      monthlyPrice: 0,
      yearlyPrice: 0,
    },
    {
      code: "PRO",
      name: "Pro",
      tier: "PRO" as const,
      description: "1 domain, 10 mailboxes, 20 GB storage",
      maxDomains: 1,
      maxMailboxes: 10,
      storageQuotaBytes: BigInt(20 * GB),
      aliasesEnabled: true,
      forwardersEnabled: true,
      monthlyPrice: 9.99,
      yearlyPrice: 99.99,
    },
    {
      code: "BUSINESS_A",
      name: "Business (Option A)",
      tier: "BUSINESS" as const,
      description: "1 domain, 50 mailboxes, 100 GB storage",
      maxDomains: 1,
      maxMailboxes: 50,
      storageQuotaBytes: BigInt(100 * GB),
      aliasesEnabled: true,
      forwardersEnabled: true,
      prioritySupport: true,
      businessOption: "A",
      monthlyPrice: 29.99,
      yearlyPrice: 299.99,
    },
    {
      code: "BUSINESS_B",
      name: "Business (Option B)",
      tier: "BUSINESS" as const,
      description: "5 domains, 10 mailboxes per domain, 100 GB storage",
      maxDomains: 5,
      maxMailboxes: 50,
      maxMailboxesPerDomain: 10,
      storageQuotaBytes: BigInt(100 * GB),
      aliasesEnabled: true,
      forwardersEnabled: true,
      prioritySupport: true,
      businessOption: "B",
      monthlyPrice: 39.99,
      yearlyPrice: 399.99,
    },
    {
      code: "ENTERPRISE",
      name: "Enterprise",
      tier: "ENTERPRISE" as const,
      description: "Unlimited domains, mailboxes, and storage",
      maxDomains: -1,
      maxMailboxes: -1,
      storageQuotaBytes: BigInt(1024 * GB),
      aliasesEnabled: true,
      forwardersEnabled: true,
      spamProtection: true,
      prioritySupport: true,
      monthlyPrice: 99.99,
      yearlyPrice: 999.99,
    },
  ];

  const seeded: Record<string, string> = {};
  for (const plan of plans) {
    const record = await prisma.plan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
    seeded[plan.code] = record.id;
  }
  return seeded;
}

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("Admin@123456", 12);
  const planIds = await seedPlans();

  await prisma.user.upsert({
    where: { email: "admin@mailhost.local" },
    update: {},
    create: {
      email: "admin@mailhost.local",
      passwordHash,
      firstName: "Super",
      lastName: "Admin",
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  const organization = await prisma.organization.upsert({
    where: { slug: "acme-corp" },
    update: {
      planId: planIds.PRO,
      maxDomains: 1,
      maxMailboxes: 10,
      storageQuota: BigInt(20 * GB),
      subscriptionStatus: "ACTIVE",
      planActivatedAt: new Date(),
    },
    create: {
      name: "Acme Corporation",
      slug: "acme-corp",
      description: "Demo organization for MailHost Platform",
      status: OrganizationStatus.ACTIVE,
      contactEmail: "contact@acme-corp.com",
      planId: planIds.PRO,
      maxDomains: 1,
      maxMailboxes: 10,
      storageQuota: BigInt(20 * GB),
      subscriptionStatus: "ACTIVE",
      planActivatedAt: new Date(),
    },
  });

  const orgAdmin = await prisma.user.upsert({
    where: { email: "orgadmin@acme-corp.com" },
    update: {},
    create: {
      email: "orgadmin@acme-corp.com",
      passwordHash,
      firstName: "Org",
      lastName: "Admin",
      role: UserRole.ORG_ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      organizationId: organization.id,
    },
  });

  await prisma.organization.update({
    where: { id: organization.id },
    data: { ownerId: orgAdmin.id },
  });

  const domain = await prisma.domain.upsert({
    where: { name: "acme-corp.com" },
    update: {},
    create: {
      name: "acme-corp.com",
      status: "VERIFIED",
      verifiedAt: new Date(),
      isDefault: true,
      spfRecord: "v=spf1 mx ip4:127.0.0.1 -all",
      dmarcRecord: "v=DMARC1; p=none; pct=100",
      mxRecord: "mail.acme-corp.com",
      spfStatus: "VALID",
      dkimStatus: "VALID",
      dmarcStatus: "VALID",
      mxStatus: "VALID",
      organizationId: organization.id,
    },
  });

  const mailbox = await prisma.mailbox.upsert({
    where: { email: "john.doe@acme-corp.com" },
    update: {},
    create: {
      email: "john.doe@acme-corp.com",
      localPart: "john.doe",
      passwordHash,
      displayName: "John Doe",
      status: "ACTIVE",
      quotaBytes: BigInt(5368709120),
      maildirPath: "/var/mail/vhosts/acme-corp.com/john.doe",
      domainId: domain.id,
      organizationId: organization.id,
    },
  });

  const mailUser = await prisma.user.upsert({
    where: { email: "john.doe@acme-corp.com" },
    update: {},
    create: {
      email: "john.doe@acme-corp.com",
      passwordHash,
      firstName: "John",
      lastName: "Doe",
      role: UserRole.MAIL_USER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      organizationId: organization.id,
    },
  });

  await prisma.mailbox.update({
    where: { id: mailbox.id },
    data: { userId: mailUser.id },
  });

  await prisma.setting.upsert({
    where: { key: "smtp" },
    update: {},
    create: {
      key: "smtp",
      category: "mail",
      value: {
        hostname: "mail.acme-corp.com",
        port: 587,
        tls: true,
        ssl: false,
        auth: true,
        maxConnections: 100,
        maxMessageSize: 52428800,
      },
    },
  });

  await prisma.setting.upsert({
    where: { key: "imap" },
    update: {},
    create: {
      key: "imap",
      category: "mail",
      value: { port: 993, ssl: true, tls: true },
    },
  });

  await prisma.setting.upsert({
    where: { key: "pop3" },
    update: {},
    create: {
      key: "pop3",
      category: "mail",
      value: { port: 995, ssl: true, tls: true },
    },
  });

  console.log("Seed completed:");
  console.log(`  Super Admin: admin@mailhost.local / Admin@123456`);
  console.log(`  Org Admin: orgadmin@acme-corp.com / Admin@123456`);
  console.log(`  Mail User: john.doe@acme-corp.com / Admin@123456`);
  console.log(`  Plans seeded: FREE, PRO, BUSINESS_A, BUSINESS_B, ENTERPRISE`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
