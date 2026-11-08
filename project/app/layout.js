import { Providers } from './providers';
import './globals.css';

export const metadata = {
  title: 'SpacetimeDB Next.js App',
  description: 'A Next.js app powered by SpacetimeDB',
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
