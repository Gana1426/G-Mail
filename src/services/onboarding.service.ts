import { prisma } from "@/lib/prisma";
import { userRepository } from "@/repositories/user.repository";
import { organizationRepository } from "@/repositories/organization.repository";
import { domainRepository } from "@/repositories/domain.repository";
import { emailVerificationRepository } from "@/repositories/user.repository";
import { hashPassword, generateSecureToken, hashToken } from "@/utils/crypto";
import { ConflictError } from "@/utils/errors";
import { UserRole, UserStatus, OrganizationStatus } from "@prisma/client";
import type { OnboardingRegisterInput } from "@/utils/validation";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export class OnboardingService {
  async register(input: OnboardingRegisterInput) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw new ConflictError("Email already registered");
    }

    let slug = slugify(input.organizationName);
    const slugExists = await organizationRepository.findBySlug(slug);
    if (slugExists) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const passwordHash = await hashPassword(input.password);
    const verificationToken = generateSecureToken();

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: input.organizationName,
          slug,
          contactEmail: input.email.toLowerCase(),
          status: OrganizationStatus.PENDING,
          subscriptionStatus: "NONE",
        },
      });

      const user = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          role: UserRole.ORG_ADMIN,
          status: UserStatus.PENDING,
          organizationId: organization.id,
        },
      });

      await tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          token: hashToken(verificationToken),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      await tx.organization.update({
        where: { id: organization.id },
        data: { ownerId: user.id },
      });

      return { user, organization, verificationToken };
    });

    return result;
  }

  async getStatus(organizationId: string) {
    const domains = await domainRepository.findByOrganization(organizationId);
    const hasDomain = domains.length > 0;
    const hasVerifiedDomain = domains.some((d) => d.status === "VERIFIED");
    const verifiedDomains = domains.filter((d) => d.status === "VERIFIED");
    const pendingDomains = domains.filter((d) => d.status === "PENDING");

    return {
      hasDomain,
      hasVerifiedDomain,
      domainCount: domains.length,
      verifiedDomainCount: verifiedDomains.length,
      pendingDomainCount: pendingDomains.length,
      domains: domains.map((d) => ({
        id: d.id,
        name: d.name,
        status: d.status,
        verifiedAt: d.verifiedAt,
      })),
      canCreateMailboxes: hasVerifiedDomain,
      onboardingComplete: hasVerifiedDomain,
    };
  }
}

export const onboardingService = new OnboardingService();
