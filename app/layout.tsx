import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/shell/Sidebar";
import { Providers } from "@/components/shell/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Innovera Eval V3",
  description: "Memo evaluation platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-background text-foreground antialiased">
        <Providers>
          <Sidebar />
          {/* Main content offset by sidebar width */}
          <div className="ml-56 min-h-screen flex flex-col">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
