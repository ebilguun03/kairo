import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Report configuration presence only; never expose keys or probe external APIs.
export async function GET() {
  const names = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ANTHROPIC_API_KEY",
  ];
  const servicesConfigured = names.every((name) => {
    const value = process.env[name]?.trim();
    return Boolean(value && !value.includes("YOUR_") && !value.includes("XXXXXXXX"));
  });
  return NextResponse.json({
    servicesConfigured,
    passwordRequired: Boolean(process.env.KAIRO_CHAT_PASSWORD),
  });
}
