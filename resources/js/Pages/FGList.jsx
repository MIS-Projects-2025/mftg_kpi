import React, { useCallback, useEffect, useRef, useState } from 'react';
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

function currentHour(shift) {
    const h   = new Date().getHours();
    const fmt = `${String(h).padStart(2, '0')}:00`;
    const hrs = shiftHours(shift);
    return hrs.includes(fmt) ? fmt : hrs[0] ?? '07:00';
}

/* ─── blank form ───────────────────────────────────────────────── */
const BLANK = {
    lot_no: '', partname: '', device_name: '',
    package: '', charging: '',
    good_qty: '', reject_qty: '',
};

/* ─── validation regex ─────────────────────────────────────────── */
const LOT_REGEX = /^[A-Z0-9][A-Z0-9\.\-]{3,}$/;

/* ─── sanitize barcode ─────────────────────────────────────────── */
function sanitize(val) {
    return val.replace(/\([^)]*\)/g, '').trim().toUpperCase();
}
function sanitizeQty(val) {
    return val.replace(/\([^)]*\)/g, '').replace(/[^\d]/g, '').trim();
}

/* ═══════════════════════════════════════════════════════════════ */
export default function FGList() {

    const initShift = detectShift();
    const [shift, setShift] = useState(initShift);
    const [hour,  setHour]  = useState(() => currentHour(initShift));

    /* auto-update hour every minute */
    useEffect(() => {
        const t = setInterval(() => setHour(currentHour(shift)), 60000);
        return () => clearInterval(t);
    }, [shift]);

    /* ── form state ───────────────────────────────────────────── */
    const [form,      setForm]      = useState(BLANK);
    const [looking,   setLooking]   = useState(false);
    const [lookupMsg, setLookupMsg] = useState(null);
    const [saving,    setSaving]    = useState(false);
    const [saveMsg,   setSaveMsg]   = useState(null);

    /* ── entries table ────────────────────────────────────────── */
    const [rows,    setRows]    = useState([]);
    const [loading, setLoading] = useState(false);

    /* ── focus refs ───────────────────────────────────────────── */
    const refLot    = useRef(null);
    const refPart   = useRef(null);
    const refGood   = useRef(null);
    const refReject = useRef(null);

    function fld(key, val) { setForm(p => ({ ...p, [key]: val })); }

    /* ── load today's entries for this shift ──────────────────── */
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get('/hourly-outputs', {
                params: { date: todayISO(), shift },
            });
            setRows(r.data);
        } catch (_) {}
        finally { setLoading(false); }
    }, [shift]);

    useEffect(() => {
        load();
        refLot.current?.focus();
    }, [load]);

    /* ── aggregates ───────────────────────────────────────────── */
    const totGood   = rows.reduce((s, r) => s + Number(r.good_qty   || 0), 0);
    const totReject = rows.reduce((s, r) => s + Number(r.reject_qty || 0), 0);
    const totTotal  = totGood + totReject;

    /* ── package list lookup ──────────────────────────────────── */
    async function lookup() {
        const partname = form.partname.trim();
        if (!partname) return;
        setLooking(true);
        setLookupMsg(null);
        try {
            const r = await api.get('/package-list/search', { params: { partname } });
            const d = r.data;
            setForm(f => ({
                ...f,
                device_name: d.device_name || partname.toUpperCase(),
                package:     d.package     || '',
                charging:    d.charging    || '',
            }));
            setLookupMsg({ type: 'ok', text: `✓ ${d.device_name}  ·  ${d.package}  ·  ${d.charging}` });
            setTimeout(() => refGood.current?.focus(), 60);
        } catch (err) {
            const msg = err.response?.status === 404
                ? `"${partname}" not found in package list.`
                : 'Lookup failed — check connection.';
            setLookupMsg({ type: 'err', text: msg });
            setForm(f => ({ ...f, device_name: '', package: '', charging: '' }));
        } finally {
            setLooking(false);
        }
    }

    /* ── keyboard Enter chain ─────────────────────────────────── */
    async function onLotKey(e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const val = form.lot_no.trim();
        if (!val) return;
        if (!LOT_REGEX.test(val)) {
            setLookupMsg({ type: 'err', text: '⚠ Invalid Lot No format — expected e.g. 1TAZ64221.9' });
            refLot.current?.select();
            return;
        }
        try {
            const r = await api.get('/hourly-outputs/check-lot', { params: { lot_no: val } });
            if (r.data.duplicate) {
                setLookupMsg({ type: 'err', text: `⛔ Lot No ${val} already exists. Scan a different lot.` });
                fld('lot_no', '');
                refLot.current?.focus();
                return;
            }
        } catch (_) {}
        setLookupMsg(null);
        refPart.current?.focus();
    }

    function onPartKey(e) {
        if (e.key === 'Enter') { e.preventDefault(); lookup(); }
    }
    function onGoodKey(e) {
        if (e.key === 'Enter') { e.preventDefault(); refReject.current?.focus(); }
    }
    function onRejectKey(e) {
        if (e.key === 'Enter') { e.preventDefault(); save(); }
    }

    /* ── save ─────────────────────────────────────────────────── */
    async function save() {
        if (!form.lot_no.trim())   { setSaveMsg({ type: 'err', text: 'Lot No is required.'   }); refLot.current?.focus();  return; }
        if (!form.partname.trim()) { setSaveMsg({ type: 'err', text: 'Part Name is required.' }); refPart.current?.focus(); return; }
        if (!form.good_qty)        { setSaveMsg({ type: 'err', text: 'Good Qty is required.'  }); refGood.current?.focus(); return; }

        try {
            const check = await api.get('/hourly-outputs/check-lot', { params: { lot_no: form.lot_no.trim() } });
            if (check.data.duplicate) {
                setSaveMsg({ type: 'err', text: `⛔ Lot No ${form.lot_no} already exists. Cannot save.` });
                return;
            }
        } catch (_) {}

        setSaving(true);
        setSaveMsg(null);
        try {
            await api.post('/hourly-outputs', {
                lot_no:        form.lot_no.trim().toUpperCase(),
                partname:      form.partname.trim().toUpperCase(),
                device_name:   form.device_name || form.partname.trim().toUpperCase(),
                package:       form.package,
                charging:      form.charging,
                good_qty:      Number(form.good_qty   || 0),
                reject_qty:    Number(form.reject_qty || 0),
                shift,
                hour,
            });
            setSaveMsg({ type: 'ok', text: `✓ Saved — Lot ${form.lot_no}  ·  Good: ${form.good_qty}  ·  Reject: ${form.reject_qty || 0}` });
            setForm(BLANK);
            setLookupMsg(null);
            load(); // ← refresh table immediately after save
            setTimeout(() => { setSaveMsg(null); refLot.current?.focus(); }, 2000);
        } catch (err) {
            setSaveMsg({ type: 'err', text: err.response?.data?.message || 'Could not save.' });
        } finally {
            setSaving(false);
        }
    }

    function clearForm() {
        setForm(BLANK);
        setLookupMsg(null);
        setSaveMsg(null);
        refLot.current?.focus();
    }

    /* ── styles ───────────────────────────────────────────────── */
    const S = {
        wrap:    { padding: '0 0 48px' },
        grid:    { display: 'grid', gridTemplateColumns: '400px 1fr', gap: 16, alignItems: 'start' },
        lbl:     { fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 },
        inp:     { fontSize: 14, padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', color: '#1e293b', background: '#f8fafc', outline: 'none', width: '100%' },
        inpRo:   { fontSize: 14, padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', color: '#334155', background: '#f1f5f9', width: '100%' },
        inpBig:  { fontSize: 20, fontWeight: 700, padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', color: '#1e293b', background: '#f8fafc', outline: 'none', width: '100%', textAlign: 'right' },
        card:    { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 1px 4px rgba(14,40,65,.06)', overflow: 'hidden', marginBottom: 16 },
        cardHdr: { padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9' },
        ttl:     { fontSize: 12, fontWeight: 700, color: '#0e2841', textTransform: 'uppercase', letterSpacing: '.06em' },
        r2:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
        step:    f => ({ marginBottom: 10, padding: '10px 12px', borderRadius: 8, border: f ? '1px solid #86efac' : '1px solid #e2e8f0', background: f ? '#f0fdf4' : '#f8fafc' }),
        stepLbl: f => ({ fontSize: 10, fontWeight: 700, color: f ? '#166534' : '#94a3b8', marginBottom: 6, letterSpacing: '.06em' }),
        hint:    { fontSize: 11, color: '#94a3b8', marginTop: 3 },
        btn:     { width: '100%', padding: '11px', marginTop: 8, borderRadius: 8, background: '#0e2841', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' },
        btnSm:   { width: '100%', padding: '7px', marginTop: 6, borderRadius: 8, border: '1px solid #e2e8f0', background: 'transparent', fontSize: 12, color: '#94a3b8', cursor: 'pointer' },
        msg:     t => ({ padding: '7px 11px', borderRadius: 7, fontSize: 12, marginBottom: 8, background: t === 'ok' ? '#dcfce7' : '#fee2e2', color: t === 'ok' ? '#166534' : '#991b1b' }),
        kpis:    { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 },
        kpi:     { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' },
        th:      { background: '#0e2841', color: '#fff', padding: '8px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'left', whiteSpace: 'nowrap' },
        thR:     { background: '#0e2841', color: '#fff', padding: '8px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'right', whiteSpace: 'nowrap' },
        td:      i => ({ padding: '8px 10px', fontSize: 12, verticalAlign: 'middle', background: i % 2 === 0 ? '#f8fafc' : '#fff', borderBottom: '1px solid #e2e8f0' }),
        tdR:     i => ({ padding: '8px 10px', fontSize: 12, textAlign: 'right', verticalAlign: 'middle', fontVariantNumeric: 'tabular-nums', background: i % 2 === 0 ? '#f8fafc' : '#fff', borderBottom: '1px solid #e2e8f0' }),
        totRow:  { background: '#0e2841' },
    };

    /* ═══════════════════════════════════════════════════════════ */
    return (
        <div style={S.wrap}>

            {/* Shift + hour banner */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px' }}>
                    <label style={S.lbl}>Shift</label>
                    <select style={{ ...S.inp, width: 170, marginTop: 4 }} value={shift}
                        onChange={e => { setShift(e.target.value); setHour(currentHour(e.target.value)); }}>
                        <option value="DAY">Day Shift  (07:00 – 19:00)</option>
                        <option value="NIGHT">Night Shift (19:00 – 07:00)</option>
                    </select>
                </div>
                <div style={{ background: '#0e2841', borderRadius: 8, padding: '8px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#90b8d8', fontWeight: 600, letterSpacing: '.06em' }}>CURRENT HOUR</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>{hour}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                    {loading && <span style={{ fontSize: 12, color: '#94a3b8' }}>Loading…</span>}
                    <button onClick={load}
                        style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #cbd5e1', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#0e2841', fontWeight: 600 }}>
                        ↻ Refresh
                    </button>
                </div>
            </div>

            {/* Main grid — form left, table right */}
            <div style={S.grid}>

                {/* ── LOG FORM ──────────────────────────────── */}
                <div style={S.card}>
                    <div style={S.cardHdr}>
                        <div style={S.ttl}>FGLIST Entry</div>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{shift} · {hour}</span>
                    </div>
                    <div style={{ padding: '14px 16px 16px' }}>

                        {/* STEP 1 — Lot No */}
                        <div style={S.step(form.lot_no)}>
                            <div style={S.stepLbl(form.lot_no)}>STEP 1 — SCAN LOT NO</div>
                            <label style={S.lbl}>Lot No <span style={{ color: '#dc2626' }}>*</span></label>
                            <input ref={refLot} style={S.inp}
                                type="text" placeholder="Scan or type lot no…"
                                value={form.lot_no}
                                onChange={e => {
                                    const val = sanitize(e.target.value);
                                    fld('lot_no', val);
                                    if (val && !LOT_REGEX.test(val)) {
                                        setLookupMsg({ type: 'err', text: 'Invalid lot no format — expected e.g. 1TAZ64221.9' });
                                    } else {
                                        setLookupMsg(null);
                                    }
                                }}
                                onKeyDown={onLotKey}
                                autoFocus />
                            <div style={S.hint}>Press Enter → Part Name</div>
                        </div>

                        {/* STEP 2 — Part Name */}
                        <div style={S.step(form.partname)}>
                            <div style={S.stepLbl(form.partname)}>STEP 2 — SCAN PART NAME</div>
                            <label style={S.lbl}>Part Name <span style={{ color: '#dc2626' }}>*</span></label>
                            <input ref={refPart} style={S.inp}
                                type="text" placeholder="Scan part name / device name…"
                                value={form.partname}
                                onChange={e => fld('partname', sanitize(e.target.value))}
                                onKeyDown={onPartKey} />
                            <div style={S.hint}>Press Enter → lookup package list</div>
                            {looking && <div style={{ ...S.msg('ok'), background: '#dbeafe', color: '#1e40af' }}>⏳ Looking up package list…</div>}
                            {lookupMsg && !looking && (
                                <div style={S.msg(lookupMsg.type === 'ok' ? 'ok' : 'err')}>{lookupMsg.text}</div>
                            )}
                        </div>

                        {/* AUTO-FILL */}
                        <div style={S.step(form.package)}>
                            <div style={S.stepLbl(form.package)}>
                                AUTO-FILLED FROM PACKAGE LIST {form.package ? '✓' : '— pending scan'}
                            </div>
                            <div style={S.r2}>
                                <div>
                                    <label style={S.lbl}>Package</label>
                                    <input style={S.inpRo} readOnly value={form.package} placeholder="Auto-fill" />
                                </div>
                                <div>
                                    <label style={S.lbl}>Charging</label>
                                    <input style={S.inpRo} readOnly value={form.charging} placeholder="Auto-fill" />
                                </div>
                            </div>
                        </div>

                        {/* STEP 3 — Qty */}
                        <div style={S.step(form.good_qty)}>
                            <div style={S.stepLbl(form.good_qty)}>STEP 3 — ENTER QTY</div>
                            <div style={S.r2}>
                                <div>
                                    <label style={S.lbl}>Good Qty <span style={{ color: '#dc2626' }}>*</span></label>
                                    <input ref={refGood}
                                        style={{ ...S.inpBig, color: '#16a34a' }}
                                        type="number" min="0" placeholder="0"
                                        value={form.good_qty}
                                        onChange={e => fld('good_qty', sanitizeQty(e.target.value))}
                                        onKeyDown={onGoodKey} />
                                    <div style={S.hint}>Enter → Reject Qty</div>
                                </div>
                                <div>
                                    <label style={S.lbl}>Reject Qty</label>
                                    <input ref={refReject}
                                        style={{ ...S.inpBig, color: '#dc2626' }}
                                        type="number" min="0" placeholder="0"
                                        value={form.reject_qty}
                                        onChange={e => fld('reject_qty', sanitizeQty(e.target.value))}
                                        onKeyDown={onRejectKey} />
                                    <div style={S.hint}>Enter → Save</div>
                                </div>
                            </div>
                        </div>

                        {saveMsg && <div style={S.msg(saveMsg.type === 'ok' ? 'ok' : 'err')}>{saveMsg.text}</div>}

                        <button style={{ ...S.btn, opacity: saving ? 0.6 : 1 }}
                            disabled={saving} onClick={save}>
                            {saving ? 'Saving…' : '✓ Save Entry'}
                        </button>
                        <button style={S.btnSm} onClick={clearForm}>Clear Form</button>
                    </div>
                </div>

                {/* ── ENTRIES TABLE ──────────────────────────── */}
                <div style={S.card}>
                    <div style={S.cardHdr}>
                        <div style={S.ttl}>Today's Entries — {shift} Shift</div>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                            {rows.length} record{rows.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    {/* Mini KPI summary */}
                    <div style={{ padding: '10px 16px 0' }}>
                        <div style={S.kpis}>
                            {[
                                { label: 'Good',   value: totGood.toLocaleString(),   color: '#16a34a' },
                                { label: 'Reject', value: totReject.toLocaleString(), color: '#dc2626' },
                                { label: 'Total',  value: totTotal.toLocaleString(),  color: '#1e5fa8' },
                            ].map((k, i) => (
                                <div key={i} style={S.kpi}>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>{k.label}</div>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: k.color, lineHeight: 1.1 }}>{k.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                                <tr>
                                    <th style={S.th}>Hour</th>
                                    <th style={S.th}>Lot No</th>
                                    <th style={S.th}>Part Name</th>
                                    <th style={S.th}>Package</th>
                                    <th style={S.th}>Charging</th>
                                    <th style={S.thR}>Good</th>
                                    <th style={S.thR}>Reject</th>
                                    <th style={S.thR}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: 'center', padding: 36, color: '#94a3b8', fontSize: 13 }}>
                                            No entries yet — scan a lot to begin.
                                        </td>
                                    </tr>
                                )}
                                {rows.map((r, i) => (
                                    <tr key={r.id || i}>
                                        <td style={S.td(i)}>
                                            <span style={{ background: '#e8eef5', borderRadius: 5, padding: '2px 7px', fontSize: 11, fontWeight: 700, color: '#0e2841' }}>
                                                {r.hour || '—'}
                                            </span>
                                        </td>
                                        <td style={S.td(i)}><b style={{ color: '#0e2841' }}>{r.lot_no}</b></td>
                                        <td style={S.td(i)}>{r.device_name || r.partname || '—'}</td>
                                        <td style={S.td(i)}>{r.package  || '—'}</td>
                                        <td style={S.td(i)}>{r.charging || '—'}</td>
                                        <td style={S.tdR(i)}>
                                            <b style={{ color: '#16a34a' }}>{Number(r.good_qty || 0).toLocaleString()}</b>
                                        </td>
                                        <td style={S.tdR(i)}>
                                            {Number(r.reject_qty || 0) > 0
                                                ? <span style={{ color: '#dc2626', fontWeight: 700 }}>{Number(r.reject_qty).toLocaleString()}</span>
                                                : <span style={{ color: '#cbd5e1' }}>—</span>}
                                        </td>
                                        <td style={S.tdR(i)}>
                                            {(Number(r.good_qty || 0) + Number(r.reject_qty || 0)).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                                {rows.length > 0 && (
                                    <tr style={S.totRow}>
                                        <td colSpan={5} style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700, color: '#90b8d8' }}>
                                            TOTAL — {rows.length} entries
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#86efac', fontWeight: 700, fontSize: 13 }}>
                                            {totGood.toLocaleString()}
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#fca5a5', fontWeight: 700, fontSize: 13 }}>
                                            {totReject.toLocaleString()}
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#ffd080', fontWeight: 700, fontSize: 13 }}>
                                            {totTotal.toLocaleString()}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
