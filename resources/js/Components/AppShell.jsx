/* @jsxRuntime automatic */
import React from "react";

const NAV_ITEMS = [
    {
        key: "dashboard",
        label: "KPI Dashboard",
        href: "/FGLIST/dashboard",
        icon: "📊",
    },
    {
        key: "hourly-output",
        label: "Hourly Output",
        href: "/FGLIST/hourly-output",
        icon: "⏱",
    },
    {
        key: "fglist",
        label: "FGLIST Entry",
        href: "/FGLIST/fg-list",
        icon: "📋",
    },
    {
        key: "delivery-orders",
        label: "Delivery Orders",
        href: "/FGLIST/delivery-orders/builder",
        icon: "📦",
    },
    {
        key: "telford-out",
        label: "Telford Out",
        href: "/FGLIST/telford-out",
        icon: "📤",
    },
    { key: "f3-out", label: "F3 Out", href: "/FGLIST/f3-out", icon: "🗃️" },
    {
        key: "team-dashboard",
        label: "Team Dashboard",
        href: "/FGLIST/team-dashboard",
        icon: "👥",
    },
    {
        key: "loading-plan",
        label: "Loading Plan",
        href: "/FGLIST/loading-plan",
        icon: "🏭",
    },
    {
        key: "lot-monitoring",
        label: "Lot Monitoring",
        href: "/FGLIST/lot-monitoring",
        icon: "🔍",
    },
];

export default function AppShell({
    active,
    title,
    subtitle,
    children,
    headerRight,
}) {
    return (
        <div className="shell">
            <aside className="shell-sidebar">
                <div className="brand">
                    <div className="brand-mark">T</div>
                    <div className="brand-text">
                        <div className="brand-name">TELFORD</div>
                        <div className="brand-sub">Production Operations</div>
                    </div>
                </div>
                <nav className="shell-nav">
                    {NAV_ITEMS.map((item) => (
                        <a
                            key={item.key}
                            href={item.href}
                            className={
                                "nav-item" +
                                (active === item.key ? " active" : "")
                            }
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span>{item.label}</span>
                        </a>
                    ))}
                </nav>
                <div className="shell-sidebar-footer">
                    <div className="env-badge">PRODUCTION</div>
                    <div className="footer-meta">TELFORD Svc. Phils. Inc.</div>
                </div>
            </aside>
            <div className="shell-main">
                <header className="shell-topbar">
                    <div>
                        <h1>{title}</h1>
                        {subtitle && <p>{subtitle}</p>}
                    </div>
                    <div className="topbar-right">{headerRight}</div>
                </header>
                <main className="shell-content">{children}</main>
            </div>
        </div>
    );
}
