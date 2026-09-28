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
    return hrs.includes(fmt) ? fmt : hrs[0];
}

/* ─── attainment pill ──────────────────────────────────────────── */
function Pill({ pct }) {
    const n = Number(pct || 0);
    const [bg, fg] =
        n >= 95 ? ['#dcfce7', '#166534'] :
        n >= 75 ? ['#fef9c3', '#854d0e'] :
                  ['#fee2e2', '#991b1b'];
    return (
        <span style={{
            display: 'inline-block', padding: '2px 8px',
            borderRadius: 99, fontSize: 11, fontWeight: 700,
            background: bg, color: fg,
        }}>
            {n}%
        </span>
    );
}

/* ─── blank form ───────────────────────────────────────────────── */
const BLANK = {
    lot_no: '', partname: '', device_name: '',
    package: '', charging: '',
    good_qty: '', reject_qty: '',
};

/* ─── validation regex ─────────────────────────────────────────── */
const LOT_REGEX = /^[A-Z0-9][A-Z0-9\.\-]{3,}$/;
/* ─── sanitize barcode input ───────────────────────────────────── */
function sanitize(val) {
    return val
        .replace(/\([^)]*\)/g, '')   // remove (1P), (1T), (Q) etc.
        .trim()
        .toUpperCase();
}

