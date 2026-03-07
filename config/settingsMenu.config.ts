export type SettingsMenuItem = {
  id: string;
  label: string;
  path: string;
  description: string;
};

export const SETTINGS_MENU_ITEMS: SettingsMenuItem[] = [
  {
    id: "security",
    label: "Security",
    path: "/account/security",
    description: "Password, recovery and sign-in security",
  },
  {
    id: "billing-account",
    label: "Billing and Account",
    path: "/account/billing",
    description: "Plan and payment method management",
  },
  {
    id: "terms",
    label: "Terms and Conditions",
    path: "/account/terms",
    description: "Legal terms and acceptance history",
  },
  {
    id: "communications",
    label: "Communications Preferences",
    path: "/account/communications-preferences",
    description: "Control how Legacy Fortress contacts you",
  },
  {
    id: "reminders",
    label: "Reminder Preferences",
    path: "/account/reminder-preferences",
    description: "Configure reminder cadence and notification lead times",
  },
];
