import type { Metadata } from "next";
import "../styles/globals.css";
import DotGrid from "./components/dot-grid";
import Navbar from "./components/navbar";
import { AuthProvider } from "./components/auth-provider";

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
  metadataBase: new URL("https://doccelerate.com"),
  openGraph: {
    title: "Doccelerate - Accelerate Your Document Processing",
    description: "Transform your document workflows with intelligent processing, automated insights, and seamless integration.",
    url: "https://doccelerate.com",
    siteName: "Doccelerate",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Doccelerate - Document Processing Platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Doccelerate - Accelerate Your Document Processing",
    description: "Transform your document workflows with intelligent processing, automated insights, and seamless integration.",
    images: ["/og-image.jpg"],
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
  verification: {
    google: "your-google-verification-code",
    yandex: "your-yandex-verification-code",
    yahoo: "your-yahoo-verification-code",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="antialiased bg-background">
        <AuthProvider>
          <Navbar />
          <DotGrid
            className="fixed top-0 left-0 w-screen h-screen pointer-events-none"
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
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
