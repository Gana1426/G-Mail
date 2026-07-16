import {
  mailPortalMailboxRepository,
  mailPreferenceRepository,
  mailSignatureRepository,
  mailSessionRepository,
} from "@mail-portal/repositories/mail.repository";
import { mailProvisionService } from "@/services/mail-provision.service";
import { hashPassword, verifyPassword } from "@/utils/crypto";
import type {
  MailSessionContext,
  MailSettings,
  MailProfile,
  MailProfileUpdateInput,
  MailUiPreferences,
} from "@mail-portal/types/mail";
import { ValidationError } from "@/utils/errors";
import { validatePasswordStrength } from "@/utils/crypto";
import { prisma } from "@/lib/prisma";
import { authService } from "@/services/auth.service";

function parseUiPrefs(raw: unknown): MailUiPreferences {
  if (!raw || typeof raw !== "object") return {};
  return raw as MailUiPreferences;
}

function buildMailSettings(
  pref: Awaited<ReturnType<typeof mailPreferenceRepository.findByMailbox>>,
  signatures: Awaited<ReturnType<typeof mailSignatureRepository.listByMailbox>>,
  mailbox: Awaited<ReturnType<typeof mailPortalMailboxRepository.findById>>
): MailSettings {
  const ui = parseUiPrefs(pref?.keyboardShortcuts);

  return {
    theme: pref?.theme ?? "system",
    language: pref?.language ?? "en",
    timezone: pref?.timezone ?? "UTC",
    signatureId: pref?.signatureId ?? null,
    signatures: signatures.map((s) => ({
      id: s.id,
      name: s.name,
      content: s.content,
      isDefault: s.isDefault,
    })),
    vacationEnabled: mailbox?.vacationEnabled ?? pref?.vacationEnabled ?? false,
    vacationSubject: mailbox?.vacationSubject ?? pref?.vacationSubject ?? null,
    vacationMessage: mailbox?.vacationMessage ?? pref?.vacationMessage ?? null,
    vacationStartDate:
      (mailbox?.vacationStartDate ?? pref?.vacationStartDate)?.toISOString() ?? null,
    vacationEndDate:
      (mailbox?.vacationEndDate ?? pref?.vacationEndDate)?.toISOString() ?? null,
    forwardingEnabled: pref?.forwardingEnabled ?? false,
    forwardingAddress: pref?.forwardingAddress ?? null,
    keepCopy: pref?.keepCopy ?? true,
    conversationView: pref?.conversationView ?? true,
    sidebarWidth: pref?.sidebarWidth ?? 260,
    readingPaneWidth: pref?.readingPaneWidth ?? 560,
    trashRetentionDays: pref?.trashRetentionDays ?? 30,
    displayName: mailbox?.displayName ?? ui.displayName ?? null,
    dateFormat: ui.dateFormat ?? "MMM d, yyyy",
    timeFormat: ui.timeFormat ?? "12h",
    defaultReplyMode: ui.defaultReplyMode ?? "replyAll",
    autoSaveDraft: ui.autoSaveDraft ?? true,
    autoSaveDraftInterval: ui.autoSaveDraftInterval ?? 30,
    readReceiptsDefault: ui.readReceiptsDefault ?? false,
    previewPane: ui.previewPane ?? "right",
    messageDensity: ui.messageDensity ?? "comfortable",
    autoRefreshInterval: ui.autoRefreshInterval ?? 60,
    signatureForNew: ui.signatureForNew ?? null,
    signatureForReply: ui.signatureForReply ?? null,
    signatureForForward: ui.signatureForForward ?? null,
  };
}

export class MailSettingsService {
  async getSettings(session: MailSessionContext): Promise<MailSettings> {
    const [pref, signatures, mailbox] = await Promise.all([
      mailPreferenceRepository.findByMailbox(session.mailboxId),
      mailSignatureRepository.listByMailbox(session.mailboxId),
      mailPortalMailboxRepository.findById(session.mailboxId),
    ]);

    return buildMailSettings(pref, signatures, mailbox);
  }

