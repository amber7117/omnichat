import { Outlet, NavLink } from "react-router-dom";
import { cn } from "@/common/lib/utils";
import { LayoutGrid, Cpu, Link as LinkIcon, Code2 } from "lucide-react";

export function PluginsLayout() {
  const navItems = [
    { to: "/plugins", end: true, label: "Marketplace", icon: LayoutGrid },
    { to: "/plugins/mcp", label: "MCP Tools", icon: Cpu },
    { to: "/plugins/portal", label: "Portal", icon: LinkIcon },
    { to: "/plugins/developer", label: "Developer Center", icon: Code2 },
  ];

  return (
    <div className="flex h-full bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r bg-muted/10 flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg">Plugins</h2>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
