import type { ReactNode } from "react";
import {
  BriefcaseIcon,
  BuildingIcon,
  CarIcon,
  ContactsIcon,
  DashboardIcon,
  DocumentIcon,
  HelpIcon,
  PersonalIcon,
  PersonIcon,
  TrustIcon,
  WalletIcon,
} from "../app/(app)/components/NavIcons";
import type { VaultCategoryGroupKey } from "../lib/vaultPreferences";

export type AppRouteNode = {
  id: string;
  label: string;
  path: string;
  description?: string;
  icon?: ReactNode;
  vaultCategoryKey?: VaultCategoryGroupKey;
  children?: AppRouteNode[];
  enabled?: boolean;
};

const on = true;

export const APP_ROUTE_MANIFEST: AppRouteNode[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
    description: "Overview",
    icon: <DashboardIcon />,
    enabled: on,
  },
  {
    id: "legal",
    label: "Legal",
    path: "/legal",
    icon: <DocumentIcon />,
    vaultCategoryKey: "legal",
    enabled: on,
    children: [
      { id: "legal-wills", label: "Wills", path: "/legal/wills", enabled: on },
      { id: "legal-trusts", label: "Trusts", path: "/legal/trusts", enabled: on },
      { id: "legal-poa", label: "Power of Attorney", path: "/legal/power-of-attorney", enabled: on },
      { id: "legal-funeral", label: "Funeral Wishes", path: "/legal/funeral-wishes", enabled: on },
      { id: "legal-marriage", label: "Marriage / Divorce Documents", path: "/legal/marriage-divorce-documents", enabled: on },
      { id: "legal-identity", label: "Identity Documents", path: "/legal/identity-documents", enabled: on },
      { id: "legal-other", label: "Other Legal Documents", path: "/legal/other-legal-documents", enabled: on },
      { id: "legal-verification", label: "Death Certificate Verification", path: "/legal/death-certificate", enabled: on },
    ],
  },
  {
    id: "finances",
    label: "Finances",
    path: "/finances",
    icon: <WalletIcon />,
    vaultCategoryKey: "finances",
    enabled: on,
    children: [
      { id: "finances-bank", label: "Bank", path: "/finances/bank", enabled: on },
      { id: "finances-pensions", label: "Pensions", path: "/finances/pensions", enabled: on },
      { id: "finances-investments", label: "Investments", path: "/finances/investments", enabled: on },
      { id: "finances-insurance", label: "Insurance", path: "/finances/insurance", enabled: on },
      { id: "finances-debts", label: "Debts", path: "/finances/debts", enabled: on },
    ],
  },
  {
    id: "personal",
    label: "Personal",
    path: "/personal",
    icon: <PersonalIcon />,
    vaultCategoryKey: "personal",
    enabled: on,
    children: [
      { id: "personal-possessions", label: "Possessions", path: "/vault/personal", enabled: on },
      { id: "personal-subscriptions", label: "Subscriptions", path: "/personal/subscriptions", enabled: on },
      { id: "personal-social-media", label: "Social media", path: "/personal/social-media", enabled: on },
      { id: "personal-wishes", label: "Personal Wishes", path: "/personal/wishes", enabled: on },
    ],
  },
  {
    id: "people-contacts",
    label: "Contacts",
    path: "/contacts",
    icon: <ContactsIcon />,
    enabled: on,
  },
  {
    id: "trust",
    label: "Executors",
    path: "/trust",
    icon: <TrustIcon />,
    vaultCategoryKey: "executors",
    enabled: on,
  },
  {
    id: "property",
    label: "Property",
    path: "/property",
    icon: <BuildingIcon />,
    vaultCategoryKey: "property",
    enabled: on,
    children: [
      { id: "property-records", label: "Property Records", path: "/vault/property", enabled: on },
      { id: "property-documents", label: "Property Documents", path: "/property/documents", enabled: on },
    ],
  },
  {
    id: "business",
    label: "Business",
    path: "/business",
    icon: <BriefcaseIcon />,
    vaultCategoryKey: "business",
    enabled: on,
    children: [
      { id: "business-interests", label: "Business Interests", path: "/business", enabled: on },
      { id: "business-employment", label: "Employment", path: "/employment", enabled: on },
    ],
  },
  {
    id: "cars-transport",
    label: "Cars & Transport",
    path: "/cars-transport",
    icon: <CarIcon />,
    vaultCategoryKey: "cars_transport",
    enabled: on,
  },
  {
    id: "support",
    label: "Support",
    path: "/support",
    icon: <HelpIcon />,
    enabled: on,
    children: [{ id: "support-help", label: "Support", path: "/support", enabled: on }],
  },
];

export const ACCOUNT_ROUTE_MANIFEST: AppRouteNode[] = [
  {
    id: "account-profile",
    label: "Profile",
    path: "/profile",
    icon: <PersonIcon />,
    enabled: on,
    children: [
      { id: "settings-security", label: "Security", path: "/account/security", enabled: on },
      { id: "settings-billing", label: "Billing and Account", path: "/account/billing", enabled: on },
      { id: "settings-my-vault", label: "My Vault", path: "/account/my-vault", enabled: on },
      { id: "settings-terms", label: "Terms and Conditions", path: "/account/terms", enabled: on },
      { id: "settings-comms", label: "Communications Preferences", path: "/account/communications-preferences", enabled: on },
      { id: "settings-reminders", label: "Reminder Preferences", path: "/account/reminder-preferences", enabled: on },
    ],
  },
];
