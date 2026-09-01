import {
  LayoutDashboard,
  Filter,
  BarChart3,
  Settings,
  ChevronDown,
  ShoppingCart,
  PackageCheck,
  Heart,
  SlidersHorizontal,
  CreditCard,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const funnelItems = [
  { title: "Pre-Purchase", url: "/app/funnels/pre-purchase", icon: ShoppingCart },
  { title: "Post-Purchase", url: "/app/funnels/post-purchase", icon: PackageCheck },
  { title: "Thank You Page", url: "/app/funnels/thank-you", icon: Heart },
];

const settingsItems = [
  { title: "General", url: "/app/settings", icon: SlidersHorizontal },
  { title: "Plan & Billing", url: "/app/settings/billing", icon: CreditCard },
];

/* ── Shared "Icon Tiles" class strings ────────────────────────────────
   Row is a `group` so the inner tile can react to aria-current/hover. */
const ROW =
  "group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/40 hover:text-foreground";
const ROW_ACTIVE =
  "bg-sidebar-accent text-sidebar-primary font-semibold border border-[hsl(var(--primary)/0.30)]";
const TILE_BASE =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors";
// Inactive tile that flips to solid orange when the row is the active NavLink.
const TILE =
  cn(
    TILE_BASE,
    "bg-secondary text-muted-foreground group-hover:text-foreground",
    "group-aria-[current=page]:bg-primary group-aria-[current=page]:text-white",
  );

/** A top-level nav row (Dashboard, Analytics). */
function NavRow({ to, end, icon: Icon, label, collapsed }) {
  return (
    <SidebarMenuItem>
      <NavLink to={to} end={end} className={ROW} activeClassName={ROW_ACTIVE}>
        <span className={TILE}>
          <Icon className="h-4 w-4" />
        </span>
        {!collapsed && <span>{label}</span>}
      </NavLink>
    </SidebarMenuItem>
  );
}

/** A collapsible parent (Funnels, Settings) with a tile that tints when a child
 *  route is active. */
function NavGroup({ icon: Icon, label, active, defaultOpen, collapsed, children }) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <button type="button" className={cn(ROW, active && "text-foreground")}>
            <span
              className={cn(
                TILE_BASE,
                active
                  ? "bg-primary text-white"
                  : "bg-secondary text-muted-foreground group-hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            {!collapsed && (
              <>
                <span className="flex-1 text-left">{label}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </>
            )}
          </button>
        </CollapsibleTrigger>
        {!collapsed && (
          <CollapsibleContent>
            <SidebarMenuSub className="border-sidebar-border">{children}</SidebarMenuSub>
          </CollapsibleContent>
        )}
      </SidebarMenuItem>
    </Collapsible>
  );
}

/** A nested sub-item (lighter: small icon, no tile, indented, orange when active). */
function SubRow({ to, end, icon: Icon, label }) {
  return (
    <SidebarMenuSubItem>
      <NavLink
        to={to}
        end={end}
        className="group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/30 hover:text-foreground"
        activeClassName="text-sidebar-primary font-medium"
      >
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground group-aria-[current=page]:text-sidebar-primary" />
        {label}
      </NavLink>
    </SidebarMenuSubItem>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path) => currentPath === path || currentPath.startsWith(path + "/");
  const isFunnelsActive = funnelItems.some((i) => isActive(i.url));
  const isSettingsActive = settingsItems.some((i) => currentPath === i.url);

  return (
    <Sidebar collapsible="offcanvas">
      {/* Logo + brand */}
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="DRIMS Upsell Pro logo"
            className="h-9 w-9 shrink-0 rounded-lg object-contain"
          />
          {!collapsed && (
            <div className="leading-tight">
              <p className="font-display text-lg font-bold text-sidebar-foreground">DRIMS</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Upsell Pro
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              <NavRow to="/app" end icon={LayoutDashboard} label="Dashboard" collapsed={collapsed} />

              {/* Funnels */}
              <NavGroup
                icon={Filter}
                label="Funnels"
                active={isFunnelsActive}
                defaultOpen
                collapsed={collapsed}
              >
                {funnelItems.map((item) => (
                  <SubRow key={item.title} to={item.url} icon={item.icon} label={item.title} />
                ))}
              </NavGroup>

              <NavRow to="/app/analytics" end icon={BarChart3} label="Analytics" collapsed={collapsed} />

              {/* Settings */}
              <NavGroup
                icon={Settings}
                label="Settings"
                active={isSettingsActive}
                defaultOpen={isSettingsActive}
                collapsed={collapsed}
              >
                {settingsItems.map((item) => (
                  <SubRow key={item.title} to={item.url} end icon={item.icon} label={item.title} />
                ))}
              </NavGroup>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            DRIMS Upsell Pro
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
