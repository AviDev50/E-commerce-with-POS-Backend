import { Request, Response } from "express";
import * as orderService from "./order.service.js";
import { hasPermission } from "../../middlewares/permission.middleware.js";

export async function createPosOrder(req: Request, res: Response) {
  try {
    const { items, customerId, newCustomer, couponCode, payments } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "items are required" });
    }

    // Exactly one: existing customer YA new customer
    if (!!customerId === !!newCustomer) {
      return res
        .status(400)
        .json({ message: "Select an existing customer or add a new one" });
    }

    if (newCustomer) {
      const name = String(newCustomer.name ?? "").trim();
      const phone = String(newCustomer.phone ?? "").trim();
      if (!name) {
        return res.status(400).json({ message: "Customer name is required" });
      }
      if (!/^[6-9]\d{9}$/.test(phone)) {
        return res.status(400).json({ message: "Invalid customer phone" });
      }
      newCustomer.name = name;
      newCustomer.phone = phone;
    }

    if (!payments || !Array.isArray(payments) || payments.length === 0) {
      return res
        .status(400)
        .json({ message: "payments array is required (at least one entry)" });
    }

    for (const p of payments) {
      if (!p.method || typeof p.amount !== "number" || p.amount <= 0) {
        return res.status(400).json({
          message: "each payment must have a valid method and a positive amount",
        });
      }
    }

    const order = await orderService.createPosOrderService({
      items,
      customerId,
      newCustomer,
      couponCode,
      payments,
      createdById: req.user!.id,
    });

    return res.status(201).json({ message: "Order created", data: order });
  } catch (error: any) {
    return res.status(error.statusCode || 400).json({ message: error.message });
  }
}

export async function createOnlineOrder(req: Request, res: Response) {
  try {
    const { items, addressId, couponCode, cartItemIds, paymentMethod } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0 || !addressId || !paymentMethod) {
      return res.status(400).json({ message: "items, addressId, and paymentMethod are required" });
    }

    const order = await orderService.createOnlineOrderService({
      items,
      addressId,
      couponCode,
      customerId: req.customer!.id,
      cartItemIds,
      paymentMethod,
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
      return res
        .status(403)
        .json({ message: "You do not have access to this order" });
    }

    // Staff ke liye permission check (route se nahi laga, kyunki route combined hai)
    if (req.user) {
      const allowed = await hasPermission(req.user.role, "order:read");
      if (!allowed) {
        return res
          .status(403)
          .json({ message: "You do not have permission to view orders" });
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
    return res
      .status(200)
      .json({ message: "Order status updated", data: order });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function refundOrder(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { amount, reason } = req.body;

    if (!amount || !reason) {
      return res
        .status(400)
        .json({ message: "amount and reason are required" });
    }

    const refund = await orderService.refundOrderService(
      id,
      Number(amount),
      reason,
      req.user!.id,
    );
    return res.status(200).json({ message: "Order refunded", data: refund });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function previewOnlineOrder(req: Request, res: Response) {
  try {
    const { items, addressId, couponCode } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0 || !addressId) {
      return res.status(400).json({ message: "items and addressId are required" });
    }

    const preview = await orderService.previewOnlineOrderService({
      items,
      addressId,
      couponCode,
      customerId: req.customer!.id,
    });

    return res.status(200).json({ data: preview });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}


export async function cancelOrder(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: "reason is required" });
    }

    const result = await orderService.cancelOrderService(id, req.customer!.id, reason);
    return res.status(200).json({ message: "Order cancelled", data: result });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function getOrderReceipt(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const requestingCustomerId = req.customer ? req.customer.id : undefined;
    const receipt = await orderService.getOrderReceiptService(id, requestingCustomerId);
    return res.status(200).json({ data: receipt });
  } catch (error: any) {
    return res.status(error.statusCode || 400).json({ message: error.message });
  }
}

export async function getPosOrderHistory(req: Request, res: Response) {
  try {
    const { from, to, cashierId, page, limit } = req.query;

    const result = await orderService.getPosOrderHistoryService({
      from: from as string | undefined,
      to: to as string | undefined,
      cashierId: cashierId as string | undefined,
      requestingUserId: req.user!.id,
      requestingUserRole: req.user!.role,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    return res.status(200).json({ data: result.orders, pagination: result.pagination });
  } catch (error: any) {
    return res.status(error.statusCode || 400).json({ message: error.message });
  }
}