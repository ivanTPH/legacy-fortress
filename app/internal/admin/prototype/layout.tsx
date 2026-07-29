import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminPrototypeLayout({ children }: { children: ReactNode }) {
  const explicitlyAllowed = process.env.LEGACY_FORTRESS_ALLOW_ADMIN_PROTOTYPES === "true";
  const localDevelopment = process.env.NODE_ENV === "development";
  if (!localDevelopment || !explicitlyAllowed) {
    notFound();
  }
  return children;
}
