import { ReturnStatus } from "@prisma/client";

export const DEFAULT_RETURN_WINDOW_DAYS = 7;

// RECEIVED nahi: markReceived par returnedQty pehle hi badh jaati hai
export const PENDING_RETURN_STATUSES: ReturnStatus[] = [
  ReturnStatus.REQUESTED,
  ReturnStatus.APPROVED,
  ReturnStatus.PICKUP_SCHEDULED,
];