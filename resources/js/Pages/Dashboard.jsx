import React, { useCallback, useEffect, useState } from 'react';
import {
    ResponsiveContainer, ComposedChart, Bar, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    AreaChart, Area,
} from 'recharts';
import api from '../services/api';

/* ─── helpers ──────────────────────────────────────────────────── */
function todayISO() { return new Date().toISOString().slice(0, 10); }
function monthStart() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

/* ─── KPI card ─────────────────────────────────────────────────── */
function KpiCard({ label, value, sub, color }) {
    return (
        <div style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
            padding: '14px 16px', boxShadow: '0 1px 4px rgba(14,40,65,.06)',
        }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b',
                          textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
                {label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: color || '#0e2841', lineHeight: 1.1 }}>
                {value}
            </div>
            {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{sub}</div>}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function KpiDashboard() {

    /* ── filters ──────────────────────────────────────────────── */
    const [date,  setDate]  = useState(todayISO());
    const [from,  setFrom]  = useState(monthStart());
    const [to,    setTo]    = useState(todayISO());
    const [shift, setShift] = useState('');
    const [area,  setArea]  = useState('');
    const [areas, setAreas] = useState([]);

    /* ── data ─────────────────────────────────────────────────── */
    const [summary,   setSummary]   = useState(null);
    const [perHour,   setPerHour]   = useState([]);
    const [perShift,  setPerShift]  = useState([]);
    const [perDay,    setPerDay]    = useState([]);
    const [perPart,   setPerPart]   = useState([]);
    const [loading,   setLoading]   = useState(false);

    /* ── load areas once ──────────────────────────────────────── */
    useEffect(() => {
    api.get('/dashboard/per-day', {
        params: { from: monthStart(), to: todayISO() }
    }).then(r => {
        if (r.data && r.data.length > 0) {
            const dates = [...new Set(r.data.map(row => row.date))].sort();
            const latest = dates[dates.length - 1];
            setDate(latest);
        }
    }).catch(() => {});
}, []);

// ← ADD THIS RIGHT AFTER
useEffect(() => {
    api.get('/dashboard/areas')
        .then(r => setAreas(r.data))
        .catch(() => {});
}, []);

    /* ── load all dashboard data ──────────────────────────────── */
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params     = { date, shift: shift || undefined, area: area || undefined };
            const dayParams  = { from, to, shift: shift || undefined, area: area || undefined };

            const [s, h, sh, d, p] = await Promise.all([
                api.get('/dashboard/summary',     { params }),
                api.get('/dashboard/per-hour',    { params }),
                api.get('/dashboard/per-shift',   { params: { date, area: area || undefined } }),
                api.get('/dashboard/per-day',     { params: dayParams }),
                api.get('/dashboard/per-partname',{ params }),
            ]);

            setSummary(s.data);
            setPerHour(h.data);
            setPerShift(sh.data);
            setPerDay(d.data);
            setPerPart(p.data);
        } catch (_) {}
        finally { setLoading(false); }
    }, [date, from, to, shift, area]);

    useEffect(() => { load(); }, [load]);

    /* ── chart data ───────────────────────────────────────────── */
    // Per-hour chart — all 24 hours, filled in from data
    const hourChartData = Array.from({ length: 24 }, (_, i) => {
        const label = `${String(i).padStart(2, '0')}:00`;
        const found = perHour.filter(r => r.hour_label === label);
        return {
            hour: label,
            qty:  found.reduce((s, r) => s + Number(r.total_qty || 0), 0),
            lots: found.reduce((s, r) => s + Number(r.total_lots || 0), 0),
            shift: (i >= 7 && i < 19) ? 'DAY' : 'NIGHT',
        };
    }).filter(h => h.qty > 0);

    // Per-day chart
    const dayChartData = (() => {
        const grouped = {};
        perDay.forEach(r => {
            if (!grouped[r.date]) grouped[r.date] = { date: r.date, qty: 0, lots: 0 };
            grouped[r.date].qty  += Number(r.total_qty  || 0);
            grouped[r.date].lots += Number(r.total_lots || 0);
        });
        return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
    })();

    // Per-shift summary
    const dayShift   = perShift.filter(r => r.shift === 'DAY');
    const nightShift = perShift.filter(r => r.shift === 'NIGHT');
    const dayQty     = dayShift.reduce((s, r)   => s + Number(r.total_qty || 0), 0);
    const nightQty   = nightShift.reduce((s, r) => s + Number(r.total_qty || 0), 0);

    /* ── styles ───────────────────────────────────────────────── */
    const S = {
        wrap:    { padding: '0 0 48px' },
        bar:     { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end',
                   background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
                   padding: '12px 16px', marginBottom: 16,
                   boxShadow: '0 1px 3px rgba(14,40,65,.05)' },
        lbl:     { fontSize: 11, fontWeight: 600, color: '#64748b',
                   textTransform: 'uppercase', letterSpacing: '.05em',
                   display: 'block', marginBottom: 4 },
        inp:     { fontSize: 13, padding: '7px 10px', borderRadius: 7,
                   border: '1px solid #cbd5e1', color: '#1e293b',
                   background: '#f8fafc', outline: 'none' },
        kpis:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))',
                   gap: 12, marginBottom: 16 },
        shiftRow:{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 },
        card:    { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
                   boxShadow: '0 1px 4px rgba(14,40,65,.06)', overflow: 'hidden', marginBottom: 16 },
        cardHdr: { padding: '12px 16px', display: 'flex', alignItems: 'center',
                   justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9' },
        ttl:     { fontSize: 12, fontWeight: 700, color: '#0e2841',
                   textTransform: 'uppercase', letterSpacing: '.06em' },
        th:      { background: '#0e2841', color: '#fff', padding: '8px 10px',
                   fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                   letterSpacing: '.04em', textAlign: 'left', whiteSpace: 'nowrap' },
        thR:     { background: '#0e2841', color: '#fff', padding: '8px 10px',
                   fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                   letterSpacing: '.04em', textAlign: 'right', whiteSpace: 'nowrap' },
        td:      i => ({ padding: '8px 10px', fontSize: 12, verticalAlign: 'middle',
                         background: i % 2 === 0 ? '#f8fafc' : '#fff',
                         borderBottom: '1px solid #e2e8f0' }),
        tdR:     i => ({ padding: '8px 10px', fontSize: 12, textAlign: 'right',
                         verticalAlign: 'middle', fontVariantNumeric: 'tabular-nums',
                         background: i % 2 === 0 ? '#f8fafc' : '#fff',
                         borderBottom: '1px solid #e2e8f0' }),
        totRow:  { background: '#0e2841' },
    };

    const tooltipStyle = { borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 };

    return (
        <div style={S.wrap}>

            {/* ── Filter bar ─────────────────────────────────── */}
            <div style={S.bar}>
                <div>
                    <label style={S.lbl}>Date</label>
                    <input style={{ ...S.inp, width: 140 }} type="date"
                        value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div>
                    <label style={S.lbl}>Shift</label>
                    <select style={{ ...S.inp, width: 160 }} value={shift}
                        onChange={e => setShift(e.target.value)}>
                        <option value="">All Shifts</option>
                        <option value="DAY">Day (07:00 – 19:00)</option>
                        <option value="NIGHT">Night (19:00 – 07:00)</option>
                    </select>
                </div>
                <div>
                    <label style={S.lbl}>Area</label>
                    <select style={{ ...S.inp, width: 140 }} value={area}
                        onChange={e => setArea(e.target.value)}>
                        <option value="">All Areas</option>
                        {areas.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>
                <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: 12 }}>
                    <label style={S.lbl}>From</label>
                    <input style={{ ...S.inp, width: 130 }} type="date"
                        value={from} onChange={e => setFrom(e.target.value)} />
                </div>
                <div>
                    <label style={S.lbl}>To</label>
                    <input style={{ ...S.inp, width: 130 }} type="date"
                        value={to} onChange={e => setTo(e.target.value)} />
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                    {loading && <span style={{ fontSize: 12, color: '#94a3b8' }}>Loading…</span>}
                    <button onClick={load}
                        style={{ padding: '7px 16px', borderRadius: 7,
                                 border: '1px solid #cbd5e1', background: '#fff',
                                 fontSize: 13, cursor: 'pointer', color: '#0e2841', fontWeight: 600 }}>
                        ↻ Refresh
                    </button>
                </div>
            </div>

            {/* ── Summary KPI cards ──────────────────────────── */}
            {summary && (
                <div style={S.kpis}>
                    <KpiCard label="Total Qty"       value={Number(summary.total_qty   || 0).toLocaleString()} color="#16a34a" />
                    <KpiCard label="Total Lots"      value={Number(summary.total_lots  || 0).toLocaleString()} color="#0b7285" />
                    <KpiCard label="Total Parts"     value={Number(summary.total_parts || 0).toLocaleString()} color="#1e5fa8" />
                    <KpiCard label="Focus Groups"    value={Number(summary.total_focus_groups || 0).toLocaleString()} color="#7c3aed" />
                    <KpiCard label="Entries"         value={Number(summary.total_entries || 0).toLocaleString()} color="#0e2841" />
                    <KpiCard label="Days Active"     value={Number(summary.total_days  || 0).toLocaleString()} color="#d97706" />
                </div>
            )}

            {/* ── Shift summary cards ────────────────────────── */}
            <div style={S.shiftRow}>
                <div style={{ ...S.card, border: '1px solid #bfdbfe' }}>
                    <div style={{ background: '#1e3a5f', padding: '14px 16px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#93c5fd',
                                      letterSpacing: '.06em', marginBottom: 4 }}>
                            ☀ DAY SHIFT — 07:00 to 19:00
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>
                            {dayQty.toLocaleString()}
                            <span style={{ fontSize: 13, fontWeight: 400, color: '#93c5fd', marginLeft: 8 }}>pcs</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#93c5fd', marginTop: 4 }}>
                            {dayShift.reduce((s, r) => s + Number(r.total_lots || 0), 0)} lots
                            &nbsp;·&nbsp;
                            {dayShift.reduce((s, r) => s + Number(r.entries || 0), 0)} transactions
                        </div>
                    </div>
                    {/* Area breakdown for day */}
                    <div style={{ padding: '10px 16px' }}>
                        {dayShift.map((r, i) => r.area && (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
                                                  padding: '4px 0', borderBottom: '1px solid #f1f5f9',
                                                  fontSize: 12 }}>
                                <span style={{ color: '#0e2841', fontWeight: 600 }}>{r.area}</span>
                                <span style={{ color: '#16a34a', fontWeight: 700 }}>
                                    {Number(r.total_qty || 0).toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ ...S.card, border: '1px solid #c4b5fd' }}>
                    <div style={{ background: '#1e1b4b', padding: '14px 16px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#c4b5fd',
                                      letterSpacing: '.06em', marginBottom: 4 }}>
                            🌙 NIGHT SHIFT — 19:00 to 07:00
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>
                            {nightQty.toLocaleString()}
                            <span style={{ fontSize: 13, fontWeight: 400, color: '#c4b5fd', marginLeft: 8 }}>pcs</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#c4b5fd', marginTop: 4 }}>
                            {nightShift.reduce((s, r) => s + Number(r.total_lots || 0), 0)} lots
                            &nbsp;·&nbsp;
                            {nightShift.reduce((s, r) => s + Number(r.entries || 0), 0)} transactions
                        </div>
                    </div>
                    <div style={{ padding: '10px 16px' }}>
                        {nightShift.map((r, i) => r.area && (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
                                                  padding: '4px 0', borderBottom: '1px solid #f1f5f9',
                                                  fontSize: 12 }}>
                                <span style={{ color: '#0e2841', fontWeight: 600 }}>{r.area}</span>
                                <span style={{ color: '#7c3aed', fontWeight: 700 }}>
                                    {Number(r.total_qty || 0).toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Output per Hour chart ──────────────────────── */}
            {hourChartData.length > 0 && (
                <div style={S.card}>
                    <div style={S.cardHdr}>
                        <div style={S.ttl}>Output per Hour — {date}</div>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                            {shift ? shift + ' shift' : 'All shifts'}{area ? ' · ' + area : ''}
                        </span>
                    </div>
                    <div style={{ padding: '16px' }}>
                        <ResponsiveContainer width="100%" height={280}>
                            <ComposedChart data={hourChartData}
                                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#64748b' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                                <Tooltip contentStyle={tooltipStyle}
                                    formatter={(v, name) => [Number(v).toLocaleString(), name]} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Bar dataKey="qty" name="Qty" radius={[4, 4, 0, 0]}
                                    fill="#1e5fa8"
                                    label={false} />
                                <Line dataKey="lots" name="Lots" stroke="#f59e0b"
                                    strokeWidth={2} dot={{ r: 3 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* ── Output per Day chart ───────────────────────── */}
            {dayChartData.length > 0 && (
                <div style={S.card}>
                    <div style={S.cardHdr}>
                        <div style={S.ttl}>Output per Day — {from} to {to}</div>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                            {dayChartData.length} days · {area || 'All areas'}
                        </span>
                    </div>
                    <div style={{ padding: '16px' }}>
                        <ResponsiveContainer width="100%" height={260}>
                            <AreaChart data={dayChartData}
                                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="qtyGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                                <Tooltip contentStyle={tooltipStyle}
                                    formatter={(v, name) => [Number(v).toLocaleString(), name]} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Area dataKey="qty" name="Qty" stroke="#16a34a"
                                    fill="url(#qtyGrad)" strokeWidth={2} />
                                <Line dataKey="lots" name="Lots" stroke="#f59e0b"
                                    strokeWidth={2} dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* ── Per-hour table ─────────────────────────────── */}
            {perHour.length > 0 && (
                <div style={S.card}>
                    <div style={S.cardHdr}>
                        <div style={S.ttl}>Hourly Breakdown — {date}</div>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>by Area</span>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                                <tr>
                                    <th style={S.th}>Hour</th>
                                    <th style={S.th}>Shift</th>
                                    <th style={S.th}>Area</th>
                                    <th style={S.thR}>Qty</th>
                                    <th style={S.thR}>Lots</th>
                                    <th style={S.thR}>Entries</th>
                                </tr>
                            </thead>
                            <tbody>
                                {perHour.map((r, i) => (
                                    <tr key={i}>
                                        <td style={S.td(i)}>
                                            <span style={{ background: '#e8eef5', borderRadius: 5,
                                                           padding: '2px 7px', fontSize: 11,
                                                           fontWeight: 700, color: '#0e2841' }}>
                                                {r.hour_label}
                                            </span>
                                        </td>
                                        <td style={S.td(i)}>
                                            <span style={{
                                                display: 'inline-block', padding: '2px 8px',
                                                borderRadius: 99, fontSize: 11, fontWeight: 700,
                                                background: r.shift === 'DAY' ? '#dbeafe' : '#ede9fe',
                                                color:      r.shift === 'DAY' ? '#1e40af' : '#5b21b6',
                                            }}>
                                                {r.shift}
                                            </span>
                                        </td>
                                        <td style={S.td(i)}>{r.area || '—'}</td>
                                        <td style={S.tdR(i)}>
                                            <b style={{ color: '#16a34a' }}>
                                                {Number(r.total_qty || 0).toLocaleString()}
                                            </b>
                                        </td>
                                        <td style={S.tdR(i)}>{Number(r.total_lots || 0).toLocaleString()}</td>
                                        <td style={S.tdR(i)}>{Number(r.entries || 0).toLocaleString()}</td>
                                    </tr>
                                ))}
                                <tr style={S.totRow}>
                                    <td colSpan={3} style={{ padding: '8px 10px', fontSize: 12,
                                                             fontWeight: 700, color: '#90b8d8' }}>
                                        TOTAL
                                    </td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right',
                                                 color: '#86efac', fontWeight: 700, fontSize: 13 }}>
                                        {perHour.reduce((s, r) => s + Number(r.total_qty || 0), 0).toLocaleString()}
                                    </td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right',
                                                 color: '#ffd080', fontWeight: 700, fontSize: 13 }}>
                                        {perHour.reduce((s, r) => s + Number(r.total_lots || 0), 0).toLocaleString()}
                                    </td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right',
                                                 color: '#90b8d8', fontWeight: 700, fontSize: 13 }}>
                                        {perHour.reduce((s, r) => s + Number(r.entries || 0), 0).toLocaleString()}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Top Parts table ────────────────────────────── */}
            {perPart.length > 0 && (
                <div style={S.card}>
                    <div style={S.cardHdr}>
                        <div style={S.ttl}>Top Part Names — {date}</div>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                            Top {perPart.length} by qty
                        </span>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                                <tr>
                                    <th style={S.th}>#</th>
                                    <th style={S.th}>Part Name</th>
                                    <th style={S.th}>Focus Group</th>
                                    <th style={S.th}>Area</th>
                                    <th style={S.thR}>Qty</th>
                                    <th style={S.thR}>Lots</th>
                                </tr>
                            </thead>
                            <tbody>
                                {perPart.map((r, i) => (
                                    <tr key={i}>
                                        <td style={{ ...S.td(i), color: '#94a3b8', width: 36 }}>
                                            {i + 1}
                                        </td>
                                        <td style={S.td(i)}>
                                            <b style={{ color: '#0e2841' }}>{r.partname}</b>
                                        </td>
                                        <td style={S.td(i)}>{r.focus_group || '—'}</td>
                                        <td style={S.td(i)}>
                                            {r.area
                                                ? <span style={{ background: '#e0f2fe', color: '#0369a1',
                                                                  padding: '2px 8px', borderRadius: 99,
                                                                  fontSize: 11, fontWeight: 700 }}>
                                                    {r.area}
                                                  </span>
                                                : '—'}
                                        </td>
                                        <td style={S.tdR(i)}>
                                            <b style={{ color: '#16a34a' }}>
                                                {Number(r.total_qty || 0).toLocaleString()}
                                            </b>
                                        </td>
                                        <td style={S.tdR(i)}>
                                            {Number(r.total_lots || 0).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

        </div>
    );
}
