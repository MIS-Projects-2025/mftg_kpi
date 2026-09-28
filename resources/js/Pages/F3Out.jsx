import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';

/* ─── helpers ──────────────────────────────────────────────────── */
function todayISO() { return new Date().toISOString().slice(0, 10); }
function monthStart() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

const COLS = [
    'Part_Name','Lot_Id','Out_Date','Qty','Package','Date_Loaded',
    'test_group','division','building','process',
];

/* ═══════════════════════════════════════════════════════════════ */
export default function F3Out() {

    /* ── upload state ─────────────────────────────────────────── */
    const [file,       setFile]       = useState(null);
    const [uploading,  setUploading]  = useState(false);
    const [uploadMsg,  setUploadMsg]  = useState(null);
    const fileRef = useRef(null);

    /* ── filter + table state ─────────────────────────────────── */
    const [search,      setSearch]      = useState('');
    const [from,        setFrom]        = useState(monthStart());
    const [to,          setTo]          = useState(todayISO());
    const [rows,        setRows]        = useState([]);
    const [total,       setTotal]       = useState(0);
    const [loading,     setLoading]     = useState(false);

    /* ── load table ───────────────────────────────────────────── */
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get('/f3-out', {
                params: {
                    search: search || undefined,
                    from:   from   || undefined,
                    to:     to     || undefined,
                },
            });
            setRows(r.data.rows);
            setTotal(r.data.total);
        } catch (_) {}
        finally { setLoading(false); }
    }, [search, from, to]);

    useEffect(() => { load(); }, [load]);

    /* ── upload ───────────────────────────────────────────────── */
    async function upload() {
        if (!file) return;
        setUploading(true);
        setUploadMsg(null);
        const fd = new FormData();
        fd.append('file', file);
        try {
            const r = await api.post('/f3-out/upload', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setUploadMsg({ type: 'ok', text: r.data.message });
            setFile(null);
            if (fileRef.current) fileRef.current.value = '';
            load();
        } catch (err) {
            setUploadMsg({
                type: 'err',
                text: err.response?.data?.message || 'Upload failed.',
            });
        } finally {
            setUploading(false);
        }
    }

    /* ── styles ───────────────────────────────────────────────── */
    const S = {
        wrap:    { padding: '0 0 48px' },
        bar:     { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', marginBottom: 16, boxShadow: '0 1px 3px rgba(14,40,65,.05)' },
        lbl:     { fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 },
        inp:     { fontSize: 13, padding: '7px 10px', borderRadius: 7, border: '1px solid #cbd5e1', color: '#1e293b', background: '#f8fafc', outline: 'none' },
        card:    { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 1px 4px rgba(14,40,65,.06)', overflow: 'hidden', marginBottom: 16 },
        cardHdr: { padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9' },
        ttl:     { fontSize: 12, fontWeight: 700, color: '#0e2841', textTransform: 'uppercase', letterSpacing: '.06em' },
        th:      { background: '#0e2841', color: '#fff', padding: '8px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'left', whiteSpace: 'nowrap' },
        thR:     { background: '#0e2841', color: '#fff', padding: '8px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'right', whiteSpace: 'nowrap' },
        td:      i => ({ padding: '7px 10px', fontSize: 12, verticalAlign: 'middle', background: i % 2 === 0 ? '#f8fafc' : '#fff', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }),
        tdR:     i => ({ padding: '7px 10px', fontSize: 12, textAlign: 'right', verticalAlign: 'middle', fontVariantNumeric: 'tabular-nums', background: i % 2 === 0 ? '#f8fafc' : '#fff', borderBottom: '1px solid #e2e8f0' }),
        msg:     t => ({ padding: '8px 12px', borderRadius: 7, fontSize: 13, marginTop: 8, background: t === 'ok' ? '#dcfce7' : '#fee2e2', color: t === 'ok' ? '#166534' : '#991b1b' }),
        btn:     { padding: '8px 20px', borderRadius: 7, background: '#0e2841', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
        kpis:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 16 },
        kpi:     { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', boxShadow: '0 1px 3px rgba(14,40,65,.05)' },
    };

    const totalQty = rows.reduce((s, r) => s + Number(r.Qty || 0), 0);

    return (
        <div style={S.wrap}>

            {/* ── Upload card ────────────────────────────────── */}
            <div style={S.card}>
                <div style={S.cardHdr}>
                    <div style={S.ttl}>Upload Excel — F3 Out</div>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                        Reads Sheet2 · Columns: {COLS.join(', ')}
                    </span>
                </div>
                <div style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input ref={fileRef} type="file" accept=".xlsx,.xls"
                            onChange={e => setFile(e.target.files[0] || null)}
                            style={{ fontSize: 13, color: '#1e293b' }} />
                        <button style={{ ...S.btn, opacity: (!file || uploading) ? 0.5 : 1 }}
                            disabled={!file || uploading} onClick={upload}>
                            {uploading ? 'Uploading…' : '⬆ Upload & Import'}
                        </button>
                        {file && (
                            <span style={{ fontSize: 12, color: '#64748b' }}>
                                {file.name} ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                        )}
                    </div>
                    {uploadMsg && <div style={S.msg(uploadMsg.type)}>{uploadMsg.text}</div>}
                </div>
            </div>

            {/* ── KPI cards ──────────────────────────────────── */}
            <div style={S.kpis}>
                {[
                    { label: 'Total Records', value: total.toLocaleString(),       color: '#0e2841' },
                    { label: 'Showing',       value: rows.length.toLocaleString(), color: '#1e5fa8' },
                    { label: 'Total Qty',     value: totalQty.toLocaleString(),    color: '#16a34a' },
                ].map((k, i) => (
                    <div key={i} style={S.kpi}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{k.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: k.color, lineHeight: 1.1 }}>{k.value}</div>
                    </div>
                ))}
            </div>

            {/* ── Filter bar ─────────────────────────────────── */}
            <div style={S.bar}>
                <div>
                    <label style={S.lbl}>Search</label>
                    <input style={{ ...S.inp, width: 200 }} type="text"
                        placeholder="Part name, lot ID…"
                        value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div>
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
                    <button onClick={load} style={{ ...S.btn, background: '#fff', color: '#0e2841', border: '1px solid #cbd5e1' }}>
                        ↻ Refresh
                    </button>
                </div>
            </div>

            {/* ── Data table ─────────────────────────────────── */}
            <div style={S.card}>
                <div style={S.cardHdr}>
                    <div style={S.ttl}>F3 Out Records</div>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                        Showing {rows.length.toLocaleString()} of {total.toLocaleString()} records
                    </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                            <tr>
                                <th style={S.th}>Part Name</th>
                                <th style={S.th}>Lot ID</th>
                                <th style={S.th}>Out Date</th>
                                <th style={S.thR}>Qty</th>
                                <th style={S.th}>Package</th>
                                <th style={S.th}>Date Loaded</th>
                                <th style={S.th}>Test Group</th>
                                <th style={S.th}>Division</th>
                                <th style={S.th}>Building</th>
                                <th style={S.th}>Process</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={10} style={{ textAlign: 'center', padding: 36, color: '#94a3b8', fontSize: 13 }}>
                                        {loading ? 'Loading…' : 'No records found. Upload an Excel file to get started.'}
                                    </td>
                                </tr>
                            )}
                            {rows.map((r, i) => (
                                <tr key={r.id || i}>
                                    <td style={{ ...S.td(i), fontWeight: 600, color: '#0e2841' }}>{r.Part_Name || '—'}</td>
                                    <td style={S.td(i)}><b style={{ color: '#0e2841' }}>{r.Lot_Id || '—'}</b></td>
                                    <td style={S.td(i)}>
                                        {r.Out_Date
                                            ? new Date(r.Out_Date).toLocaleString('en-PH', {
                                                month: '2-digit', day: '2-digit', year: 'numeric',
                                                hour: '2-digit', minute: '2-digit', hour12: true
                                              })
                                            : '—'}
                                    </td>
                                    <td style={S.tdR(i)}>
                                        <b style={{ color: '#16a34a' }}>{Number(r.Qty || 0).toLocaleString()}</b>
                                    </td>
                                    <td style={S.td(i)}>{r.Package || '—'}</td>
                                    <td style={S.td(i)}>
                                        {r.Date_Loaded
                                            ? new Date(r.Date_Loaded).toLocaleString('en-PH', {
                                                month: '2-digit', day: '2-digit', year: 'numeric',
                                                hour: '2-digit', minute: '2-digit', hour12: true
                                              })
                                            : '—'}
                                    </td>
                                    <td style={S.td(i)}>{r.test_group || '—'}</td>
                                    <td style={S.td(i)}>{r.division    || '—'}</td>
                                    <td style={S.td(i)}>{r.building    || '—'}</td>
                                    <td style={S.td(i)}>{r.process     || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
