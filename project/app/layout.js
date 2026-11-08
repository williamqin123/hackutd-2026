import { Providers } from "./providers";
import "./globals.css";

export const metadata = {
  title: "WaterBoard",
  description: "Historical flood-response simulation and dispatch coordination",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "WaterBoard",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  themeColor: "#dc2626",
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
