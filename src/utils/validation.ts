import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  twoFactorCode: z.string().length(6).optional(),
});

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain uppercase letter")
    .regex(/[a-z]/, "Must contain lowercase letter")
    .regex(/[0-9]/, "Must contain number")
    .regex(/[!@#$%^&*(),.?":{}|<>]/, "Must contain special character"),
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
});

export const onboardingRegisterSchema = registerSchema.extend({
  organizationName: z
    .string()
    .min(2, "Organization name must be at least 2 characters")
    .max(100),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain uppercase letter")
    .regex(/[a-z]/, "Must contain lowercase letter")
    .regex(/[0-9]/, "Must contain number")
    .regex(/[!@#$%^&*(),.?":{}|<>]/, "Must contain special character"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain uppercase letter")
    .regex(/[a-z]/, "Must contain lowercase letter")
    .regex(/[0-9]/, "Must contain number")
    .regex(/[!@#$%^&*(),.?":{}|<>]/, "Must contain special character"),
});

export const verify2faSchema = z.object({
  code: z.string().length(6, "Code must be 6 digits"),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens")
    .optional(),
  description: z.string().max(500).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(20).optional(),
  address: z.string().max(200).optional(),
  storageQuota: z.number().positive().optional(),
  maxDomains: z.number().int().positive().optional(),
  maxMailboxes: z.number().int().positive().optional(),
  planId: z.string().cuid().optional(),
  ownerEmail: z.string().email().optional(),
  ownerFirstName: z.string().min(1).max(50).optional(),
  ownerLastName: z.string().min(1).max(50).optional(),
  ownerPassword: z.string().min(8).optional(),
});

export const createPlanSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[A-Z0-9_-]+$/, "Code must be uppercase alphanumeric"),
  name: z.string().min(2).max(100),
  tier: z.enum(["FREE", "PRO", "BUSINESS", "ENTERPRISE"]),
  description: z.string().max(500).optional(),
  maxDomains: z.number().int(),
  maxMailboxes: z.number().int(),
  maxMailboxesPerDomain: z.number().int().positive().optional(),
  storageQuotaBytes: z.number().positive(),
  aliasesEnabled: z.boolean().optional(),
  forwardersEnabled: z.boolean().optional(),
  spamProtection: z.boolean().optional(),
  prioritySupport: z.boolean().optional(),
  monthlyPrice: z.number().min(0).optional(),
  yearlyPrice: z.number().min(0).optional(),
  businessOption: z.string().max(10).optional(),
});

export const updatePlanSchema = createPlanSchema.partial();

export const changePlanSchema = z.object({
  planId: z.string().cuid(),
});

export const selectPlanSchema = z.object({
  planId: z.string().cuid(),
  interval: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
});

export const verifyRazorpayPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export const clonePlanSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[A-Z0-9_-]+$/),
});

export const updateAliasSchema = z.object({
  recipients: z.array(z.string().email()).min(1).optional(),
  isActive: z.boolean().optional(),
  mailboxId: z.string().cuid().optional().nullable(),
});

export const updateForwarderSchema = z.object({
  targetEmail: z.string().email().optional(),
  targetMailboxId: z.string().cuid().optional().nullable(),
  keepCopy: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100).optional(),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens")
    .optional(),
  description: z.string().max(500).optional().nullable(),
  contactEmail: z
    .union([z.string().email(), z.literal("")])
    .optional()
    .nullable(),
  contactPhone: z.string().max(20).optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  storageQuota: z.number().positive().optional(),
  maxDomains: z.number().int().optional(),
  maxMailboxes: z.number().int().optional(),
});

export const organizationListQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "PENDING", "SUSPENDED", "DELETED"]).optional(),
  planId: z.string().cuid().optional(),
  createdFrom: z.string().optional(),
  createdTo: z.string().optional(),
  minDomainCount: z.coerce.number().int().min(0).optional(),
  maxDomainCount: z.coerce.number().int().min(0).optional(),
});

export const resetOwnerPasswordSchema = z
  .object({
    password: z.string().min(8).optional(),
    generate: z.boolean().optional(),
  })
  .refine((data) => data.generate || (data.password && data.password.length >= 8), {
    message: "Provide a password (min 8 characters) or set generate to true",
  });

