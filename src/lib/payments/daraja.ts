import { buildMpesaCallbackUrl } from "./callback-auth";

const SANDBOX_URL = "https://sandbox.safaricom.co.ke";
const PRODUCTION_URL = "https://api.safaricom.co.ke";

function getBaseUrl(): string {
  return process.env.MPESA_ENVIRONMENT === "production" ? PRODUCTION_URL : SANDBOX_URL;
}

interface AccessTokenResponse {
  access_token: string;
  expires_in: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString("base64");

  const response = await fetch(
    `${getBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`,
    {
      method: "GET",
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.statusText}`);
  }

  const data: AccessTokenResponse = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + parseInt(data.expires_in) * 1000 - 60000,
  };

  return data.access_token;
}

export interface STKPushRequest {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  description: string;
}

export interface STKPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export async function initiateSTKPush(request: STKPushRequest): Promise<STKPushResponse> {
  const token = await getAccessToken();
  const timestamp = generateTimestamp();
  const password = generatePassword(timestamp);

  const payload = {
    BusinessShortCode: process.env.MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.ceil(request.amount),
    PartyA: formatPhoneNumber(request.phoneNumber),
    PartyB: process.env.MPESA_SHORTCODE,
    PhoneNumber: formatPhoneNumber(request.phoneNumber),
    CallBackURL: buildMpesaCallbackUrl(),
    AccountReference: request.accountReference,
    TransactionDesc: request.description,
  };

  const response = await fetch(
    `${getBaseUrl()}/mpesa/stkpush/v1/processrequest`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`STK Push failed: ${error}`);
  }

  return response.json();
}

export interface STKQueryResponse {
  ResponseCode: string;
  ResponseDescription: string;
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: string;
  ResultDesc: string;
}

export async function querySTKStatus(checkoutRequestId: string): Promise<STKQueryResponse> {
  const token = await getAccessToken();
  const timestamp = generateTimestamp();
  const password = generatePassword(timestamp);

  const payload = {
    BusinessShortCode: process.env.MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestId,
  };

  const response = await fetch(
    `${getBaseUrl()}/mpesa/stkpushquery/v1/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw new Error(`STK Query failed: ${response.statusText}`);
  }

  return response.json();
}

export interface CallbackData {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{ Name: string; Value: string | number }>;
      };
    };
  };
}

export function parseCallback(data: CallbackData): {
  success: boolean;
  checkoutRequestId: string;
  receiptNumber: string | null;
  amount: number | null;
  phone: string | null;
} {
  const callback = data.Body.stkCallback;
  const success = callback.ResultCode === 0;

  let receiptNumber: string | null = null;
  let amount: number | null = null;
  let phone: string | null = null;

  if (success && callback.CallbackMetadata) {
    for (const item of callback.CallbackMetadata.Item) {
      switch (item.Name) {
        case "MpesaReceiptNumber":
          receiptNumber = String(item.Value);
          break;
        case "Amount":
          amount = Number(item.Value);
          break;
        case "PhoneNumber":
          phone = String(item.Value);
          break;
      }
    }
  }

  return {
    success,
    checkoutRequestId: callback.CheckoutRequestID,
    receiptNumber,
    amount,
    phone,
  };
}

function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function generatePassword(timestamp: string): string {
  const shortcode = process.env.MPESA_SHORTCODE || "";
  const passkey = process.env.MPESA_PASSKEY || "";
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
}

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[\s\-\+]/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = `254${cleaned.slice(1)}`;
  }
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
}
