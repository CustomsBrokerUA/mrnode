import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { ThemeProvider } from "./theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: 'MRNode',
    template: '%s | MRNode',
  },
  description: 'MRNode — перегляд та аналітика митних декларацій',
  applicationName: 'MRNode',
  manifest: '/manifest.webmanifest',
  themeColor: '#0f172a',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/icon-192.svg', type: 'image/svg+xml' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeInitScript = `
    (function() {
      try {
        const path = window.location.pathname;
        // Only apply theme to dashboard pages, always use light theme for landing/login/register
        const isDashboardPage = path.startsWith('/dashboard');
        
        if (!isDashboardPage) {
          // Force light theme for non-dashboard pages
          const root = document.documentElement;
          root.classList.remove('light', 'dark');
          root.removeAttribute('data-theme');
          root.classList.add('light');
          root.setAttribute('data-theme', 'light');
          return;
        }
        
        const theme = localStorage.getItem('appTheme');
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        root.removeAttribute('data-theme');

        if (theme === 'light') {
          root.classList.add('light');
          root.setAttribute('data-theme', 'light');
        } else if (theme === 'dark') {
          root.classList.add('dark');
          root.setAttribute('data-theme', 'dark');
        } else if (theme === 'system') {
          // system
          const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (prefersDark) {
            root.classList.add('dark');
            root.setAttribute('data-theme', 'dark');
          } else {
            root.classList.add('light');
            root.setAttribute('data-theme', 'light');
          }
        } else {
          // default to light theme
          root.classList.add('light');
          root.setAttribute('data-theme', 'light');
        }
      } catch (e) {
        // ignore
      }
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          {children}
          <Toaster position="top-right" closeButton richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
