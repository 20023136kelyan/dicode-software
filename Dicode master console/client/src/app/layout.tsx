import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { JobTrackerProvider } from "@/contexts/JobTrackerContext";
import { NotificationCenterProvider } from "@/contexts/NotificationCenterContext";
import AuthGuard from "@/components/Auth/AuthGuard";
import ToastContainer from "@/components/Notifications/ToastContainer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "DiCode Master Console",
  description: "Behavioral coaching campaign management platform - Create AI videos, manage campaigns, and track employee development",
  icons: {
    icon: "/dicode_logo.png",
  },
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
            <JobTrackerProvider>
              <SidebarProvider>
                <NotificationCenterProvider>
            <AuthGuard>
              {children}
            </AuthGuard>
                  <ToastContainer />
                </NotificationCenterProvider>
              </SidebarProvider>
            </JobTrackerProvider>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
