import { connection, NextResponse } from "next/server";
import { lanAddresses } from "@/lib/server/network";

// Development helper for the front-desk QR code: when the desk screen runs on localhost, phones
// need this computer's network address instead. Never exposed in production.
export async function GET() {
  await connection();
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  return NextResponse.json({ addresses: lanAddresses() });
}
