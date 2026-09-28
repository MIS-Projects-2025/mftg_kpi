import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';

/* ─── helpers ──────────────────────────────────────────────────── */
function fmt(n)  { return Number(n||0).toLocaleString(); }
function fmtM(n) { return n==null||n===0?'—':n>=1e6?(n/1e6).toFixed(2)+'M':n>=1e3?(n/1e3).toFixed(0)+'K':String(n); }

/* ─── status helpers ───────────────────────────────────────────── */
function statusStyle(s) {
    if (s==='done') return { bg:'#dcfce7', color:'#166534', label:'✓ Done' };
    return               { bg:'#f3f4f6', color:'#6b7280', label:'Not Started' };
}
function attColor(pct) { return pct>=100?'#16a34a':pct>=75?'#d97706':'#dc2626'; }
function attBg(pct)    { return pct>=100?'#dcfce7':pct>=75?'#fef9c3':'#fee2e2'; }

/* ─── factory badge ────────────────────────────────────────────── */
const FC = { F1:'#1e5fa8', F2:'#059669', F3:'#7c3aed' };
function FactoryBadge({ factory }) {
    if (!factory) return <span style={{color:'#cbd5e1',fontSize:11}}>—</span>;
    const c = FC[factory]||'#64748b';
    return <span style={{display:'inline-block',padding:'2px 8px',borderRadius:6,fontSize:10,fontWeight:700,background:c+'18',color:c,border:`1px solid ${c}33`}}>{factory}</span>;
}

/* ─── style consts ─────────────────────────────────────────────── */
const S = { fontSize:13,padding:'7px 10px',borderRadius:7,border:'1px solid #cbd5e1',color:'#1e293b',background:'#f8fafc',outline:'none' };
const TH = { background:'#0e2841',color:'#fff',padding:'8px 10px',fontSize:11,fontWeight:700,textAlign:'left',whiteSpace:'nowrap' };
const TD = { padding:'7px 10px',borderBottom:'1px solid #e2e8f0',fontSize:12 };
const TDR = { ...TD,textAlign:'right',fontVariantNumeric:'tabular-nums' };

