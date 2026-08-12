import { Request, Response } from "express";
import * as websiteSupportService from "./websiteSupport.service.js";

export async function createSupportTicket(req: Request, res: Response) {
  try {
    const customerId = (req as any).customer.id;
    const { title, description } = req.body;

    const ticket = await websiteSupportService.createSupportTicketService({
      customerId,
      title,
      description,
    });

    return res.status(201).json({ message: "Support ticket submitted", data: ticket });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function getMySupportTickets(req: Request, res: Response) {
  try {
    const customerId = (req as any).customer.id;
    const tickets = await websiteSupportService.getMySupportTicketsService(customerId);
    return res.status(200).json({ data: tickets });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getMySupportTicketById(req: Request, res: Response) {
  try {
    const customerId = (req as any).customer.id;
    const id = req.params.id as string;

    const ticket = await websiteSupportService.getMySupportTicketByIdService(customerId, id);
    return res.status(200).json({ data: ticket });
  } catch (error: any) {
    return res.status(404).json({ message: error.message });
  }
}