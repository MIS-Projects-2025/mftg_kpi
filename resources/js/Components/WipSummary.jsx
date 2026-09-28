import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';

function fmt(n) { return Number(n||0).toLocaleString(); }
function fmtPct(n) { return n==null?'—':Number(n).toFixed(1)+'%'; }

const FC = { F1:'#1e5fa8', F2:'#059669', F3:'#7c3aed', Unknown:'#64748b' };
function FactoryBadge({ f }) {
    const c = FC[f]||'#64748b';
    return <span style={{display:'inline-block',padding:'2px 8px',borderRadius:6,fontSize:10,fontWeight:700,background:c+'18',color:c,border:`1px solid ${c}33`}}>{f||'?'}</span>;
}
function pctColor(p) { return p>=100?'#16a34a':p>=75?'#d97706':'#dc2626'; }
function pctBg(p)    { return p>=100?'#dcfce7':p>=75?'#fef9c3':'#fee2e2'; }

const TH = { background:'#0e2841',color:'#fff',padding:'7px 8px',fontSize:10,fontWeight:700,textAlign:'right',whiteSpace:'nowrap',borderRight:'1px solid #1e3a5f' };
const THL = { ...TH, textAlign:'left' };
const THG = { background:'#1e3a5f',color:'#93c5fd',padding:'5px 8px',fontSize:9,fontWeight:700,textAlign:'center',letterSpacing:'.06em',textTransform:'uppercase',borderRight:'1px solid #0e2841' };
const TD = { padding:'6px 8px',borderBottom:'1px solid #f1f5f9',fontSize:11,textAlign:'right',borderRight:'1px solid #f1f5f9',fontVariantNumeric:'tabular-nums' };
const TDL = { ...TD, textAlign:'left' };

