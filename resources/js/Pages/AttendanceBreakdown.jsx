import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';

function fmt(n) { return Number(n || 0).toLocaleString(); }
function fmtPct(n) { return n == null ? '—' : Number(n).toFixed(1) + '%'; }

const S = {
    lbl: { fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 },
    inp: { fontSize: 13, padding: '7px 10px', borderRadius: 7, border: '1px solid #cbd5e1', color: '#1e293b', background: '#f8fafc', outline: 'none' },
};

const FACTORIES = ['All', 'F1', 'F2', 'F3', 'F1/F2', 'F1/F2/F3'];

const COL_HEADERS = [
    { label: 'DL by Area', span: 1, sub: '' },
    { label: 'Scheduled HC', span: 3, sub: ['Certified', 'Trainees', 'Total'] },
    { label: 'Present HC', span: 4, sub: ['Certified', 'Trainees', 'Total', '% Present'] },
    { label: 'Absent HC', span: 4, sub: ['Certified', 'Trainees', 'Total', '% Absent'] },
];

function pctColor(pct) {
    if (pct >= 95) return '#16a34a';
    if (pct >= 80) return '#d97706';
    return '#dc2626';
}

function pctBg(pct) {
    if (pct >= 95) return '#f0fdf4';
    if (pct >= 80) return '#fef9c3';
    return '#fee2e2';
}

