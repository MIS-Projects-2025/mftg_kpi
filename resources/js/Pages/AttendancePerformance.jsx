import React, { useEffect, useState, useCallback } from "react";
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import api from "../services/api";

function fmt(n) {
    return Number(n || 0).toLocaleString();
}
function fmtPct(n) {
    return n == null ? "—" : Number(n).toFixed(1) + "%";
}
const TEAM_COLOR = { A: "#1e5fa8", B: "#059669", C: "#dc2626" };
function attColor(p) {
    return p >= 95 ? "#16a34a" : p >= 80 ? "#d97706" : "#dc2626";
}
function attBg(p) {
    return p >= 95 ? "#dcfce7" : p >= 80 ? "#fef9c3" : "#fee2e2";
}

const S = {
    lbl: {
        fontSize: 11,
        fontWeight: 600,
        color: "#64748b",
        textTransform: "uppercase",
        letterSpacing: ".05em",
        display: "block",
        marginBottom: 4,
    },
    inp: {
        fontSize: 13,
        padding: "7px 10px",
        borderRadius: 7,
        border: "1px solid #cbd5e1",
        color: "#1e293b",
        background: "#f8fafc",
        outline: "none",
    },
};

function Toggle({ value, onChange, options }) {
    return (
        <div
            style={{
                display: "flex",
                background: "#f1f5f9",
                borderRadius: 8,
                padding: 3,
                gap: 2,
            }}
        >
            {options.map((o) => (
                <button
                    key={o.value}
                    onClick={() => onChange(o.value)}
                    style={{
                        padding: "5px 14px",
                        borderRadius: 6,
                        border: "none",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        background:
                            value === o.value ? "#0e2841" : "transparent",
                        color: value === o.value ? "#fff" : "#64748b",
                    }}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

function StatCard({ label, value, sub, color, bg, border, onClick }) {
    return (
        <div
            onClick={onClick}
            style={{
                background: bg || "#fff",
                border: `1px solid ${border || "#e2e8f0"}`,
                borderRadius: 10,
                padding: "10px 14px",
                boxShadow: "0 1px 3px rgba(14,40,65,.05)",
                cursor: onClick ? "pointer" : undefined,
            }}
        >
            <div
                style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: ".06em",
                    marginBottom: 4,
                }}
            >
                {label}
            </div>
            <div
                style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: color || "#0e2841",
                }}
            >
                {value}
            </div>
            {sub && (
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                    {sub}
                </div>
            )}
            {onClick && (
                <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>
                    Click to view →
                </div>
            )}
        </div>
    );
}

/* ─── Employee Modal ──────────────────────────────────────── */
const SCENARIOS = [
    { key: "all", label: "All", color: "#64748b" },
    { key: "present", label: "Present", color: "#16a34a" },
    { key: "absent", label: "Absent", color: "#dc2626" },
    { key: "late", label: "Late", color: "#9d174d" },
    { key: "wrong_schedule", label: "Wrong Schedule", color: "#b45309" },
    { key: "leave", label: "On Leave", color: "#d97706" },
    { key: "restday", label: "Rest Day", color: "#0891b2" },
    { key: "pending", label: "On Shift", color: "#7c3aed" },
    { key: "no_schedule", label: "No Schedule", color: "#94a3b8" },
];

function EmployeeModal({ open, onClose, date, factory, team, status, title }) {
    const [allEmps, setAllEmps] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState("all");

    useEffect(() => {
        if (!open) {
            setAllEmps([]);
            setSearch("");
            setActiveTab("all");
            return;
        }
        setAllEmps([]);
        setSearch("");
        // Default tab to whichever status opened the modal
        setActiveTab(status || "all");
        setLoading(true);
        const params = { date };
        if (factory) params.factory = factory;
        if (team) params.team = team;
        // Always fetch all for tab switching
        api.get("/attendance/employees", { params })
            .then((r) => setAllEmps(r.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [open, date, factory, team, status]);

    if (!open) return null;

    // Filter by active tab - must match server-side summary logic exactly
    const hasShift = (e) => e.shift && e.shift !== "—";
    const tabFiltered = (() => {
        if (activeTab === "all")
            return allEmps.filter((e) => !e.restday && e.status !== "pending");
        if (activeTab === "present")
            return allEmps.filter((e) => e.status === "present");
        if (activeTab === "absent")
            return allEmps.filter((e) => e.status === "absent" && !e.restday);
        if (activeTab === "late") return allEmps.filter((e) => e.late);
        if (activeTab === "wrong_schedule")
            return allEmps.filter((e) => e.wrong_shift);
        if (activeTab === "leave")
            return allEmps.filter((e) => e.status === "leave");
        if (activeTab === "restday") return allEmps.filter((e) => e.restday);
        if (activeTab === "no_schedule")
            return allEmps.filter(
                (e) => (!e.shift || e.shift === "—") && e.check_in,
            );
        if (activeTab === "pending")
            return allEmps.filter((e) => e.status === "pending");
        return allEmps;
    })();

    const filtered = search
        ? tabFiltered.filter(
              (e) =>
                  e.name?.toLowerCase().includes(search.toLowerCase()) ||
                  String(e.employid).includes(search),
          )
        : tabFiltered;

    const hasShiftFn = (e) => e.shift && e.shift !== "—";
    const counts = {
        all: allEmps.filter((e) => !e.restday && e.status !== "pending").length,
        present: allEmps.filter((e) => e.status === "present").length,
        absent: allEmps.filter((e) => e.status === "absent" && !e.restday)
            .length,
        late: allEmps.filter((e) => e.late).length,
        wrong_schedule: allEmps.filter((e) => e.wrong_shift).length,
        leave: allEmps.filter((e) => e.status === "leave").length,
        restday: allEmps.filter((e) => e.restday).length,
        pending: allEmps.filter((e) => e.status === "pending").length,
        no_schedule: allEmps.filter(
            (e) => (!e.shift || e.shift === "—") && e.check_in,
        ).length,
    };

    const statusColor = {
        present: "#16a34a",
        absent: "#dc2626",
        leave: "#d97706",
        restday: "#1e5fa8",
        pending: "#d97706",
    };
    const statusBg = {
        present: "#f0fdf4",
        absent: "#fee2e2",
        leave: "#fef9c3",
        restday: "#eff6ff",
        pending: "#fef9c3",
    };
    const statusLabel = {
        present: "Present",
        absent: "Absent",
        leave: "On Leave",
        restday: "Rest Day",
        pending: "On Shift",
    };

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,.5)",
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
            }}
        >
            <div
                style={{
                    background: "#fff",
                    borderRadius: 14,
                    width: "100%",
                    maxWidth: 1000,
                    maxHeight: "90vh",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: "0 20px 60px rgba(0,0,0,.3)",
                }}
            >
                {/* Header */}
                <div
                    style={{
                        padding: "14px 20px",
                        borderBottom: "1px solid #f1f5f9",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <div>
                        <div
                            style={{
                                fontWeight: 700,
                                color: "#0e2841",
                                fontSize: 14,
                            }}
                        >
                            {title}
                        </div>
                        <div
                            style={{
                                fontSize: 11,
                                color: "#94a3b8",
                                marginTop: 2,
                            }}
                        >
                            {date} · {filtered.length} employees{" "}
                            {search
                                ? `(filtered from ${tabFiltered.length})`
                                : ""}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            border: "none",
                            background: "#f1f5f9",
                            borderRadius: 8,
                            padding: "6px 12px",
                            cursor: "pointer",
                            fontSize: 13,
                            color: "#64748b",
                            fontWeight: 600,
                        }}
                    >
                        ✕ Close
                    </button>
                </div>
                {/* Scenario tabs */}
                <div
                    style={{
                        display: "flex",
                        gap: 4,
                        padding: "10px 16px",
                        borderBottom: "1px solid #f1f5f9",
                        flexWrap: "wrap",
                    }}
                >
                    {SCENARIOS.map((s) => {
                        const cnt = counts[s.key];
                        const active = activeTab === s.key;
                        return (
                            <button
                                key={s.key}
                                onClick={() => setActiveTab(s.key)}
                                style={{
                                    padding: "4px 12px",
                                    borderRadius: 99,
                                    border: `1px solid ${active ? s.color : "#e2e8f0"}`,
                                    background: active ? s.color : "#f8fafc",
                                    color: active ? "#fff" : s.color,
                                    fontWeight: 600,
                                    fontSize: 11,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 5,
                                }}
                            >
                                {s.label}
                                <span
                                    style={{
                                        background: active
                                            ? "rgba(255,255,255,.3)"
                                            : "rgba(0,0,0,.08)",
                                        borderRadius: 99,
                                        padding: "1px 6px",
                                        fontSize: 10,
                                    }}
                                >
                                    {cnt}
                                </span>
                            </button>
                        );
                    })}
                </div>
                {/* Search */}
                <div
                    style={{
                        padding: "10px 20px",
                        borderBottom: "1px solid #f1f5f9",
                    }}
                >
                    <input
                        placeholder="Search by name or ID…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                            ...S.inp,
                            width: "100%",
                            boxSizing: "border-box",
                        }}
                    />
                </div>
                {/* Table */}
                <div style={{ overflowY: "auto", flex: 1 }}>
                    {loading ? (
                        <div
                            style={{
                                padding: 40,
                                textAlign: "center",
                                color: "#94a3b8",
                            }}
                        >
                            Loading…
                        </div>
                    ) : (
                        <table
                            style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                fontSize: 12,
                            }}
                        >
                            <thead
                                style={{
                                    position: "sticky",
                                    top: 0,
                                    zIndex: 1,
                                }}
                            >
                                <tr>
                                    {[
                                        "ID",
                                        "Name",
                                        "Team",
                                        "Factory",
                                        "Prodline",
                                        "Shift",
                                        "Check In",
                                        "Status",
                                        "Remarks",
                                    ].map((h) => (
                                        <th
                                            key={h}
                                            style={{
                                                background: "#0e2841",
                                                color: "#fff",
                                                padding: "8px 10px",
                                                textAlign: "left",
                                                fontWeight: 700,
                                                fontSize: 11,
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((e, i) => (
                                    <tr
                                        key={e.employid}
                                        style={{
                                            background:
                                                i % 2 === 0
                                                    ? "#f8fafc"
                                                    : "#fff",
                                        }}
                                    >
                                        <td
                                            style={{
                                                padding: "7px 10px",
                                                color: "#64748b",
                                            }}
                                        >
                                            {e.employid}
                                        </td>
                                        <td
                                            style={{
                                                padding: "7px 10px",
                                                fontWeight: 600,
                                                color: "#0e2841",
                                            }}
                                        >
                                            {e.name || "—"}
                                        </td>
                                        <td
                                            style={{
                                                padding: "7px 10px",
                                                textAlign: "center",
                                            }}
                                        >
                                            <span
                                                style={{
                                                    background:
                                                        TEAM_COLOR[e.team] +
                                                        "22",
                                                    color: TEAM_COLOR[e.team],
                                                    fontWeight: 700,
                                                    padding: "2px 8px",
                                                    borderRadius: 99,
                                                    fontSize: 11,
                                                }}
                                            >
                                                {e.team}
                                            </span>
                                        </td>
                                        <td
                                            style={{
                                                padding: "7px 10px",
                                                color: "#64748b",
                                            }}
                                        >
                                            {e.factory || "—"}
                                        </td>
                                        <td
                                            style={{
                                                padding: "7px 10px",
                                                color: "#64748b",
                                                fontSize: 10,
                                            }}
                                        >
                                            {e.prodline || "—"}
                                        </td>
                                        <td
                                            style={{
                                                padding: "7px 10px",
                                                textAlign: "center",
                                            }}
                                        >
                                            {(() => {
                                                const dayIds = [15, 9, 21];
                                                const nightIds = [16, 10, 22];
                                                const rdIds = [11, 12];
                                                const sid = Number(e.shift_id);
                                                const color = rdIds.includes(
                                                    sid,
                                                )
                                                    ? "#0891b2"
                                                    : dayIds.includes(sid)
                                                      ? "#1e5fa8"
                                                      : nightIds.includes(sid)
                                                        ? "#7c3aed"
                                                        : "#94a3b8";
                                                const bg = rdIds.includes(sid)
                                                    ? "#ecfeff"
                                                    : dayIds.includes(sid)
                                                      ? "#eff6ff"
                                                      : nightIds.includes(sid)
                                                        ? "#f5f3ff"
                                                        : "#f8fafc";
                                                const icon = dayIds.includes(
                                                    sid,
                                                )
                                                    ? "☀ "
                                                    : nightIds.includes(sid)
                                                      ? "🌙 "
                                                      : rdIds.includes(sid)
                                                        ? "🔄 "
                                                        : "";
                                                return (
                                                    <span
                                                        style={{
                                                            fontSize: 10,
                                                            fontWeight: 700,
                                                            color,
                                                            background: bg,
                                                            padding: "2px 8px",
                                                            borderRadius: 99,
                                                            whiteSpace:
                                                                "nowrap",
                                                        }}
                                                    >
                                                        {icon}
                                                        {e.shift || "—"}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td
                                            style={{
                                                padding: "7px 10px",
                                                fontVariantNumeric:
                                                    "tabular-nums",
                                                color: "#0e2841",
                                            }}
                                        >
                                            {e.check_in || "—"}
                                        </td>
                                        <td style={{ padding: "7px 10px" }}>
                                            <span
                                                style={{
                                                    background:
                                                        statusBg[e.status] ||
                                                        "#f1f5f9",
                                                    color:
                                                        statusColor[e.status] ||
                                                        "#64748b",
                                                    padding: "2px 8px",
                                                    borderRadius: 99,
                                                    fontSize: 10,
                                                    fontWeight: 700,
                                                }}
                                            >
                                                {statusLabel[e.status] ||
                                                    e.status ||
                                                    "—"}
                                            </span>
                                        </td>
                                        <td style={{ padding: "7px 10px" }}>
                                            <div
                                                style={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: 3,
                                                }}
                                            >
                                                {e.shift_desc && (
                                                    <span
                                                        style={{
                                                            fontSize: 10,
                                                            color: "#64748b",
                                                        }}
                                                    >
                                                        {e.shift_desc}
                                                    </span>
                                                )}
                                                {e.wrong_shift ? (
                                                    <span
                                                        style={{
                                                            color: "#b45309",
                                                            fontWeight: 700,
                                                            fontSize: 10,
                                                        }}
                                                    >
                                                        ⚠ Wrong Schedule
                                                    </span>
                                                ) : e.late ? (
                                                    <span
                                                        style={{
                                                            color: "#dc2626",
                                                            fontWeight: 700,
                                                            fontSize: 10,
                                                        }}
                                                    >
                                                        ⚠ Late
                                                    </span>
                                                ) : (!e.shift ||
                                                      e.shift === "—") &&
                                                  e.check_in ? (
                                                    <span
                                                        style={{
                                                            color: "#7c3aed",
                                                            fontWeight: 700,
                                                            fontSize: 10,
                                                        }}
                                                    >
                                                        No Schedule
                                                    </span>
                                                ) : (
                                                    <span
                                                        style={{
                                                            color: "#94a3b8",
                                                            fontSize: 10,
                                                        }}
                                                    >
                                                        —
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={9}
                                            style={{
                                                padding: 32,
                                                textAlign: "center",
                                                color: "#94a3b8",
                                            }}
                                        >
                                            No employees found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div
            style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "10px 14px",
                boxShadow: "0 4px 12px rgba(0,0,0,.1)",
                fontSize: 12,
                minWidth: 180,
            }}
        >
            <div
                style={{
                    fontWeight: 700,
                    color: "#0e2841",
                    marginBottom: 8,
                    borderBottom: "1px solid #f1f5f9",
                    paddingBottom: 6,
                }}
            >
                {label}
            </div>
            {payload.map((p, i) => (
                <div
                    key={i}
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 16,
                        marginBottom: 4,
                    }}
                >
                    <span style={{ color: p.color || p.fill, fontWeight: 600 }}>
                        {p.name}
                    </span>
                    <span style={{ fontWeight: 700, color: "#0e2841" }}>
                        {p.name.includes("%") ? p.value + "%" : fmt(p.value)}
                    </span>
                </div>
            ))}
        </div>
    );
}

/* ─── DL Breakdown Employee Modal ──────────────────────────── */
function BreakdownEmpModal({
    open,
    onClose,
    date,
    factory,
    department,
    rowLabel,
    rowType,
    status,
    title,
}) {
    const [emps, setEmps] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");

    useEffect(() => {
        if (!open) {
            setEmps([]);
            setSearch("");
            return;
        }
        setLoading(true);
        const params = { date, status };
        if (factory) params.factory = factory;
        if (department) params.department = department;
        if (rowLabel) params.row_label = rowLabel;
        if (rowType) params.row_type = rowType;
        api.get("/attendance/breakdown-employees", { params })
            .then((r) => setEmps(r.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [open, date, factory, department, rowLabel, rowType, status]);

    if (!open) return null;
    const filtered = search
        ? emps.filter(
              (e) =>
                  e.name?.toLowerCase().includes(search.toLowerCase()) ||
                  String(e.employid).includes(search),
          )
        : emps;
    const catColor = (cat) =>
        cat?.startsWith("Trainee") ? "#d97706" : "#1e5fa8";
    const catBg = (cat) => (cat?.startsWith("Trainee") ? "#fef9c3" : "#eff6ff");

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,.5)",
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
            }}
        >
            <div
                style={{
                    background: "#fff",
                    borderRadius: 14,
                    width: "100%",
                    maxWidth: 900,
                    maxHeight: "85vh",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: "0 20px 60px rgba(0,0,0,.3)",
                }}
            >
                <div
                    style={{
                        padding: "14px 20px",
                        borderBottom: "1px solid #f1f5f9",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <div>
                        <div
                            style={{
                                fontWeight: 700,
                                color: "#0e2841",
                                fontSize: 14,
                            }}
                        >
                            {title}
                        </div>
                        <div
                            style={{
                                fontSize: 11,
                                color: "#94a3b8",
                                marginTop: 2,
                            }}
                        >
                            {date} · {filtered.length} employees
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            border: "none",
                            background: "#f1f5f9",
                            borderRadius: 8,
                            padding: "6px 12px",
                            cursor: "pointer",
                            fontSize: 13,
                            color: "#64748b",
                            fontWeight: 600,
                        }}
                    >
                        ✕ Close
                    </button>
                </div>
                <div
                    style={{
                        padding: "10px 20px",
                        borderBottom: "1px solid #f1f5f9",
                    }}
                >
                    <input
                        placeholder="Search by name or ID…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                            fontSize: 13,
                            padding: "7px 10px",
                            borderRadius: 7,
                            border: "1px solid #cbd5e1",
                            width: "100%",
                            boxSizing: "border-box",
                        }}
                    />
                </div>
                <div style={{ overflowY: "auto", flex: 1 }}>
                    {loading ? (
                        <div
                            style={{
                                padding: 40,
                                textAlign: "center",
                                color: "#94a3b8",
                            }}
                        >
                            Loading…
                        </div>
                    ) : (
                        <table
                            style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                fontSize: 12,
                            }}
                        >
                            <thead
                                style={{
                                    position: "sticky",
                                    top: 0,
                                    zIndex: 1,
                                }}
                            >
                                <tr>
                                    {[
                                        "ID",
                                        "Name",
                                        "Department",
                                        "Job Title",
                                        "Station",
                                        "Category",
                                        "Schedule",
                                        "Check In",
                                        "Status",
                                    ].map((h) => (
                                        <th
                                            key={h}
                                            style={{
                                                background: "#0e2841",
                                                color: "#fff",
                                                padding: "8px 10px",
                                                textAlign: "left",
                                                fontWeight: 700,
                                                fontSize: 11,
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((e, i) => (
                                    <tr
                                        key={e.employid}
                                        style={{
                                            background:
                                                i % 2 === 0
                                                    ? "#f8fafc"
                                                    : "#fff",
                                        }}
                                    >
                                        <td
                                            style={{
                                                padding: "6px 10px",
                                                color: "#64748b",
                                            }}
                                        >
                                            {e.employid}
                                        </td>
                                        <td
                                            style={{
                                                padding: "6px 10px",
                                                fontWeight: 600,
                                                color: "#0e2841",
                                            }}
                                        >
                                            {e.name}
                                        </td>
                                        <td
                                            style={{
                                                padding: "6px 10px",
                                                color: "#64748b",
                                                fontSize: 11,
                                            }}
                                        >
                                            {e.department}
                                        </td>
                                        <td
                                            style={{
                                                padding: "6px 10px",
                                                color: "#64748b",
                                                fontSize: 11,
                                            }}
                                        >
                                            {e.job_title}
                                        </td>
                                        <td
                                            style={{
                                                padding: "6px 10px",
                                                color: "#64748b",
                                                fontSize: 11,
                                            }}
                                        >
                                            {e.station || "—"}
                                        </td>
                                        <td style={{ padding: "6px 10px" }}>
                                            <span
                                                style={{
                                                    background: catBg(
                                                        e.category,
                                                    ),
                                                    color: catColor(e.category),
                                                    padding: "2px 8px",
                                                    borderRadius: 99,
                                                    fontSize: 10,
                                                    fontWeight: 700,
                                                }}
                                            >
                                                {e.category}
                                            </span>
                                        </td>
                                        <td
                                            style={{
                                                padding: "6px 10px",
                                                textAlign: "center",
                                            }}
                                        >
                                            {(() => {
                                                const dayIds = [15, 9, 21];
                                                const nightIds = [16, 10, 22];
                                                const rdIds = [11, 12];
                                                const sid = Number(e.shift_id);
                                                const color = rdIds.includes(
                                                    sid,
                                                )
                                                    ? "#0891b2"
                                                    : dayIds.includes(sid)
                                                      ? "#1e5fa8"
                                                      : nightIds.includes(sid)
                                                        ? "#7c3aed"
                                                        : "#94a3b8";
                                                const bg = rdIds.includes(sid)
                                                    ? "#ecfeff"
                                                    : dayIds.includes(sid)
                                                      ? "#eff6ff"
                                                      : nightIds.includes(sid)
                                                        ? "#f5f3ff"
                                                        : "#f8fafc";
                                                const icon = dayIds.includes(
                                                    sid,
                                                )
                                                    ? "☀ "
                                                    : nightIds.includes(sid)
                                                      ? "🌙 "
                                                      : rdIds.includes(sid)
                                                        ? "🔄 "
                                                        : "";
                                                return (
                                                    <span
                                                        style={{
                                                            fontSize: 10,
                                                            fontWeight: 700,
                                                            color,
                                                            background: bg,
                                                            padding: "2px 8px",
                                                            borderRadius: 99,
                                                            whiteSpace:
                                                                "nowrap",
                                                        }}
                                                    >
                                                        {icon}
                                                        {e.shift || "—"}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td
                                            style={{
                                                padding: "6px 10px",
                                                color: "#0e2841",
                                            }}
                                        >
                                            {e.check_in || "—"}
                                        </td>
                                        <td style={{ padding: "6px 10px" }}>
                                            {e.wrong_shift ? (
                                                <span
                                                    style={{
                                                        background: "#fef9c3",
                                                        color: "#b45309",
                                                        padding: "2px 8px",
                                                        borderRadius: 99,
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    ⚠ Wrong Schedule
                                                </span>
                                            ) : e.late ? (
                                                <span
                                                    style={{
                                                        background: "#fce7f3",
                                                        color: "#9d174d",
                                                        padding: "2px 8px",
                                                        borderRadius: 99,
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    ⚠ Late
                                                </span>
                                            ) : (
                                                <span
                                                    style={{
                                                        background:
                                                            e.status ===
                                                            "present"
                                                                ? "#f0fdf4"
                                                                : e.status ===
                                                                    "restday"
                                                                  ? "#e8f0fe"
                                                                  : e.status ===
                                                                      "pending"
                                                                    ? "#fef9c3"
                                                                    : "#fee2e2",
                                                        color:
                                                            e.status ===
                                                            "present"
                                                                ? "#16a34a"
                                                                : e.status ===
                                                                    "restday"
                                                                  ? "#1e5fa8"
                                                                  : e.status ===
                                                                      "pending"
                                                                    ? "#d97706"
                                                                    : "#dc2626",
                                                        padding: "2px 8px",
                                                        borderRadius: 99,
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        textTransform:
                                                            "capitalize",
                                                    }}
                                                >
                                                    {e.status === "pending"
                                                        ? "Night (Pending)"
                                                        : e.status}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─── DL by Area Breakdown ────────────────────────────────── */
function DLByAreaBreakdown({ date, factory }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modal, setModal] = useState(null);
    const [collapsed, setCollapsed] = useState({});
    const toggleDept = (dept) =>
        setCollapsed((prev) => ({ ...prev, [dept]: !prev[dept] }));

    useEffect(() => {
        if (!date) return;
        setLoading(true);
        const params = { date };
        if (factory && factory !== "All") params.factory = factory;
        api.get("/attendance/breakdown", { params })
            .then((r) => setRows(r.data.rows || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [date, factory]);

    const tdBase = {
        padding: "6px 10px",
        textAlign: "right",
        fontSize: 11,
        borderBottom: "1px solid #f1f5f9",
        borderLeft: "1px solid #e2e8f0",
        whiteSpace: "nowrap",
    };
    const pctColor = (p) =>
        p >= 95 ? "#16a34a" : p >= 80 ? "#d97706" : "#dc2626";
    const pctBg = (p) =>
        p >= 95 ? "#f0fdf4" : p >= 80 ? "#fef9c3" : "#fee2e2";

    const openModal = (row, dept, status) => {
        console.log("openModal called", row, dept, status);
        if (row.type === "grand_total") return;
        const isDept = row.type === "department";
        setModal({
            department: isDept ? row.label : dept,
            rowLabel: isDept ? null : row.label,
            rowType: isDept ? null : row.row_type || "station",
            status,
            title: `${isDept ? row.label : `${dept} — ${row.label}`} · ${status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}`,
            openedAt: Date.now(),
        });
    };

    if (loading)
        return (
            <div
                style={{
                    padding: 40,
                    textAlign: "center",
                    color: "#94a3b8",
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                }}
            >
                Loading DL by Area…
            </div>
        );
    if (!rows.length)
        return (
            <div
                style={{
                    padding: 40,
                    textAlign: "center",
                    color: "#94a3b8",
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                }}
            >
                No data
            </div>
        );

    let currentDept = "";

    return (
        <>
            <div
                style={{
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    boxShadow: "0 1px 4px rgba(14,40,65,.06)",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        fontSize: 10,
                        color: "#64748b",
                        fontStyle: "italic",
                        padding: "8px 14px",
                        borderBottom: "1px solid #f1f5f9",
                    }}
                >
                    Leave and No Check-in = Absent · DL = non-Trainee employees
                    · Trainees = CERTIFICATION_STATUS IN (BUDDY, CLASSROOM) ·
                    Click any cell to view employees
                </div>
                <div style={{ overflowX: "auto" }}>
                    <table
                        style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: 11,
                        }}
                    >
                        <thead>
                            <tr>
                                <th
                                    rowSpan={2}
                                    style={{
                                        background: "#0e2841",
                                        color: "#fff",
                                        padding: "8px 14px",
                                        textAlign: "left",
                                        minWidth: 200,
                                        borderRight: "2px solid #1e3a5f",
                                        fontWeight: 700,
                                    }}
                                >
                                    DL by Area
                                </th>
                                <th
                                    colSpan={3}
                                    style={{
                                        background: "#1e5fa8",
                                        color: "#fff",
                                        padding: "7px 10px",
                                        textAlign: "center",
                                        fontWeight: 700,
                                        borderLeft:
                                            "2px solid rgba(255,255,255,.2)",
                                    }}
                                >
                                    Scheduled HC
                                </th>
                                <th
                                    colSpan={4}
                                    style={{
                                        background: "#16a34a",
                                        color: "#fff",
                                        padding: "7px 10px",
                                        textAlign: "center",
                                        fontWeight: 700,
                                        borderLeft:
                                            "2px solid rgba(255,255,255,.2)",
                                    }}
                                >
                                    Present HC
                                </th>
                                <th
                                    colSpan={4}
                                    style={{
                                        background: "#dc2626",
                                        color: "#fff",
                                        padding: "7px 10px",
                                        textAlign: "center",
                                        fontWeight: 700,
                                        borderLeft:
                                            "2px solid rgba(255,255,255,.2)",
                                    }}
                                >
                                    Absent HC
                                </th>
                            </tr>
                            <tr>
                                {["Certified", "Trainees", "Total"].map((h) => (
                                    <th
                                        key={h}
                                        style={{
                                            background: "#2563eb",
                                            color: "#bfdbfe",
                                            padding: "5px 10px",
                                            textAlign: "right",
                                            fontSize: 10,
                                            fontWeight: 600,
                                            borderLeft:
                                                "1px solid rgba(255,255,255,.15)",
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                                {[
                                    "Certified",
                                    "Trainees",
                                    "Total",
                                    "% Present",
                                ].map((h) => (
                                    <th
                                        key={h}
                                        style={{
                                            background: "#15803d",
                                            color: "#bbf7d0",
                                            padding: "5px 10px",
                                            textAlign: "right",
                                            fontSize: 10,
                                            fontWeight: 600,
                                            borderLeft:
                                                "1px solid rgba(255,255,255,.15)",
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                                {[
                                    "Certified",
                                    "Trainees",
                                    "Total",
                                    "% Absent",
                                ].map((h) => (
                                    <th
                                        key={h}
                                        style={{
                                            background: "#b91c1c",
                                            color: "#fecaca",
                                            padding: "5px 10px",
                                            textAlign: "right",
                                            fontSize: 10,
                                            fontWeight: 600,
                                            borderLeft:
                                                "1px solid rgba(255,255,255,.15)",
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, i) => {
                                if (row.type === "department")
                                    currentDept = row.label;
                                const dept = currentDept;
                                const d = row.data;
                                const isDept = row.type === "department";
                                const isGrand = row.type === "grand_total";
                                const isSubRow = row.type === "row";
                                const isCollapsed =
                                    collapsed[isDept ? row.label : currentDept];
                                // Hide sub-rows if dept is collapsed
                                if (isSubRow && isCollapsed) return null;
                                const rowBg = isGrand
                                    ? "#0e2841"
                                    : isDept
                                      ? "#e8f0fe"
                                      : i % 2 === 0
                                        ? "#f8fafc"
                                        : "#fff";
                                const tc = isGrand
                                    ? "#fff"
                                    : isDept
                                      ? "#1e3a5f"
                                      : "#374151";
                                const C = (status) =>
                                    isGrand
                                        ? {}
                                        : {
                                              cursor: "pointer",
                                              onClick: () =>
                                                  openModal(row, dept, status),
                                          };
                                return (
                                    <tr key={i} style={{ background: rowBg }}>
                                        <td
                                            style={{
                                                padding: `6px 14px 6px ${isSubRow ? 28 : 14}px`,
                                                fontWeight:
                                                    isDept || isGrand
                                                        ? 700
                                                        : 400,
                                                color: tc,
                                                borderBottom:
                                                    "1px solid #e2e8f0",
                                                borderRight:
                                                    "2px solid #e2e8f0",
                                                whiteSpace: "nowrap",
                                                fontSize: isDept ? 12 : 11,
                                                cursor: isGrand
                                                    ? undefined
                                                    : "pointer",
                                            }}
                                            onClick={() =>
                                                isDept
                                                    ? toggleDept(row.label)
                                                    : !isGrand &&
                                                      openModal(
                                                          row,
                                                          dept,
                                                          "all",
                                                      )
                                            }
                                        >
                                            {isDept
                                                ? `${collapsed[row.label] ? "▶" : "▼"} ${row.label}`
                                                : row.label}
                                        </td>
                                        <td
                                            style={{
                                                ...tdBase,
                                                color: isGrand
                                                    ? "#fff"
                                                    : "#1e5fa8",
                                                fontWeight:
                                                    isDept || isGrand
                                                        ? 700
                                                        : 400,
                                                ...C("all"),
                                            }}
                                        >
                                            {fmt(d.dl_sched)}
                                        </td>
                                        <td
                                            style={{
                                                ...tdBase,
                                                color: isGrand
                                                    ? "#fff"
                                                    : "#d97706",
                                                fontWeight:
                                                    isDept || isGrand
                                                        ? 700
                                                        : 400,
                                                ...C("all"),
                                            }}
                                        >
                                            {fmt(d.train_sched)}
                                        </td>
                                        <td
                                            style={{
                                                ...tdBase,
                                                color: isGrand
                                                    ? "#fff"
                                                    : "#1e3a5f",
                                                fontWeight: 700,
                                                borderRight:
                                                    "2px solid #e2e8f0",
                                                ...C("all"),
                                            }}
                                        >
                                            {fmt(d.total_sched)}
                                        </td>
                                        <td
                                            style={{
                                                ...tdBase,
                                                color: isGrand
                                                    ? "#fff"
                                                    : "#16a34a",
                                                fontWeight:
                                                    isDept || isGrand
                                                        ? 700
                                                        : 400,
                                                ...C("present"),
                                            }}
                                        >
                                            {fmt(d.dl_present)}
                                        </td>
                                        <td
                                            style={{
                                                ...tdBase,
                                                color: isGrand
                                                    ? "#fff"
                                                    : "#d97706",
                                                fontWeight:
                                                    isDept || isGrand
                                                        ? 700
                                                        : 400,
                                                ...C("present"),
                                            }}
                                        >
                                            {fmt(d.train_present)}
                                        </td>
                                        <td
                                            style={{
                                                ...tdBase,
                                                color: isGrand
                                                    ? "#fff"
                                                    : "#15803d",
                                                fontWeight: 700,
                                                ...C("present"),
                                            }}
                                        >
                                            {fmt(d.total_present)}
                                        </td>
                                        <td
                                            style={{
                                                ...tdBase,
                                                fontWeight: 700,
                                                borderRight:
                                                    "2px solid #e2e8f0",
                                                background: isGrand
                                                    ? "transparent"
                                                    : pctBg(d.pct_present),
                                                color: isGrand
                                                    ? "#fff"
                                                    : pctColor(d.pct_present),
                                            }}
                                        >
                                            {fmtPct(d.pct_present)}
                                        </td>
                                        <td
                                            style={{
                                                ...tdBase,
                                                color: isGrand
                                                    ? "#fff"
                                                    : "#dc2626",
                                                fontWeight:
                                                    isDept || isGrand
                                                        ? 700
                                                        : 400,
                                                ...C("absent"),
                                            }}
                                        >
                                            {fmt(d.dl_absent)}
                                        </td>
                                        <td
                                            style={{
                                                ...tdBase,
                                                color: isGrand
                                                    ? "#fff"
                                                    : "#d97706",
                                                fontWeight:
                                                    isDept || isGrand
                                                        ? 700
                                                        : 400,
                                                ...C("absent"),
                                            }}
                                        >
                                            {fmt(d.train_absent)}
                                        </td>
                                        <td
                                            style={{
                                                ...tdBase,
                                                color: isGrand
                                                    ? "#fff"
                                                    : "#b91c1c",
                                                fontWeight: 700,
                                                ...C("absent"),
                                            }}
                                        >
                                            {fmt(d.total_absent)}
                                        </td>
                                        <td
                                            style={{
                                                ...tdBase,
                                                fontWeight: 700,
                                                background: isGrand
                                                    ? "transparent"
                                                    : pctBg(100 - d.pct_absent),
                                                color: isGrand
                                                    ? "#fff"
                                                    : pctColor(
                                                          100 - d.pct_absent,
                                                      ),
                                            }}
                                        >
                                            {fmtPct(d.pct_absent)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            {modal && (
                <BreakdownEmpModal
                    key={
                        modal.openedAt ||
                        `${modal.department}-${modal.rowLabel}-${modal.status}`
                    }
                    open={true}
                    onClose={() => setModal(null)}
                    date={date}
                    factory={factory}
                    department={modal.department}
                    rowLabel={modal.rowLabel}
                    rowType={modal.rowType}
                    status={modal.status}
                    title={modal.title}
                />
            )}
        </>
    );
}

/* ═══════════════════════════════════════════════════════════ */
export default function AttendancePerformance() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [factory, setFactory] = useState("All");
    const [team, setTeam] = useState("");
    const [chartView, setChartView] = useState("daily");
    const [modal, setModal] = useState(null);

    useEffect(() => {
        const today = new Date().toISOString().slice(0, 10);
        setFrom(today);
        setTo(today);
    }, []);

    const load = useCallback(async () => {
        if (!from || !to) return;
        setLoading(true);
        try {
            const params = { from, to };
            if (factory !== "All") params.factory = factory;
            if (team) params.team = team;
            const res = await api.get("/attendance/summary", { params });
            setData(res.data);
        } catch (_) {
        } finally {
            setLoading(false);
        }
    }, [from, to, factory, team]);

    useEffect(() => {
        if (from && to) load();
    }, [load]);

    const lastDayTeams =
        data?.by_day?.length > 0
            ? data.by_day[data.by_day.length - 1].teams
            : null;
    const kpiTeams = lastDayTeams ? Object.values(lastDayTeams) : [];

    const totalHC = kpiTeams.reduce((s, t) => s + (t.headcount || 0), 0);
    const totalSchedHC = kpiTeams.reduce((s, t) => s + (t.sched_hc || 0), 0);
    const totalUnschedHC = kpiTeams.reduce(
        (s, t) => s + (t.unsched_hc || 0),
        0,
    );
    const totalPresent = kpiTeams.reduce((s, t) => s + (t.present || 0), 0);
    const totalSchedPresent = kpiTeams.reduce(
        (s, t) => s + (t.sched_present || 0),
        0,
    );
    const totalUnschedPres = kpiTeams.reduce(
        (s, t) => s + (t.unsched_present || 0),
        0,
    );
    const totalAbsent = kpiTeams.reduce((s, t) => s + (t.absent || 0), 0);
    const totalLeave = kpiTeams.reduce((s, t) => s + (t.on_leave || 0), 0);
    const totalLate = kpiTeams.reduce((s, t) => s + (t.late || 0), 0);
    const totalWrongSchedule = kpiTeams.reduce(
        (s, t) => s + (t.sched_wrong || 0),
        0,
    );
    const totalDayHC = kpiTeams.reduce((s, t) => s + (t.day_hc || 0), 0);
    const totalNightHC = kpiTeams.reduce((s, t) => s + (t.night_hc || 0), 0);
    const totalDayPresent = kpiTeams.reduce(
        (s, t) => s + (t.day_present || 0),
        0,
    );
    const totalNightPresent = kpiTeams.reduce(
        (s, t) => s + (t.night_present || 0),
        0,
    );
    const dayAttRate =
        totalDayHC > 0
            ? ((totalDayPresent / totalDayHC) * 100).toFixed(1)
            : null;
    const nightAttRate =
        totalNightHC > 0
            ? ((totalNightPresent / totalNightHC) * 100).toFixed(1)
            : null;
    const attDayHC = totalDayHC;
    const attNightHC = totalNightHC;
    const attDenomHC = attDayHC + attNightHC;
    const attNumer = totalDayPresent + totalNightPresent;
    const avgAtt =
        attDenomHC > 0 ? ((attNumer / attDenomHC) * 100).toFixed(1) : 0;

    const buildChartData = () => {
        if (!data?.by_day?.length) return [];
        const days = data.by_day.filter((d) => d?.date);

        const aggRow = (rows) => {
            const row = { _cnt: 0 };
            ["A", "B", "C"].forEach((t) => {
                row[`${t}_day`] = 0;
                row[`${t}_night`] = 0;
                row[`${t}_absent`] = 0;
                row[`${t}_att`] = 0;
            });
            rows.forEach((d) => {
                row._cnt++;
                ["A", "B", "C"].forEach((t) => {
                    const ts = d.teams?.[t] || {};
                    row[`${t}_day`] += ts.day_present || 0;
                    row[`${t}_night`] += ts.night_present || 0;
                    row[`${t}_absent`] += ts.absent || 0;
                    row[`${t}_att`] += Math.min(ts.att_rate || 0, 100);
                });
            });
            ["A", "B", "C"].forEach((t) => {
                row[`${t}_att`] =
                    row._cnt > 0 ? +(row[`${t}_att`] / row._cnt).toFixed(1) : 0;
            });
            return row;
        };

        if (chartView === "weekly") {
            const buckets = {};
            days.forEach((d) => {
                const dt = new Date(d.date);
                const wk = `W${Math.ceil(dt.getDate() / 7)} ${d.date.slice(0, 7)}`;
                if (!buckets[wk]) buckets[wk] = [];
                buckets[wk].push(d);
            });
            return Object.entries(buckets).map(([label, rows]) => ({
                label,
                ...aggRow(rows),
            }));
        }

        if (chartView === "quarterly") {
            const buckets = {};
            days.forEach((d) => {
                const dt = new Date(d.date);
                const q = Math.ceil((dt.getMonth() + 1) / 3);
                const key = `Q${q} ${dt.getFullYear()}`;
                if (!buckets[key]) buckets[key] = [];
                buckets[key].push(d);
            });
            return Object.entries(buckets).map(([label, rows]) => ({
                label,
                ...aggRow(rows),
            }));
        }

        // Daily
        return days.map((d) => {
            const row = { label: d.date.slice(5) };
            ["A", "B", "C"].forEach((t) => {
                const ts = d.teams?.[t] || {};
                row[`${t}_day`] = ts.day_present || 0;
                row[`${t}_night`] = ts.night_present || 0;
                row[`${t}_absent`] = ts.absent || 0;
                row[`${t}_att`] = Math.min(ts.att_rate || 0, 100);
            });
            return row;
        });
    };
    const chartData = buildChartData();

    const lastDate = data?.by_day?.[data.by_day.length - 1]?.date || from;
    const FACTORIES = ["All", "F1", "F2", "F3", "F1/F2", "F1/F2/F3"];

    /* ─── team breakdown table ────────────────────────────── */
    const TeamBreakdownTable = ({ ts, teamLabel }) => {
        if (!ts) return null;
        const c = TEAM_COLOR[teamLabel];
        const rows = [
            {
                label: "Scheduled",
                icon: "📋",
                bold: true,
                hc: ts.sched_hc,
                present: ts.sched_present,
                absent: ts.sched_absent,
                leave: ts.sched_leave,
                late: ts.sched_late,
                wrong: ts.sched_wrong,
                restday: "—",
                onClick_hc: () =>
                    setModal({
                        date: lastDate,
                        team: teamLabel,
                        status: "scheduled",
                        title: `Team ${teamLabel} — Scheduled`,
                        openedAt: Date.now(),
                    }),
                onClick_present: () =>
                    setModal({
                        date: lastDate,
                        team: teamLabel,
                        status: "present",
                        title: `Team ${teamLabel} — Present (Scheduled)`,
                        openedAt: Date.now(),
                    }),
                onClick_absent: () =>
                    setModal({
                        date: lastDate,
                        team: teamLabel,
                        status: "absent",
                        title: `Team ${teamLabel} — Absent`,
                        openedAt: Date.now(),
                    }),
                onClick_late: () =>
                    setModal({
                        date: lastDate,
                        team: teamLabel,
                        status: "late",
                        title: `Team ${teamLabel} — Late`,
                        openedAt: Date.now(),
                    }),
                onClick_wrong: () =>
                    setModal({
                        date: lastDate,
                        team: teamLabel,
                        status: "wrong_schedule",
                        title: `Team ${teamLabel} — Wrong Schedule`,
                        openedAt: Date.now(),
                    }),
            },
            {
                label: "Rest Day",
                icon: "🔄",
                bold: false,
                hc: ts.restday_hc,
                present: ts.restday_present,
                absent: "—",
                leave: "—",
                late: "—",
                restday: ts.restday_hc,
                onClick_hc: () =>
                    setModal({
                        date: lastDate,
                        team: teamLabel,
                        status: "restday",
                        title: `Team ${teamLabel} — Rest Day`,
                        openedAt: Date.now(),
                    }),
                onClick_present: () =>
                    setModal({
                        date: lastDate,
                        team: teamLabel,
                        status: "restday",
                        title: `Team ${teamLabel} — Rest Day Present`,
                        openedAt: Date.now(),
                    }),
            },
            {
                label: "No Schedule",
                icon: "🔓",
                bold: false,
                hc: ts.unsched_hc,
                present: ts.unsched_present,
                absent: "—",
                leave: "—",
                late: "—",
                restday: "—",
                onClick_hc: () =>
                    setModal({
                        date: lastDate,
                        team: teamLabel,
                        status: "no_schedule",
                        title: `Team ${teamLabel} — No Schedule`,
                        openedAt: Date.now(),
                    }),
                onClick_present: () =>
                    setModal({
                        date: lastDate,
                        team: teamLabel,
                        status: "no_schedule",
                        title: `Team ${teamLabel} — No Schedule (Present)`,
                        openedAt: Date.now(),
                    }),
            },
            {
                label: "☀ Day",
                icon: "",
                bold: false,
                sub: true,
                hc: ts.day_hc,
                present: ts.day_present,
                absent: ts.day_absent,
                leave: "—",
                late: ts.day_late,
                restday: "—",
                att: ts.day_att_rate,
            },
            {
                label: "🌙 Night",
                icon: "",
                bold: false,
                sub: true,
                hc: ts.night_hc,
                present: ts.night_present,
                absent: ts.night_absent,
                leave: "—",
                late: ts.night_late,
                restday: "—",
                att: ts.night_att_rate,
            },
        ];

        return (
            <table
                style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 11,
                }}
            >
                <thead>
                    <tr style={{ background: `${c}15` }}>
                        <th
                            style={{
                                padding: "6px 10px",
                                textAlign: "left",
                                fontWeight: 700,
                                color: c,
                                fontSize: 11,
                            }}
                        >
                            Category
                        </th>
                        <th
                            style={{
                                padding: "6px 8px",
                                textAlign: "right",
                                fontWeight: 700,
                                color: "#0e2841",
                            }}
                        >
                            HC
                        </th>
                        <th
                            style={{
                                padding: "6px 8px",
                                textAlign: "right",
                                fontWeight: 700,
                                color: "#16a34a",
                            }}
                        >
                            Present
                        </th>
                        <th
                            style={{
                                padding: "6px 8px",
                                textAlign: "right",
                                fontWeight: 700,
                                color: "#dc2626",
                            }}
                        >
                            Absent
                        </th>
                        <th
                            style={{
                                padding: "6px 8px",
                                textAlign: "right",
                                fontWeight: 700,
                                color: "#d97706",
                            }}
                        >
                            Leave
                        </th>
                        <th
                            style={{
                                padding: "6px 8px",
                                textAlign: "right",
                                fontWeight: 700,
                                color: "#9d174d",
                            }}
                        >
                            Late
                        </th>
                        <th
                            style={{
                                padding: "6px 8px",
                                textAlign: "right",
                                fontWeight: 700,
                                color: "#b45309",
                            }}
                        >
                            Wrong Sched
                        </th>
                        <th
                            style={{
                                padding: "6px 8px",
                                textAlign: "right",
                                fontWeight: 700,
                                color: "#0891b2",
                            }}
                        >
                            Restday
                        </th>
                        <th
                            style={{
                                padding: "6px 8px",
                                textAlign: "right",
                                fontWeight: 700,
                                color: "#7c3aed",
                            }}
                        >
                            Att%
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr
                            key={r.label}
                            style={{
                                background: i % 2 === 0 ? "#fff" : "#f8fafc",
                                borderBottom: "1px solid #f1f5f9",
                            }}
                        >
                            <td
                                style={{
                                    padding: "7px 10px",
                                    fontWeight: r.bold ? 700 : 400,
                                    color: r.sub ? "#94a3b8" : "#0e2841",
                                    paddingLeft: r.sub ? 20 : 10,
                                    fontSize: r.sub ? 10 : 11,
                                }}
                            >
                                {r.icon} {r.label}
                            </td>
                            <td
                                style={{
                                    padding: "7px 8px",
                                    textAlign: "right",
                                    fontWeight: 600,
                                    color: "#0e2841",
                                    cursor: r.onClick_hc
                                        ? "pointer"
                                        : undefined,
                                }}
                                onClick={r.onClick_hc}
                            >
                                {typeof r.hc === "number" ? fmt(r.hc) : r.hc}
                            </td>
                            <td
                                style={{
                                    padding: "7px 8px",
                                    textAlign: "right",
                                    color: "#16a34a",
                                    fontWeight: 600,
                                    cursor: r.onClick_present
                                        ? "pointer"
                                        : undefined,
                                }}
                                onClick={r.onClick_present}
                            >
                                {typeof r.present === "number"
                                    ? fmt(r.present)
                                    : r.present}
                            </td>
                            <td
                                style={{
                                    padding: "7px 8px",
                                    textAlign: "right",
                                    color: "#dc2626",
                                    cursor: r.onClick_absent
                                        ? "pointer"
                                        : undefined,
                                }}
                                onClick={r.onClick_absent}
                            >
                                {typeof r.absent === "number"
                                    ? fmt(r.absent)
                                    : r.absent}
                            </td>
                            <td
                                style={{
                                    padding: "7px 8px",
                                    textAlign: "right",
                                    color: "#d97706",
                                }}
                            >
                                {typeof r.leave === "number"
                                    ? fmt(r.leave)
                                    : r.leave}
                            </td>
                            <td
                                style={{
                                    padding: "7px 8px",
                                    textAlign: "right",
                                    color: "#9d174d",
                                    cursor: r.onClick_late
                                        ? "pointer"
                                        : undefined,
                                }}
                                onClick={r.onClick_late}
                            >
                                {typeof r.late === "number"
                                    ? fmt(r.late)
                                    : r.late}
                            </td>
                            <td
                                style={{
                                    padding: "7px 8px",
                                    textAlign: "right",
                                    color: "#b45309",
                                    cursor: r.onClick_wrong
                                        ? "pointer"
                                        : undefined,
                                }}
                                onClick={r.onClick_wrong}
                            >
                                {typeof r.wrong === "number"
                                    ? fmt(r.wrong)
                                    : r.wrong || "—"}
                            </td>
                            <td
                                style={{
                                    padding: "7px 8px",
                                    textAlign: "right",
                                    color: "#0891b2",
                                }}
                            >
                                {typeof r.restday === "number"
                                    ? fmt(r.restday)
                                    : r.restday}
                            </td>
                            <td
                                style={{
                                    padding: "7px 8px",
                                    textAlign: "right",
                                    color: "#7c3aed",
                                    fontWeight: 600,
                                }}
                            >
                                {r.att != null ? fmtPct(r.att) : "—"}
                            </td>
                        </tr>
                    ))}
                    {/* Total row */}
                    <tr
                        style={{
                            background: `${c}10`,
                            fontWeight: 800,
                            borderTop: `2px solid ${c}33`,
                        }}
                    >
                        <td style={{ padding: "7px 10px", color: c }}>Total</td>
                        <td
                            style={{
                                padding: "7px 8px",
                                textAlign: "right",
                                color: "#0e2841",
                            }}
                        >
                            {fmt(ts.headcount || 0)}
                        </td>
                        <td
                            style={{
                                padding: "7px 8px",
                                textAlign: "right",
                                color: "#16a34a",
                            }}
                        >
                            {fmt(ts.present || 0)}
                        </td>
                        <td
                            style={{
                                padding: "7px 8px",
                                textAlign: "right",
                                color: "#dc2626",
                            }}
                        >
                            {fmt(ts.absent || 0)}
                        </td>
                        <td
                            style={{
                                padding: "7px 8px",
                                textAlign: "right",
                                color: "#d97706",
                            }}
                        >
                            {fmt(ts.on_leave || 0)}
                        </td>
                        <td
                            style={{
                                padding: "7px 8px",
                                textAlign: "right",
                                color: "#9d174d",
                            }}
                        >
                            {fmt(ts.late || 0)}
                        </td>
                        <td
                            style={{
                                padding: "7px 8px",
                                textAlign: "right",
                                color: "#b45309",
                                cursor: "pointer",
                            }}
                            onClick={() =>
                                setModal({
                                    date: lastDate,
                                    team: teamLabel,
                                    status: "wrong_schedule",
                                    title: `Team ${teamLabel} — Wrong Schedule`,
                                    openedAt: Date.now(),
                                })
                            }
                        >
                            {fmt(ts.sched_wrong || 0)}
                        </td>
                        <td
                            style={{
                                padding: "7px 8px",
                                textAlign: "right",
                                color: "#0891b2",
                            }}
                        >
                            {fmt(ts.restday_hc || 0)}
                        </td>
                        <td
                            style={{
                                padding: "7px 8px",
                                textAlign: "right",
                                color: "#7c3aed",
                                fontWeight: 700,
                            }}
                        >
                            {fmtPct(ts.att_rate || 0)}
                        </td>
                    </tr>
                </tbody>
            </table>
        );
    };

    return (
        <div style={{ padding: "0 0 48px" }}>
            {/* ── Filter bar ────────────────────────────────── */}
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                    alignItems: "flex-end",
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: "14px 16px",
                    marginBottom: 16,
                    boxShadow: "0 1px 3px rgba(14,40,65,.05)",
                }}
            >
                <div>
                    <label style={S.lbl}>From</label>
                    <input
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        style={{ ...S.inp, width: 145 }}
                    />
                </div>
                <div>
                    <label style={S.lbl}>To</label>
                    <input
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        style={{ ...S.inp, width: 145 }}
                    />
                </div>
                <div>
                    <label style={S.lbl}>Factory</label>
                    <select
                        value={factory}
                        onChange={(e) => setFactory(e.target.value)}
                        style={{ ...S.inp, width: 120 }}
                    >
                        {FACTORIES.map((f) => (
                            <option key={f} value={f}>
                                {f}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label style={S.lbl}>Team</label>
                    <select
                        value={team}
                        onChange={(e) => setTeam(e.target.value)}
                        style={{ ...S.inp, width: 100 }}
                    >
                        <option value="">All</option>
                        {["A", "B", "C"].map((t) => (
                            <option key={t} value={t}>
                                Team {t}
                            </option>
                        ))}
                    </select>
                </div>
                <div
                    style={{
                        marginLeft: "auto",
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                    }}
                >
                    {loading && (
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>
                            Loading…
                        </span>
                    )}
                    <button
                        onClick={load}
                        style={{
                            padding: "7px 18px",
                            borderRadius: 7,
                            border: "1px solid #cbd5e1",
                            background: "#fff",
                            fontSize: 13,
                            cursor: "pointer",
                            color: "#0e2841",
                            fontWeight: 600,
                        }}
                    >
                        ↻ Refresh
                    </button>
                </div>
            </div>

            {/* ── KPI strip ─────────────────────────────────── */}
            {data && (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns:
                            "repeat(auto-fit,minmax(120px,1fr))",
                        gap: 10,
                        marginBottom: 16,
                    }}
                >
                    <StatCard
                        label="Total HC"
                        value={fmt(totalHC)}
                        color="#0e2841"
                        sub={`Sched:${fmt(totalSchedHC)} / Unsched:${fmt(totalUnschedHC)} (excl. Restday)`}
                        onClick={() =>
                            setModal({
                                date: lastDate,
                                factory,
                                status: null,
                                title: "All Employees",
                                openedAt: Date.now(),
                            })
                        }
                    />
                    <StatCard
                        label="Present"
                        value={fmt(totalPresent)}
                        color="#16a34a"
                        bg="#f0fdf4"
                        border="#bbf7d0"
                        sub={`Sched:${fmt(totalSchedPresent)} / NoSched:${fmt(totalUnschedPres)}`}
                        onClick={() =>
                            setModal({
                                date: lastDate,
                                factory,
                                status: "present",
                                title: "Present Employees",
                                openedAt: Date.now(),
                            })
                        }
                    />
                    <StatCard
                        label="Absent"
                        value={fmt(totalAbsent)}
                        color="#dc2626"
                        bg="#fee2e2"
                        border="#fca5a5"
                        onClick={() =>
                            setModal({
                                date: lastDate,
                                factory,
                                status: "absent",
                                title: "Absent Employees",
                                openedAt: Date.now(),
                            })
                        }
                    />
                    <StatCard
                        label="On Leave"
                        value={fmt(totalLeave)}
                        color="#d97706"
                        bg="#fef9c3"
                        border="#fde68a"
                        onClick={() =>
                            setModal({
                                date: lastDate,
                                factory,
                                status: "leave",
                                title: "On Leave Employees",
                                openedAt: Date.now(),
                            })
                        }
                    />
                    <StatCard
                        label="Late"
                        value={fmt(totalLate)}
                        color="#9d174d"
                        bg="#fce7f3"
                        border="#fbcfe8"
                        onClick={() =>
                            setModal({
                                date: lastDate,
                                factory,
                                status: "late",
                                title: "Late Employees",
                                openedAt: Date.now(),
                            })
                        }
                    />
                    <StatCard
                        label="Wrong Schedule"
                        value={fmt(totalWrongSchedule)}
                        color="#d97706"
                        bg="#fef9c3"
                        border="#fde68a"
                        onClick={() =>
                            setModal({
                                date: lastDate,
                                factory,
                                status: "wrong_schedule",
                                title: "Wrong Schedule Employees",
                                openedAt: Date.now(),
                            })
                        }
                    />
                    <StatCard
                        label="No Schedule"
                        value={fmt(totalUnschedHC)}
                        color="#7c3aed"
                        bg="#f5f3ff"
                        border="#ddd6fe"
                        sub={`Present: ${fmt(totalUnschedPres)}`}
                        onClick={() =>
                            setModal({
                                date: lastDate,
                                factory,
                                status: "no_schedule",
                                title: "No Schedule Employees",
                                openedAt: Date.now(),
                            })
                        }
                    />
                    <StatCard
                        label="☀ Day HC"
                        value={fmt(totalDayHC)}
                        color="#1e5fa8"
                        bg="#eff6ff"
                        border="#bfdbfe"
                        sub={`Present: ${fmt(totalDayPresent)}`}
                    />
                    <StatCard
                        label="🌙 Night HC"
                        value={fmt(totalNightHC)}
                        color="#7c3aed"
                        bg="#f5f3ff"
                        border="#ddd6fe"
                        sub={`Present: ${fmt(totalNightPresent)}`}
                    />
                    <StatCard
                        label="☀ Day Att Rate"
                        value={
                            dayAttRate != null
                                ? fmtPct(Number(dayAttRate))
                                : "—"
                        }
                        color={
                            dayAttRate != null
                                ? attColor(Number(dayAttRate))
                                : "#94a3b8"
                        }
                        bg={
                            dayAttRate != null
                                ? attBg(Number(dayAttRate))
                                : "#f8fafc"
                        }
                        sub={
                            totalDayHC > 0
                                ? `${fmt(totalDayPresent)}/${fmt(totalDayHC)}`
                                : ""
                        }
                    />
                    <StatCard
                        label="🌙 Night Att Rate"
                        value={
                            nightAttRate != null
                                ? fmtPct(Number(nightAttRate))
                                : "—"
                        }
                        color={
                            nightAttRate != null
                                ? attColor(Number(nightAttRate))
                                : "#94a3b8"
                        }
                        bg={
                            nightAttRate != null
                                ? attBg(Number(nightAttRate))
                                : "#f8fafc"
                        }
                        sub={
                            totalNightHC > 0
                                ? `${fmt(totalNightPresent)}/${fmt(totalNightHC)}`
                                : ""
                        }
                    />
                    <div
                        style={{
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            borderRadius: 10,
                            padding: "10px 14px",
                            boxShadow: "0 1px 3px rgba(14,40,65,.05)",
                        }}
                    >
                        <div
                            style={{
                                fontSize: 9,
                                fontWeight: 600,
                                color: "#64748b",
                                textTransform: "uppercase",
                                letterSpacing: ".06em",
                                marginBottom: 6,
                            }}
                        >
                            Overall Att Rate
                        </div>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: 10,
                                        color: "#1e5fa8",
                                        fontWeight: 600,
                                    }}
                                >
                                    ☀ Day
                                </span>
                                <span
                                    style={{
                                        fontSize: 14,
                                        fontWeight: 800,
                                        color:
                                            dayAttRate != null
                                                ? attColor(Number(dayAttRate))
                                                : "#94a3b8",
                                    }}
                                >
                                    {dayAttRate != null
                                        ? fmtPct(Number(dayAttRate))
                                        : "—"}
                                </span>
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: 10,
                                        color: "#7c3aed",
                                        fontWeight: 600,
                                    }}
                                >
                                    🌙 Night
                                </span>
                                <span
                                    style={{
                                        fontSize: 14,
                                        fontWeight: 800,
                                        color:
                                            nightAttRate != null
                                                ? attColor(Number(nightAttRate))
                                                : "#94a3b8",
                                    }}
                                >
                                    {nightAttRate != null
                                        ? fmtPct(Number(nightAttRate))
                                        : "—"}
                                </span>
                            </div>
                            <div
                                style={{
                                    borderTop: "1px solid #e2e8f0",
                                    paddingTop: 4,
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: 10,
                                        color: "#64748b",
                                        fontWeight: 600,
                                    }}
                                >
                                    Overall
                                </span>
                                <span
                                    style={{
                                        fontSize: 14,
                                        fontWeight: 800,
                                        color: attColor(Number(avgAtt)),
                                    }}
                                >
                                    {fmtPct(Number(avgAtt))}
                                </span>
                            </div>
                        </div>
                    </div>
                    <StatCard
                        label="Days"
                        value={data.by_day?.length || 0}
                        color="#7c3aed"
                    />
                </div>
            )}

            {/* ── Team breakdown cards ───────────────────────── */}
            {lastDayTeams && (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3,1fr)",
                        gap: 12,
                        marginBottom: 16,
                    }}
                >
                    {["A", "B", "C"].map((t) => {
                        const ts = lastDayTeams[t] || {};
                        const c = TEAM_COLOR[t];
                        const attRate = ts.att_rate || 0;
                        return (
                            <div
                                key={t}
                                style={{
                                    borderRadius: 10,
                                    border: `2px solid ${c}22`,
                                    background: "#fff",
                                    boxShadow: "0 1px 3px rgba(14,40,65,.05)",
                                    overflow: "hidden",
                                }}
                            >
                                {/* Team header */}
                                <div
                                    style={{
                                        background: `${c}12`,
                                        padding: "10px 14px",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        borderBottom: `1px solid ${c}22`,
                                    }}
                                >
                                    <span
                                        style={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: "50%",
                                            background: c,
                                            color: "#fff",
                                            fontWeight: 900,
                                            fontSize: 14,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        {t}
                                    </span>
                                    <span
                                        style={{
                                            fontWeight: 700,
                                            color: "#0e2841",
                                            fontSize: 13,
                                        }}
                                    >
                                        Team {t}
                                    </span>
                                    <div
                                        style={{
                                            marginLeft: "auto",
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "flex-end",
                                            gap: 3,
                                        }}
                                    >
                                        <div
                                            style={{ display: "flex", gap: 4 }}
                                        >
                                            <span
                                                style={{
                                                    background: "#eff6ff",
                                                    color: "#1e5fa8",
                                                    fontWeight: 700,
                                                    fontSize: 10,
                                                    padding: "2px 7px",
                                                    borderRadius: 99,
                                                }}
                                            >
                                                ☀ {fmtPct(ts.day_att_rate || 0)}
                                            </span>
                                            <span
                                                style={{
                                                    background: "#f5f3ff",
                                                    color: "#7c3aed",
                                                    fontWeight: 700,
                                                    fontSize: 10,
                                                    padding: "2px 7px",
                                                    borderRadius: 99,
                                                }}
                                            >
                                                🌙{" "}
                                                {fmtPct(ts.night_att_rate || 0)}
                                            </span>
                                        </div>
                                        <span
                                            style={{
                                                background: attBg(attRate),
                                                color: attColor(attRate),
                                                fontWeight: 800,
                                                fontSize: 11,
                                                padding: "2px 10px",
                                                borderRadius: 99,
                                            }}
                                        >
                                            Overall {fmtPct(attRate)}
                                        </span>
                                    </div>
                                </div>
                                {/* Breakdown table */}
                                <TeamBreakdownTable ts={ts} teamLabel={t} />
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Chart ─────────────────────────────────────── */}
            {data?.by_day?.length > 0 && (
                <div
                    style={{
                        background: "#fff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        boxShadow: "0 1px 4px rgba(14,40,65,.06)",
                        overflow: "hidden",
                        marginBottom: 16,
                    }}
                >
                    <div
                        style={{
                            padding: "12px 16px",
                            borderBottom: "1px solid #f1f5f9",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: 10,
                        }}
                    >
                        <div>
                            <div
                                style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: "#0e2841",
                                    textTransform: "uppercase",
                                    letterSpacing: ".06em",
                                }}
                            >
                                Team Rotation — Attendance Performance
                            </div>
                            <div
                                style={{
                                    fontSize: 10,
                                    color: "#94a3b8",
                                    marginTop: 2,
                                }}
                            >
                                Stacked: ☀ Day Present / 🌙 Night Present /
                                Absent · Dashed line = Att%
                            </div>
                        </div>
                        <Toggle
                            value={chartView}
                            onChange={setChartView}
                            options={[
                                { value: "daily", label: "Daily" },
                                { value: "weekly", label: "Weekly" },
                                { value: "quarterly", label: "Quarterly" },
                            ]}
                        />
                    </div>
                    <div style={{ padding: 16 }}>
                        <ResponsiveContainer width="100%" height={340}>
                            <ComposedChart
                                data={chartData}
                                margin={{
                                    top: 10,
                                    right: 60,
                                    left: 10,
                                    bottom: 5,
                                }}
                                barCategoryGap="20%"
                                barGap={1}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="#f1f5f9"
                                />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 10 }}
                                />
                                <YAxis
                                    yAxisId="left"
                                    tick={{ fontSize: 10 }}
                                    width={40}
                                    label={{
                                        value: "Employees",
                                        angle: -90,
                                        position: "insideLeft",
                                        style: { fontSize: 9, fill: "#94a3b8" },
                                    }}
                                />
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    tick={{ fontSize: 10 }}
                                    tickFormatter={(v) => v + "%"}
                                    domain={[0, 100]}
                                    allowDataOverflow={true}
                                    width={45}
                                />
                                <Tooltip content={<ChartTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 10 }} />
                                {/* Single combined stacked bar: A_day, A_night, B_day, B_night, C_day, C_night, then absents */}
                                <Bar
                                    yAxisId="left"
                                    dataKey="A_day"
                                    name="Team A ☀ Day"
                                    stackId="all"
                                    fill={TEAM_COLOR["A"]}
                                    fillOpacity={0.95}
                                    radius={[0, 0, 0, 0]}
                                />
                                <Bar
                                    yAxisId="left"
                                    dataKey="A_night"
                                    name="Team A 🌙 Night"
                                    stackId="all"
                                    fill={TEAM_COLOR["A"]}
                                    fillOpacity={0.55}
                                />
                                <Bar
                                    yAxisId="left"
                                    dataKey="B_day"
                                    name="Team B ☀ Day"
                                    stackId="all"
                                    fill={TEAM_COLOR["B"]}
                                    fillOpacity={0.95}
                                />
                                <Bar
                                    yAxisId="left"
                                    dataKey="B_night"
                                    name="Team B 🌙 Night"
                                    stackId="all"
                                    fill={TEAM_COLOR["B"]}
                                    fillOpacity={0.55}
                                />
                                <Bar
                                    yAxisId="left"
                                    dataKey="C_day"
                                    name="Team C ☀ Day"
                                    stackId="all"
                                    fill={TEAM_COLOR["C"]}
                                    fillOpacity={0.95}
                                />
                                <Bar
                                    yAxisId="left"
                                    dataKey="C_night"
                                    name="Team C 🌙 Night"
                                    stackId="all"
                                    fill={TEAM_COLOR["C"]}
                                    fillOpacity={0.55}
                                />
                                <Bar
                                    yAxisId="left"
                                    dataKey="A_absent"
                                    name="Team A Absent"
                                    stackId="all"
                                    fill="#dc2626"
                                    fillOpacity={0.25}
                                />
                                <Bar
                                    yAxisId="left"
                                    dataKey="B_absent"
                                    name="Team B Absent"
                                    stackId="all"
                                    fill="#dc2626"
                                    fillOpacity={0.2}
                                />
                                <Bar
                                    yAxisId="left"
                                    dataKey="C_absent"
                                    name="Team C Absent"
                                    stackId="all"
                                    fill="#dc2626"
                                    fillOpacity={0.15}
                                    radius={[3, 3, 0, 0]}
                                />
                                {/* Att% line per team */}
                                {["A", "B", "C"].map((t) => (
                                    <Line
                                        key={`${t}_att`}
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey={`${t}_att`}
                                        name={`Team ${t} Att%`}
                                        stroke={TEAM_COLOR[t]}
                                        strokeWidth={2}
                                        strokeDasharray="5 2"
                                        dot={{ r: 3 }}
                                    />
                                ))}
                            </ComposedChart>
                        </ResponsiveContainer>
                        {/* Legend */}
                        <div
                            style={{
                                display: "flex",
                                gap: 12,
                                justifyContent: "center",
                                flexWrap: "wrap",
                                marginTop: 8,
                                fontSize: 10,
                                color: "#64748b",
                            }}
                        >
                            {["A", "B", "C"].map((t) => (
                                <span
                                    key={t}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4,
                                    }}
                                >
                                    <span
                                        style={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: 2,
                                            background: TEAM_COLOR[t],
                                            opacity: 0.95,
                                            display: "inline-block",
                                        }}
                                    />
                                    <b style={{ color: TEAM_COLOR[t] }}>
                                        Team {t}
                                    </b>{" "}
                                    ☀
                                    <span
                                        style={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: 2,
                                            background: TEAM_COLOR[t],
                                            opacity: 0.55,
                                            display: "inline-block",
                                        }}
                                    />
                                    🌙
                                    <span>-- Att%</span>
                                </span>
                            ))}
                            <span
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                }}
                            >
                                <span
                                    style={{
                                        width: 10,
                                        height: 10,
                                        borderRadius: 2,
                                        background: "#dc2626",
                                        opacity: 0.25,
                                        display: "inline-block",
                                    }}
                                />
                                Absent
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* ── DL by Area Breakdown ──────────────────────── */}
            <DLByAreaBreakdown date={lastDate} factory={factory} />

            {!data && !loading && (
                <div
                    style={{
                        padding: 40,
                        textAlign: "center",
                        color: "#94a3b8",
                    }}
                >
                    Select a date range and click Refresh
                </div>
            )}
            {loading && (
                <div
                    style={{
                        padding: 40,
                        textAlign: "center",
                        color: "#94a3b8",
                    }}
                >
                    Loading attendance data…
                </div>
            )}

            {modal && (
                <EmployeeModal
                    key={
                        modal.openedAt ||
                        `${modal.date}-${modal.status}-${modal.team}`
                    }
                    open={true}
                    onClose={() => setModal(null)}
                    date={modal.date}
                    factory={
                        modal.factory && modal.factory !== "All"
                            ? modal.factory
                            : factory !== "All"
                              ? factory
                              : null
                    }
                    team={modal.team || team || null}
                    status={modal.status}
                    title={modal.title}
                />
            )}
        </div>
    );
}
