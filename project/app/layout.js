import { Providers } from "./providers";
import "./globals.css";

export const metadata = {
  title: "WaterBoard",
  description: "Historical flood-response simulation and dispatch coordination",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/favicon-teal.svg", type: "image/svg+xml" }],
    apple: "/favicon-teal.png?v=2",
  },
  appleWebApp: {
    capable: true,
    title: "WaterBoard",
    statusBarStyle: "default",
  },
};

export const viewport = {
  themeColor: "#1a7f7a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
