import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

/* ─── helpers ──────────────────────────────────────────────────── */
function todayISO() { return new Date().toISOString().slice(0, 10); }

function detectShift() {
    const h = new Date().getHours();
    return h >= 7 && h < 19 ? 'DAY' : 'NIGHT';
}

function shiftHours(shift) {
    return Array.from({ length: 12 }, (_, i) => {
        const h = shift === 'DAY' ? 7 + i : (19 + i) % 24;
        return `${String(h).padStart(2, '0')}:00`;
    });
}

/* ═══════════════════════════════════════════════════════════════ */
export default function HourlyOutput() {

    const initShift = detectShift();
    const [date,    setDate]    = useState(todayISO());
    const [shift,   setShift]   = useState(initShift);
    const [rows,    setRows]    = useState([]);
    const [loading, setLoading] = useState(false);
    const [plan,    setPlan]    = useState(null);
    const [planLoad,setPlanLoad]= useState(false);

    /* ── load hourly outputs ──────────────────────────────────── */
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get('/hourly-outputs', { params: { date, shift } });
            setRows(r.data);
        } catch (_) {}
        finally { setLoading(false); }
    }, [date, shift]);

    useEffect(() => { load(); }, [load]);

    /* ── load plan commits ────────────────────────────────────── */
    const loadPlan = useCallback(async () => {
    setPlanLoad(true);
    try {
        const r = await api.get('/lot-commits', { params: { date } }); // ← pass date
        setPlan(r.data);
    } catch (_) {}
    finally { setPlanLoad(false); }
}, [date]);

    useEffect(() => { loadPlan(); }, [loadPlan]);

    /* ── aggregates ───────────────────────────────────────────── */
    const totGood   = rows.reduce((s, r) => s + Number(r.good_qty   || 0), 0);
    const totReject = rows.reduce((s, r) => s + Number(r.reject_qty || 0), 0);
    const totTotal  = totGood + totReject;

    /* ── group by operator ────────────────────────────────────── */
    const byOp = rows.reduce((acc, r) => {
        const k = r.operator_name || 'Unknown';
        if (!acc[k]) acc[k] = [];
        acc[k].push(r);
        return acc;
    }, {});

    /* ── lot pivot ────────────────────────────────────────────── */
    const byLot = rows.reduce((acc, r) => {
        const k = `${r.lot_no}|||${r.partname}`;
        if (!acc[k]) acc[k] = {
            lot_no: r.lot_no, partname: r.partname,
            device_name: r.device_name, package: r.package, charging: r.charging,
            byHour: {}, totalGood: 0, totalReject: 0,
        };
        const hourKey = r.hour
            ? String(r.hour).padStart(5, '0').slice(0, 5)
            : null;
        if (hourKey) {
            acc[k].byHour[hourKey] = (acc[k].byHour[hourKey] || 0) + Number(r.good_qty || 0);
        }
        acc[k].totalGood   += Number(r.good_qty   || 0);
        acc[k].totalReject += Number(r.reject_qty || 0);
        return acc;
    }, {});

    /* ── per-hour summary ─────────────────────────────────────── */
    const byHourSummary = rows.reduce((acc, r) => {
        const h = r.hour
            ? String(r.hour).padStart(5, '0').slice(0, 5)
            : 'Unknown';
        if (!acc[h]) acc[h] = { good: 0, reject: 0, lots: 0 };
        acc[h].good   += Number(r.good_qty   || 0);
        acc[h].reject += Number(r.reject_qty || 0);
        acc[h].lots   += 1;
        return acc;
    }, {});

    const hours = shiftHours(shift);

    /* ── styles ───────────────────────────────────────────────── */
    const S = {
        wrap:    { padding: '0 0 48px' },
        bar:     { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', marginBottom: 16, boxShadow: '0 1px 3px rgba(14,40,65,.05)' },
        lbl:     { fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 },
        inp:     { fontSize: 14, padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', color: '#1e293b', background: '#f8fafc', outline: 'none', width: '100%' },
        card:    { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 1px 4px rgba(14,40,65,.06)', overflow: 'hidden', marginBottom: 16 },
        cardHdr: { padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9' },
        ttl:     { fontSize: 12, fontWeight: 700, color: '#0e2841', textTransform: 'uppercase', letterSpacing: '.06em' },
        kpis:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 16 },
        kpi:     { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', boxShadow: '0 1px 3px rgba(14,40,65,.05)' },
        th:      { background: '#0e2841', color: '#fff', padding: '8px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'left', whiteSpace: 'nowrap' },
        thR:     { background: '#0e2841', color: '#fff', padding: '8px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'right', whiteSpace: 'nowrap' },
        td:      i => ({ padding: '8px 10px', fontSize: 12, verticalAlign: 'middle', background: i % 2 === 0 ? '#f8fafc' : '#fff', borderBottom: '1px solid #e2e8f0' }),
        tdR:     i => ({ padding: '8px 10px', fontSize: 12, textAlign: 'right', verticalAlign: 'middle', fontVariantNumeric: 'tabular-nums', background: i % 2 === 0 ? '#f8fafc' : '#fff', borderBottom: '1px solid #e2e8f0' }),
        opHdr:   { background: '#e8eef5', padding: '6px 10px', fontSize: 12, fontWeight: 700, color: '#0e2841', borderBottom: '1px solid #c8d8ec' },
        totRow:  { background: '#0e2841' },
    };

    /* ═══════════════════════════════════════════════════════════ */
    return (
        <div style={S.wrap}>

            {/* ── Filter bar ─────────────────────────────────── */}
            <div style={S.bar}>
                <div>
                    <label style={S.lbl}>Date</label>
                    <input style={{ ...S.inp, width: 148 }} type="date"
                        value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div>
                    <label style={S.lbl}>Shift</label>
                    <select style={{ ...S.inp, width: 176 }} value={shift}
                        onChange={e => setShift(e.target.value)}>
                        <option value="DAY">Day Shift  (07:00 – 19:00)</option>
                        <option value="NIGHT">Night Shift (19:00 – 07:00)</option>
                    </select>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                    {loading && <span style={{ fontSize: 12, color: '#94a3b8' }}>Loading…</span>}
                    <button onClick={() => { load(); loadPlan(); }}
                        style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #cbd5e1', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#0e2841', fontWeight: 600 }}>
                        ↻ Refresh
                    </button>
                </div>
            </div>

            {/* ── KPI cards ──────────────────────────────────── */}
            <div style={S.kpis}>
                {[
                    { label: 'Entries',      value: rows.length,                color: '#0e2841' },
                    { label: 'Good Qty',     value: totGood.toLocaleString(),   color: '#16a34a' },
                    { label: 'Reject Qty',   value: totReject.toLocaleString(), color: '#dc2626' },
                    { label: 'Total Output', value: totTotal.toLocaleString(),  color: '#1e5fa8' },
                    { label: 'Lots',         value: Object.keys(byLot).length,  color: '#0b7285' },
                    { label: 'Operators',    value: Object.keys(byOp).length,   color: '#0e2841' },
                ].map((k, i) => (
                    <div key={i} style={S.kpi}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{k.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: k.color, lineHeight: 1.1 }}>{k.value}</div>
                    </div>
                ))}
            </div>

            {/* ── Lot pivot table ────────────────────────────── */}
            {rows.length > 0 && (
                <div style={S.card}>
                    <div style={S.cardHdr}>
                        <div style={S.ttl}>Lot Summary — Good Qty per Hour</div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                                <tr>
                                    <th style={S.th}>Lot No</th>
                                    <th style={S.th}>Part Name</th>
                                    <th style={S.th}>Package</th>
                                    <th style={S.th}>Charging</th>
                                    {hours.map(h => (
                                        <th key={h} style={{ ...S.thR, minWidth: 46 }}>{h}</th>
                                    ))}
                                    <th style={S.thR}>Good</th>
                                    <th style={S.thR}>Reject</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.values(byLot).map((g, gi) => (
                                    <tr key={gi}>
                                        <td style={S.td(gi)}><b style={{ color: '#0e2841' }}>{g.lot_no}</b></td>
                                        <td style={S.td(gi)}>{g.device_name || g.partname}</td>
                                        <td style={S.td(gi)}>{g.package}</td>
                                        <td style={S.td(gi)}>{g.charging}</td>
                                        {hours.map(h => (
                                            <td key={h} style={{
                                                ...S.tdR(gi),
                                                color:      g.byHour[h] ? '#16a34a' : '#cbd5e1',
                                                fontWeight: g.byHour[h] ? 700 : 400,
                                            }}>
                                                {g.byHour[h] ? g.byHour[h].toLocaleString() : '—'}
                                            </td>
                                        ))}
                                        <td style={{ ...S.tdR(gi), fontWeight: 700, color: '#16a34a' }}>
                                            {g.totalGood.toLocaleString()}
                                        </td>
                                        <td style={{ ...S.tdR(gi), fontWeight: 700, color: g.totalReject > 0 ? '#dc2626' : '#cbd5e1' }}>
                                            {g.totalReject > 0 ? g.totalReject.toLocaleString() : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Total Output per Hour ──────────────────────── */}
            {rows.length > 0 && (
                <div style={S.card}>
                    <div style={S.cardHdr}>
                        <div style={S.ttl}>Total Output per Hour — {shift} Shift · {date}</div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                                <tr>
                                    <th style={S.th}>Hour</th>
                                    <th style={S.thR}>Good Qty</th>
                                    <th style={S.thR}>Reject Qty</th>
                                    <th style={S.thR}>Total Output</th>
                                    <th style={S.thR}>Lots Scanned</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    const sorted = hours
                                        .filter(h => byHourSummary[h])
                                        .map(h => ({ hour: h, ...byHourSummary[h] }));
                                    if (byHourSummary['Unknown']) {
                                        sorted.push({ hour: 'Unknown', ...byHourSummary['Unknown'] });
                                    }
                                    return sorted.map((h, i) => (
                                        <tr key={h.hour}>
                                            <td style={S.td(i)}>
                                                <span style={{ background: '#e8eef5', borderRadius: 5, padding: '2px 7px', fontSize: 11, fontWeight: 700, color: '#0e2841' }}>
                                                    {h.hour}
                                                </span>
                                            </td>
                                            <td style={S.tdR(i)}>
                                                <b style={{ color: '#16a34a' }}>{h.good.toLocaleString()}</b>
                                            </td>
                                            <td style={S.tdR(i)}>
                                                {h.reject > 0
                                                    ? <span style={{ color: '#dc2626', fontWeight: 700 }}>{h.reject.toLocaleString()}</span>
                                                    : <span style={{ color: '#cbd5e1' }}>—</span>}
                                            </td>
                                            <td style={S.tdR(i)}>
                                                <b>{(h.good + h.reject).toLocaleString()}</b>
                                            </td>
                                            <td style={S.tdR(i)}>{h.lots}</td>
                                        </tr>
                                    ));
                                })()}
                                <tr style={S.totRow}>
                                    <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700, color: '#90b8d8' }}>TOTAL</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#86efac', fontWeight: 700, fontSize: 13 }}>{totGood.toLocaleString()}</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#fca5a5', fontWeight: 700, fontSize: 13 }}>{totReject.toLocaleString()}</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#ffd080', fontWeight: 700, fontSize: 13 }}>{totTotal.toLocaleString()}</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#90b8d8', fontWeight: 700, fontSize: 13 }}>{rows.length}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Plan vs Output Progress ────────────────────── */}
            {plan && (
                <div style={S.card}>
                    <div style={S.cardHdr}>
                        <div style={S.ttl}>Plan vs Output — {plan.date}</div>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                            {planLoad ? 'Refreshing…' : `${plan.finished_lots} / ${plan.total_lots} lots finished`}
                        </span>
                    </div>

                    {/* Overall progress bar */}
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#0e2841' }}>Overall Attainment</span>
                            <span style={{ fontSize: 13, fontWeight: 800,
                                color: plan.overall_pct >= 100 ? '#16a34a' : plan.overall_pct >= 75 ? '#d97706' : '#dc2626' }}>
                                {plan.overall_pct}%
                            </span>
                        </div>
                        <div style={{ background: '#e2e8f0', borderRadius: 99, height: 14, overflow: 'hidden' }}>
                            <div style={{
                                width: `${plan.overall_pct}%`, height: '100%', borderRadius: 99,
                                background: plan.overall_pct >= 100 ? '#16a34a' : plan.overall_pct >= 75 ? '#d97706' : '#dc2626',
                                transition: 'width .4s ease',
                            }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 11, color: '#64748b' }}>
                            <span>Plan: {plan.total_plan_qty.toLocaleString()} pcs</span>
                            <span>Actual: {plan.total_actual.toLocaleString()} pcs</span>
                            <span>{plan.finished_lots} lots done · {plan.total_lots - plan.finished_lots} remaining</span>
                        </div>
                    </div>

                    {/* Per-lot progress table */}
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                                <tr>
                                    <th style={S.th}>Lot ID</th>
                                    <th style={S.th}>Part Name</th>
                                    <th style={S.th}>Package</th>
                                    <th style={S.th}>Recipe</th>
                                    <th style={S.th}>Commit</th>
                                    <th style={S.thR}>Plan Qty</th>
                                    <th style={S.thR}>Actual Good</th>
                                    <th style={S.thR}>Reject</th>
                                    <th style={{ ...S.th, minWidth: 140 }}>Progress</th>
                                    <th style={S.thR}>Att%</th>
                                    <th style={S.th}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {plan.commits.map((c, i) => {
                                    const pct   = c.attainment;
                                    const color = pct >= 100 ? '#16a34a' : pct >= 75 ? '#d97706' : '#dc2626';
                                    return (
                                        <tr key={c.lotid}>
                                            <td style={{ ...S.td(i), background: c.finished ? '#f0fdf4' : S.td(i).background }}>
                                                <b style={{ color: '#0e2841' }}>{c.lotid}</b>
                                            </td>
                                            <td style={S.td(i)}>{c.part_name || '—'}</td>
                                            <td style={S.td(i)}>{c.package_name || '—'}</td>
                                            <td style={S.td(i)}>{c.recipe_used || '—'}</td>
                                            <td style={S.td(i)}>
                                                <span style={{
                                                    display: 'inline-block', padding: '2px 8px',
                                                    borderRadius: 99, fontSize: 11, fontWeight: 700,
                                                    background: c.commit ? '#dcfce7' : '#f3f4f6',
                                                    color:      c.commit ? '#166534' : '#6b7280',
                                                }}>
                                                    {c.commit || '—'}
                                                </span>
                                            </td>
                                            <td style={S.tdR(i)}>{c.plan_qty.toLocaleString()}</td>
                                            <td style={S.tdR(i)}>
                                                <b style={{ color: '#16a34a' }}>{c.actual_good.toLocaleString()}</b>
                                            </td>
                                            <td style={S.tdR(i)}>
                                                {c.actual_reject > 0
                                                    ? <span style={{ color: '#dc2626', fontWeight: 700 }}>{c.actual_reject.toLocaleString()}</span>
                                                    : <span style={{ color: '#cbd5e1' }}>—</span>}
                                            </td>
                                            <td style={{ ...S.td(i), minWidth: 160 }}>
                                                <div style={{ background: '#e2e8f0', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                                                    <div style={{
                                                        width: `${Math.min(100, pct)}%`, height: '100%',
                                                        borderRadius: 99, background: color,
                                                    }} />
                                                </div>
                                            </td>
                                            <td style={{ ...S.tdR(i), fontWeight: 700, color }}>{pct}%</td>
                                            <td style={S.td(i)}>
                                                {c.finished
                                                    ? <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>✓ Done</span>
                                                    : c.actual_good > 0
                                                        ? <span style={{ background: '#fef9c3', color: '#854d0e', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>In Progress</span>
                                                        : <span style={{ background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>Not Started</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

        </div>
    );
}

