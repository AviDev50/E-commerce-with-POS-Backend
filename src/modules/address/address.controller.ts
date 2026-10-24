import { Request, Response } from "express";
import * as addressService from "./address.service.js";

export async function createAddress(req: Request, res: Response) {
  try {
    const { type, line1, line2, city, state, postalCode, country, isDefault } =
      req.body;

    if (!line1 || !city || !state || !postalCode) {
      return res
        .status(400)
        .json({ message: "line1, city, state, and postalCode are required" });
    }

    const address = await addressService.createAddressService({
      customerId: req.customer!.id,
      type,
      line1,
      line2,
      city,
      state,
      postalCode,
      country,
      isDefault,
    });

    return res.status(201).json({ message: "Address added", data: address });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function getMyAddresses(req: Request, res: Response) {
  try {
    const addresses = await addressService.getAddressesByCustomerService(
      req.customer!.id,
    );
    return res.status(200).json({ data: addresses });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getAddressById(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const address = await addressService.getAddressByIdService(
      id,
      req.customer!.id,
    );
    return res.status(200).json({ data: address });
  } catch (error: any) {
    return res.status(404).json({ message: error.message });
  }
}

export async function updateAddress(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { type, line1, line2, city, state, postalCode, country, isDefault } =
      req.body;

    const address = await addressService.updateAddressService(
      id,
      req.customer!.id,
      {
        type,
        line1,
        line2,
        city,
        state,
        postalCode,
        country,
        isDefault,
      },
    );

    return res.status(200).json({ message: "Address updated", data: address });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function deleteAddress(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    await addressService.deleteAddressService(id, req.customer!.id);
    return res.status(200).json({ message: "Address deleted" });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}
