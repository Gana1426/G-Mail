export type MailFolderId =
  | "INBOX"
  | "SENT"
  | "DRAFTS"
  | "SPAM"
  | "TRASH"
  | "ARCHIVE"
  | "STARRED"
  | "IMPORTANT"
  | "OUTBOX";

export interface MailAddress {
  name?: string;
  address: string;
}

export interface MailAttachmentMeta {
  id: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface MailMessageSummary {
  uid: string;
  messageId?: string;
  folder: MailFolderId;
  from: MailAddress;
  to: MailAddress[];
  cc?: MailAddress[];
  subject: string;
  preview: string;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  isImportant: boolean;
  hasAttachments: boolean;
  attachmentCount: number;
  size: number;
  labels?: string[];
}

export interface MailMessageDetail extends MailMessageSummary {
  bcc?: MailAddress[];
  html?: string;
  text?: string;
  attachments: MailAttachmentMeta[];
  inReplyTo?: string;
  references?: string[];
  headers?: Record<string, string>;
}

export interface MailFolderInfo {
  id: MailFolderId;
  name: string;
  path: string;
  total: number;
  unread: number;
  selectable: boolean;
}

export interface MailDashboardStats {
  unreadCount: number;
  storageUsed: string;
  storageQuota: string;
  storagePercent: number;
  folders: MailFolderInfo[];
  recentEmails: MailMessageSummary[];
}

export interface SendMailInput {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    content: string;
  }>;
  priority?: "normal" | "high" | "low";
  requestReadReceipt?: boolean;
  inReplyTo?: string;
  references?: string[];
}

export interface MailSearchQuery {
  q?: string;
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
  folder?: MailFolderId;
  hasAttachment?: boolean;
  isRead?: boolean;
  isUnread?: boolean;
  isStarred?: boolean;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export type MessageDensity = "compact" | "comfortable" | "spacious";
export type PreviewPaneMode = "right" | "bottom" | "off";
export type DefaultReplyMode = "reply" | "replyAll";
export type DateFormatPreference = "MMM d, yyyy" | "dd/MM/yyyy" | "MM/dd/yyyy";
export type TimeFormatPreference = "12h" | "24h";

export interface MailUiPreferences {
  displayName?: string;
  phone?: string;
  dateFormat?: DateFormatPreference;
  timeFormat?: TimeFormatPreference;
  defaultReplyMode?: DefaultReplyMode;
  autoSaveDraft?: boolean;
  autoSaveDraftInterval?: number;
  readReceiptsDefault?: boolean;
  previewPane?: PreviewPaneMode;
  messageDensity?: MessageDensity;
  autoRefreshInterval?: number;
  signatureForNew?: string | null;
  signatureForReply?: string | null;
  signatureForForward?: string | null;
  loginHistory?: Array<{ at: string; ip: string | null; device: string | null }>;
}

export interface MailSessionContext {
  sessionId: string;
  mailboxId: string;
  email: string;
  displayName: string | null;
  maildirPath: string;
  password: string;
}

export interface MailProfile {
  id: string;
  email: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
  phone: string | null;
  timezone: string;
  language: string;
  twoFactorEnabled: boolean;
  storageUsed: string;
  storageQuota: string;
  storagePercent: number;
  lastLoginAt: string | null;
  loginHistory: Array<{ at: string; ip: string | null; device: string | null }>;
  sessions: Array<{
    id: string;
    deviceInfo: string | null;
    ipAddress: string | null;
    lastActiveAt: string;
    createdAt: string;
    current: boolean;
  }>;
}

export interface MailProfileUpdateInput {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  timezone?: string;
  language?: string;
  avatar?: string | null;
}

export interface MailSettings {
  theme: string;
  language: string;
  timezone: string;
  signatureId: string | null;
  signatures: Array<{ id: string; name: string; content: string; isDefault: boolean }>;
  vacationEnabled: boolean;
  vacationSubject: string | null;
  vacationMessage: string | null;
  vacationStartDate: string | null;
  vacationEndDate: string | null;
  forwardingEnabled: boolean;
  forwardingAddress: string | null;
  keepCopy: boolean;
  conversationView: boolean;
  sidebarWidth: number;
  readingPaneWidth: number;
  trashRetentionDays: number;
  displayName: string | null;
  dateFormat: DateFormatPreference;
  timeFormat: TimeFormatPreference;
  defaultReplyMode: DefaultReplyMode;
  autoSaveDraft: boolean;
  autoSaveDraftInterval: number;
  readReceiptsDefault: boolean;
  previewPane: PreviewPaneMode;
  messageDensity: MessageDensity;
  autoRefreshInterval: number;
  signatureForNew: string | null;
  signatureForReply: string | null;
  signatureForForward: string | null;
}
