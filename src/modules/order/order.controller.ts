import { Request, Response } from "express";
import * as orderService from "./order.service";
import { hasPermission } from "../../middlewares/permission.middleware";

export async function createPosOrder(req: Request, res: Response) {
  try {
    const { items, customerId, couponCode, paymentMethod } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0 || !paymentMethod) {
      return res.status(400).json({ message: "items and paymentMethod are required" });
    }

    const order = await orderService.createPosOrderService({
      items,
      customerId,
      couponCode,
      paymentMethod,
      createdById: req.user!.id,
    });

    return res.status(201).json({ message: "Order created", data: order });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function createOnlineOrder(req: Request, res: Response) {
  try {
    const { items, addressId, couponCode } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0 || !addressId) {
      return res.status(400).json({ message: "items and addressId are required" });
    }

    const order = await orderService.createOnlineOrderService({
      items,
      addressId,
      couponCode,
      customerId: req.customer!.id,
    });

    return res.status(201).json({ message: "Order created", data: order });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function getAllOrders(req: Request, res: Response) {
  try {
    // Customer sirf apne orders dekhega, staff sab dekhega
    const filters = req.customer ? { customerId: req.customer.id } : {};
    const orders = await orderService.getAllOrdersService(filters);
    return res.status(200).json({ data: orders });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getOrderById(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const order = await orderService.getOrderByIdService(id);

    // Authorization check — customer sirf apna order dekh sakta hai
    if (req.customer && order.customerId !== req.customer.id) {
      return res.status(403).json({ message: "You do not have access to this order" });
    }

    // Staff ke liye permission check (route se nahi laga, kyunki route combined hai)
    if (req.user) {
      const allowed = await hasPermission(req.user.role, "order:read");
      if (!allowed) {
        return res.status(403).json({ message: "You do not have permission to view orders" });
      }
    }

    return res.status(200).json({ data: order });
  } catch (error: any) {
    return res.status(404).json({ message: error.message });
  }
}

export async function updateOrderStatus(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "status is required" });
    }

    const order = await orderService.updateOrderStatusService(id, status);
    return res.status(200).json({ message: "Order status updated", data: order });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function refundOrder(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { amount, reason } = req.body;

    if (!amount || !reason) {
      return res.status(400).json({ message: "amount and reason are required" });
    }

    const refund = await orderService.refundOrderService(id, Number(amount), reason, req.user!.id);
    return res.status(200).json({ message: "Order refunded", data: refund });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}