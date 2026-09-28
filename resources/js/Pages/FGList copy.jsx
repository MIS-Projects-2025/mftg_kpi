
import React, { useEffect, useMemo, useState } from 'react';
import {
    ResponsiveContainer, ComposedChart, Bar, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
// import AppShell from '../Components/AppShell';
import api from '../services/api';

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

function StatusBadge({ status }) {
    const map = {
        on_target:    { bg: '#dcfce7', fg: '#166534', label: 'On Target'    },
        below_target: { bg: '#fef9c3', fg: '#854d0e', label: 'Below Target' },
        critical:     { bg: '#fee2e2', fg: '#991b1b', label: 'Critical'     },
        no_data:      { bg: '#f3f4f6', fg: '#6b7280', label: 'No Data'      },
    };
    const s = map[status] || map.no_data;
    return (
        <span style={{
            display: 'inline-block', padding: '2px 10px', borderRadius: 99,
            fontSize: 11, fontWeight: 700, background: s.bg, color: s.fg,
        }}>
            {s.label}
        </span>
    );
}

function KpiCard({ label, value, sublabel, tone }) {
    const color = { green: '#16a34a', amber: '#d97706', red: '#dc2626' }[tone] || '#0e2841';
    return (
        <div style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
            padding: '18px 20px', boxShadow: '0 1px 4px rgba(14,40,65,.07)',
        }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b',
                          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                {label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1.1, marginBottom: 4 }}>
                {value}
            </div>
            {sublabel && <div style={{ fontSize: 12, color: '#94a3b8' }}>{sublabel}</div>}
        </div>
    );
}

function AttPill({ pct }) {
    const n = Number(pct);
    const bg = n >= 95 ? '#dcfce7' : n >= 75 ? '#fef9c3' : '#fee2e2';
    const fg = n >= 95 ? '#166534' : n >= 75 ? '#854d0e' : '#991b1b';
    return (
        <span style={{
            display: 'inline-block', padding: '2px 9px', borderRadius: 99,
            fontSize: 12, fontWeight: 700, background: bg, color: fg,
        }}>
            {n}%
        </span>
    );
}

