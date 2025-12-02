import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import AuthGuard from "@/components/Auth/AuthGuard";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "DICode Video Generator",
  description: "Create amazing videos with OpenAI's Sora 2 API",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <AuthProvider>
          <NotificationProvider>
            <AuthGuard>
              {children}
            </AuthGuard>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