/* ═══════════════════════════════════════════════════════════════ */
export default function LotMonitoring() {
    const [lots,     setLots]     = useState([]);
    const [summary,  setSummary]  = useState(null);
    const [loading,  setLoading]  = useState(false);
    const [dates,    setDates]    = useState([]);
    const [date,     setDate]     = useState('');
    const [factory,  setFactory]  = useState('');
    const [status,   setStatus]   = useState('');
    const [search,   setSearch]   = useState('');
    const [searchVal,setSearchVal]= useState('');
    const [page,     setPage]     = useState(1);
    const [totalPages,setTotalPages]=useState(1);
    const [total,    setTotal]    = useState(0);
    const perPage = 100;

    // Load available dates on mount
    useEffect(() => {
        api.get('/lot-monitoring/dates').then(r => {
            setDates(r.data);
            if (r.data.length > 0) setDate(r.data[0]);
        }).catch(() => {});
    }, []);

    const load = useCallback(async (pg = page) => {
        setLoading(true);
        try {
            const params = { page: pg, per_page: perPage };
            if (date)    params.date    = date;
            if (factory) params.factory = factory;
            if (status)  params.status  = status;
            if (search)  params.search  = search;
            const res = await api.get('/lot-monitoring/lots', { params });
            setLots(res.data.lots);
            setSummary(res.data.summary);
            setTotal(res.data.total);
            setTotalPages(res.data.pages);
            setPage(pg);
        } catch(_) {}
        finally { setLoading(false); }
    }, [date, factory, status, search, page]);

    // Reload when filters change — reset to page 1
    useEffect(() => {
        if (date !== undefined) load(1);
    }, [date, factory, status, search]);

    const handleSearch = (e) => {
        e.preventDefault();
        setSearch(searchVal);
    };

    const kpis = summary ? [
        { label:'Total Lots',    value: fmt(summary.total),          color:'#0e2841' },
        { label:'Done',          value: fmt(summary.done),           color:'#16a34a' },
        { label:'Not Started',   value: fmt(summary.not_started),    color:'#dc2626' },
        { label:'Total Plan',    value: fmtM(summary.total_plan),    color:'#1e5fa8' },
        { label:'Total Actual',  value: fmtM(summary.total_actual),  color:'#059669' },
        { label:'Variance',      value: fmtM(summary.total_variance),color: summary.total_variance<=0?'#16a34a':'#dc2626' },
        { label:'Avg Att %',     value: summary.avg_att+'%',         color: attColor(summary.avg_att) },
        { label:'Avg Leadtime',  value: summary.avg_leadtime!=null?summary.avg_leadtime+'d':'—', color:'#7c3aed' },
    ] : [];

    return (
        <div style={{ padding:'0 0 48px' }}>

            {/* ── Filter bar ─────────────────────────────────── */}
            <div style={{ display:'flex',flexWrap:'wrap',gap:12,alignItems:'flex-end',background:'#fff',border:'1px solid #e2e8f0',borderRadius:10,padding:'12px 16px',marginBottom:16,boxShadow:'0 1px 3px rgba(14,40,65,.05)' }}>
                <div>
                    <span style={{ fontSize:10,fontWeight:600,color:'#64748b',textTransform:'uppercase',letterSpacing:'.06em',display:'block',marginBottom:4 }}>Date Loaded</span>
                    <select value={date} onChange={e=>{setDate(e.target.value);setPage(1);}} style={{ ...S,width:150 }}>
                        <option value="">All Dates</option>
                        {dates.map(d=><option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
                <div>
                    <span style={{ fontSize:10,fontWeight:600,color:'#64748b',textTransform:'uppercase',letterSpacing:'.06em',display:'block',marginBottom:4 }}>Factory</span>
                    <select value={factory} onChange={e=>{setFactory(e.target.value);setPage(1);}} style={{ ...S,width:100 }}>
                        <option value="">All</option>
                        <option value="F1">F1</option>
                        <option value="F2">F2</option>
                        <option value="F3">F3</option>
                    </select>
                </div>
                <div>
                    <span style={{ fontSize:10,fontWeight:600,color:'#64748b',textTransform:'uppercase',letterSpacing:'.06em',display:'block',marginBottom:4 }}>Status</span>
                    <select value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}} style={{ ...S,width:130 }}>
                        <option value="">All Status</option>
                        <option value="done">Done</option>
                        <option value="not_started">Not Started</option>
                    </select>
                </div>
                <div>
                    <span style={{ fontSize:10,fontWeight:600,color:'#64748b',textTransform:'uppercase',letterSpacing:'.06em',display:'block',marginBottom:4 }}>Search</span>
                    <form onSubmit={handleSearch} style={{ display:'flex',gap:6 }}>
                        <input placeholder="Lot ID or Part Name…" value={searchVal} onChange={e=>setSearchVal(e.target.value)}
                            style={{ ...S,width:200 }}/>
                        <button type="submit" style={{ padding:'7px 14px',borderRadius:7,border:'none',background:'#0e2841',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer' }}>Search</button>
                        {search&&<button type="button" onClick={()=>{setSearch('');setSearchVal('');setPage(1);}}
                            style={{ padding:'7px 10px',borderRadius:7,border:'1px solid #cbd5e1',background:'#fee2e2',color:'#dc2626',fontSize:12,fontWeight:600,cursor:'pointer' }}>✕</button>}
                    </form>
                </div>
                <div style={{ marginLeft:'auto',display:'flex',gap:8,alignItems:'center' }}>
                    {loading&&<span style={{ fontSize:12,color:'#94a3b8' }}>Loading…</span>}
                    <button onClick={()=>load(page)} style={{ padding:'7px 16px',borderRadius:7,border:'1px solid #cbd5e1',background:'#fff',fontSize:13,cursor:'pointer',color:'#0e2841',fontWeight:600 }}>↻ Refresh</button>
                </div>
            </div>

            {/* ── KPI strip ──────────────────────────────────── */}
            {summary && (
                <div style={{ display:'grid',gridTemplateColumns:'repeat(8,1fr)',gap:8,marginBottom:16 }}>
                    {kpis.map((k,i)=>(
                        <div key={i} style={{ background:'#fff',border:'1px solid #e2e8f0',borderRadius:10,padding:'10px 12px',boxShadow:'0 1px 3px rgba(14,40,65,.05)' }}>
                            <div style={{ fontSize:9,fontWeight:600,color:'#64748b',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:4 }}>{k.label}</div>
                            <div style={{ fontSize:18,fontWeight:800,color:k.color }}>{k.value}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Table ──────────────────────────────────────── */}
            <div style={{ background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,boxShadow:'0 1px 4px rgba(14,40,65,.06)',overflow:'hidden' }}>
                <div style={{ padding:'12px 16px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8 }}>
                    <div style={{ fontSize:12,fontWeight:700,color:'#0e2841',textTransform:'uppercase',letterSpacing:'.06em' }}>
                        Lot Monitoring
                        {date&&<span style={{ marginLeft:8,fontWeight:400,color:'#64748b',fontSize:11,textTransform:'none' }}>{date}</span>}
                    </div>
                    <div style={{ display:'flex',gap:12,alignItems:'center',fontSize:11,color:'#64748b' }}>
                        <span>{total} lots total</span>
                        {totalPages>1&&<span>Page {page} of {totalPages}</span>}
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding:40,textAlign:'center',color:'#94a3b8' }}>Loading…</div>
                ) : lots.length===0 ? (
                    <div style={{ padding:40,textAlign:'center',color:'#94a3b8' }}>No lots found</div>
                ) : (
                    <>
                        <div style={{ overflowX:'auto' }}>
                            <table style={{ width:'100%',borderCollapse:'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={TH}>#</th>
                                        <th style={TH}>Lot ID</th>
                                        <th style={TH}>Part Name</th>
                                        <th style={TH}>Focus Group</th>
                                        <th style={TH}>Factory</th>
                                        <th style={{ ...TH,textAlign:'right' }}>Plan Qty</th>
                                        <th style={{ ...TH,textAlign:'right' }}>Actual Qty</th>
                                        <th style={{ ...TH,textAlign:'right' }}>Variance</th>
                                        <th style={TH}>Date Loaded</th>
                                        <th style={TH}>Last Out Date</th>
                                        <th style={{ ...TH,textAlign:'right' }}>Leadtime</th>
                                        <th style={{ ...TH,textAlign:'right' }}>Attainment</th>
                                        <th style={TH}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lots.map((l,i)=>{
                                        const offset = (page-1)*perPage;
                                        const st  = statusStyle(l.status);
                                        const bg  = l.status==='done'?'#f0fdf4':i%2===0?'#f8fafc':'#fff';
                                        return (
                                            <tr key={l.lot_id} style={{ background:bg }}>
                                                <td style={{ ...TD,color:'#94a3b8',fontSize:11 }}>{offset+i+1}</td>
                                                <td style={TD}><b style={{ color:'#0e2841' }}>{l.lot_id}</b></td>
                                                <td style={{ ...TD,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{l.part_name}</td>
                                                <td style={{ ...TD,color:'#475569' }}>{l.focus_group||'—'}</td>
                                                <td style={TD}><FactoryBadge factory={l.factory}/></td>
                                                <td style={TDR}>{fmt(l.plan_qty)}</td>
                                                <td style={{ ...TDR,color:'#16a34a',fontWeight:600 }}>{fmt(l.actual_qty)}</td>
                                                <td style={{ ...TDR,fontWeight:600,color:l.variance<=0?'#16a34a':'#dc2626' }}>
                                                    {l.variance<=0?'':'-'}{fmt(Math.abs(l.variance))}
                                                </td>
                                                <td style={{ ...TD,fontSize:11,color:'#475569' }}>{l.date_loaded||'—'}</td>
                                                <td style={{ ...TD,fontSize:11,color:'#475569' }}>{l.last_out_date||'—'}</td>
                                                <td style={{ ...TDR,color:'#7c3aed' }}>{l.leadtime_days!=null?l.leadtime_days+'d':'—'}</td>
                                                <td style={TDR}>
                                                    <span style={{ display:'inline-block',padding:'2px 8px',borderRadius:99,fontSize:11,fontWeight:700,background:attBg(l.attainment),color:attColor(l.attainment) }}>
                                                        {l.attainment}%
                                                    </span>
                                                </td>
                                                <td style={TD}>
                                                    <span style={{ background:st.bg,color:st.color,padding:'2px 8px',borderRadius:99,fontSize:10,fontWeight:700 }}>{st.label}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div style={{ padding:'12px 16px',borderTop:'1px solid #f1f5f9',display:'flex',gap:6,alignItems:'center',justifyContent:'center',flexWrap:'wrap' }}>
                                <button onClick={()=>load(1)} disabled={page===1}
                                    style={{ padding:'5px 10px',borderRadius:6,border:'1px solid #e2e8f0',background:page===1?'#f8fafc':'#fff',color:page===1?'#cbd5e1':'#0e2841',cursor:page===1?'not-allowed':'pointer',fontSize:12 }}>«</button>
                                <button onClick={()=>load(page-1)} disabled={page===1}
                                    style={{ padding:'5px 10px',borderRadius:6,border:'1px solid #e2e8f0',background:page===1?'#f8fafc':'#fff',color:page===1?'#cbd5e1':'#0e2841',cursor:page===1?'not-allowed':'pointer',fontSize:12 }}>‹</button>
                                {Array.from({length:Math.min(7,totalPages)},(_,i)=>{
                                    let p;
                                    if(totalPages<=7) p=i+1;
                                    else if(page<=4) p=i+1;
                                    else if(page>=totalPages-3) p=totalPages-6+i;
                                    else p=page-3+i;
                                    return(
                                        <button key={p} onClick={()=>load(p)}
                                            style={{ padding:'5px 10px',borderRadius:6,border:'1px solid #e2e8f0',background:p===page?'#0e2841':'#fff',color:p===page?'#fff':'#0e2841',cursor:'pointer',fontSize:12,fontWeight:p===page?700:400,minWidth:34 }}>
                                            {p}
                                        </button>
                                    );
                                })}
                                <button onClick={()=>load(page+1)} disabled={page===totalPages}
                                    style={{ padding:'5px 10px',borderRadius:6,border:'1px solid #e2e8f0',background:page===totalPages?'#f8fafc':'#fff',color:page===totalPages?'#cbd5e1':'#0e2841',cursor:page===totalPages?'not-allowed':'pointer',fontSize:12 }}>›</button>
                                <button onClick={()=>load(totalPages)} disabled={page===totalPages}
                                    style={{ padding:'5px 10px',borderRadius:6,border:'1px solid #e2e8f0',background:page===totalPages?'#f8fafc':'#fff',color:page===totalPages?'#cbd5e1':'#0e2841',cursor:page===totalPages?'not-allowed':'pointer',fontSize:12 }}>»</button>
                                <span style={{ fontSize:11,color:'#94a3b8',marginLeft:8 }}>
                                    {(page-1)*perPage+1}–{Math.min(page*perPage,total)} of {fmt(total)}
                                </span>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