export default function WipSummary({ date }) {
    const [rows,    setRows]    = useState([]);
    const [loading, setLoading] = useState(false);
    const [factory, setFactory] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (date) params.date = date;
            const res = await api.get('/loading-plan/wip-summary', { params });
            setRows(res.data);
        } catch(_) {}
        finally { setLoading(false); }
    }, [date]);

    useEffect(() => { load(); }, [load]);

    const filtered = factory
        ? rows.filter(r => r.factory === factory)
        : rows;

    // Group by factory for subtotals
    const factories = [...new Set(rows.map(r => r.factory))].sort();

    // Grand totals
    const grand = (key) => filtered.reduce((s,r) => s+(r[key]||0), 0);

    if (loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Loading WIP Summary…</div>;
    if (rows.length===0) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>No data — select a date or upload a CSV</div>;

    return (
        <div>
            {/* Filter */}
            <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12,flexWrap:'wrap'}}>
                <span style={{fontSize:11,fontWeight:600,color:'#64748b'}}>Factory:</span>
                {['','F1','F2','F3'].map(f=>(
                    <button key={f} onClick={()=>setFactory(f)}
                        style={{padding:'4px 12px',borderRadius:6,border:'1px solid #e2e8f0',fontSize:11,fontWeight:600,cursor:'pointer',
                            background:factory===f?'#0e2841':'#fff',color:factory===f?'#fff':'#475569'}}>
                        {f||'All'}
                    </button>
                ))}
                <button onClick={load} style={{marginLeft:'auto',padding:'5px 12px',borderRadius:6,border:'1px solid #cbd5e1',background:'#fff',fontSize:11,cursor:'pointer',color:'#0e2841',fontWeight:600}}>↻ Refresh</button>
            </div>

            <div style={{overflowX:'auto',borderRadius:12,boxShadow:'0 1px 4px rgba(14,40,65,.08)',border:'1px solid #e2e8f0'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                    <thead>
                        {/* Group headers */}
                        <tr>
                            <th style={{...THL,rowSpan:2,verticalAlign:'middle'}} rowSpan={2}>Factory</th>
                            <th style={{...THL,rowSpan:2,verticalAlign:'middle'}} rowSpan={2}>Package</th>
                            <th style={{...THG,textAlign:'center'}} colSpan={2}>6AM Starting WIP</th>
                            <th style={{...THG,textAlign:'center'}} colSpan={2}>6AM Processable WIP</th>
                            <th style={{...THG,textAlign:'center'}} colSpan={2}>Pull In</th>
                            <th style={{...THG,textAlign:'center'}} colSpan={3}>TNR Commit</th>
                            <th style={{...THG,textAlign:'center'}} colSpan={2}>Pipeline</th>
                            <th style={{...THG,textAlign:'center',background:'#1e4620',color:'#86efac'}} colSpan={1}>Total Commit</th>
                            <th style={{...THG,textAlign:'center',background:'#1e4620',color:'#86efac'}} colSpan={1}>FG Out</th>
                            <th style={{...THG,textAlign:'center',background:'#7f1d1d',color:'#fca5a5'}} colSpan={1}>Delta</th>
                            <th style={{...THG,textAlign:'center'}} colSpan={2}>Left at Pipeline</th>
                            <th style={{...THG,textAlign:'center',background:'#1e3a1e',color:'#86efac'}} colSpan={1}>%</th>
                        </tr>
                        <tr>
                            <th style={TH}>Lots</th><th style={TH}>Qty</th>
                            <th style={TH}>Lots</th><th style={TH}>Qty</th>
                            <th style={TH}>Lots</th><th style={TH}>Qty</th>
                            <th style={TH}>Lots</th><th style={TH}>Qty</th><th style={{...TH,color:'#fde68a'}}>+Pull In</th>
                            <th style={TH}>Lots</th><th style={TH}>Qty</th>
                            <th style={{...TH,background:'#14532d',color:'#86efac'}}>Qty</th>
                            <th style={{...TH,background:'#14532d',color:'#86efac'}}>Qty</th>
                            <th style={{...TH,background:'#7f1d1d',color:'#fca5a5'}}>Qty</th>
                            <th style={TH}>Lots</th><th style={TH}>Qty</th>
                            <th style={{...TH,background:'#14532d',color:'#86efac'}}>Att%</th>
                        </tr>
                    </thead>
                    <tbody>
                        {factories.filter(f => !factory || f===factory).map(fac => {
                            const facRows = filtered.filter(r => r.factory===fac);
                            const sub = (key) => facRows.reduce((s,r)=>s+(r[key]||0),0);
                            return [
                                // Factory sub-header
                                <tr key={`fac-${fac}`} style={{background:'#f8fafc'}}>
                                    <td colSpan={18} style={{...TDL,fontWeight:700,fontSize:11,color:FC[fac]||'#0e2841',padding:'6px 10px',borderBottom:'2px solid #e2e8f0'}}>
                                        <FactoryBadge f={fac}/> {fac}
                                    </td>
                                </tr>,
                                // Package rows
                                ...facRows.map((r,i) => {
                                    const bg = i%2===0?'#fff':'#f8fafc';
                                    const att = r.attainment_pct;
                                    return (
                                        <tr key={`${fac}-${r.package_name}`} style={{background:bg}}>
                                            <td style={TDL}><FactoryBadge f={r.factory}/></td>
                                            <td style={{...TDL,fontWeight:600,color:'#0e2841'}}>{r.package_name||'—'}</td>
                                            <td style={TD}>{fmt(r.wip_lots)}</td>
                                            <td style={TD}>{fmt(r.wip_qty)}</td>
                                            <td style={TD}>{fmt(r.proc_lots)}</td>
                                            <td style={TD}>{fmt(r.proc_qty)}</td>
                                            <td style={TD}>{fmt(r.pull_in_lots)}</td>
                                            <td style={TD}>{fmt(r.pull_in_qty)}</td>
                                            <td style={TD}>{fmt(r.tnr_commit_lots)}</td>
                                            <td style={TD}>{fmt(r.tnr_commit_qty)}</td>
                                            <td style={{...TD,color:'#d97706',fontWeight:600}}>{fmt(r.total_tnr_commit)}</td>
                                            <td style={TD}>{fmt(r.pipeline_lots)}</td>
                                            <td style={TD}>{fmt(r.pipeline_qty)}</td>
                                            <td style={{...TD,fontWeight:700,color:'#166534'}}>{fmt(r.total_commit)}</td>
                                            <td style={{...TD,fontWeight:700,color:'#059669'}}>{fmt(r.fg_out)}</td>
                                            <td style={{...TD,fontWeight:700,color:r.delta>=0?'#16a34a':'#dc2626'}}>{r.delta>=0?'+':''}{fmt(r.delta)}</td>
                                            <td style={TD}>{fmt(r.left_pipeline_lots)}</td>
                                            <td style={TD}>{fmt(r.left_pipeline_qty)}</td>
                                            <td style={TD}>
                                                <span style={{background:pctBg(att),color:pctColor(att),padding:'2px 6px',borderRadius:99,fontSize:10,fontWeight:700}}>
                                                    {fmtPct(att)}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                }),
                                // Factory subtotal
                                <tr key={`sub-${fac}`} style={{background:'#f1f5f9',fontWeight:700}}>
                                    <td style={{...TDL,color:FC[fac]||'#0e2841'}} colSpan={2}>Subtotal {fac}</td>
                                    <td style={TD}>{fmt(sub('wip_lots'))}</td>
                                    <td style={TD}>{fmt(sub('wip_qty'))}</td>
                                    <td style={TD}>{fmt(sub('proc_lots'))}</td>
                                    <td style={TD}>{fmt(sub('proc_qty'))}</td>
                                    <td style={TD}>{fmt(sub('pull_in_lots'))}</td>
                                    <td style={TD}>{fmt(sub('pull_in_qty'))}</td>
                                    <td style={TD}>{fmt(sub('tnr_commit_lots'))}</td>
                                    <td style={TD}>{fmt(sub('tnr_commit_qty'))}</td>
                                    <td style={{...TD,color:'#d97706'}}>{fmt(sub('total_tnr_commit'))}</td>
                                    <td style={TD}>{fmt(sub('pipeline_lots'))}</td>
                                    <td style={TD}>{fmt(sub('pipeline_qty'))}</td>
                                    <td style={{...TD,color:'#166534'}}>{fmt(sub('total_commit'))}</td>
                                    <td style={{...TD,color:'#059669'}}>{fmt(sub('fg_out'))}</td>
                                    <td style={{...TD,color:sub('delta')>=0?'#16a34a':'#dc2626'}}>{sub('delta')>=0?'+':''}{fmt(sub('delta'))}</td>
                                    <td style={TD}>{fmt(sub('left_pipeline_lots'))}</td>
                                    <td style={TD}>{fmt(sub('left_pipeline_qty'))}</td>
                                    <td style={TD}>
                                        {sub('total_commit')>0
                                            ? <span style={{background:pctBg(sub('fg_out')/sub('total_commit')*100),color:pctColor(sub('fg_out')/sub('total_commit')*100),padding:'2px 6px',borderRadius:99,fontSize:10,fontWeight:700}}>
                                                {(sub('fg_out')/sub('total_commit')*100).toFixed(1)}%
                                              </span>
                                            : '—'}
                                    </td>
                                </tr>,
                            ];
                        })}
                    </tbody>
                    {/* Grand total */}
                    <tfoot>
                        <tr style={{background:'#0e2841',color:'#fff',fontWeight:800}}>
                            <td style={{...TDL,color:'#fff',fontSize:12}} colSpan={2}>GRAND TOTAL</td>
                            <td style={{...TD,color:'#fff'}}>{fmt(grand('wip_lots'))}</td>
                            <td style={{...TD,color:'#fff'}}>{fmt(grand('wip_qty'))}</td>
                            <td style={{...TD,color:'#fff'}}>{fmt(grand('proc_lots'))}</td>
                            <td style={{...TD,color:'#fff'}}>{fmt(grand('proc_qty'))}</td>
                            <td style={{...TD,color:'#fff'}}>{fmt(grand('pull_in_lots'))}</td>
                            <td style={{...TD,color:'#fff'}}>{fmt(grand('pull_in_qty'))}</td>
                            <td style={{...TD,color:'#fff'}}>{fmt(grand('tnr_commit_lots'))}</td>
                            <td style={{...TD,color:'#fff'}}>{fmt(grand('tnr_commit_qty'))}</td>
                            <td style={{...TD,color:'#fde68a'}}>{fmt(grand('total_tnr_commit'))}</td>
                            <td style={{...TD,color:'#fff'}}>{fmt(grand('pipeline_lots'))}</td>
                            <td style={{...TD,color:'#fff'}}>{fmt(grand('pipeline_qty'))}</td>
                            <td style={{...TD,color:'#86efac'}}>{fmt(grand('total_commit'))}</td>
                            <td style={{...TD,color:'#86efac'}}>{fmt(grand('fg_out'))}</td>
                            <td style={{...TD,color:grand('delta')>=0?'#86efac':'#fca5a5'}}>{grand('delta')>=0?'+':''}{fmt(grand('delta'))}</td>
                            <td style={{...TD,color:'#fff'}}>{fmt(grand('left_pipeline_lots'))}</td>
                            <td style={{...TD,color:'#fff'}}>{fmt(grand('left_pipeline_qty'))}</td>
                            <td style={{...TD,color:'#86efac'}}>
                                {grand('total_commit')>0?(grand('fg_out')/grand('total_commit')*100).toFixed(1)+'%':'—'}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
