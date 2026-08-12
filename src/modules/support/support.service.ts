import prisma from "../../config/db.js";
import { SupportTicketStatus } from "@prisma/client";

export async function getAllSupportTicketsService(status?: SupportTicketStatus) {
  const tickets = await prisma.supportTicket.findMany({
    where: status ? { status } : undefined,
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return tickets;
}

export async function getSupportTicketByIdService(id: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true } },
    },
  });

  if (!ticket) {
    throw new Error("Support ticket not found");
  }
  return ticket;
}

export async function updateSupportTicketStatusService(id: string, status: SupportTicketStatus) {
  const existing = await prisma.supportTicket.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Support ticket not found");
  }

  const ticket = await prisma.supportTicket.update({
    where: { id },
    data: { status },
  });

  return ticket;
}