export const createDomainSchema = z.object({
  name: z
    .string()
    .min(3)
    .max(253)
    .regex(
      /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
      "Invalid domain name"
    ),
  isDefault: z.boolean().optional(),
});

export const createMailboxSchema = z
  .object({
    localPart: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-zA-Z0-9._+-]+$/, "Invalid username"),
    domainId: z.string().cuid(),
    firstName: z.string().min(1, "First name is required").max(50),
    lastName: z.string().min(1, "Last name is required").max(50),
    displayName: z.string().max(100).optional(),
    password: z
      .string()
      .min(8)
      .regex(/[A-Z]/, "Must contain uppercase letter")
      .regex(/[a-z]/, "Must contain lowercase letter")
      .regex(/[0-9]/, "Must contain number")
      .regex(/[!@#$%^&*(),.?":{}|<>]/, "Must contain special character"),
    confirmPassword: z.string().min(1, "Confirm password is required"),
    quotaBytes: z.number().positive().optional(),
    role: z.enum(["MAIL_USER", "ORG_ADMIN"]).optional().default("MAIL_USER"),
    status: z.enum(["ACTIVE", "SUSPENDED", "PENDING"]).optional().default("ACTIVE"),
    createUser: z.boolean().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const checkEmailSchema = z.object({
  email: z.string().email(),
});

export const resetMailboxPasswordSchema = z.object({
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/)
    .regex(/[!@#$%^&*(),.?":{}|<>]/),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const updateMailboxSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  displayName: z.string().max(100).optional(),
  quotaBytes: z.number().positive().optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
});

export const createAliasSchema = z.object({
  address: z.string().email(),
  domainId: z.string().cuid(),
  recipients: z.array(z.string().email()).min(1, "At least one recipient required"),
  mailboxId: z.string().cuid().optional(),
});

export const createForwarderSchema = z.object({
  sourceEmail: z.string().email(),
  domainId: z.string().cuid(),
  targetEmail: z.string().email().optional(),
  targetMailboxId: z.string().cuid().optional(),
  type: z.enum(["INTERNAL", "EXTERNAL"]),
  keepCopy: z.boolean().optional(),
}).refine(
  (data) => data.targetEmail || data.targetMailboxId,
  { message: "Either targetEmail or targetMailboxId is required" }
);

export const vacationSchema = z.object({
  enabled: z.boolean(),
  subject: z.string().max(200).optional(),
  message: z.string().max(5000).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  avatar: z.string().url().optional(),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(50),
  permissions: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const spamSettingsSchema = z.object({
  spamScore: z.number().min(0).max(20).optional(),
  whitelist: z.array(z.string().email()).optional(),
  blacklist: z.array(z.string().email()).optional(),
});

export const catchAllSchema = z.object({
  enabled: z.boolean(),
  mailboxId: z.string().cuid().optional(),
});

export const dmarcGeneratorSchema = z.object({
  policy: z.enum(["none", "quarantine", "reject"]),
  percentage: z.number().min(0).max(100).optional(),
  rua: z.string().email().optional(),
  ruf: z.string().email().optional(),
});

export const settingsSchema = z.object({
  smtp: z.object({
    hostname: z.string().optional(),
    port: z.number().optional(),
    tls: z.boolean().optional(),
    ssl: z.boolean().optional(),
    maxConnections: z.number().optional(),
    maxMessageSize: z.number().optional(),
  }).optional(),
  imap: z.object({
    port: z.number().optional(),
    ssl: z.boolean().optional(),
    tls: z.boolean().optional(),
  }).optional(),
  pop3: z.object({
    port: z.number().optional(),
    ssl: z.boolean().optional(),
    tls: z.boolean().optional(),
  }).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type OnboardingRegisterInput = z.infer<typeof onboardingRegisterSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type CreateDomainInput = z.infer<typeof createDomainSchema>;
export type CreateMailboxInput = z.infer<typeof createMailboxSchema>;
export type UpdateMailboxInput = z.infer<typeof updateMailboxSchema>;
export type CreateAliasInput = z.infer<typeof createAliasSchema>;
export type CreateForwarderInput = z.infer<typeof createForwarderSchema>;
export type VacationInput = z.infer<typeof vacationSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
