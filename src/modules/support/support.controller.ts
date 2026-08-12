import { Request, Response } from "express";
import * as supportService from "./support.service.js";
import { SupportTicketStatus } from "@prisma/client";

const VALID_STATUSES: SupportTicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export async function getAllSupportTickets(req: Request, res: Response) {
  try {
    const status = req.query.status as SupportTicketStatus | undefined;

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid status filter" });
    }

    const tickets = await supportService.getAllSupportTicketsService(status);
    return res.status(200).json({ data: tickets });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getSupportTicketById(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const ticket = await supportService.getSupportTicketByIdService(id);
    return res.status(200).json({ data: ticket });
  } catch (error: any) {
    return res.status(404).json({ message: error.message });
  }
}

export async function updateSupportTicketStatus(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Valid status is required (OPEN, IN_PROGRESS, RESOLVED, CLOSED)" });
    }

    const ticket = await supportService.updateSupportTicketStatusService(id, status);
    return res.status(200).json({ message: "Ticket status updated", data: ticket });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}