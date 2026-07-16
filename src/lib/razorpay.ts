import crypto from "crypto";
import { config } from "@/config";

export function getRazorpayKeyId(): string {
  return config.razorpay.keyId;
}

export function isRazorpayConfigured(): boolean {
  return Boolean(config.razorpay.keyId && config.razorpay.keySecret);
}

export async function createRazorpayOrder(params: {
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}) {
  const Razorpay = (await import("razorpay")).default;
  const instance = new Razorpay({
    key_id: config.razorpay.keyId,
    key_secret: config.razorpay.keySecret,
  });

  return instance.orders.create({
    amount: params.amount,
    currency: params.currency,
    receipt: params.receipt,
    notes: params.notes,
  });
}

export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac("sha256", config.razorpay.keySecret)
    .update(body)
    .digest("hex");
  return expected === signature;
}

export function verifyWebhookSignature(
  body: string,
  signature: string
): boolean {
  if (!config.razorpay.webhookSecret) return false;
  const expected = crypto
    .createHmac("sha256", config.razorpay.webhookSecret)
    .update(body)
    .digest("hex");
  return expected === signature;
}

export function toSmallestUnit(amount: number): number {
  return Math.round(amount * 100);
}
