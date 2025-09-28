import type { Metadata } from "next";
import "../styles/globals.css";
import DotGrid from "@/app/components/DotGrid";
import Navbar from "@/app/components/Navbar";
import { AuthProvider } from "@/app/components/AuthProvider";
import Providers from "./providers";
import { AlertTriangle } from "lucide-react";

export const metadata: Metadata = {
  title: "Doccelerate - Accelerate Your Document Processing",
  description: "Transform your document workflows with intelligent processing, automated insights, and seamless integration. Built for teams who need speed without compromising accuracy.",
  keywords: ["document processing", "automation", "AI", "workflow", "enterprise", "API"],
  authors: [{ name: "Doccelerate Team" }],
  creator: "Doccelerate",
  publisher: "Doccelerate",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "Doccelerate - Accelerate Your Document Processing",
    description: "Transform your document workflows with intelligent processing, automated insights, and seamless integration.",
    siteName: "Doccelerate",
    locale: "en_US",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="antialiased bg-transparent" suppressHydrationWarning={true}>
        <Providers>
          <AuthProvider>
            <DotGrid
              className="fixed inset-0 z-0 pointer-events-none"
              dotSize={1}
              gap={15}
              baseColor="var(--color-accent)"
              activeColor="var(--color-primary)"
              proximity={120}
              shockRadius={250}
              shockStrength={5}
              resistance={750}
              returnDuration={1.5}
            />
            <div className="relative z-10 w-full min-h-screen px-4">
              <Navbar />
              {children}
            </div>
          </AuthProvider>
          
          {/* Warning Banner */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-orange-500 text-white px-4 py-3 shadow-2xl">
            <div className="max-w-6xl mx-auto flex items-center justify-center gap-3 text-center">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm sm:text-base font-medium">
                <span className="font-semibold">Notice:</span> This project is paused. 
                For a working demonstration, please contact the owner at{" "}
                <a 
                  href="mailto:hasanfaaz10@gmail.com" 
                  className="underline hover:text-orange-100 transition-colors"
                >
                  hasanfaaz10@gmail.com
                </a>
              </p>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
