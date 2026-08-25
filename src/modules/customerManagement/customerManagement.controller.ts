import { Request, Response } from "express";
import * as customerManagementService from "./customerManagement.service.js";

export async function searchCustomer(req: Request, res: Response) {
  try {
    const { phone } = req.query;

    if (!phone || typeof phone !== "string") {
      return res.status(400).json({ message: "phone query param is required" });
    }

    const customers =
      await customerManagementService.searchCustomerByPhone(phone);
    return res
      .status(200)
      .json({ message: "Customers fetched", data: customers });
  } catch (error: any) {
    return res.status(error.statusCode || 400).json({ message: error.message });
  }
}

export async function quickCreateCustomer(req: Request, res: Response) {
  try {
    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ message: "name and phone are required" });
    }

    const customer = await customerManagementService.quickCreateCustomerService(
      { name, phone },
    );
    return res
      .status(201)
      .json({ message: "Customer created", data: customer });
  } catch (error: any) {
    return res.status(error.statusCode || 400).json({ message: error.message });
  }
}

export async function getAllCustomers(req: Request, res: Response) {
  try {
    const search = req.query.search as string | undefined;
    const customers = await customerManagementService.getAllCustomersService({
      search,
    });
    return res.status(200).json({ data: customers });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