  async updateSettings(session: MailSessionContext, data: Partial<MailSettings>) {
    const existing = await mailPreferenceRepository.findByMailbox(session.mailboxId);
    const ui = parseUiPrefs(existing?.keyboardShortcuts);

    const nextUi: MailUiPreferences = {
      ...ui,
      ...(data.dateFormat !== undefined ? { dateFormat: data.dateFormat } : {}),
      ...(data.timeFormat !== undefined ? { timeFormat: data.timeFormat } : {}),
      ...(data.defaultReplyMode !== undefined
        ? { defaultReplyMode: data.defaultReplyMode }
        : {}),
      ...(data.autoSaveDraft !== undefined ? { autoSaveDraft: data.autoSaveDraft } : {}),
      ...(data.autoSaveDraftInterval !== undefined
        ? { autoSaveDraftInterval: data.autoSaveDraftInterval }
        : {}),
      ...(data.readReceiptsDefault !== undefined
        ? { readReceiptsDefault: data.readReceiptsDefault }
        : {}),
      ...(data.previewPane !== undefined ? { previewPane: data.previewPane } : {}),
      ...(data.messageDensity !== undefined ? { messageDensity: data.messageDensity } : {}),
      ...(data.autoRefreshInterval !== undefined
        ? { autoRefreshInterval: data.autoRefreshInterval }
        : {}),
      ...(data.signatureForNew !== undefined
        ? { signatureForNew: data.signatureForNew }
        : {}),
      ...(data.signatureForReply !== undefined
        ? { signatureForReply: data.signatureForReply }
        : {}),
      ...(data.signatureForForward !== undefined
        ? { signatureForForward: data.signatureForForward }
        : {}),
      ...(data.displayName !== undefined ? { displayName: data.displayName ?? undefined } : {}),
    };

    if (data.displayName !== undefined) {
      await mailPortalMailboxRepository.updateProfile(session.mailboxId, {
        displayName: data.displayName,
      });
    }

    await mailPreferenceRepository.upsert(session.mailboxId, {
      theme: data.theme,
      language: data.language,
      timezone: data.timezone,
      signatureId: data.signatureId,
      vacationEnabled: data.vacationEnabled,
      vacationSubject: data.vacationSubject,
      vacationMessage: data.vacationMessage,
      vacationStartDate: data.vacationStartDate
        ? new Date(data.vacationStartDate)
        : undefined,
      vacationEndDate: data.vacationEndDate ? new Date(data.vacationEndDate) : undefined,
      forwardingEnabled: data.forwardingEnabled,
      forwardingAddress: data.forwardingAddress,
      keepCopy: data.keepCopy,
      conversationView: data.conversationView,
      sidebarWidth: data.sidebarWidth,
      readingPaneWidth: data.readingPaneWidth,
      trashRetentionDays: data.trashRetentionDays,
      keyboardShortcuts: nextUi as object,
    });

    return this.getSettings(session);
  }

  async changePassword(
    session: MailSessionContext,
    currentPassword: string,
    newPassword: string
  ) {
    const mailbox = await mailPortalMailboxRepository.findById(session.mailboxId);
    if (!mailbox) throw new ValidationError("Mailbox not found");

    const valid = await verifyPassword(currentPassword, mailbox.passwordHash);
    if (!valid) throw new ValidationError("Current password is incorrect");

    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      throw new ValidationError(strength.errors.join(". "));
    }

    const passwordHash = await hashPassword(newPassword);
    await mailPortalMailboxRepository.updatePassword(session.mailboxId, passwordHash);

    const maildirPath =
      mailbox.maildirPath ??
      mailProvisionService.getMaildirPath(mailbox.domain.name, mailbox.localPart);

    await mailProvisionService.updateMailboxPassword(
      mailbox.email,
      passwordHash,
      maildirPath
    );

    return { success: true };
  }

  async upsertSignature(
    session: MailSessionContext,
    data: { id?: string; name: string; content: string; isDefault?: boolean }
  ) {
    const signatures = await mailSignatureRepository.listByMailbox(session.mailboxId);
    const existing = data.id
      ? signatures.find((signature) => signature.id === data.id)
      : null;
    const shouldBeDefault =
      data.isDefault ?? existing?.isDefault ?? signatures.length === 0;

    if (shouldBeDefault) {
      await mailSignatureRepository.clearDefault(session.mailboxId);
    }

    if (data.id) {
      return mailSignatureRepository.update(data.id, {
        name: data.name,
        content: data.content,
        isDefault: shouldBeDefault,
      });
    }

    return mailSignatureRepository.create({
      mailbox: { connect: { id: session.mailboxId } },
      name: data.name,
      content: data.content,
      isDefault: shouldBeDefault,
    });
  }

  async deleteSignature(session: MailSessionContext, signatureId: string) {
    const signatures = await mailSignatureRepository.listByMailbox(session.mailboxId);
    const target = signatures.find((s) => s.id === signatureId);
    if (!target) throw new ValidationError("Signature not found");
    await mailSignatureRepository.delete(signatureId);

    const remaining = signatures.filter((s) => s.id !== signatureId);
    const fallbackDefault = remaining.find((s) => s.isDefault) ?? remaining[0] ?? null;

    if (target.isDefault && fallbackDefault) {
      await mailSignatureRepository.clearDefault(session.mailboxId);
      await mailSignatureRepository.update(fallbackDefault.id, { isDefault: true });
    }

    const pref = await mailPreferenceRepository.findByMailbox(session.mailboxId);
    const ui = parseUiPrefs(pref?.keyboardShortcuts);
    const replaceDeletedRef = (value: string | null | undefined) =>
      value === signatureId ? fallbackDefault?.id ?? null : value ?? null;

    await mailPreferenceRepository.upsert(session.mailboxId, {
      signatureId:
        pref?.signatureId === signatureId ? fallbackDefault?.id ?? null : pref?.signatureId,
      keyboardShortcuts: {
        ...ui,
        signatureForNew: replaceDeletedRef(ui.signatureForNew),
        signatureForReply: replaceDeletedRef(ui.signatureForReply),
        signatureForForward: replaceDeletedRef(ui.signatureForForward),
      } as object,
    });

    return { success: true };
  }

  async duplicateSignature(session: MailSessionContext, signatureId: string) {
    const signatures = await mailSignatureRepository.listByMailbox(session.mailboxId);
    const source = signatures.find((s) => s.id === signatureId);
    if (!source) throw new ValidationError("Signature not found");

    return mailSignatureRepository.create({
      mailbox: { connect: { id: session.mailboxId } },
      name: `${source.name} (copy)`,
      content: source.content,
      isDefault: false,
    });
  }

  async setDefaultSignature(session: MailSessionContext, signatureId: string) {
    const signatures = await mailSignatureRepository.listByMailbox(session.mailboxId);
    const target = signatures.find((s) => s.id === signatureId);
    if (!target) throw new ValidationError("Signature not found");

    await mailSignatureRepository.clearDefault(session.mailboxId);
    return mailSignatureRepository.update(signatureId, { isDefault: true });
  }
}