function sanitizeQty(val) {
    return val
        .replace(/\([^)]*\)/g, '')   // remove (Q) prefix
        .replace(/[^\d]/g, '')        // keep digits only
        .trim();
}
/* ═══════════════════════════════════════════════════════════════ */
export default function HourlyOutput() {

    /* ── shift / date / hour ────────────────────────────────────── */
    const initShift = detectShift();
    const [date,  setDate]  = useState(todayISO());
    const [shift, setShift] = useState(initShift);
    const [hour,  setHour]  = useState(() => currentHour(initShift));

    // ← add this — auto-update hour every minute
useEffect(() => {
    const timer = setInterval(() => {
        setHour(currentHour(shift));
    }, 60000); // check every 60 seconds
    return () => clearInterval(timer);
}, [shift]);
    /* ── form state ─────────────────────────────────────────────── */
    const [form,      setForm]      = useState(BLANK);
    const [looking,   setLooking]   = useState(false);
    const [lookupMsg, setLookupMsg] = useState(null);
    const [saving,    setSaving]    = useState(false);
    const [saveMsg,   setSaveMsg]   = useState(null);

    /* ── table ──────────────────────────────────────────────────── */
    const [rows,    setRows]    = useState([]);
    const [loading, setLoading] = useState(false);

    /* ── focus refs ─────────────────────────────────────────────── */
    const refLot    = useRef(null);
    const refPart   = useRef(null);
    const refGood   = useRef(null);
    const refReject = useRef(null);

    /* ── field helper ───────────────────────────────────────────── */
    function fld(key, val) { setForm(p => ({ ...p, [key]: val })); }

    /* ─── sanitize barcode input ───────────────────────────────────── */
    function sanitize(val) {
        return val
            .replace(/\([^)]*\)/g, '')   // remove ALL (...) groups e.g. (1P), (Q), (1T)
            .trim()
            .toUpperCase();
    }

    /* ─── sanitize qty — extract numbers only ──────────────────────── */
    function sanitizeQty(val) {
        return val
            .replace(/\([^)]*\)/g, '')   // remove (Q) prefix
            .replace(/[^\d]/g, '')        // keep digits only
            .trim();
    }

    /* ── load entries ───────────────────────────────────────────── */
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get('/hourly-outputs', { params: { date, shift } });
            setRows(r.data);
        } catch (_) {}
        finally { setLoading(false); }
    }, [date, shift]);

    useEffect(() => { load(); refLot.current?.focus(); }, [load]);

    /* ── packagelist lookup ─────────────────────────────────────── */
    async function lookup() {
    const partname = form.partname.trim();

    if (!partname) return;

    setLooking(true);
    setLookupMsg(null);

    try {
        const r = await api.get('/package-list/search', {
            params: { partname },    // ← only partname, no lot_no
        });
        const d = r.data;
        setForm(f => ({
            ...f,
            device_name: d.device_name || partname.toUpperCase(),
            package:     d.package     || '',
            charging:    d.charging    || '',
        }));
        setLookupMsg({
            type: 'ok',
            text: `✓ ${d.device_name}  ·  ${d.package}  ·  ${d.charging}`,
        });
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

    /* ── keyboard: Enter moves focus through scan chain ─────────── */
    async function onLotKey(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    const val = form.lot_no.trim();
    if (!val) return;

    // format check
    if (!LOT_REGEX.test(val)) {
        setLookupMsg({ type: 'err', text: `⚠ Invalid Lot No format — expected e.g. 1TAZ64221.9` });
        refLot.current?.select();
        return;
    }

    // check against ALL records in hourly_outputs (not just current session)
    try {
        const r = await api.get('/hourly-outputs/check-lot', { params: { lot_no: val } });
        if (r.data.duplicate) {
            setLookupMsg({ type: 'err', text: `⛔ Lot No ${val} already exists in records. Scan a different lot.` });
            fld('lot_no', '');
            refLot.current?.focus();
            return;
        }
    } catch (_) {
        // if check fails, allow to proceed — don't block operator
    }

    // all good — move to part name
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

    /* ── save ───────────────────────────────────────────────────── */
    async function save() {
        console.log('Saving with hour:', hour, 'shift:', shift);
        if (!form.lot_no.trim())   { setSaveMsg({ type: 'err', text: 'Lot No is required.'   }); refLot.current?.focus();  return; }
        if (!form.partname.trim()) { setSaveMsg({ type: 'err', text: 'Part Name is required.' }); refPart.current?.focus(); return; }
        if (!form.good_qty)        { setSaveMsg({ type: 'err', text: 'Good Qty is required.'  }); refGood.current?.focus(); return; }

        // ← second guard — check against ALL records before saving
        try {
            const check = await api.get('/hourly-outputs/check-lot', {
                params: { lot_no: form.lot_no.trim() }
            });
            if (check.data.duplicate) {
                setSaveMsg({ type: 'err', text: `⛔ Lot No ${form.lot_no} already exists in records. Cannot save.` });
                return;
            }
        } catch (_) {
            // if check fails, allow save to proceed
        }

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
            setSaveMsg({
                type: 'ok',
                text: `✓ Saved — Lot ${form.lot_no}  ·  Good: ${form.good_qty}  ·  Reject: ${form.reject_qty || 0}`,
            });
            setForm(BLANK);
            setLookupMsg(null);
            load();
            setTimeout(() => {
                setSaveMsg(null);
                refLot.current?.focus();
            }, 2000);
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

    /* ── aggregates ─────────────────────────────────────────────── */
    const totGood   = rows.reduce((s, r) => s + Number(r.good_qty   || 0), 0);
    const totReject = rows.reduce((s, r) => s + Number(r.reject_qty || 0), 0);
    const totTotal  = totGood + totReject;

    /* ── group rows by operator ─────────────────────────────────── */
    const byOp = rows.reduce((acc, r) => {
        const k = r.operator_name || 'Unknown';
        if (!acc[k]) acc[k] = [];
        acc[k].push(r);
        return acc;
    }, {});

    /* ── lot pivot (per lot per hour) ───────────────────────────── */
    const byLot = rows.reduce((acc, r) => {
        const k = `${r.lot_no}|||${r.partname}`;
        if (!acc[k]) acc[k] = {
            lot_no: r.lot_no, partname: r.partname,
            device_name: r.device_name, package: r.package, charging: r.charging,
            byHour: {}, totalGood: 0, totalReject: 0,
        };
        acc[k].byHour[r.hour] = (acc[k].byHour[r.hour] || 0) + Number(r.good_qty || 0);
        acc[k].totalGood   += Number(r.good_qty   || 0);
        acc[k].totalReject += Number(r.reject_qty || 0);
        return acc;
    }, {});

    const hours = shiftHours(shift);

    /* ── styles ─────────────────────────────────────────────────── */
    const S = {
        wrap:    { padding: '0 0 48px' },
        bar:     { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', marginBottom: 16, boxShadow: '0 1px 3px rgba(14,40,65,.05)' },
        lbl:     { fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 },
        inp:     { fontSize: 14, padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', color: '#1e293b', background: '#f8fafc', outline: 'none', width: '100%' },
        inpRo:   { fontSize: 14, padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', color: '#334155', background: '#f1f5f9', width: '100%' },
        inpBig:  { fontSize: 20, fontWeight: 700, padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', color: '#1e293b', background: '#f8fafc', outline: 'none', width: '100%', textAlign: 'right' },
        card:    { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 1px 4px rgba(14,40,65,.06)', overflow: 'hidden', marginBottom: 16 },
        cardHdr: { padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9' },
        ttl:     { fontSize: 12, fontWeight: 700, color: '#0e2841', textTransform: 'uppercase', letterSpacing: '.06em' },
        kpis:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 16 },
        kpi:     { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', boxShadow: '0 1px 3px rgba(14,40,65,.05)' },
        grid:    { display: 'grid', gridTemplateColumns: '380px 1fr', gap: 16, alignItems: 'start' },
        r2:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
        step:    (filled) => ({ marginBottom: 10, padding: '10px 12px', borderRadius: 8, border: filled ? '1px solid #86efac' : '1px solid #e2e8f0', background: filled ? '#f0fdf4' : '#f8fafc' }),
        stepLbl: (filled) => ({ fontSize: 10, fontWeight: 700, color: filled ? '#166534' : '#94a3b8', marginBottom: 6, letterSpacing: '.06em' }),
        hint:    { fontSize: 11, color: '#94a3b8', marginTop: 3 },
        btn:     { width: '100%', padding: '11px', marginTop: 8, borderRadius: 8, background: '#0e2841', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' },
        btnSm:   { width: '100%', padding: '7px', marginTop: 6, borderRadius: 8, border: '1px solid #e2e8f0', background: 'transparent', fontSize: 12, color: '#94a3b8', cursor: 'pointer' },
        msg:     (type) => ({ padding: '7px 11px', borderRadius: 7, fontSize: 12, marginBottom: 8, background: type === 'ok' ? '#dcfce7' : '#fee2e2', color: type === 'ok' ? '#166534' : '#991b1b' }),
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

            {/* ── Filter / shift bar ─────────────────────────── */}
            <div style={S.bar}>
                <div>
                    <label style={S.lbl}>Date</label>
                    <input style={{ ...S.inp, width: 148 }} type="date"
                        value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div>
                    <label style={S.lbl}>Shift</label>
                    <select style={{ ...S.inp, width: 176 }} value={shift}
                        onChange={e => { setShift(e.target.value); setHour(currentHour(e.target.value)); }}>
                        <option value="DAY">Day Shift  (07:00 – 19:00)</option>
                        <option value="NIGHT">Night Shift (19:00 – 07:00)</option>
                    </select>
                </div>
                
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                    {loading && <span style={{ fontSize: 12, color: '#94a3b8' }}>Loading…</span>}
                    <button onClick={load}
                        style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #cbd5e1', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#0e2841', fontWeight: 600 }}>
                        ↻ Refresh
                    </button>
                </div>
            </div>

            {/* ── KPI row ────────────────────────────────────── */}
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

            {/* ── Main grid ──────────────────────────────────── */}
            <div style={S.grid}>

                {/* LOG FORM */}
                <div style={S.card}>
                    <div style={S.cardHdr}>
                        <div style={S.ttl}>Log Entry</div>
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
                                // onChange={e => fld('lot_no', e.target.value.toUpperCase())}
                                onChange={e => {
                                    const val = sanitize(e.target.value);   // strips (1T)
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
                                onChange={e => {
                                    const val = sanitize(e.target.value);   // strips (1P)
                                    fld('partname', val);
                                }}
                                onKeyDown={onPartKey} />
                            <div style={S.hint}>Press Enter → lookup package list</div>
                            {looking && (
                                <div style={S.msg('info')}>⏳ Looking up package list…</div>
                            )}
                            {lookupMsg && !looking && (
                                <div style={S.msg(lookupMsg.type === 'ok' ? 'ok' : 'err')}>
                                    {lookupMsg.text}
                                </div>
                            )}
                        </div>

                        {/* AUTO-FILL — Package & Charging */}
                        <div style={S.step(form.package)}>
                            <div style={S.stepLbl(form.package)}>
                                AUTO-FILLED FROM PACKAGE LIST {form.package ? '✓' : '— pending scan'}
                            </div>
                            <div style={S.r2}>
                                <div>
                                    <label style={S.lbl}>Package</label>
                                    <input style={S.inpRo} readOnly
                                        value={form.package} placeholder="Auto-fill" />
                                </div>
                                <div>
                                    <label style={S.lbl}>Charging</label>
                                    <input style={S.inpRo} readOnly
                                        value={form.charging} placeholder="Auto-fill" />
                                </div>
                            </div>
                        </div>

                        {/* STEP 3 — Qty */}
                        <div style={S.step(form.good_qty)}>
                            <div style={S.stepLbl(form.good_qty)}>STEP 3 — ENTER QTY</div>
                            <div style={S.r2}>
                                <div>
                                    <label style={S.lbl}>
                                        Good Qty <span style={{ color: '#dc2626' }}>*</span>
                                    </label>
                                    <input ref={refGood}
                                        style={{ ...S.inpBig, color: '#16a34a' }}
                                        type="number" min="0" placeholder="0"
                                        value={form.good_qty}
                                        onChange={e => {
                                            const val = sanitizeQty(e.target.value);  // strips (Q) and keeps digits
                                            fld('good_qty', val);
                                        }}
                                        onKeyDown={onGoodKey} />
                                    <div style={S.hint}>Enter → Reject Qty</div>
                                </div>
                                <div>
                                    <label style={S.lbl}>Reject Qty</label>
                                    <input ref={refReject}
                                        style={{ ...S.inpBig, color: '#dc2626' }}
                                        type="number" min="0" placeholder="0"
                                        value={form.reject_qty}
                                        onChange={e => fld('reject_qty', e.target.value)}
                                        onKeyDown={onRejectKey} />
                                    <div style={S.hint}>Enter → Save</div>
                                </div>
                            </div>
                        </div>

                        {/* Messages */}
                        {saveMsg && <div style={S.msg(saveMsg.type === 'ok' ? 'ok' : 'err')}>{saveMsg.text}</div>}

                        <button style={{ ...S.btn, opacity: saving ? 0.6 : 1 }}
                            disabled={saving} onClick={save}>
                            {saving ? 'Saving…' : '✓ Save Entry'}
                        </button>
                        <button style={S.btnSm} onClick={clearForm}>Clear Form</button>
                    </div>
                </div>

                {/* ENTRIES TABLE */}
                <div style={S.card}>
                    <div style={S.cardHdr}>
                        <div style={S.ttl}>Entries — {shift} · {date}</div>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                            {rows.length} record{rows.length !== 1 ? 's' : ''}
                        </span>
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

                                {/* Grouped by operator */}
                                {Object.entries(byOp).map(([opName, opRows]) => {
                                    const opGood   = opRows.reduce((s, r) => s + Number(r.good_qty   || 0), 0);
                                    const opReject = opRows.reduce((s, r) => s + Number(r.reject_qty || 0), 0);
                                    return (
                                        <React.Fragment key={opName}>
                                            <tr>
                                                <td colSpan={8} style={S.opHdr}>
                                                    👤 {opName}
                                                    <span style={{ fontWeight: 400, color: '#546e7a', fontSize: 11, marginLeft: 10 }}>
                                                        {opRows.length} entr{opRows.length !== 1 ? 'ies' : 'y'}
                                                        &nbsp;·&nbsp;Good: {opGood.toLocaleString()}
                                                        &nbsp;·&nbsp;Reject: {opReject.toLocaleString()}
                                                        &nbsp;·&nbsp;Total: {(opGood + opReject).toLocaleString()}
                                                    </span>
                                                </td>
                                            </tr>
                                            {opRows.map((r, i) => (
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
                                        </React.Fragment>
                                    );
                                })}

                                {/* Total row */}
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

            {/* ── Lot pivot table ─────────────────────────────── */}
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

        </div>
    );
}
