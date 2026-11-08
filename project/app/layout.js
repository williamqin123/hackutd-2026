import { Providers } from "./providers";
import "./globals.css";

export const metadata = {
  title: "WaterBoard",
  description: "Historical flood-response simulation and dispatch coordination",
  icons: {
    icon: "/favicon.png",
  },
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