export class MailProfileService {
  async getProfile(session: MailSessionContext): Promise<MailProfile> {
    const mailbox = await mailPortalMailboxRepository.findById(session.mailboxId);
    if (!mailbox) throw new ValidationError("Mailbox not found");

    const pref = mailbox.mailPreference;
    const ui = parseUiPrefs(pref?.keyboardShortcuts);
    const sessions = await mailSessionRepository.listByMailbox(session.mailboxId);
    const usedBytes = mailbox.usedBytes;
    const quotaBytes = mailbox.quotaBytes;
    const storagePercent =
      quotaBytes > BigInt(0) ? Number((usedBytes * BigInt(100)) / quotaBytes) : 0;

    return {
      id: mailbox.id,
      email: mailbox.email,
      displayName: mailbox.displayName,
      firstName: mailbox.firstName,
      lastName: mailbox.lastName,
      avatar: mailbox.user?.avatar ?? null,
      phone: ui.phone ?? null,
      timezone: pref?.timezone ?? "UTC",
      language: pref?.language ?? "en",
      twoFactorEnabled: mailbox.user?.twoFactorEnabled ?? false,
      storageUsed: usedBytes.toString(),
      storageQuota: quotaBytes.toString(),
      storagePercent,
      lastLoginAt: mailbox.lastLoginAt?.toISOString() ?? null,
      loginHistory: ui.loginHistory ?? [],
      sessions: sessions.map((s) => ({
        id: s.id,
        deviceInfo: s.deviceInfo,
        ipAddress: s.ipAddress,
        lastActiveAt: s.lastActiveAt.toISOString(),
        createdAt: s.createdAt.toISOString(),
        current: s.id === session.sessionId,
      })),
    };
  }

  async updateProfile(session: MailSessionContext, data: MailProfileUpdateInput) {
    const mailbox = await mailPortalMailboxRepository.findById(session.mailboxId);
    if (!mailbox) throw new ValidationError("Mailbox not found");

    if (data.displayName !== undefined) {
      await mailPortalMailboxRepository.updateProfile(session.mailboxId, {
        displayName: data.displayName,
      });
    }

    if (data.firstName !== undefined || data.lastName !== undefined) {
      await prisma.mailbox.update({
        where: { id: session.mailboxId },
        data: {
          ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
          ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
        },
      });
    }

    if (data.avatar !== undefined && mailbox.userId) {
      await prisma.user.update({
        where: { id: mailbox.userId },
        data: { avatar: data.avatar },
      });
    }

    const pref = await mailPreferenceRepository.findByMailbox(session.mailboxId);
    const ui = parseUiPrefs(pref?.keyboardShortcuts);

    await mailPreferenceRepository.upsert(session.mailboxId, {
      timezone: data.timezone,
      language: data.language,
      keyboardShortcuts: {
        ...ui,
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
      } as object,
    });

    return this.getProfile(session);
  }

  async revokeSession(session: MailSessionContext, sessionId: string) {
    if (sessionId === session.sessionId) {
      throw new ValidationError("Cannot revoke current session from here");
    }
    await mailSessionRepository.revoke(sessionId);
  }

  async revokeAllOtherSessions(session: MailSessionContext) {
    await mailSessionRepository.revokeAllExcept(session.mailboxId, session.sessionId);
  }

  private async resolveLinkedUserId(session: MailSessionContext): Promise<string> {
    const mailbox = await mailPortalMailboxRepository.findById(session.mailboxId);
    if (!mailbox?.userId) {
      throw new ValidationError("This mailbox is not linked to a user account");
    }
    return mailbox.userId;
  }

  async setup2FA(session: MailSessionContext) {
    const userId = await this.resolveLinkedUserId(session);
    return authService.setup2FA(userId);
  }

  async enable2FA(session: MailSessionContext, code: string) {
    const userId = await this.resolveLinkedUserId(session);
    await authService.enable2FA(userId, code);
  }

  async disable2FA(session: MailSessionContext, code: string) {
    const userId = await this.resolveLinkedUserId(session);
    await authService.disable2FA(userId, code);
  }
}

export const mailSettingsService = new MailSettingsService();
export const mailProfileService = new MailProfileService();
