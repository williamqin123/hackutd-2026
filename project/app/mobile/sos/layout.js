export const metadata = {
  title: "WaterBoard SOS",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "WaterBoard SOS",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  themeColor: "#dc2626",
};

export default function SosLayout({ children }) {
  return children;
}
