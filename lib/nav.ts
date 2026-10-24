import {
  Bell,
  Cable,
  Cpu,
  CreditCard,
  FileSpreadsheet,
  Gauge,
  LineChart,
  Router,
  Settings,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type AppNavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  mobilePrimary?: boolean;
};

export const APP_NAV: AppNavItem[] = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Home", icon: Gauge, mobilePrimary: true },
  { href: "/integrations", label: "Integrations", shortLabel: "Connect", icon: Cable, mobilePrimary: true },
  { href: "/devices", label: "Devices", shortLabel: "Devices", icon: Cpu, mobilePrimary: true },
  { href: "/gateways", label: "Gateways", icon: Router },
  { href: "/smart-grid", label: "Smart Grid", icon: Zap },
  { href: "/automation", label: "Automation", shortLabel: "Auto", icon: Workflow, mobilePrimary: true },
  { href: "/analytics", label: "Analytics", icon: LineChart },
  { href: "/alerts", label: "Alerts", shortLabel: "Alerts", icon: Bell, mobilePrimary: true },
  { href: "/reports", label: "Reports", icon: FileSpreadsheet },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const MOBILE_PRIMARY_NAV = APP_NAV.filter((item) => item.mobilePrimary);
export const MOBILE_MORE_NAV = APP_NAV.filter((item) => !item.mobilePrimary);
