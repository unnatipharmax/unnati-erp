import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Unnati ERP',
  description: 'ERP System for Unnati Pharmax',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
