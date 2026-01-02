import 'leaflet/dist/leaflet.css';

import './globals.css';

export const metadata = {
  title: 'Ekin Office Panel',
  description: 'Ekin Automation Door Systems - Office Panel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
