import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lives Mailer | Gestão de Contatos",
  description: "Importação massiva de contatos por ficheiro TXT",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
