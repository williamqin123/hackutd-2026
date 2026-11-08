import { Providers } from "./providers";
import { ThemeProvider } from "../components/ThemeProvider";
import { THEME_BOOTSTRAP } from "../lib/theme";
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
  themeColor: "#070b14",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="cyberpunk" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} /></head>
      <body>
        <ThemeProvider><Providers>{children}</Providers></ThemeProvider>
      </body>
    </html>
  );
}
