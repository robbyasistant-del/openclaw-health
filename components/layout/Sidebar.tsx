"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Stethoscope,
  Settings,
  HeartPulse,
  Briefcase,
  Shield,
  DatabaseBackup,
  Terminal,
} from "lucide-react";

const modules = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Doctor", href: "/doctor", icon: Stethoscope },
  { name: "HealthChecks", href: "/health-checks", icon: HeartPulse },
  { name: "Workspace", href: "/workspace", icon: Briefcase },
  { name: "Backups", href: "/backups", icon: DatabaseBackup },
  { name: "Security", href: "/security", icon: Shield },
  { name: "Prompts", href: "/prompts", icon: Terminal },
  { name: "Config", href: "/config", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-zinc-900 border-r border-zinc-800 min-h-screen flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <HeartPulse className="h-6 w-6 text-emerald-500" />
          Openclaw Health
        </h1>
        <p className="text-xs text-zinc-500 mt-1">v0.1.0</p>
      </div>

      <nav className="px-4 pb-6 flex-1">
        <ul className="space-y-1">
          {modules.map((module) => {
            const isActive = pathname === module.href;
            const Icon = module.icon;

            return (
              <li key={module.name}>
                <Link
                  href={module.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {module.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-zinc-800">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <span className="text-emerald-400 text-sm font-medium">U</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">Usuario</p>
            <p className="text-xs text-zinc-500 truncate">Admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
