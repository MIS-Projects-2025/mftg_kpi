import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';

/* ─── helpers ──────────────────────────────────────────────────── */
function fmt(n)  { return Number(n||0).toLocaleString(); }
function fmtN(n) { return n==null||n===0?'—':Number(n).toLocaleString(); }

/* ─── status badge ─────────────────────────────────────────────── */
function statusBg(s) {
    const u=(s||'').toUpperCase();
    if(u.includes('HOLD'))    return {bg:'#fee2e2',color:'#dc2626'};
    if(u.includes('COMPLET')) return {bg:'#dbeafe',color:'#0369a1'};
    if(u.includes('ACTIVE'))  return {bg:'#dcfce7',color:'#16a34a'};
    return {bg:'#f1f5f9',color:'#475569'};
}

/* ─── badges ───────────────────────────────────────────────────── */
const SC={
    'GTTFVI_T':'#7c3aed','GTTBOX_T':'#0369a1','GTTOQA_T':'#059669',
    'GTBRAND_T':'#b45309','GTIQA_T':'#0e7490','GTTLLI_T':'#7c3aed',
    'GTTRES_T':'#be123c','GTBKIPBE_T':'#15803d','GTREEL_T':'#1d4ed8',
    'GTBKLDBE_T':'#9333ea','GTBKULBE_T':'#c026d3','GTTRANS_T':'#0369a1',
    'GTTERASE_T':'#dc2626','GTLPI_T':'#ea580c','GTCARIER_T':'#16a34a',
    'GTARCH_T':'#64748b','GTTSORT_T':'#6d28d9','GTBATCH_T':'#0f172a',
};
function StationBadge({station}){const c=SC[station]||'#64748b';return<span style={{display:'inline-block',padding:'2px 8px',borderRadius:6,fontSize:10,fontWeight:700,background:c+'18',color:c,border:`1px solid ${c}33`}}>{station}</span>;}
function PkgBadge({pkg}){if(!pkg)return<span style={{color:'#cbd5e1'}}>—</span>;return<span style={{fontSize:10,fontWeight:600,color:'#475569',background:'#f1f5f9',padding:'2px 6px',borderRadius:4,border:'1px solid #e2e8f0'}}>{pkg}</span>;}

const TH={background:'#0e2841',color:'#fff',padding:'8px 10px',fontSize:11,fontWeight:700,textAlign:'left',whiteSpace:'nowrap'};
const THR={background:'#0e2841',color:'#fff',padding:'8px 10px',fontSize:11,fontWeight:700,textAlign:'right',whiteSpace:'nowrap'};
const TD={padding:'7px 10px',borderBottom:'1px solid #e2e8f0'};
const TDR={padding:'7px 10px',borderBottom:'1px solid #e2e8f0',textAlign:'right',fontVariantNumeric:'tabular-nums'};

/* ─── helpers ──────────────────────────────────────────────────── */
function fmtM(n) { return n==null||n===0?'—':n>=1e6?(n/1e6).toFixed(2)+'M':n>=1e3?(n/1e3).toFixed(0)+'K':String(n); }
function fmtPct(n) { return n==null?'—':Number(n).toFixed(1)+'%'; }
const FC = { F1:'#1e5fa8', F2:'#059669', F3:'#7c3aed', Unknown:'#64748b' };
function FactoryBadge({f}){const c=FC[f]||'#64748b';return<span style={{display:'inline-block',padding:'2px 6px',borderRadius:6,fontSize:10,fontWeight:700,background:c+'18',color:c,border:`1px solid ${c}33`}}>{f||'?'}</span>;}
function pctColor(p){return p>=100?'#16a34a':p>=75?'#d97706':'#dc2626';}
function pctBg(p){return p>=100?'#dcfce7':p>=75?'#fef9c3':'#fee2e2';}

const TWH={background:'#0e2841',color:'#fff',padding:'7px 8px',fontSize:10,fontWeight:700,textAlign:'right',whiteSpace:'nowrap',borderRight:'1px solid #1e3a5f'};
const TWHL={...TWH,textAlign:'left'};
const TWGH={background:'#1e3a5f',color:'#93c5fd',padding:'5px 8px',fontSize:9,fontWeight:700,textAlign:'center',letterSpacing:'.06em',textTransform:'uppercase',borderRight:'1px solid #0e2841'};
const TWD={padding:'6px 8px',borderBottom:'1px solid #f1f5f9',fontSize:11,textAlign:'right',borderRight:'1px solid #f1f5f9',fontVariantNumeric:'tabular-nums'};
const TWDL={...TWD,textAlign:'left'};

