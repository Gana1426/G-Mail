import { prisma } from "@/lib/prisma";
import type { Mailbox, MailSession, Prisma } from "@prisma/client";

export class MailPortalMailboxRepository {
  findByEmail(email: string) {
    return prisma.mailbox.findUnique({
      where: { email: email.toLowerCase() },
      include: { domain: true, user: true, mailPreference: true },
    });
  }

  findById(id: string) {
    return prisma.mailbox.findUnique({
      where: { id },
      include: { domain: true, user: true, mailPreference: true },
    });
  }

  updateLastLogin(id: string) {
    return prisma.mailbox.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  updatePassword(id: string, passwordHash: string) {
    return prisma.mailbox.update({
      where: { id },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
  }

  updateUsedBytes(id: string, usedBytes: bigint) {
    return prisma.mailbox.update({
      where: { id },
      data: { usedBytes },
    });
  }

  updateProfile(id: string, data: { displayName?: string | null }) {
    return prisma.mailbox.update({
      where: { id },
      data: {
        displayName: data.displayName,
      },
    });
  }
}

export class MailSessionRepository {
  create(data: Prisma.MailSessionCreateInput) {
    return prisma.mailSession.create({ data });
  }

  findByTokenHash(tokenHash: string) {
    return prisma.mailSession.findUnique({
      where: { tokenHash },
      include: { mailbox: { include: { domain: true, user: true } } },
    });
  }

  findById(id: string) {
    return prisma.mailSession.findUnique({
      where: { id },
      include: { mailbox: { include: { domain: true, user: true } } },
    });
  }

  listByMailbox(mailboxId: string) {
    return prisma.mailSession.findMany({
      where: { mailboxId, expiresAt: { gt: new Date() } },
      orderBy: { lastActiveAt: "desc" },
    });
  }

  touch(id: string) {
    return prisma.mailSession.update({
      where: { id },
      data: { lastActiveAt: new Date() },
    });
  }

  revoke(id: string) {
    return prisma.mailSession.delete({ where: { id } });
  }

  revokeAllExcept(mailboxId: string, exceptId: string) {
    return prisma.mailSession.deleteMany({
      where: { mailboxId, id: { not: exceptId } },
    });
  }

  revokeAll(mailboxId: string) {
    return prisma.mailSession.deleteMany({ where: { mailboxId } });
  }

  deleteExpired() {
    return prisma.mailSession.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }

  updateTokenHash(id: string, tokenHash: string) {
    return prisma.mailSession.update({
      where: { id },
      data: { tokenHash },
    });
  }
}

export class MailPreferenceRepository {
  findByMailbox(mailboxId: string) {
    return prisma.mailPreference.findUnique({ where: { mailboxId } });
  }

  upsert(mailboxId: string, data: Prisma.MailPreferenceUncheckedUpdateInput) {
    const createData: Prisma.MailPreferenceUncheckedCreateInput = {
      ...(data as Prisma.MailPreferenceUncheckedCreateInput),
      mailboxId,
    };
    return prisma.mailPreference.upsert({
      where: { mailboxId },
      create: createData,
      update: data,
    });
  }
}

export class MailSignatureRepository {
  listByMailbox(mailboxId: string) {
    return prisma.mailSignature.findMany({
      where: { mailboxId },
      orderBy: { createdAt: "desc" },
    });
  }

  create(data: Prisma.MailSignatureCreateInput) {
    return prisma.mailSignature.create({ data });
  }

  update(id: string, data: Prisma.MailSignatureUpdateInput) {
    return prisma.mailSignature.update({ where: { id }, data });
  }

  delete(id: string) {
    return prisma.mailSignature.delete({ where: { id } });
  }

  clearDefault(mailboxId: string) {
    return prisma.mailSignature.updateMany({
      where: { mailboxId, isDefault: true },
      data: { isDefault: false },
    });
  }
}

export class MailContactRepository {
  listByMailbox(mailboxId: string) {
    return prisma.mailContact.findMany({
      where: { mailboxId },
      include: { group: true },
      orderBy: { name: "asc" },
    });
  }

  create(data: Prisma.MailContactCreateInput) {
    return prisma.mailContact.create({ data });
  }

  createMany(data: Prisma.MailContactCreateManyInput[]) {
    return prisma.mailContact.createMany({ data, skipDuplicates: true });
  }

  delete(id: string) {
    return prisma.mailContact.delete({ where: { id } });
  }

  listGroups(mailboxId: string) {
    return prisma.mailContactGroup.findMany({
      where: { mailboxId },
      include: { _count: { select: { contacts: true } } },
    });
  }

  createGroup(data: Prisma.MailContactGroupCreateInput) {
    return prisma.mailContactGroup.create({ data });
  }
}

export const mailPortalMailboxRepository = new MailPortalMailboxRepository();
export const mailSessionRepository = new MailSessionRepository();
export const mailPreferenceRepository = new MailPreferenceRepository();
export const mailSignatureRepository = new MailSignatureRepository();
export const mailContactRepository = new MailContactRepository();

export type MailboxWithRelations = Mailbox & {
  domain: { name: string };
  user: { avatar: string | null } | null;
  mailPreference: import("@prisma/client").MailPreference | null;
};

export type MailSessionWithMailbox = MailSession & {
  mailbox: MailboxWithRelations;
};
