import prisma from "../../config/db.js";

interface CreateSupportTicketInput {
  customerId: string;
  title: string;
  description: string;
}

export async function createSupportTicketService(input: CreateSupportTicketInput) {
  const { customerId, title, description } = input;

  if (!title?.trim() || !description?.trim()) {
    throw new Error("Title and description are required");
  }

  const ticket = await prisma.supportTicket.create({
    data: { customerId, title: title.trim(), description: description.trim() },
  });

  return ticket;
}

export async function getMySupportTicketsService(customerId: string) {
  const tickets = await prisma.supportTicket.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
  });
  return tickets;
}

export async function getMySupportTicketByIdService(customerId: string, ticketId: string) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });

  if (!ticket || ticket.customerId !== customerId) {
    throw new Error("Support ticket not found");
  }

  return ticket;
}