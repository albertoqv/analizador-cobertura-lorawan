import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head />
      <body className="bg-slate-900 w-screen h-screen overflow-hidden">
        <main className="w-full h-full">{children}</main>
      </body>
    </html>
  );
}
