import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const DEFAULT_BILL_TO = [
    'ANALOG DEVICES GEN. TRIAS INC.',
    'GATEWAY BUSINESS PARK',
    'JAVALERA, GEN. TRIAS',
    'CAVITE PHILIPPINES',
].join('\n');

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

export default function DeliveryOrderBuilder() {
    const [transactions, setTransactions] = useState([]);
    const [transactionId, setTransactionId] = useState('');
    const [items, setItems] = useState([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [saving, setSaving] = useState(false);
    const [savedOrder, setSavedOrder] = useState(null);
    const [error, setError] = useState(null);

    // unit price per FGLIST row id — this is what makes the DO read like an invoice
    const [prices, setPrices] = useState({});
    const [vatRate, setVatRate] = useState(0.12);
    const [currency, setCurrency] = useState('PHP');

    const [uploading, setUploading] = useState(false);
    const [uploadMsg, setUploadMsg] = useState(null);

    const [form, setForm] = useState({
        do_no: '',
        order_date: todayISO(),
        po_no: '',
        terms: '30 DAYS',
        bill_to_name: 'ANALOG DEVICES GEN. TRIAS INC.',
        bill_to_address: DEFAULT_BILL_TO,
        attn_bill: 'B3',
        ship_to_name: 'ANALOG DEVICES GEN. TRIAS INC.',
        ship_to_address: DEFAULT_BILL_TO,
        attn_ship: 'B3',
    });

    function loadTransactions(preferTransactionId) {
        return api.get('/fglist/transactions').then((res) => {
            setTransactions(res.data);
            if (res.data.length) {
                const preferred = preferTransactionId
                    ? res.data.find((t) => String(t.transaction_id) === String(preferTransactionId))
                    : null;
                setTransactionId(String((preferred ?? res.data[0]).transaction_id));
            }
        });
    }

    // load the list of transactions from the FGLIST "DB" on mount
    useEffect(() => {
        loadTransactions();
    }, []);

    async function handleUpload(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setUploadMsg(null);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post('/fglist/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setUploadMsg(res.data.message);
            // most recently imported transaction ids come back from the server;
            // jump the picker to the last one in the workbook.
            const ids = res.data.transaction_ids || [];
            await loadTransactions(ids[ids.length - 1]);
        } catch (err) {
            setError(err.response?.data?.message || 'Could not import that file.');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    }

    // load lot rows whenever the selected transaction changes
    useEffect(() => {
        if (!transactionId) return;
        setLoadingItems(true);
        setSavedOrder(null);
        setPrices({});
        api
            .get(`/fglist/transactions/${transactionId}/items`)
            .then((res) => setItems(res.data))
            .catch(() => setItems([]))
            .finally(() => setLoadingItems(false));
    }, [transactionId]);

    const totals = useMemo(() => {
        const units = items.reduce((s, r) => s + Number(r.quantity || 0), 0);
        const boxes = items.reduce((s, r) => s + Number(r.total_box || 0), 0);
        const subtotal = items.reduce((s, r) => {
            const price = Number(prices[r.id] || 0);
            return s + Number(r.quantity || 0) * price;
        }, 0);
        const vatAmount = subtotal * Number(vatRate || 0);
        const totalDue = subtotal + vatAmount;
        return { units, boxes, lots: items.length, subtotal, vatAmount, totalDue };
    }, [items, prices, vatRate]);

    function updateField(key, value) {
        setForm((f) => ({ ...f, [key]: value }));
    }

    function updatePrice(itemId, value) {
        setPrices((p) => ({ ...p, [itemId]: value === '' ? '' : Number(value) }));
    }

    function amountFor(item) {
        const price = Number(prices[item.id] || 0);
        return Number(item.quantity || 0) * price;
    }

    function money(n) {
        return `${currency} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    function buildPayload() {
        return {
            transaction_id: Number(transactionId),
            vat_rate: Number(vatRate),
            currency,
            prices,
            ...form,
        };
    }

    async function handleSave() {
        setSaving(true);
        setError(null);
        try {
            const res = await api.post('/delivery-orders', buildPayload());
            setSavedOrder(res.data);
        } catch (e) {
            setError(e.response?.data?.message || 'Could not save the delivery order.');
        } finally {
            setSaving(false);
        }
    }

    async function handleExport() {
        // Export the persisted DB record so the file always reflects what's saved.
        const order = savedOrder ?? (await handleSaveAndReturn());
        if (!order) return;
        window.location.href = `/api/delivery-orders/${order.id}/export`;
    }

    async function handleSaveAndReturn() {
        try {
            setSaving(true);
            const res = await api.post('/delivery-orders', buildPayload());
            setSavedOrder(res.data);
            return res.data;
        } catch (e) {
            setError(e.response?.data?.message || 'Could not save the delivery order.');
            return null;
        } finally {
            setSaving(false);
        }
    }

    const billLines = form.bill_to_address.split('\n');
    const shipLines = form.ship_to_address.split('\n');

    return (
        <div className="do-app">
            <aside className="do-panel">
                <h2>Delivery Order Builder</h2>
                <p className="sub">
                    Reads lot data from the FGLIST data source (DB). Saving writes a Delivery Order
                    header + items into <code>delivery_orders</code> / <code>delivery_order_items</code>.
                </p>

                <div className="field upload-field">
                    <label>Upload FGLIST Workbook (.xlsx)</label>
                    <input type="file" accept=".xlsx,.xls" onChange={handleUpload} disabled={uploading} />
                    {uploading && <p className="hint">Importing…</p>}
                    {uploadMsg && <p className="success">{uploadMsg}</p>}
                </div>

                <div className="field">
                    <label>Transaction ID <span className="badge">from DB</span></label>
                    <select value={transactionId} onChange={(e) => setTransactionId(e.target.value)}>
                        {transactions.map((t) => (
                            <option key={t.transaction_id} value={t.transaction_id}>
                                {t.transaction_id} ({t.lot_count} lots)
                            </option>
                        ))}
                    </select>
                </div>

                <div className="field">
                    <label>DO No.</label>
                    <input value={form.do_no} onChange={(e) => updateField('do_no', e.target.value)} placeholder="e.g. 00123" />
                </div>

                <div className="row2">
                    <div className="field">
                        <label>Date</label>
                        <input type="date" value={form.order_date} onChange={(e) => updateField('order_date', e.target.value)} />
                    </div>
                    <div className="field">
                        <label>PO No.</label>
                        <input value={form.po_no} onChange={(e) => updateField('po_no', e.target.value)} placeholder="N/A" />
                    </div>
                </div>

                <div className="row2">
                    <div className="field">
                        <label>Attn (Bill To)</label>
                        <input value={form.attn_bill} onChange={(e) => updateField('attn_bill', e.target.value)} />
                    </div>
                    <div className="field">
                        <label>Attn (Ship To)</label>
                        <input value={form.attn_ship} onChange={(e) => updateField('attn_ship', e.target.value)} />
                    </div>
                </div>

                <div className="field">
                    <label>Terms of Payment</label>
                    <input value={form.terms} onChange={(e) => updateField('terms', e.target.value)} />
                </div>

                <div className="row2">
                    <div className="field">
                        <label>VAT Rate</label>
                        <input
                            type="number" step="0.01" min="0" max="1"
                            value={vatRate}
                            onChange={(e) => setVatRate(e.target.value)}
                        />
                    </div>
                    <div className="field">
                        <label>Currency</label>
                        <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
                    </div>
                </div>
                <p className="hint">Enter a unit price per lot in the table to price this Delivery Order like an invoice.</p>

                <hr />

                <div className="field">
                    <label>Bill To — Company</label>
                    <input value={form.bill_to_name} onChange={(e) => updateField('bill_to_name', e.target.value)} />
                </div>
                <div className="field">
                    <label>Bill To — Address</label>
                    <textarea value={form.bill_to_address} onChange={(e) => updateField('bill_to_address', e.target.value)} />
                </div>
                <div className="field">
                    <label>Ship To — Company</label>
                    <input value={form.ship_to_name} onChange={(e) => updateField('ship_to_name', e.target.value)} />
                </div>
                <div className="field">
                    <label>Ship To — Address</label>
                    <textarea value={form.ship_to_address} onChange={(e) => updateField('ship_to_address', e.target.value)} />
                </div>

                <hr />

                <div className="stat"><span>Lots in this transaction</span><b>{totals.lots}</b></div>
                <div className="stat"><span>Total units</span><b>{totals.units.toLocaleString()}</b></div>
                <div className="stat"><span>Total boxes</span><b>{totals.boxes.toLocaleString()}</b></div>
                <div className="stat"><span>Subtotal</span><b>{money(totals.subtotal)}</b></div>
                <div className="stat"><span>VAT</span><b>{money(totals.vatAmount)}</b></div>
                <div className="stat"><span>Total amount due</span><b>{money(totals.totalDue)}</b></div>

                {error && <p className="error">{error}</p>}
                {savedOrder && <p className="success">Saved as Delivery Order #{savedOrder.id}.</p>}

                <div className="btns">
                    <button className="primary" disabled={saving || !items.length} onClick={handleSave}>
                        {saving ? 'Saving…' : 'Save Delivery Order'}
                    </button>
                    <button className="secondary" disabled={saving || !items.length} onClick={handleExport}>
                        ⬇ Export to Excel (.xlsx)
                    </button>
                </div>
            </aside>

            <main className="do-doc">
                <div className="doc-top">
                    <div>
                        <p className="co-name">TELFORD Svc. Phils. Inc.</p>
                        <p className="co-addr">Linares St., Gateway Business Park</p>
                        <p className="co-addr">Brgy. Javalera, Gen. Trias, Cavite 4107, Philippines</p>
                    </div>
                    <div className="do-title-block">
                        <div className="do-title">DELIVERY ORDER</div>
                        <div className="do-tin">TIN 205-375-260-000 VAT</div>
                        <div className="do-no">No. {form.do_no || '—'}</div>
                    </div>
                </div>

                <hr className="divider" />

                <div className="parties">
                    <div className="party">
                        <h3>BILL TO</h3>
                        {billLines.map((l, i) => (
                            <div key={i} className={i === 0 ? 'name' : 'addr'}>{l}</div>
                        ))}
                        <div className="attn"><b>ATTN :</b> {form.attn_bill}</div>
                    </div>
                    <div className="party">
                        <h3>SHIP TO</h3>
                        {shipLines.map((l, i) => (
                            <div key={i} className={i === 0 ? 'name' : 'addr'}>{l}</div>
                        ))}
                        <div className="attn"><b>ATTN :</b> {form.attn_ship}</div>
                    </div>
                </div>

                <div className="meta-strip">
                    <div><div className="label">Date</div><div className="val">{form.order_date}</div></div>
                    <div><div className="label">Purchase Order No.</div><div className="val">{form.po_no || 'N/A'}</div></div>
                    <div><div className="label">Terms of Payment</div><div className="val">{form.terms}</div></div>
                </div>

                <div className="desc-row">
                    <div><b>Description:</b> INTEGRATED CIRCUIT</div>
                    <div><b>Transaction I.D No.:</b> {transactionId || '—'}</div>
                </div>

                <table className="items">
                    <thead>
                        <tr>
                            <th>Non-Rto / Rto</th><th>Destination</th><th>Focus Group</th><th>Lot i.d</th>
                            <th>Qty.</th><th>Partname</th><th>Date Code</th><th>Lead</th>
                            <th>Package</th><th>Boxes</th><th>Lot Type</th>
                            <th>Unit Price</th><th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loadingItems ? (
                            <tr><td colSpan={13}>Loading…</td></tr>
                        ) : (
                            items.map((r) => (
                                <tr key={r.id}>
                                    <td>{r.rto_non_rto}</td>
                                    <td>{r.destination}</td>
                                    <td>{r.focus_group}</td>
                                    <td>{r.lotno}</td>
                                    <td>{Number(r.quantity).toLocaleString()}</td>
                                    <td>{r.partname}</td>
                                    <td>{r.datecode}</td>
                                    <td>{r.lead}</td>
                                    <td>{r.package}</td>
                                    <td>{r.total_box}</td>
                                    <td>{r.lot_type}</td>
                                    <td>
                                        <input
                                            className="price-input"
                                            type="number" step="0.0001" min="0"
                                            value={prices[r.id] ?? ''}
                                            onChange={(e) => updatePrice(r.id, e.target.value)}
                                            placeholder="0.00"
                                        />
                                    </td>
                                    <td>{amountFor(r).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={4}>G-TOTAL</td>
                            <td>{totals.units.toLocaleString()}</td>
                            <td colSpan={4}>UNITS</td>
                            <td>{totals.boxes.toLocaleString()}</td>
                            <td>BOXES</td>
                            <td colSpan={2}></td>
                        </tr>
                    </tfoot>
                </table>

                <div className="amount-summary">
                    <div className="row"><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
                    <div className="row"><span>VAT ({(Number(vatRate) * 100).toFixed(0)}%)</span><span>{money(totals.vatAmount)}</span></div>
                    <div className="row total"><span>Total Amount Due</span><span>{money(totals.totalDue)}</span></div>
                </div>

                <div className="sign-grid">
                    <div>Prepared By</div>
                    <div>Checked By</div>
                    <div>Checked By</div>
                    <div>Approved By</div>
                    <div>Received the above in good order and condition.</div>
                </div>

                <div className="footer-strip">
                    <span>TELFORD SVC PHILS., INC</span>
                    <span>DVR-01 (REV. 5)</span>
                </div>
            </main>
        </div>
    );
}
