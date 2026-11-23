import type { Metadata } from "next";
import PartnerEnquiryPage from "@/components/partners/PartnerEnquiryPage";

export const metadata: Metadata = {
  title: "Become a partner · Legacy Fortress",
  description: "Offer Legacy Fortress Premium to your employees, clients or members.",
};

export default function PartnersPage() {
  return <PartnerEnquiryPage />;
}
