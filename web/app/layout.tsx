import type { Metadata } from "next";
import "../styles/globals.css";
import DotGrid from "@/app/components/DotGrid";
import Navbar from "@/app/components/Navbar";
import { AuthProvider } from "@/app/components/AuthProvider";
import Providers from "./providers";

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
        </Providers>
      </body>
    </html>
  );
}
