import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type React from "react";
import "./global.css";

export const links = () => [];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0d10] px-4 text-[#f6f3ed]">
      <section className="max-w-md rounded-lg border border-[#25282d] bg-[#15181d] p-6">
        <h1 className="text-2xl font-semibold">App error</h1>
        <p className="mt-2 text-sm text-[#8d949e]">{message}</p>
      </section>
    </main>
  );
}