export default function AttendanceBreakdown() {
    const [data,    setData]    = useState(null);
    const [loading, setLoading] = useState(false);
    const [date,    setDate]    = useState('');
    const [factory, setFactory] = useState('All');

    useEffect(() => {
        setDate(new Date().toISOString().slice(0, 10));
    }, []);

    const load = useCallback(async () => {
        if (!date) return;
        setLoading(true);
        try {
            const params = { date };
            if (factory !== 'All') params.factory = factory;
            const res = await api.get('/attendance/breakdown', { params });
            setData(res.data);
        } catch (_) {}
        finally { setLoading(false); }
    }, [date, factory]);

    useEffect(() => { if (date) load(); }, [load]);

    const rows = data?.rows ?? [];

    const tdBase = {
        padding: '6px 10px',
        textAlign: 'right',
        fontSize: 12,
        borderBottom: '1px solid #f1f5f9',
        borderLeft: '1px solid #f1f5f9',
        whiteSpace: 'nowrap',
    };

    return (
        <div style={{ padding: '0 0 48px' }}>
            {/* Filter bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', marginBottom: 16, boxShadow: '0 1px 3px rgba(14,40,65,.05)' }}>
                <div>
                    <label style={S.lbl}>Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...S.inp, width: 160 }} />
                </div>
                <div>
                    <label style={S.lbl}>Factory</label>
                    <select value={factory} onChange={e => setFactory(e.target.value)} style={{ ...S.inp, width: 130 }}>
                        {FACTORIES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                    {loading && <span style={{ fontSize: 12, color: '#94a3b8' }}>Loading…</span>}
                    <button onClick={load} style={{ padding: '7px 18px', borderRadius: 7, border: '1px solid #cbd5e1', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#0e2841', fontWeight: 600 }}>↻ Refresh</button>
                </div>
            </div>

            {/* Note */}
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10, fontStyle: 'italic' }}>
                Note: Leave and No Check-in are considered as Absent. Certified = CERTIFICATION_STATUS = 'CERTIFIED'. Trainees = EMPSTATUS = 3.
            </div>

            {/* Table */}
            {rows.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 1px 4px rgba(14,40,65,.06)', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                                {/* Row 1: Group headers */}
                                <tr>
                                    <th rowSpan={2} style={{ background: '#0e2841', color: '#fff', padding: '8px 14px', textAlign: 'left', minWidth: 180, borderRight: '2px solid #1e3a5f', fontWeight: 700, fontSize: 12 }}>
                                        DL by Area
                                    </th>
                                    <th colSpan={3} style={{ background: '#1e5fa8', color: '#fff', padding: '8px 12px', textAlign: 'center', fontWeight: 700, borderLeft: '2px solid rgba(255,255,255,.2)' }}>
                                        Scheduled HC
                                    </th>
                                    <th colSpan={4} style={{ background: '#16a34a', color: '#fff', padding: '8px 12px', textAlign: 'center', fontWeight: 700, borderLeft: '2px solid rgba(255,255,255,.2)' }}>
                                        Present HC
                                    </th>
                                    <th colSpan={4} style={{ background: '#dc2626', color: '#fff', padding: '8px 12px', textAlign: 'center', fontWeight: 700, borderLeft: '2px solid rgba(255,255,255,.2)' }}>
                                        Absent HC
                                    </th>
                                </tr>
                                {/* Row 2: Sub-headers */}
                                <tr>
                                    {['Certified','Trainees','Total'].map(h => (
                                        <th key={h} style={{ background: '#2563eb', color: '#bfdbfe', padding: '5px 10px', textAlign: 'right', fontSize: 10, fontWeight: 600, borderLeft: '1px solid rgba(255,255,255,.15)' }}>{h}</th>
                                    ))}
                                    {['Certified','Trainees','Total','% Present'].map(h => (
                                        <th key={h} style={{ background: '#15803d', color: '#bbf7d0', padding: '5px 10px', textAlign: 'right', fontSize: 10, fontWeight: 600, borderLeft: '1px solid rgba(255,255,255,.15)' }}>{h}</th>
                                    ))}
                                    {['Certified','Trainees','Total','% Absent'].map(h => (
                                        <th key={h} style={{ background: '#b91c1c', color: '#fecaca', padding: '5px 10px', textAlign: 'right', fontSize: 10, fontWeight: 600, borderLeft: '1px solid rgba(255,255,255,.15)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, i) => {
                                    const d = row.data;
                                    const isDept  = row.type === 'department';
                                    const isGrand = row.type === 'grand_total';
                                    const isRow   = row.type === 'row';

                                    const rowBg = isGrand ? '#0e2841'
                                        : isDept  ? '#e8f0fe'
                                        : i % 2 === 0 ? '#f8fafc' : '#fff';
                                    const labelColor = isGrand ? '#fff' : isDept ? '#1e3a5f' : '#374151';
                                    const labelWeight = (isDept || isGrand) ? 700 : 400;
                                    const labelPL = isRow ? 24 : 14;

                                    return (
                                        <tr key={i} style={{ background: rowBg }}>
                                            {/* Label */}
                                            <td style={{ padding: `6px 14px 6px ${labelPL}px`, fontWeight: labelWeight, color: labelColor, borderBottom: '1px solid #e2e8f0', borderRight: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontSize: isDept ? 12 : 11 }}>
                                                {isDept ? `▸ ${row.label}` : isGrand ? row.label : row.label}
                                            </td>
                                            {/* Scheduled */}
                                            <td style={{ ...tdBase, color: isGrand ? '#fff' : '#1e5fa8', fontWeight: isDept || isGrand ? 700 : 400 }}>{fmt(d.cert_sched)}</td>
                                            <td style={{ ...tdBase, color: isGrand ? '#fff' : '#1e5fa8', fontWeight: isDept || isGrand ? 700 : 400 }}>{fmt(d.train_sched)}</td>
                                            <td style={{ ...tdBase, color: isGrand ? '#fff' : '#1e3a5f', fontWeight: 700, borderRight: '2px solid #e2e8f0' }}>{fmt(d.total_sched)}</td>
                                            {/* Present */}
                                            <td style={{ ...tdBase, color: isGrand ? '#fff' : '#16a34a', fontWeight: isDept || isGrand ? 700 : 400 }}>{fmt(d.cert_present)}</td>
                                            <td style={{ ...tdBase, color: isGrand ? '#fff' : '#16a34a', fontWeight: isDept || isGrand ? 700 : 400 }}>{fmt(d.train_present)}</td>
                                            <td style={{ ...tdBase, color: isGrand ? '#fff' : '#15803d', fontWeight: 700 }}>{fmt(d.total_present)}</td>
                                            <td style={{ ...tdBase, fontWeight: 700, borderRight: '2px solid #e2e8f0',
                                                background: isGrand ? 'transparent' : pctBg(d.pct_present),
                                                color: isGrand ? '#fff' : pctColor(d.pct_present) }}>
                                                {fmtPct(d.pct_present)}
                                            </td>
                                            {/* Absent */}
                                            <td style={{ ...tdBase, color: isGrand ? '#fff' : '#dc2626', fontWeight: isDept || isGrand ? 700 : 400 }}>{fmt(d.cert_absent)}</td>
                                            <td style={{ ...tdBase, color: isGrand ? '#fff' : '#dc2626', fontWeight: isDept || isGrand ? 700 : 400 }}>{fmt(d.train_absent)}</td>
                                            <td style={{ ...tdBase, color: isGrand ? '#fff' : '#b91c1c', fontWeight: 700 }}>{fmt(d.total_absent)}</td>
                                            <td style={{ ...tdBase, fontWeight: 700,
                                                background: isGrand ? 'transparent' : pctBg(100 - d.pct_absent),
                                                color: isGrand ? '#fff' : pctColor(100 - d.pct_absent) }}>
                                                {fmtPct(d.pct_absent)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {!data && !loading && (
                <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Select a date and factory to load breakdown</div>
            )}
            {loading && (
                <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading breakdown data…</div>
            )}
        </div>
    );
}