export default function FGList() {
    const [tab, setTab]                     = useState('overview');
    const [date, setDate]                   = useState(todayISO());
    const [shift, setShift]                 = useState('');
    const [workCenterFilter, setWCFilter]   = useState('');
    const [workCenters, setWorkCenters]     = useState([]);
    const [summary, setSummary]             = useState(null);
    const [hourly, setHourly]               = useState([]);
    const [lineBreakdown, setLineBreakdown] = useState([]);
    const [logRows, setLogRows]             = useState([]);
    const [loading, setLoading]             = useState(true);

    const [logForm, setLogForm] = useState({
        work_center_id: '', hour_start: '', shift: '1st',
        target_qty: '', actual_qty: '', reject_qty: 0,
        downtime_minutes: 0, downtime_reason: '', operator_name: '', remarks: '',
    });
    const [logSaving, setLogSaving] = useState(false);
    const [logMsg,    setLogMsg]    = useState(null);

    useEffect(() => {
        api.get('/work-centers').then(r => setWorkCenters(r.data));
    }, []);

    async function refresh() {
        setLoading(true);
        const params  = { date, ...(shift ? { shift } : {}) };
        const wcParam = workCenterFilter ? { work_center_id: workCenterFilter } : {};
        try {
            const [s, h, wc, log] = await Promise.all([
                api.get('/dashboard/summary',     { params }),
                api.get('/dashboard/hourly',       { params: { ...params, ...wcParam } }),
                api.get('/dashboard/work-centers', { params }),
                api.get('/hourly-outputs',         { params: { ...params, ...wcParam } }),
            ]);
            setSummary(s.data);
            setHourly(h.data);
            setLineBreakdown(wc.data);
            setLogRows(log.data);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { refresh(); }, [date, shift, workCenterFilter]); // eslint-disable-line

    const chartData = useMemo(
        () => hourly.map(h => ({ ...h, target: h.target_qty, actual: h.actual_qty })),
        [hourly],
    );

    function updateLogField(key, value) {
        setLogForm(f => ({ ...f, [key]: value }));
    }

    async function submitLog(e) {
        e.preventDefault();
        setLogSaving(true);
        setLogMsg(null);
        try {
            const wc = workCenters.find(w => String(w.id) === String(logForm.work_center_id));
            await api.post('/hourly-outputs', {
                ...logForm,
                target_qty:       Number(logForm.target_qty || (wc ? wc.target_per_hour : 0)),
                actual_qty:       Number(logForm.actual_qty  || 0),
                reject_qty:       Number(logForm.reject_qty  || 0),
                downtime_minutes: Number(logForm.downtime_minutes || 0),
            });
            setLogMsg({ type: 'success', text: 'Hourly output logged.' });
            setLogForm(f => ({ ...f, actual_qty: '', reject_qty: 0, downtime_minutes: 0, remarks: '' }));
            refresh();
        } catch (err) {
            setLogMsg({ type: 'error', text: err.response?.data?.message || 'Could not save.' });
        } finally {
            setLogSaving(false);
        }
    }

    const S = {
        kpiGrid:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 20 },
        card:     { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 1px 4px rgba(14,40,65,.06)', overflow: 'hidden' },
        cardPad:  { padding: '18px 20px' },
        secTitle: { fontSize: 13, fontWeight: 700, color: '#0e2841', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 },
        filterBar:{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', marginBottom: 20, boxShadow: '0 1px 3px rgba(14,40,65,.05)' },
        label:    { fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 },
        input:    { fontSize: 13, padding: '6px 10px', borderRadius: 7, border: '1px solid #cbd5e1', color: '#1e293b', background: '#f8fafc', outline: 'none' },
        tab:      a => ({ padding: '8px 20px', fontSize: 13, fontWeight: 600, border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: a ? '2px solid #0e2841' : '2px solid transparent', color: a ? '#0e2841' : '#64748b', marginBottom: -2 }),
        th:       { background: '#0e2841', color: '#fff', textAlign: 'left', padding: '9px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' },
        thR:      { background: '#0e2841', color: '#fff', textAlign: 'right', padding: '9px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' },
        td:       i => ({ padding: '9px 12px', verticalAlign: 'middle', background: i%2===0?'#f8fafc':'#fff', borderBottom: '1px solid #e2e8f0' }),
        tdR:      i => ({ padding: '9px 12px', textAlign: 'right', verticalAlign: 'middle', background: i%2===0?'#f8fafc':'#fff', borderBottom: '1px solid #e2e8f0', fontVariantNumeric: 'tabular-nums' }),
        logGrid:  { display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' },
        field:    { display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 },
        row2:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
        btnPrim:  { width: '100%', padding: '10px 0', marginTop: 8, borderRadius: 8, background: '#0e2841', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' },
        success:  { color: '#166534', background: '#dcfce7', padding: '8px 12px', borderRadius: 7, fontSize: 13, marginBottom: 4 },
        error:    { color: '#991b1b', background: '#fee2e2', padding: '8px 12px', borderRadius: 7, fontSize: 13, marginBottom: 4 },
    };

    return (
        <>

            <div style={S.filterBar}>
                <div>
                    <label style={S.label}>Date</label>
                    <input style={S.input} type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div>
                    <label style={S.label}>Shift</label>
                    <select style={S.input} value={shift} onChange={e => setShift(e.target.value)}>
                        <option value="">All Shifts</option>
                        <option value="1st">1st (6 AM – 2 PM)</option>
                        <option value="2nd">2nd (2 PM – 10 PM)</option>
                        <option value="3rd">3rd (10 PM – 6 AM)</option>
                    </select>
                </div>
                <div>
                    <label style={S.label}>Line</label>
                    <select style={S.input} value={workCenterFilter} onChange={e => setWCFilter(e.target.value)}>
                        <option value="">All Lines</option>
                        {workCenters.map(wc => (
                            <option key={wc.id} value={wc.id}>{wc.name}</option>
                        ))}
                    </select>
                </div>
                {loading && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8', alignSelf: 'center' }}>Refreshing…</span>}
            </div>

            <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '2px solid #e2e8f0' }}>
                <button style={S.tab(tab === 'overview')} onClick={() => setTab('overview')}>Overview</button>
                <button style={S.tab(tab === 'log')}      onClick={() => setTab('log')}>Hourly Output Log</button>
            </div>

            {tab === 'overview' && summary && (
                <>
                    <div style={S.kpiGrid}>
                        <KpiCard label="Total Output"  value={summary.total_actual.toLocaleString()} sublabel={`Target ${summary.total_target.toLocaleString()}`} />
                        <KpiCard label="Attainment"    value={`${summary.attainment_pct}%`} sublabel={summary.attainment_pct >= 95 ? 'On target' : summary.attainment_pct >= 75 ? 'Below target' : 'Needs attention'} tone={summary.attainment_pct >= 95 ? 'green' : summary.attainment_pct >= 75 ? 'amber' : 'red'} />
                        <KpiCard label="Downtime"      value={`${Math.round(summary.total_downtime_minutes / 60 * 10) / 10} hrs`} sublabel={`${summary.total_downtime_minutes} min logged`} />
                        <KpiCard label="Line Status"   value={`${summary.on_target_lines}/${summary.total_lines}`} sublabel={`${summary.below_target_lines} below · ${summary.critical_lines} critical`} />
                    </div>

                    <div style={{ ...S.card, marginBottom: 20 }}>
                        <div style={S.cardPad}>
                            <div style={S.secTitle}>Hourly Output — Target vs Actual</div>
                            <ResponsiveContainer width="100%" height={300}>
                                <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                                    <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#64748b' }} />
                                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v, name) => [Number(v).toLocaleString(), name === 'actual' ? 'Actual' : 'Target']} labelFormatter={l => `Hour ${l}`} />
                                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                                    <Bar dataKey="actual" name="Actual" fill="#b91c1c" radius={[4, 4, 0, 0]} />
                                    <Line dataKey="target" name="Target" stroke="#0e2841" strokeWidth={2} dot={false} strokeDasharray="5 3" />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div style={S.card}>
                        <div style={{ ...S.cardPad, paddingBottom: 8 }}>
                            <div style={S.secTitle}>Work Center Performance</div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr>
                                        <th style={S.th}>Line</th>
                                        <th style={S.th}>Area</th>
                                        <th style={S.thR}>Target</th>
                                        <th style={S.thR}>Actual</th>
                                        <th style={S.thR}>Attainment</th>
                                        <th style={S.thR}>Downtime</th>
                                        <th style={S.th}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lineBreakdown.length === 0 && (
                                        <tr><td colSpan={7} style={{ ...S.td(0), textAlign: 'center', color: '#94a3b8' }}>No data for this date / shift.</td></tr>
                                    )}
                                    {lineBreakdown.map((l, i) => (
                                        <tr key={l.work_center_id}>
                                            <td style={S.td(i)}><b style={{ color: '#0e2841' }}>{l.code}</b> — {l.name}</td>
                                            <td style={S.td(i)}>{l.area}</td>
                                            <td style={S.tdR(i)}>{l.target_qty.toLocaleString()}</td>
                                            <td style={S.tdR(i)}>{l.actual_qty.toLocaleString()}</td>
                                            <td style={S.tdR(i)}><AttPill pct={l.attainment_pct} /></td>
                                            <td style={S.tdR(i)}>{l.downtime_minutes} min</td>
                                            <td style={S.td(i)}><StatusBadge status={l.status} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {tab === 'log' && (
                <div style={S.logGrid}>
                    <div style={S.card}>
                        <div style={S.cardPad}>
                            <div style={S.secTitle}>Log Hourly Output</div>
                            <form onSubmit={submitLog}>
                                <div style={S.field}>
                                    <label style={S.label}>Work Center</label>
                                    <select required style={S.input} value={logForm.work_center_id} onChange={e => updateLogField('work_center_id', e.target.value)}>
                                        <option value="">Select a line…</option>
                                        {workCenters.map(wc => <option key={wc.id} value={wc.id}>{wc.name} (target {wc.target_per_hour}/hr)</option>)}
                                    </select>
                                </div>
                                <div style={S.row2}>
                                    <div style={S.field}>
                                        <label style={S.label}>Hour</label>
                                        <input required style={S.input} type="datetime-local" value={logForm.hour_start} onChange={e => updateLogField('hour_start', e.target.value)} />
                                    </div>
                                    <div style={S.field}>
                                        <label style={S.label}>Shift</label>
                                        <select style={S.input} value={logForm.shift} onChange={e => updateLogField('shift', e.target.value)}>
                                            <option value="1st">1st</option>
                                            <option value="2nd">2nd</option>
                                            <option value="3rd">3rd</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={S.row2}>
                                    <div style={S.field}>
                                        <label style={S.label}>Target Qty</label>
                                        <input style={S.input} type="number" min="0" value={logForm.target_qty} placeholder="Auto from line" onChange={e => updateLogField('target_qty', e.target.value)} />
                                    </div>
                                    <div style={S.field}>
                                        <label style={S.label}>Actual Qty</label>
                                        <input required style={S.input} type="number" min="0" value={logForm.actual_qty} onChange={e => updateLogField('actual_qty', e.target.value)} />
                                    </div>
                                </div>
                                <div style={S.row2}>
                                    <div style={S.field}>
                                        <label style={S.label}>Reject Qty</label>
                                        <input style={S.input} type="number" min="0" value={logForm.reject_qty} onChange={e => updateLogField('reject_qty', e.target.value)} />
                                    </div>
                                    <div style={S.field}>
                                        <label style={S.label}>Downtime (min)</label>
                                        <input style={S.input} type="number" min="0" max="60" value={logForm.downtime_minutes} onChange={e => updateLogField('downtime_minutes', e.target.value)} />
                                    </div>
                                </div>
                                <div style={S.field}>
                                    <label style={S.label}>Downtime Reason</label>
                                    <input style={S.input} value={logForm.downtime_reason} placeholder="Optional" onChange={e => updateLogField('downtime_reason', e.target.value)} />
                                </div>
                                <div style={S.field}>
                                    <label style={S.label}>Operator</label>
                                    <input style={S.input} value={logForm.operator_name} placeholder="Optional" onChange={e => updateLogField('operator_name', e.target.value)} />
                                </div>
                                <div style={S.field}>
                                    <label style={S.label}>Remarks</label>
                                    <input style={S.input} value={logForm.remarks} placeholder="Optional" onChange={e => updateLogField('remarks', e.target.value)} />
                                </div>
                                {logMsg && <div style={logMsg.type === 'error' ? S.error : S.success}>{logMsg.text}</div>}
                                <button style={{ ...S.btnPrim, opacity: logSaving ? 0.6 : 1 }} disabled={logSaving} type="submit">
                                    {logSaving ? 'Saving…' : 'Save Entry'}
                                </button>
                            </form>
                        </div>
                    </div>

                    <div style={S.card}>
                        <div style={{ ...S.cardPad, paddingBottom: 8 }}>
                            <div style={S.secTitle}>Today's Entries</div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr>
                                        <th style={S.th}>Hour</th>
                                        <th style={S.th}>Line</th>
                                        <th style={S.th}>Shift</th>
                                        <th style={S.thR}>Target</th>
                                        <th style={S.thR}>Actual</th>
                                        <th style={S.thR}>Attainment</th>
                                        <th style={S.thR}>Downtime</th>
                                        <th style={S.th}>Operator</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logRows.length === 0 && (
                                        <tr><td colSpan={8} style={{ ...S.td(0), textAlign: 'center', color: '#94a3b8' }}>No entries yet.</td></tr>
                                    )}
                                    {logRows.map((r, i) => (
                                        <tr key={r.id}>
                                            <td style={S.td(i)}>{new Date(r.hour_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                            <td style={S.td(i)}>{r.work_center?.name}</td>
                                            <td style={S.td(i)}>{r.shift}</td>
                                            <td style={S.tdR(i)}>{r.target_qty.toLocaleString()}</td>
                                            <td style={S.tdR(i)}>{r.actual_qty.toLocaleString()}</td>
                                            <td style={S.tdR(i)}><AttPill pct={r.attainment_pct} /></td>
                                            <td style={S.tdR(i)}>{r.downtime_minutes} min</td>
                                            <td style={S.td(i)}>{r.operator_name || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}