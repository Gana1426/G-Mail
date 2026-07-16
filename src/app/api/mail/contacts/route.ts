import { NextRequest } from "next/server";
import { withMailAuth } from "@mail-portal/lib/mail-auth";
import { mailContactRepository } from "@mail-portal/repositories/mail.repository";
import { successResponse } from "@/utils/errors";
import { z } from "zod";

const contactSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  phone: z.string().optional(),
  company: z.string().optional(),
  notes: z.string().optional(),
  groupId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  return withMailAuth(request, async (_req, session) => {
    const contacts = await mailContactRepository.listByMailbox(session.mailboxId);
    const groups = await mailContactRepository.listGroups(session.mailboxId);
    return successResponse({ contacts, groups });
  });
}

export async function POST(request: NextRequest) {
  return withMailAuth(request, async (req, session) => {
    const body = await req.json();

    if (body.action === "import" && Array.isArray(body.contacts)) {
      await mailContactRepository.createMany(
        body.contacts.map((c: { email: string; name: string }) => ({
          mailboxId: session.mailboxId,
          email: c.email,
          name: c.name,
        }))
      );
      return successResponse(null, "Contacts imported");
    }

    const input = contactSchema.parse(body);
    const contact = await mailContactRepository.create({
      mailbox: { connect: { id: session.mailboxId } },
      email: input.email,
      name: input.name,
      phone: input.phone,
      company: input.company,
      notes: input.notes,
      ...(input.groupId ? { group: { connect: { id: input.groupId } } } : {}),
    });
    return successResponse(contact, "Contact created");
  });
}
