import Icon from "../../../components/ui/Icon";

type IconProps = {
  size?: number;
};

function NavIcon({ name, size = 18 }: { name: string; size?: number }) {
  return <Icon name={name} size={size} />;
}

export function DashboardIcon({ size = 18 }: IconProps) {
  return <NavIcon name="space_dashboard" size={size} />;
}

export function PersonIcon({ size = 18 }: IconProps) {
  return <NavIcon name="group" size={size} />;
}

export function PersonalIcon({ size = 18 }: IconProps) {
  return <NavIcon name="watch" size={size} />;
}

export function DigitalIcon({ size = 18 }: IconProps) {
  return <NavIcon name="devices" size={size} />;
}

export function PossessionsIcon({ size = 18 }: IconProps) {
  return <NavIcon name="inventory_2" size={size} />;
}

export function ContactsIcon({ size = 18 }: IconProps) {
  return <NavIcon name="person" size={size} />;
}

export function WalletIcon({ size = 18 }: IconProps) {
  return <NavIcon name="account_balance_wallet" size={size} />;
}

export function DocumentIcon({ size = 18 }: IconProps) {
  return <NavIcon name="gavel" size={size} />;
}

export function BuildingIcon({ size = 18 }: IconProps) {
  return <NavIcon name="home" size={size} />;
}

export function CarIcon({ size = 18 }: IconProps) {
  return <NavIcon name="directions_car" size={size} />;
}

export function BriefcaseIcon({ size = 18 }: IconProps) {
  return <NavIcon name="work" size={size} />;
}

export function KeyIcon({ size = 18 }: IconProps) {
  return <NavIcon name="key" size={size} />;
}

export function TrustIcon({ size = 18 }: IconProps) {
  return <NavIcon name="history_edu" size={size} />;
}

export function IdentityIcon({ size = 18 }: IconProps) {
  return <NavIcon name="badge" size={size} />;
}

export function AccessRequestsIcon({ size = 18 }: IconProps) {
  return <NavIcon name="key" size={size} />;
}

export function HelpIcon({ size = 18 }: IconProps) {
  return <NavIcon name="help" size={size} />;
}

export function SettingsIcon({ size = 18 }: IconProps) {
  return <NavIcon name="settings" size={size} />;
}