/* ─── WIP summary table ─────────────────────────────────────────── */
function WipSummaryTable({wipRows, wipLoading}){
    const [facFilter, setFacFilter] = useState('');
    if(wipLoading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Loading WIP Summary…</div>;
    if(!wipRows||wipRows.length===0) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>No data — select a date and upload a CSV</div>;

    const filtered = facFilter ? wipRows.filter(r=>r.factory===facFilter) : wipRows;
    const factories = [...new Set(wipRows.map(r=>r.factory))].sort();
    const grand = (key) => filtered.reduce((s,r)=>s+(r[key]||0),0);
    const grandTotalCommit = grand('total_commit');
    const grandFgOut = grand('fg_out');

    return(
        <div>
            <div style={{display:'flex',gap:3,alignItems:'center',marginBottom:12,flexWrap:'wrap'}}>
                {['','F1','F2','F3'].map(f=>(
                    <button key={f} onClick={()=>setFacFilter(f)}
                        style={{
                            padding:'7px 18px',borderRadius:'8px 8px 0 0',border:'none',
                            fontSize:12,fontWeight:700,cursor:'pointer',transition:'all .15s',
                            background:facFilter===f?(FC[f]||'#0e2841'):'#e2e8f0',
                            color:facFilter===f?'#fff':'#64748b',
                        }}>
                        {f||'All Factories'}
                    </button>
                ))}
            </div>
            <div style={{overflowX:'auto',borderRadius:12,boxShadow:'0 1px 4px rgba(14,40,65,.08)',border:'1px solid #e2e8f0'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                    <thead>
                        <tr>
                            <th style={{...TWHL,verticalAlign:'middle'}} rowSpan={2}>Factory</th>
                            <th style={{...TWHL,verticalAlign:'middle'}} rowSpan={2}>Package</th>
                            <th style={{...TWGH}} colSpan={2}>6AM Starting WIP</th>
                            <th style={{...TWGH}} colSpan={2}>6AM Processable WIP</th>
                            <th style={{...TWGH}} colSpan={2}>Pull In</th>
                            <th style={{...TWGH}} colSpan={3}>TNR Commit</th>
                            <th style={{...TWGH}} colSpan={2}>Pipeline</th>
                            <th style={{...TWGH,background:'#1e4620',color:'#86efac'}}>Total Commit</th>
                            <th style={{...TWGH,background:'#1e4620',color:'#86efac'}}>FG Out</th>
                            <th style={{...TWGH,background:'#7f1d1d',color:'#fca5a5'}}>Delta</th>
                            <th style={{...TWGH}} colSpan={2}>Left at Pipeline</th>
                            <th style={{...TWGH,background:'#1e3a1e',color:'#86efac'}}>%</th>
                        </tr>
                        <tr>
                            <th style={TWH}>Lots</th><th style={TWH}>Qty</th>
                            <th style={TWH}>Lots</th><th style={TWH}>Qty</th>
                            <th style={TWH}>Lots</th><th style={TWH}>Qty</th>
                            <th style={TWH}>Lots</th><th style={TWH}>Qty</th>
                            <th style={{...TWH,color:'#fde68a'}}>+Pull In</th>
                            <th style={TWH}>Lots</th><th style={TWH}>Qty</th>
                            <th style={{...TWH,background:'#14532d',color:'#86efac'}}>Qty</th>
                            <th style={{...TWH,background:'#14532d',color:'#86efac'}}>Qty</th>
                            <th style={{...TWH,background:'#7f1d1d',color:'#fca5a5'}}>Qty</th>
                            <th style={TWH}>Lots</th><th style={TWH}>Qty</th>
                            <th style={{...TWH,background:'#14532d',color:'#86efac'}}>Att%</th>
                        </tr>
                    </thead>
                    <tbody>
                        {factories.filter(f=>!facFilter||f===facFilter).map(fac=>{
                            const facRows=filtered.filter(r=>r.factory===fac);
                            const sub=(key)=>facRows.reduce((s,r)=>s+(r[key]||0),0);
                            const subTC=sub('total_commit'), subFG=sub('fg_out');
                            return[
                                <tr key={`fac-${fac}`} style={{background:'#f8fafc'}}>
                                    <td colSpan={19} style={{...TWDL,fontWeight:700,fontSize:11,color:FC[fac]||'#0e2841',padding:'6px 10px',borderBottom:'2px solid #e2e8f0'}}>
                                        <FactoryBadge f={fac}/> {fac}
                                    </td>
                                </tr>,
                                ...facRows.map((r,i)=>{
                                    const att=r.attainment_pct;
                                    return(
                                        <tr key={`${fac}-${r.package_name}`} style={{background:i%2===0?'#fff':'#f8fafc'}}>
                                            <td style={TWDL}><FactoryBadge f={r.factory}/></td>
                                            <td style={{...TWDL,fontWeight:600,color:'#0e2841'}}>{r.package_name||'—'}</td>
                                            <td style={TWD}>{fmt(r.wip_lots)}</td>
                                            <td style={TWD}>{fmt(r.wip_qty)}</td>
                                            <td style={TWD}>{fmt(r.proc_lots)}</td>
                                            <td style={TWD}>{fmt(r.proc_qty)}</td>
                                            <td style={TWD}>{fmt(r.pull_in_lots)}</td>
                                            <td style={TWD}>{fmt(r.pull_in_qty)}</td>
                                            <td style={TWD}>{fmt(r.tnr_commit_lots)}</td>
                                            <td style={TWD}>{fmt(r.tnr_commit_qty)}</td>
                                            <td style={{...TWD,color:'#d97706',fontWeight:600}}>{fmt(r.total_tnr_commit)}</td>
                                            <td style={TWD}>{fmt(r.pipeline_lots)}</td>
                                            <td style={TWD}>{fmt(r.pipeline_qty)}</td>
                                            <td style={{...TWD,fontWeight:700,color:'#166534'}}>{fmt(r.total_commit)}</td>
                                            <td style={{...TWD,fontWeight:700,color:'#059669'}}>{fmt(r.fg_out)}</td>
                                            <td style={{...TWD,fontWeight:700,color:r.delta>=0?'#16a34a':'#dc2626'}}>{r.delta>=0?'+':''}{fmt(r.delta)}</td>
                                            <td style={TWD}>{fmt(r.left_pipeline_lots)}</td>
                                            <td style={TWD}>{fmt(r.left_pipeline_qty)}</td>
                                            <td style={TWD}><span style={{background:pctBg(att),color:pctColor(att),padding:'2px 6px',borderRadius:99,fontSize:10,fontWeight:700}}>{fmtPct(att)}</span></td>
                                        </tr>
                                    );
                                }),
                                <tr key={`sub-${fac}`} style={{background:'#f1f5f9',fontWeight:700}}>
                                    <td style={{...TWDL,color:FC[fac]||'#0e2841'}} colSpan={2}>Subtotal {fac}</td>
                                    <td style={TWD}>{fmt(sub('wip_lots'))}</td><td style={TWD}>{fmt(sub('wip_qty'))}</td>
                                    <td style={TWD}>{fmt(sub('proc_lots'))}</td><td style={TWD}>{fmt(sub('proc_qty'))}</td>
                                    <td style={TWD}>{fmt(sub('pull_in_lots'))}</td><td style={TWD}>{fmt(sub('pull_in_qty'))}</td>
                                    <td style={TWD}>{fmt(sub('tnr_commit_lots'))}</td><td style={TWD}>{fmt(sub('tnr_commit_qty'))}</td>
                                    <td style={{...TWD,color:'#d97706'}}>{fmt(sub('total_tnr_commit'))}</td>
                                    <td style={TWD}>{fmt(sub('pipeline_lots'))}</td><td style={TWD}>{fmt(sub('pipeline_qty'))}</td>
                                    <td style={{...TWD,color:'#166534'}}>{fmt(subTC)}</td>
                                    <td style={{...TWD,color:'#059669'}}>{fmt(subFG)}</td>
                                    <td style={{...TWD,color:subFG-subTC>=0?'#16a34a':'#dc2626'}}>{subFG-subTC>=0?'+':''}{fmt(subFG-subTC)}</td>
                                    <td style={TWD}>{fmt(sub('left_pipeline_lots'))}</td><td style={TWD}>{fmt(sub('left_pipeline_qty'))}</td>
                                    <td style={TWD}>{subTC>0?<span style={{background:pctBg(subFG/subTC*100),color:pctColor(subFG/subTC*100),padding:'2px 6px',borderRadius:99,fontSize:10,fontWeight:700}}>{(subFG/subTC*100).toFixed(1)}%</span>:'—'}</td>
                                </tr>,
                            ];
                        })}
                    </tbody>
                    <tfoot>
                        <tr style={{background:'#0e2841',color:'#fff',fontWeight:800}}>
                            <td style={{...TWDL,color:'#fff',fontSize:12}} colSpan={2}>GRAND TOTAL</td>
                            <td style={{...TWD,color:'#fff'}}>{fmt(grand('wip_lots'))}</td><td style={{...TWD,color:'#fff'}}>{fmt(grand('wip_qty'))}</td>
                            <td style={{...TWD,color:'#fff'}}>{fmt(grand('proc_lots'))}</td><td style={{...TWD,color:'#fff'}}>{fmt(grand('proc_qty'))}</td>
                            <td style={{...TWD,color:'#fff'}}>{fmt(grand('pull_in_lots'))}</td><td style={{...TWD,color:'#fff'}}>{fmt(grand('pull_in_qty'))}</td>
                            <td style={{...TWD,color:'#fff'}}>{fmt(grand('tnr_commit_lots'))}</td><td style={{...TWD,color:'#fff'}}>{fmt(grand('tnr_commit_qty'))}</td>
                            <td style={{...TWD,color:'#fde68a'}}>{fmt(grand('total_tnr_commit'))}</td>
                            <td style={{...TWD,color:'#fff'}}>{fmt(grand('pipeline_lots'))}</td><td style={{...TWD,color:'#fff'}}>{fmt(grand('pipeline_qty'))}</td>
                            <td style={{...TWD,color:'#86efac'}}>{fmt(grandTotalCommit)}</td>
                            <td style={{...TWD,color:'#86efac'}}>{fmt(grandFgOut)}</td>
                            <td style={{...TWD,color:grandFgOut-grandTotalCommit>=0?'#86efac':'#fca5a5'}}>{grandFgOut-grandTotalCommit>=0?'+':''}{fmt(grandFgOut-grandTotalCommit)}</td>
                            <td style={{...TWD,color:'#fff'}}>{fmt(grand('left_pipeline_lots'))}</td><td style={{...TWD,color:'#fff'}}>{fmt(grand('left_pipeline_qty'))}</td>
                            <td style={{...TWD,color:'#86efac'}}>{grandTotalCommit>0?(grandFgOut/grandTotalCommit*100).toFixed(1)+'%':'—'}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}

/* ─── old summary table (station breakdown) — kept for reference ── */
function SummaryTable({summary}){
    if(!summary) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Loading summary…</div>;
    const cats=[
        {label:'F1 Pipeline', color:'#7c3aed', lk:'f1_pipe_lots', qk:'f1_pipe_qty', ck:null},
        {label:'F2 Pipeline', color:'#0369a1', lk:'f2_pipe_lots', qk:'f2_pipe_qty', ck:null},
        {label:'F1 Stations', color:'#059669', lk:'f1_lots',      qk:'f1_qty',      ck:'f1_commit'},
        {label:'F2 Stations', color:'#dc2626', lk:'f2_lots',      qk:'f2_qty',      ck:'f2_commit'},
        {label:'RES F1',      color:'#be123c', lk:'res_f1_lots',  qk:'res_f1_qty',  ck:null},
        {label:'RES F2',      color:'#9f1239', lk:'res_f2_lots',  qk:'res_f2_qty',  ck:null},
        {label:'LLI/LPI',     color:'#0e7490', lk:'lli_lots',     qk:'lli_qty',     ck:null},
        {label:'Sorting',     color:'#6d28d9', lk:'sort_lots',    qk:'sort_qty',    ck:null},
        {label:'Bake',        color:'#b45309', lk:'bake_lots',    qk:'bake_qty',    ck:null},
    ];
    const totals={};
    cats.forEach(c=>{
        totals[c.lk]=summary.by_station.reduce((s,r)=>s+(parseInt(r[c.lk])||0),0);
        totals[c.qk]=summary.by_station.reduce((s,r)=>s+(parseInt(r[c.qk])||0),0);
        if(c.ck) totals[c.ck]=summary.by_station.reduce((s,r)=>s+(parseInt(r[c.ck])||0),0);
    });
    const grandLots=summary.by_station.reduce((s,r)=>s+(parseInt(r.total_lots)||0),0);
    const grandQty =summary.by_station.reduce((s,r)=>s+(parseInt(r.total_qty) ||0),0);

    // Sub-header row for Lots/Qty/Commit labels
    const subCols=cats.flatMap(c=>c.ck?['Lots','Qty','Commit']:['Lots','Qty']);

    return(
        <div style={{display:'flex',flexDirection:'column',gap:16}}>

            {/* Pipeline breakdown */}
            <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px rgba(14,40,65,.06)'}}>
                <div style={{padding:'10px 16px',background:'#0e2841',color:'#ffd080',fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em'}}>
                    Pipeline — GTTFVI_T · GTTBOX_T · GTTOQA_T
                </div>
                <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                        <thead>
                            <tr>
                                <th style={TH}>Station</th>
                                <th style={{...TH,textAlign:'right'}}>Total Lots</th>
                                <th style={{...TH,textAlign:'right'}}>Total Qty</th>
                                <th style={{...TH,textAlign:'right',color:'#c4b5fd'}}>F1 Lots</th>
                                <th style={{...TH,textAlign:'right',color:'#c4b5fd'}}>F1 Qty</th>
                                <th style={{...TH,textAlign:'right',color:'#93c5fd'}}>F2 Lots</th>
                                <th style={{...TH,textAlign:'right',color:'#93c5fd'}}>F2 Qty</th>
                                <th style={{...TH,textAlign:'right',color:'#94a3b8'}}>Unclass Lots</th>
                                <th style={{...TH,textAlign:'right',color:'#94a3b8'}}>Unclass Qty</th>
                            </tr>
                        </thead>
                        <tbody>
                            {summary.pipeline.map((r,i)=>(
                                <tr key={i} style={{background:i%2===0?'#f8fafc':'#fff'}}>
                                    <td style={TD}><StationBadge station={r.Station}/></td>
                                    <td style={{...TDR,fontWeight:700}}>{fmt(r.total_lots)}</td>
                                    <td style={{...TDR,fontWeight:700}}>{fmt(r.total_qty)}</td>
                                    <td style={{...TDR,color:'#7c3aed'}}>{fmtN(r.f1_lots)}</td>
                                    <td style={{...TDR,color:'#7c3aed'}}>{fmtN(r.f1_qty)}</td>
                                    <td style={{...TDR,color:'#0369a1'}}>{fmtN(r.f2_lots)}</td>
                                    <td style={{...TDR,color:'#0369a1'}}>{fmtN(r.f2_qty)}</td>
                                    <td style={{...TDR,color:'#94a3b8'}}>{fmtN(r.unclass_lots)}</td>
                                    <td style={{...TDR,color:'#94a3b8'}}>{fmtN(r.unclass_qty)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr style={{background:'#f1f5f9'}}>
                                <td style={{...TD,fontWeight:700,color:'#0e2841'}}>TOTAL</td>
                                <td style={{...TDR,fontWeight:800}}>{fmt(summary.pipeline.reduce((s,r)=>s+r.total_lots,0))}</td>
                                <td style={{...TDR,fontWeight:800}}>{fmt(summary.pipeline.reduce((s,r)=>s+r.total_qty,0))}</td>
                                <td style={{...TDR,fontWeight:800,color:'#7c3aed'}}>{fmt(summary.pipeline.reduce((s,r)=>s+r.f1_lots,0))}</td>
                                <td style={{...TDR,fontWeight:800,color:'#7c3aed'}}>{fmt(summary.pipeline.reduce((s,r)=>s+r.f1_qty,0))}</td>
                                <td style={{...TDR,fontWeight:800,color:'#0369a1'}}>{fmt(summary.pipeline.reduce((s,r)=>s+r.f2_lots,0))}</td>
                                <td style={{...TDR,fontWeight:800,color:'#0369a1'}}>{fmt(summary.pipeline.reduce((s,r)=>s+r.f2_qty,0))}</td>
                                <td style={{...TDR,fontWeight:800,color:'#94a3b8'}}>{fmt(summary.pipeline.reduce((s,r)=>s+r.unclass_lots,0))}</td>
                                <td style={{...TDR,fontWeight:800,color:'#94a3b8'}}>{fmt(summary.pipeline.reduce((s,r)=>s+r.unclass_qty,0))}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Per-station breakdown */}
            <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px rgba(14,40,65,.06)'}}>
                <div style={{padding:'10px 16px',background:'#0e2841',color:'#ffd080',fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em'}}>
                    All Stations — Lots · Qty · Commit Breakdown
                </div>
                <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                        <thead>
                            {/* Category header row */}
                            <tr>
                                <th style={{...TH,rowSpan:2}} rowSpan={2}>Station</th>
                                <th style={{...TH,textAlign:'right',rowSpan:2}} rowSpan={2}>Total<br/>Lots</th>
                                <th style={{...TH,textAlign:'right',rowSpan:2}} rowSpan={2}>Total<br/>Qty</th>
                                {cats.map(c=>(
                                    <th key={c.label} colSpan={c.ck?3:2}
                                        style={{...TH,textAlign:'center',color:c.color,borderLeft:'2px solid #1e3a5f'}}>
                                        {c.label}
                                    </th>
                                ))}
                            </tr>
                            {/* Sub-header: Lots / Qty / Commit */}
                            <tr>
                                {cats.map(c=>[
                                    <th key={c.label+'_l'} style={{...TH,textAlign:'right',fontSize:10,borderLeft:'2px solid #1e3a5f',color:c.color}}>Lots</th>,
                                    <th key={c.label+'_q'} style={{...TH,textAlign:'right',fontSize:10,color:c.color}}>Qty</th>,
                                    ...(c.ck?[<th key={c.label+'_c'} style={{...TH,textAlign:'right',fontSize:10,color:'#4ade80'}}>Commit</th>]:[])
                                ])}
                            </tr>
                        </thead>
                        <tbody>
                            {summary.by_station.map((r,i)=>(
                                <tr key={i} style={{background:i%2===0?'#f8fafc':'#fff'}}>
                                    <td style={TD}><StationBadge station={r.Station}/></td>
                                    <td style={{...TDR,fontWeight:700}}>{fmt(r.total_lots)}</td>
                                    <td style={{...TDR,fontWeight:700}}>{fmt(r.total_qty)}</td>
                                    {cats.map(c=>[
                                        <td key={c.label+'_l'} style={{...TDR,color:parseInt(r[c.lk])>0?c.color:'#cbd5e1',borderLeft:'2px solid #f1f5f9'}}>
                                            {fmtN(r[c.lk])}
                                        </td>,
                                        <td key={c.label+'_q'} style={{...TDR,color:parseInt(r[c.qk])>0?c.color:'#cbd5e1'}}>
                                            {fmtN(r[c.qk])}
                                        </td>,
                                        ...(c.ck?[
                                            <td key={c.label+'_c'} style={{...TDR,color:r[c.ck]>0?'#15803d':'#cbd5e1',fontWeight:r[c.ck]>0?700:400}}>
                                                {fmtN(r[c.ck])}
                                            </td>
                                        ]:[])
                                    ])}
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr style={{background:'#f1f5f9'}}>
                                <td style={{...TD,fontWeight:700,color:'#0e2841'}}>TOTAL</td>
                                <td style={{...TDR,fontWeight:800}}>{fmt(grandLots)}</td>
                                <td style={{...TDR,fontWeight:800}}>{fmt(grandQty)}</td>
                                {cats.map(c=>[
                                    <td key={c.label+'_l'} style={{...TDR,fontWeight:800,color:c.color,borderLeft:'2px solid #e2e8f0'}}>{fmt(totals[c.lk])}</td>,
                                    <td key={c.label+'_q'} style={{...TDR,fontWeight:800,color:c.color}}>{fmt(totals[c.qk])}</td>,
                                    ...(c.ck?[<td key={c.label+'_c'} style={{...TDR,fontWeight:800,color:'#15803d'}}>{fmt(totals[c.ck])}</td>]:[])
                                ])}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}

/* ─── section table ────────────────────────────────────────────── */
function SectionTable({title,color,rows,showBake,showCommit}){
    const [search,setSearch]=useState('');
    const [stationFilter,setStationFilter]=useState('');
    const [pkgFilter,setPkgFilter]=useState('');

    const stations=[...new Set((rows||[]).map(r=>r.Station))].sort();
    const packages=[...new Set((rows||[]).map(r=>r.Package_Name).filter(Boolean))].sort();

    const filtered=(rows||[]).filter(r=>{
        const q=search.toLowerCase();
        return(!q||r.Lot_Id?.toLowerCase().includes(q)||r.Part_Name?.toLowerCase().includes(q)||r.Focus_Group?.toLowerCase().includes(q))
            &&(!stationFilter||r.Station===stationFilter)
            &&(!pkgFilter||r.Package_Name===pkgFilter);
    });

    const totalQty   =filtered.reduce((s,r)=>s+(parseInt(r.Qty)||0),0);
    const totalCommit=showCommit?filtered.reduce((s,r)=>s+(r.commit||0),0):0;

    return(
        <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,boxShadow:'0 1px 4px rgba(14,40,65,.06)',overflow:'hidden',marginBottom:16}}>
            <div style={{padding:'12px 16px',background:color,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
                <div style={{fontSize:12,fontWeight:700,color:'#fff',textTransform:'uppercase',letterSpacing:'.06em'}}>
                    {title}
                    <span style={{marginLeft:10,background:'rgba(255,255,255,.2)',padding:'2px 8px',borderRadius:99,fontSize:11}}>{filtered.length} lots</span>
                    {showCommit&&<span style={{marginLeft:8,background:'rgba(255,255,255,.15)',padding:'2px 8px',borderRadius:99,fontSize:11}}>Commit: {fmt(totalCommit)}</span>}
                </div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    <input placeholder="Search lot / part…" value={search} onChange={e=>setSearch(e.target.value)}
                        style={{fontSize:12,padding:'5px 10px',borderRadius:7,border:'1px solid rgba(255,255,255,.3)',background:'rgba(255,255,255,.15)',color:'#fff',outline:'none',width:180}}/>
                    {stations.length>1&&<select value={stationFilter} onChange={e=>setStationFilter(e.target.value)}
                        style={{fontSize:12,padding:'5px 8px',borderRadius:7,border:'1px solid rgba(255,255,255,.3)',background:'rgba(255,255,255,.15)',color:'#fff',outline:'none'}}>
                        <option value="">All Stations</option>
                        {stations.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>}
                    {packages.length>1&&<select value={pkgFilter} onChange={e=>setPkgFilter(e.target.value)}
                        style={{fontSize:12,padding:'5px 8px',borderRadius:7,border:'1px solid rgba(255,255,255,.3)',background:'rgba(255,255,255,.15)',color:'#fff',outline:'none'}}>
                        <option value="">All Packages</option>
                        {packages.map(p=><option key={p} value={p}>{p}</option>)}
                    </select>}
                </div>
            </div>
            {filtered.length===0?(
                <div style={{padding:32,textAlign:'center',color:'#94a3b8',fontSize:13}}>No lots found</div>
            ):(
                <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                        <thead><tr>
                            <th style={TH}>#</th><th style={TH}>Lot ID</th><th style={TH}>Part Name</th>
                            <th style={TH}>Focus Group</th><th style={TH}>Package</th><th style={TH}>Station</th>
                            <th style={{...TH,textAlign:'right'}}>Qty</th>
                            {showCommit&&<th style={{...TH,textAlign:'right'}}>Recipe</th>}
                            {showCommit&&<th style={{...TH,textAlign:'right'}}>Commit</th>}
                            {showBake&&<th style={TH}>Bake</th>}
                            <th style={TH}>Status</th>
                        </tr></thead>
                        <tbody>
                            {filtered.map((r,i)=>{
                                const st=statusBg(r.Lot_Status);
                                return(
                                    <tr key={i} style={{background:i%2===0?'#f8fafc':'#fff'}}>
                                        <td style={TD}><span style={{color:'#94a3b8',fontSize:11}}>{i+1}</span></td>
                                        <td style={TD}><b style={{color:'#0e2841'}}>{r.Lot_Id}</b></td>
                                        <td style={TD}>{r.Part_Name}</td>
                                        <td style={{...TD,color:'#475569'}}>{r.Focus_Group}</td>
                                        <td style={TD}><PkgBadge pkg={r.Package_Name}/></td>
                                        <td style={TD}><StationBadge station={r.Station}/></td>
                                        <td style={{...TDR,fontWeight:600}}>{r.Qty?fmt(r.Qty):'—'}</td>
                                        {showCommit&&<td style={{...TDR,color:'#64748b',fontSize:11}}>{r.recipe!=null?fmt(r.recipe):<span style={{color:'#cbd5e1'}}>—</span>}</td>}
                                        {showCommit&&<td style={{...TDR,fontWeight:700}}>{r.commit!=null?<span style={{color:'#15803d'}}>{fmt(r.commit)}</span>:<span style={{color:'#cbd5e1'}}>—</span>}</td>}
                                        {showBake&&<td style={TD}><span style={{background:'#fef9c3',color:'#854d0e',padding:'2px 8px',borderRadius:99,fontSize:10,fontWeight:700}}>{r.Bake||'—'}</span></td>}
                                        <td style={TD}><span style={{background:st.bg,color:st.color,padding:'2px 8px',borderRadius:99,fontSize:10,fontWeight:700}}>{r.Lot_Status||'—'}</span></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        {showCommit&&<tfoot><tr style={{background:'#f1f5f9'}}>
                            <td colSpan={6} style={{...TD,fontWeight:700,color:'#0e2841'}}>TOTAL</td>
                            <td style={{...TDR,fontWeight:700}}>{fmt(totalQty)}</td>
                            <td style={TD}></td>
                            <td style={{...TDR,fontWeight:800,color:'#15803d',fontSize:13}}>{fmt(totalCommit)}</td>
                            <td style={TD}></td>
                        </tr></tfoot>}
                    </table>
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function LoadingPlan(){
    const [data,setData]=useState(null);
    const [summary,setSummary]=useState(null);
    const [wipRows,setWipRows]=useState([]);
    const [wipLoading,setWipLoading]=useState(false);
    const [loading,setLoading]=useState(false);
    const [uploading,setUploading]=useState(false);
    const [uploadMsg,setUploadMsg]=useState(null);
    const [activeTab,setActiveTab]=useState('summary');
    const [dateFilter,setDateFilter]=useState('');

    const load=useCallback(async()=>{
        setLoading(true);
        setWipLoading(true);
        try{
            const params = dateFilter ? { date: dateFilter } : {};
            const [dr,sr,wr]=await Promise.all([
                api.get('/loading-plan/data', { params }),
                api.get('/loading-plan/summary', { params }),
                api.get('/loading-plan/wip-summary', { params }),
            ]);
            setData(dr.data);
            setSummary(sr.data);
            setWipRows(wr.data||[]);
        }catch(_){}
        finally{ setLoading(false); setWipLoading(false); }
    },[dateFilter]);

    useEffect(()=>{load();},[load]);

    const handleUpload=async(e)=>{
        const file=e.target.files?.[0]; if(!file)return;
        setUploading(true); setUploadMsg(null);
        const fd=new FormData(); fd.append('file',file);
        try{
            const res=await api.post('/loading-plan/upload',fd,{headers:{'Content-Type':'multipart/form-data'}});
            setUploadMsg({type:'success',text:`✓ Uploaded — ${res.data.inserted} rows inserted, ${res.data.skipped} skipped`});
            await load();
        }catch(err){setUploadMsg({type:'error',text:err?.response?.data?.error||'Upload failed'});}
        finally{setUploading(false);e.target.value='';}
    };

    const TABS=[
        {key:'summary',    label:'📊 Summary',  color:'#0e2841'},
        {key:'f1_pipeline',label:'F1 Pipeline', color:'#7c3aed'},
        {key:'f2_pipeline',label:'F2 Pipeline', color:'#0369a1'},
        {key:'f1',         label:'F1 Stations', color:'#059669'},
        {key:'f2',         label:'F2 Stations', color:'#dc2626'},
        {key:'res_f1',     label:'RES F1',      color:'#be123c'},
        {key:'res_f2',     label:'RES F2',      color:'#9f1239'},
        {key:'sorting',    label:'Sorting',     color:'#6d28d9'},
        {key:'lli_lpi',    label:'LLI / LPI',  color:'#0e7490'},
        {key:'bake',       label:'Bake',        color:'#b45309'},
    ];

    const TAB_DATA={
        f1_pipeline:{rows:data?.f1_pipeline,title:'F1 Pipeline — GTTFVI_T · GTTBOX_T · GTTOQA_T (PL1)',color:'#7c3aed',showBake:false,showCommit:false},
        f2_pipeline:{rows:data?.f2_pipeline,title:'F2 Pipeline — GTTFVI_T · GTTBOX_T · GTTOQA_T (PL6)',color:'#0369a1',showBake:false,showCommit:false},
        f1:         {rows:data?.f1,         title:'F1 Stations (PL1)',                                  color:'#059669',showBake:false,showCommit:true},
        f2:         {rows:data?.f2,         title:'F2 Stations (PL6)',                                  color:'#dc2626',showBake:false,showCommit:true},
        res_f1:     {rows:data?.res_f1,     title:'RES F1 — GTTRES_T (PL1)',                           color:'#be123c',showBake:false,showCommit:false},
        res_f2:     {rows:data?.res_f2,     title:'RES F2 — GTTRES_T (PL6)',                           color:'#9f1239',showBake:false,showCommit:false},
        sorting:    {rows:data?.sorting,    title:'Sorting — GTTSORT_T',                               color:'#6d28d9',showBake:false,showCommit:false},
        lli_lpi:    {rows:data?.lli_lpi,    title:'LLI / LPI — GTTLLI_T · GTLPI_T',                  color:'#0e7490',showBake:false,showCommit:false},
        bake:       {rows:data?.bake,       title:'Bake — For Bake',                                   color:'#b45309',showBake:true, showCommit:false},
    };

    return(
        <div style={{padding:'0 0 48px'}}>
            {/* Header */}
            <div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'flex-end',background:'#fff',border:'1px solid #e2e8f0',borderRadius:10,padding:'12px 16px',marginBottom:16,boxShadow:'0 1px 3px rgba(14,40,65,.05)'}}>
                <div>
                    <span style={{fontSize:10,fontWeight:600,color:'#64748b',textTransform:'uppercase',letterSpacing:'.06em',display:'block',marginBottom:4}}>Upload CSV</span>
                    <label style={{display:'inline-flex',alignItems:'center',gap:8,padding:'7px 16px',borderRadius:7,border:'1px solid #cbd5e1',background:uploading?'#f1f5f9':'#0e2841',color:uploading?'#94a3b8':'#fff',fontSize:13,fontWeight:600,cursor:uploading?'not-allowed':'pointer'}}>
                        {uploading?'⏳ Uploading…':'↑ Upload telford_backend_wip.csv'}
                        <input type="file" accept=".csv,.txt" onChange={handleUpload} disabled={uploading} style={{display:'none'}}/>
                    </label>
                </div>
                {uploadMsg&&<div style={{padding:'7px 14px',borderRadius:7,fontSize:12,fontWeight:600,background:uploadMsg.type==='success'?'#dcfce7':'#fee2e2',color:uploadMsg.type==='success'?'#166534':'#dc2626',border:`1px solid ${uploadMsg.type==='success'?'#86efac':'#fca5a5'}`}}>{uploadMsg.text}</div>}

                {/* Date filter */}
                <div>
                    <span style={{fontSize:10,fontWeight:600,color:'#64748b',textTransform:'uppercase',letterSpacing:'.06em',display:'block',marginBottom:4}}>Date Loaded</span>
                    <div style={{display:'flex',gap:6,alignItems:'center'}}>
                        <input type="date" value={dateFilter} onChange={e=>{setDateFilter(e.target.value);}}
                            style={{fontSize:13,padding:'7px 10px',borderRadius:7,border:'1px solid #cbd5e1',color:'#1e293b',background:'#f8fafc',outline:'none'}}/>
                        {dateFilter&&<button onClick={()=>setDateFilter('')}
                            style={{padding:'7px 10px',borderRadius:7,border:'1px solid #cbd5e1',background:'#fee2e2',color:'#dc2626',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                            ✕ Clear
                        </button>}
                    </div>
                </div>
                {data?.meta?.uploaded_at&&<div style={{fontSize:11,color:'#94a3b8',marginLeft:'auto',alignSelf:'center'}}>Last upload: {data.meta.uploaded_at} &nbsp;·&nbsp; {data.meta.total} rows</div>}
                <button onClick={load} disabled={loading} style={{padding:'7px 16px',borderRadius:7,border:'1px solid #cbd5e1',background:'#fff',fontSize:13,cursor:'pointer',color:'#0e2841',fontWeight:600}}>{loading?'…':'↻ Refresh'}</button>
            </div>

            {/* KPI strip */}
            {data&&(
                <div style={{display:'grid',gridTemplateColumns:'repeat(9,1fr)',gap:6,marginBottom:16}}>
                    {TABS.filter(t=>t.key!=='summary').map((t,i)=>{
                        const rows   = data?.[t.key] || [];
                        const lots   = rows.length;
                        const qty    = rows.reduce((s,r)=>s+(parseInt(r.Qty)||0),0);
                        const commit = (t.key==='f1'||t.key==='f2')
                            ? rows.reduce((s,r)=>s+(r.commit||0),0)
                            : null;
                        const active = activeTab===t.key;
                        const fg     = active?'rgba(255,255,255,.7)':'#94a3b8';
                        const vg     = active?'#fff':t.color;
                        return(
                            <div key={i} onClick={()=>setActiveTab(t.key)}
                                style={{background:active?t.color:'#fff',border:`1px solid ${active?t.color:'#e2e8f0'}`,borderRadius:10,padding:'10px 10px 8px',boxShadow:'0 1px 3px rgba(14,40,65,.05)',cursor:'pointer',transition:'all .15s'}}>
                                <div style={{fontSize:9,fontWeight:700,color:active?'rgba(255,255,255,.85)':'#64748b',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>{t.label}</div>
                                {/* Lots */}
                                <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:2}}>
                                    <span style={{fontSize:9,color:fg}}>Lots</span>
                                    <span style={{fontSize:15,fontWeight:800,color:vg}}>{fmt(lots)}</span>
                                </div>
                                {/* Qty */}
                                <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:2}}>
                                    <span style={{fontSize:9,color:fg}}>Qty</span>
                                    <span style={{fontSize:11,fontWeight:700,color:active?'rgba(255,255,255,.9)':t.color}}>{fmtM(qty)}</span>
                                </div>
                                {/* Commit — only for F1/F2 stations */}
                                {commit!==null&&(
                                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginTop:4,paddingTop:4,borderTop:`1px solid ${active?'rgba(255,255,255,.2)':'#e2e8f0'}`}}>
                                        <span style={{fontSize:9,color:fg}}>Commit</span>
                                        <span style={{fontSize:11,fontWeight:800,color:active?'#a7f3d0':'#15803d'}}>{fmtM(commit)}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Tabs */}
            <div style={{display:'flex',gap:3,marginBottom:12,flexWrap:'wrap'}}>
                {TABS.map(t=>(
                    <button key={t.key} onClick={()=>setActiveTab(t.key)}
                        style={{padding:'8px 16px',borderRadius:'8px 8px 0 0',border:'none',fontSize:12,fontWeight:700,cursor:'pointer',transition:'all .15s',background:activeTab===t.key?t.color:'#e2e8f0',color:activeTab===t.key?'#fff':'#64748b'}}>
                        {t.label}
                        {data&&t.key!=='summary'&&<span style={{marginLeft:6,background:activeTab===t.key?'rgba(255,255,255,.25)':'#cbd5e1',padding:'1px 6px',borderRadius:99,fontSize:10}}>{data?.[t.key]?.length||0}</span>}
                    </button>
                ))}
            </div>

            {/* Content */}
            {loading?(
                <div style={{padding:40,textAlign:'center',color:'#94a3b8',fontSize:14}}>Loading…</div>
            ):!data?(
                <div style={{padding:40,textAlign:'center',color:'#94a3b8',fontSize:14}}>Upload a CSV file to get started</div>
            ):activeTab==='summary'?(
                <WipSummaryTable wipRows={wipRows} wipLoading={wipLoading}/>
            ):(
                <SectionTable key={activeTab} title={TAB_DATA[activeTab].title} color={TAB_DATA[activeTab].color}
                    rows={TAB_DATA[activeTab].rows} showBake={TAB_DATA[activeTab].showBake} showCommit={TAB_DATA[activeTab].showCommit}/>
            )}
        </div>
    );
}