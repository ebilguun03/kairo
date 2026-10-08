import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kairo — AI customer growth for independent restaurants",
  description:
    "Kairo is the AI-native customer-growth operating system for independent restaurants. Currently piloting at Ozora Izakaya in Bellevue, WA.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-kairo-paper text-kairo-ink antialiased">{children}</body>
    </html>
  );
}
