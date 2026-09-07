import { v4 as uuidv4 } from 'uuid';

export function generateId(): string {
  return uuidv4();
}

export function generatePaymentReference(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = uuidv4().slice(0, 8).toUpperCase();
  return `PAY-${year}${month}${day}-${random}`;
}

export function generateReceiptNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const random = uuidv4().slice(0, 6).toUpperCase();
  return `RCP-${year}-${random}`;
}

export function generateIdempotencyKey(): string {
  return uuidv4();
}

export function generateAdmissionNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ADM-${year}-${random}`;
}

export function generateStaffNumber(): string {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `STAFF-${random}`;
}