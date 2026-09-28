import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import api from '../services/api';

/* ─── helpers ──────────────────────────────────────────────────── */
function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmt(n)     { return Number(n || 0).toLocaleString(); }
function fmtM(n)    { return n >= 1e6 ? (n/1e6).toFixed(2)+'M' : n >= 1e3 ? (n/1e3).toFixed(0)+'K' : String(n); }
function addDays(dateStr, n) {
    const d = new Date(dateStr); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10);
}
function startOfWeek(dateStr) {
    const d = new Date(dateStr); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0,10);
}
function endOfWeek(dateStr) { return addDays(startOfWeek(dateStr), 6); }
function startOfQuarter(dateStr) {
    const d = new Date(dateStr);
    const q = Math.floor(d.getMonth() / 3);
    return new Date(d.getFullYear(), q*3, 1).toISOString().slice(0,10);
}
function endOfQuarter(dateStr) {
    const d = new Date(dateStr);
    const q = Math.floor(d.getMonth() / 3);
    return new Date(d.getFullYear(), q*3+3, 0).toISOString().slice(0,10);
}
function getWeekKey(dateStr) {
    const dt = new Date(dateStr);
    const day0 = new Date(dt);
    day0.setDate(dt.getDate() - dt.getDay());
    return day0.toISOString().slice(5, 10);
}
function fmtDate(d) {
    return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric'});
}
function fmtDateFull(d) {
    return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}

/* ─── team badge ───────────────────────────────────────────────── */
const TEAM_COLOR = { A: '#1e5fa8', B: '#059669', C: '#dc2626' };
function TeamBadge({ team }) {
    if (!team) return <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34, borderRadius: '50%',
            background: TEAM_COLOR[team] || '#64748b',
            color: '#fff', fontWeight: 900, fontSize: 14,
        }}>{team}</span>
    );
}

/* ─── attainment helpers ───────────────────────────────────────── */
function attColor(pct) { return pct >= 100 ? '#16a34a' : pct >= 75 ? '#d97706' : '#dc2626'; }
function attBg(pct)    { return pct >= 100 ? '#dcfce7' : pct >= 75 ? '#fef9c3' : '#fee2e2'; }
function AttPill({ pct }) {
    if (pct === null || pct === undefined) return <span style={{ color: '#cbd5e1' }}>—</span>;
    return <span style={{ display:'inline-block', padding:'2px 9px', borderRadius:99, fontSize:11, fontWeight:800, background:attBg(pct), color:attColor(pct) }}>{pct}%</span>;
}

const S = {
    lbl: { fontSize:11, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:4 },
    inp: { fontSize:13, padding:'7px 10px', borderRadius:7, border:'1px solid #cbd5e1', color:'#1e293b', background:'#f8fafc', outline:'none' },
};

/* ─── toggle ───────────────────────────────────────────────────── */
function Toggle({ value, onChange, options }) {
    return (
        <div style={{ display:'flex', background:'#f1f5f9', borderRadius:8, padding:3, gap:2 }}>
            {options.map(o => (
                <button key={o.value} onClick={() => onChange(o.value)}
                    style={{ padding:'5px 14px', borderRadius:6, border:'none', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all .15s',
                        background: value===o.value ? '#0e2841' : 'transparent',
                        color: value===o.value ? '#fff' : '#64748b' }}>
                    {o.label}
                </button>
            ))}
        </div>
    );
}

/* ─── date range picker ────────────────────────────────────────── */
function DateRangePicker({ from, to, setFrom, setTo }) {
    const [mode, setMode] = useState('custom'); // 'daily' | 'weekly' | 'quarterly' | 'custom'
    const today = todayISO();

    const applyMode = (m) => {
        setMode(m);
        if (m === 'daily') {
            setFrom(today); setTo(today);
        } else if (m === 'weekly') {
            setFrom(startOfWeek(today)); setTo(endOfWeek(today));
        } else if (m === 'quarterly') {
            setFrom(startOfQuarter(today)); setTo(endOfQuarter(today));
        }
    };

    const navWeek = (dir) => {
        setFrom(addDays(from, dir*7));
        setTo(addDays(to, dir*7));
    };
    const navDay = (dir) => {
        const d = addDays(from, dir);
        setFrom(d); setTo(d);
    };
    const navQuarter = (dir) => {
        const anchor = dir > 0
            ? addDays(to, 1)
            : addDays(startOfQuarter(from), -1);
        setFrom(startOfQuarter(anchor)); setTo(endOfQuarter(anchor));
    };

    return (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {/* Mode selector */}
            <div style={{ display:'flex', gap:3 }}>
                {[
                    { value:'daily',     label:'Day' },
                    { value:'weekly',    label:'Week' },
                    { value:'quarterly', label:'Quarter' },
                    { value:'custom',    label:'Custom' },
                ].map(o => (
                    <button key={o.value} onClick={() => applyMode(o.value)}
                        style={{ padding:'5px 12px', borderRadius:6, border:'1px solid #e2e8f0', fontSize:11, fontWeight:700, cursor:'pointer',
                            background: mode===o.value ? '#0e2841' : '#fff',
                            color: mode===o.value ? '#fff' : '#64748b' }}>
                        {o.label}
                    </button>
                ))}
            </div>

            {/* Date inputs + nav arrows */}
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                {mode !== 'custom' && (
                    <button onClick={() => mode==='daily'?navDay(-1):mode==='weekly'?navWeek(-1):navQuarter(-1)}
                        style={{ padding:'6px 10px', borderRadius:6, border:'1px solid #e2e8f0', background:'#fff', cursor:'pointer', fontSize:14, color:'#0e2841', fontWeight:700 }}>‹</button>
                )}
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input type="date" value={from} onChange={e => { setFrom(e.target.value); setMode('custom'); }}
                        style={{ ...S.inp, width: mode==='daily'?140:130 }} />
                    {mode !== 'daily' && (
                        <>
                            <span style={{ color:'#94a3b8', fontSize:12 }}>→</span>
                            <input type="date" value={to} onChange={e => { setTo(e.target.value); setMode('custom'); }}
                                style={{ ...S.inp, width:130 }} />
                        </>
                    )}
                </div>
                {mode !== 'custom' && (
                    <button onClick={() => mode==='daily'?navDay(1):mode==='weekly'?navWeek(1):navQuarter(1)}
                        style={{ padding:'6px 10px', borderRadius:6, border:'1px solid #e2e8f0', background:'#fff', cursor:'pointer', fontSize:14, color:'#0e2841', fontWeight:700 }}>›</button>
                )}
                {mode !== 'daily' && (
                    <button onClick={() => applyMode(mode)}
                        style={{ padding:'6px 10px', borderRadius:6, border:'1px solid #e2e8f0', background:'#f8fafc', cursor:'pointer', fontSize:11, color:'#64748b', fontWeight:600 }}>
                        Current {mode==='weekly'?'Week':mode==='quarterly'?'Quarter':''}
                    </button>
                )}
                {mode === 'daily' && (
                    <button onClick={() => { setFrom(today); setTo(today); }}
                        style={{ padding:'6px 10px', borderRadius:6, border:'1px solid #e2e8f0', background:'#f8fafc', cursor:'pointer', fontSize:11, color:'#64748b', fontWeight:600 }}>
                        Today
                    </button>
                )}
            </div>

            {/* Range label */}
            <div style={{ fontSize:11, color:'#94a3b8' }}>
                {mode === 'daily' ? fmtDateFull(from)
                    : mode === 'weekly' ? `Week of ${fmtDate(from)} — ${fmtDate(to)}`
                    : mode === 'quarterly' ? `Q${Math.floor(new Date(from).getMonth()/3)+1} ${new Date(from).getFullYear()}: ${fmtDate(from)} — ${fmtDate(to)}`
                    : `${fmtDate(from)} — ${fmtDate(to)} (${Math.round((new Date(to)-new Date(from))/86400000)+1} days)`}
            </div>
        </div>
    );
}

/* ─── custom tooltip ───────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:8, padding:'10px 14px', boxShadow:'0 4px 12px rgba(0,0,0,.1)', fontSize:12, minWidth:200 }}>
            <div style={{ fontWeight:700, color:'#0e2841', marginBottom:8, borderBottom:'1px solid #f1f5f9', paddingBottom:6 }}>{label}</div>
            {payload.map((p,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', gap:16, marginBottom:4 }}>
                    <span style={{ color:p.color||p.fill, fontWeight:600 }}>{p.name}</span>
                    <span style={{ fontWeight:700, color:'#0e2841' }}>{p.name.includes('Att') ? p.value+'%' : fmtM(p.value)}</span>
                </div>
            ))}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function TeamDashboard() {

    const [from,        setFrom]        = useState('');
    const [to,          setTo]          = useState('');
    const [factory,     setFactory]     = useState('');
    const [area,        setArea]        = useState('');
    const [factories,   setFactories]   = useState([]);
    const [areas,       setAreas]       = useState([]);
    const [perDay,      setPerDay]      = useState([]);
    const [lotProg,     setLotProg]     = useState(null);
    const [loading,     setLoading]     = useState(false);
    const [chartView,   setChartView]   = useState('daily');
    const [shiftFilter, setShiftFilter] = useState('total');

    /* ── init ─────────────────────────────────────────────────── */
    useEffect(() => {
        Promise.all([
            api.get('/team-dashboard/current-period'),
            api.get('/team-dashboard/factories'),
            api.get('/team-dashboard/areas'),
        ]).then(([cp, f, a]) => {
            setFrom(cp.data.from);
            setTo(cp.data.to);
            setFactories(f.data);
            setAreas(a.data);
        }).catch(() => {
            setFrom(todayISO()); setTo(todayISO());
        });
    }, []);

    /* ── load ─────────────────────────────────────────────────── */
    const load = useCallback(async () => {
        if (!from || !to) return;
        setLoading(true);
        try {
            const params = { from, to, factory: factory||undefined, area: area||undefined };
            const [pd, lp] = await Promise.all([
                api.get('/team-dashboard/per-day',      { params }),
                api.get('/team-dashboard/lot-progress', { params: { date: from, area: area||undefined } }),
            ]);
            setPerDay(pd.data);
            setLotProg(lp.data);
        } catch (_) {}
        finally { setLoading(false); }
    }, [from, to, factory, area]);

    useEffect(() => { load(); }, [load]);

    /* ── totals ───────────────────────────────────────────────── */
    const totalPlan        = perDay.reduce((s,r)=>s+(r.total_plan   ||0),0);
    const totalActual      = perDay.reduce((s,r)=>s+(r.total_actual ||0),0);
    const dayPlanTotal     = perDay.reduce((s,r)=>s+(r.day_plan     ||0),0);
    const nightPlanTotal   = perDay.reduce((s,r)=>s+(r.night_plan   ||0),0);
    const dayActualTotal   = perDay.reduce((s,r)=>s+(r.day_actual   ||0),0);
    const nightActualTotal = perDay.reduce((s,r)=>s+(r.night_actual ||0),0);
    const overallAtt = totalPlan>0 ? Math.round((totalActual/totalPlan)*100) : 0;
    const dayAtt     = dayPlanTotal>0 ? Math.round((dayActualTotal/dayPlanTotal)*100) : 0;
    const nightAtt   = nightPlanTotal>0 ? Math.round((nightActualTotal/nightPlanTotal)*100) : 0;

    /* ── team stats ───────────────────────────────────────────── */
    const teamStats = useMemo(() => {
        const acc = {
            A:{plan:0,actual:0,dayPlan:0,dayActual:0,nightPlan:0,nightActual:0},
            B:{plan:0,actual:0,dayPlan:0,dayActual:0,nightPlan:0,nightActual:0},
            C:{plan:0,actual:0,dayPlan:0,dayActual:0,nightPlan:0,nightActual:0},
        };
        perDay.forEach(d => {
            if (d.day_team && acc[d.day_team]) {
                acc[d.day_team].dayPlan   += d.day_plan   ||0;
                acc[d.day_team].dayActual += d.day_actual ||0;
                acc[d.day_team].plan      += d.day_plan   ||0;
                acc[d.day_team].actual    += d.day_actual ||0;
            }
            if (d.night_team && acc[d.night_team]) {
                acc[d.night_team].nightPlan   += d.night_plan   ||0;
                acc[d.night_team].nightActual += d.night_actual ||0;
                acc[d.night_team].plan        += d.night_plan   ||0;
                acc[d.night_team].actual      += d.night_actual ||0;
            }
        });
        return ['A','B','C'].map(team => ({
            team,
            Plan: acc[team].plan, Output: acc[team].actual,
            Att:  acc[team].plan>0 ? Math.round((acc[team].actual/acc[team].plan)*100) : 0,
            DayPlan: acc[team].dayPlan, DayOutput: acc[team].dayActual,
            DayAtt: acc[team].dayPlan>0 ? Math.round((acc[team].dayActual/acc[team].dayPlan)*100) : 0,
            NightPlan: acc[team].nightPlan, NightOutput: acc[team].nightActual,
            NightAtt: acc[team].nightPlan>0 ? Math.round((acc[team].nightActual/acc[team].nightPlan)*100) : 0,
        }));
    }, [perDay]);

    /* ── chart data ───────────────────────────────────────────── */
    const chartData = useMemo(() => {
        if (!perDay.length) return [];
        const getVals = (d) => {
            if (shiftFilter==='day')   return { plan:d.day_plan||0,   output:d.day_actual||0   };
            if (shiftFilter==='night') return { plan:d.night_plan||0, output:d.night_actual||0 };
            return { plan:d.total_plan||0, output:d.total_actual||0 };
        };
        if (chartView==='daily') {
            return perDay.map(d => {
                const {plan,output} = getVals(d);
                return {
                    label:  d.date.slice(5),
                    Plan:   plan,
                    Output: output,
                    'Att%': plan>0 ? Math.round((output/plan)*100) : 0,
                    team:   shiftFilter==='day' ? d.day_team : shiftFilter==='night' ? d.night_team : (d.day_team||d.night_team),
                };
            });
        } else {
            const weeks = {};
            perDay.forEach(d => {
                const wk = getWeekKey(d.date);
                if (!weeks[wk]) weeks[wk] = { label:`Wk ${wk}`, plan:0, output:0 };
                const {plan,output} = getVals(d);
                weeks[wk].plan += plan; weeks[wk].output += output;
            });
            return Object.values(weeks).map(w => ({
                label: w.label, Plan: w.plan, Output: w.output,
                'Att%': w.plan>0 ? Math.round((w.output/w.plan)*100) : 0,
            }));
        }
    }, [perDay, chartView, shiftFilter]);

    /* ── custom label ─────────────────────────────────────────── */
    const CustomBarLabel = ({ x, y, width, value, index }) => {
        const d = chartData[index];
        if (!d?.team || !value) return null;
        const c = TEAM_COLOR[d.team] || '#64748b';
        return (
            <g>
                <circle cx={x+width/2} cy={y-12} r={9} fill={c} />
                <text x={x+width/2} y={y-8} textAnchor="middle" fill="#fff" fontSize={9} fontWeight={800}>{d.team}</text>
            </g>
        );
    };

    /* ─────────────────────────────────────────────────────────── */
    return (
        <div style={{ padding:'0 0 48px' }}>

            {/* ── Filter bar ─────────────────────────────────── */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:16, alignItems:'flex-start', background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:'14px 16px', marginBottom:16, boxShadow:'0 1px 3px rgba(14,40,65,.05)' }}>
                {/* Date range picker */}
                <div>
                    <label style={S.lbl}>Date Range</label>
                    <DateRangePicker from={from} to={to} setFrom={setFrom} setTo={setTo} />
                </div>

                <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap' }}>
                    <div>
                        <label style={S.lbl}>Factory <span style={{ color:'#94a3b8', fontWeight:400 }}>(Schedule)</span></label>
                        <select style={{ ...S.inp, width:100 }} value={factory} onChange={e=>setFactory(e.target.value)}>
                            <option value="">All</option>
                            {factories.map(f=><option key={f} value={f}>{f}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={S.lbl}>Area <span style={{ color:'#94a3b8', fontWeight:400 }}>(Plan & Output)</span></label>
                        <select style={{ ...S.inp, width:100 }} value={area} onChange={e=>setArea(e.target.value)}>
                            <option value="">All</option>
                            {areas.map(a=><option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                    <div style={{ display:'flex', gap:8, alignItems:'center', paddingBottom:2 }}>
                        {loading && <span style={{ fontSize:12, color:'#94a3b8' }}>Loading…</span>}
                        <button onClick={load} style={{ padding:'7px 18px', borderRadius:7, border:'1px solid #cbd5e1', background:'#fff', fontSize:13, cursor:'pointer', color:'#0e2841', fontWeight:600 }}>↻ Refresh</button>
                    </div>
                </div>
            </div>

            {/* ── KPI strip ──────────────────────────────────── */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:10, marginBottom:10 }}>
                {[
                    { label:'Period Plan',    value:fmt(totalPlan),   color:'#1e5fa8' },
                    { label:'Period Output',  value:fmt(totalActual), color:'#16a34a' },
                    { label:'Attainment',     value:overallAtt+'%',   color:attColor(overallAtt) },
                    { label:'Days in Range',  value:perDay.length,    color:'#0b7285' },
                    { label:'Days w/ Output', value:perDay.filter(d=>d.total_actual>0).length, color:'#7c3aed' },
                ].map((k,i) => (
                    <div key={i} style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:'12px 14px', boxShadow:'0 1px 3px rgba(14,40,65,.05)' }}>
                        <div style={{ fontSize:10, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>{k.label}</div>
                        <div style={{ fontSize:20, fontWeight:800, color:k.color }}>{k.value}</div>
                    </div>
                ))}
            </div>

            {/* ── Day/Night breakdown strip ───────────────────── */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
                {[
                    { label:'☀ Day Plan',      value:fmt(dayPlanTotal),    color:'#1e5fa8', bg:'#eff6ff',  border:'#bfdbfe' },
                    { label:'🌙 Night Plan',   value:fmt(nightPlanTotal),  color:'#7c3aed', bg:'#f5f3ff',  border:'#ddd6fe' },
                    { label:'📋 Total Plan',   value:fmt(totalPlan),       color:'#1d4ed8', bg:'#dbeafe',  border:'#93c5fd' },
                    { label:'☀ Day Output',    value:fmt(dayActualTotal),  color:'#16a34a', bg:'#f0fdf4',  border:'#bbf7d0' },
                    { label:'🌙 Night Output', value:fmt(nightActualTotal),color:'#a21caf', bg:'#fdf4ff',  border:'#f5d0fe' },
                    { label:'✓ Total Output',  value:fmt(totalActual),     color:'#15803d', bg:'#dcfce7',  border:'#86efac' },
                    { label:'% Day Att',       value:dayAtt+'%',           color:attColor(dayAtt),    bg:attBg(dayAtt),    border:'#e2e8f0' },
                    { label:'% Night Att',     value:nightAtt+'%',         color:attColor(nightAtt),  bg:attBg(nightAtt),  border:'#e2e8f0' },
                    { label:'% Total Att',     value:overallAtt+'%',       color:attColor(overallAtt),bg:attBg(overallAtt),border:'#e2e8f0' },
                ].map((k,i) => (
                    <div key={i} style={{ background:k.bg, border:`1px solid ${k.border}`, borderRadius:10, padding:'10px 14px', boxShadow:'0 1px 3px rgba(14,40,65,.05)' }}>
                        <div style={{ fontSize:10, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>{k.label}</div>
                        <div style={{ fontSize:18, fontWeight:800, color:k.color }}>{k.value}</div>
                    </div>
                ))}
            </div>

            {/* ── Team Performance Cards ─────────────────────── */}
            {perDay.length > 0 && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
                    {teamStats.map(t => (
                        <div key={t.team} style={{ borderRadius:10, border:`2px solid ${TEAM_COLOR[t.team]}22`, background:`${TEAM_COLOR[t.team]}08`, padding:'12px 14px', boxShadow:'0 1px 3px rgba(14,40,65,.05)' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                                <span style={{ width:32, height:32, borderRadius:'50%', background:TEAM_COLOR[t.team], color:'#fff', fontWeight:900, fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>{t.team}</span>
                                <span style={{ fontWeight:700, color:'#0e2841', fontSize:13 }}>Team {t.team}</span>
                                <span style={{ marginLeft:'auto', background:attBg(t.Att), color:attColor(t.Att), fontWeight:800, fontSize:13, padding:'2px 10px', borderRadius:99 }}>{t.Att}%</span>
                            </div>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:11 }}>
                                <div><div style={{ color:'#64748b', marginBottom:2 }}>Total Plan</div><div style={{ fontWeight:700, color:'#1e5fa8' }}>{fmtM(t.Plan)}</div></div>
                                <div><div style={{ color:'#64748b', marginBottom:2 }}>Total Output</div><div style={{ fontWeight:700, color:'#16a34a' }}>{fmtM(t.Output)}</div></div>
                                <div><div style={{ color:'#64748b', marginBottom:2 }}>☀ Day</div><div style={{ fontWeight:600, color:'#0369a1', fontSize:10 }}>{fmtM(t.DayOutput)} / {fmtM(t.DayPlan)} ({t.DayAtt}%)</div></div>
                                <div><div style={{ color:'#64748b', marginBottom:2 }}>🌙 Night</div><div style={{ fontWeight:600, color:'#7c3aed', fontSize:10 }}>{fmtM(t.NightOutput)} / {fmtM(t.NightPlan)} ({t.NightAtt}%)</div></div>
                            </div>
                            <div style={{ marginTop:10, background:'#e2e8f0', borderRadius:99, height:6, overflow:'hidden' }}>
                                <div style={{ width:`${Math.min(100,t.Att)}%`, height:'100%', borderRadius:99, background:attColor(t.Att) }} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Combined Chart ─────────────────────────────── */}
            {perDay.length > 0 && (
                <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, boxShadow:'0 1px 4px rgba(14,40,65,.06)', overflow:'hidden', marginBottom:16 }}>
                    <div style={{ padding:'12px 16px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:'#0e2841', textTransform:'uppercase', letterSpacing:'.06em' }}>
                            Team Rotation — Plan vs Output
                            {(factory||area) && <span style={{ marginLeft:10, fontWeight:400, color:'#64748b', fontSize:11, textTransform:'none' }}>{factory&&`Factory: ${factory}`}{factory&&area&&' · '}{area&&`Area: ${area}`}</span>}
                        </div>
                        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                            <Toggle value={shiftFilter} onChange={setShiftFilter} options={[
                                { value:'day',   label:'☀ Day' },
                                { value:'night', label:'🌙 Night' },
                                { value:'total', label:'Total' },
                            ]} />
                            <Toggle value={chartView} onChange={setChartView} options={[
                                { value:'daily',  label:'Daily' },
                                { value:'weekly', label:'Weekly' },
                            ]} />
                        </div>
                    </div>
                    <div style={{ padding:'16px' }}>
                        <ResponsiveContainer width="100%" height={340}>
                            <ComposedChart data={chartData} margin={{ top:24, right:60, left:10, bottom:5 }} barCategoryGap="25%" barGap={4}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="label" tick={{ fontSize:11 }} />
                                <YAxis yAxisId="qty" orientation="left" tickFormatter={fmtM} tick={{ fontSize:10 }} />
                                <YAxis yAxisId="att" orientation="right" tickFormatter={v=>v+'%'} tick={{ fontSize:10 }} domain={[0,110]} />
                                <Tooltip content={<ChartTooltip />} />
                                <Legend wrapperStyle={{ fontSize:11 }} />
                                <Bar yAxisId="qty" dataKey="Plan" name="Plan" fill="#93c5fd" radius={[4,4,0,0]}
                                    label={chartView==='daily' ? <CustomBarLabel /> : false} />
                                <Bar yAxisId="qty" dataKey="Output" name="Output" fill="#16a34a" radius={[4,4,0,0]} />
                                <Line yAxisId="att" type="monotone" dataKey="Att%" name="Att%"
                                    stroke="#f59e0b" strokeWidth={2.5}
                                    dot={{ r:4, fill:'#f59e0b', stroke:'#fff', strokeWidth:2 }}
                                    activeDot={{ r:6 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                        <div style={{ display:'flex', gap:16, justifyContent:'center', marginTop:8, fontSize:11, color:'#64748b' }}>
                            <span><span style={{ display:'inline-block', width:12, height:12, background:'#93c5fd', borderRadius:2, marginRight:4, verticalAlign:'middle' }}/>Plan (Left axis)</span>
                            <span><span style={{ display:'inline-block', width:12, height:12, background:'#16a34a', borderRadius:2, marginRight:4, verticalAlign:'middle' }}/>Output (Left axis)</span>
                            <span><span style={{ display:'inline-block', width:24, height:3, background:'#f59e0b', marginRight:4, verticalAlign:'middle' }}/>Att% (Right axis)</span>
                            {chartView==='daily' && <span style={{ color:'#94a3b8' }}>● = Team assigned to shift</span>}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Pivot table ─────────────────────────────────── */}
            {perDay.length > 0 && (() => {
                const ROWS = [
                    { label:'☀ Day Team',   hdrBg:'#0369a1', hdrFg:'#fff', cellBg:'#f0f9ff', render:d=><TeamBadge team={d.day_team}/>,   agg:null },
                    { label:'🌙 Night Team', hdrBg:'#6d28d9', hdrFg:'#fff', cellBg:'#faf5ff', render:d=><TeamBadge team={d.night_team}/>, agg:null },
                    { divider:true },
                    { label:'📋 Day Plan',   hdrBg:'#dbeafe', hdrFg:'#1e3a5f', cellBg:'#f0f9ff',
                      render:d=>d.day_plan>0?<span style={{fontWeight:600,color:'#1e5fa8',fontSize:12}}>{fmt(d.day_plan)}</span>:<span style={{color:'#cbd5e1'}}>—</span>,
                      agg:(rows,key)=><span style={{fontWeight:700,color:'#1e5fa8'}}>{fmt(rows.reduce((s,r)=>s+(r.day_plan||0),0))}</span> },
                    { label:'📋 Night Plan', hdrBg:'#ede9fe', hdrFg:'#4c1d95', cellBg:'#faf5ff',
                      render:d=>d.night_plan>0?<span style={{fontWeight:600,color:'#7c3aed',fontSize:12}}>{fmt(d.night_plan)}</span>:<span style={{color:'#cbd5e1'}}>—</span>,
                      agg:rows=><span style={{fontWeight:700,color:'#7c3aed'}}>{fmt(rows.reduce((s,r)=>s+(r.night_plan||0),0))}</span> },
                    { label:'📋 Total Plan', hdrBg:'#bfdbfe', hdrFg:'#1e3a5f', cellBg:'#eff6ff',
                      render:d=>d.total_plan>0?<span style={{fontWeight:700,color:'#1d4ed8',fontSize:12}}>{fmt(d.total_plan)}</span>:<span style={{color:'#cbd5e1'}}>—</span>,
                      agg:rows=><span style={{fontWeight:800,color:'#1d4ed8'}}>{fmt(rows.reduce((s,r)=>s+(r.total_plan||0),0))}</span> },
                    { divider:true },
                    { label:'✓ Day Output',   hdrBg:'#bbf7d0', hdrFg:'#14532d', cellBg:'#f0fdf4',
                      render:d=>d.day_actual>0?<span style={{fontWeight:700,color:'#16a34a',fontSize:12}}>{fmt(d.day_actual)}</span>:<span style={{color:'#cbd5e1'}}>—</span>,
                      agg:rows=><span style={{fontWeight:700,color:'#16a34a'}}>{fmt(rows.reduce((s,r)=>s+(r.day_actual||0),0))}</span> },
                    { label:'✓ Night Output', hdrBg:'#f5d0fe', hdrFg:'#701a75', cellBg:'#fdf4ff',
                      render:d=>d.night_actual>0?<span style={{fontWeight:700,color:'#a21caf',fontSize:12}}>{fmt(d.night_actual)}</span>:<span style={{color:'#cbd5e1'}}>—</span>,
                      agg:rows=><span style={{fontWeight:700,color:'#a21caf'}}>{fmt(rows.reduce((s,r)=>s+(r.night_actual||0),0))}</span> },
                    { label:'✓ Total Output', hdrBg:'#86efac', hdrFg:'#14532d', cellBg:'#f0fdf4',
                      render:d=>d.total_actual>0?<span style={{fontWeight:700,color:'#15803d',fontSize:12}}>{fmt(d.total_actual)}</span>:<span style={{color:'#cbd5e1'}}>—</span>,
                      agg:rows=><span style={{fontWeight:800,color:'#15803d'}}>{fmt(rows.reduce((s,r)=>s+(r.total_actual||0),0))}</span> },
                    { divider:true },
                    { label:'% Day Att',   hdrBg:'#e2e8f0', hdrFg:'#0e2841', cellBg:'#f8fafc',
                      render:d=>(d.day_plan>0||d.day_actual>0)?<AttPill pct={d.day_att}/>:<span style={{color:'#cbd5e1'}}>—</span>,
                      agg:rows=>{ const p=rows.reduce((s,r)=>s+(r.day_plan||0),0),a=rows.reduce((s,r)=>s+(r.day_actual||0),0); return <AttPill pct={p>0?Math.round((a/p)*100):null}/>; } },
                    { label:'% Night Att', hdrBg:'#e2e8f0', hdrFg:'#0e2841', cellBg:'#faf5ff',
                      render:d=>(d.night_plan>0||d.night_actual>0)?<AttPill pct={d.night_att}/>:<span style={{color:'#cbd5e1'}}>—</span>,
                      agg:rows=>{ const p=rows.reduce((s,r)=>s+(r.night_plan||0),0),a=rows.reduce((s,r)=>s+(r.night_actual||0),0); return <AttPill pct={p>0?Math.round((a/p)*100):null}/>; } },
                    { label:'% Total Att', hdrBg:'#cbd5e1', hdrFg:'#0e2841', cellBg:'#f8fafc',
                      render:d=>{ const p=(d.day_plan||0)+(d.night_plan||0),a=(d.day_actual||0)+(d.night_actual||0); return(p>0||a>0)?<AttPill pct={p>0?Math.round((a/p)*100):null}/>:<span style={{color:'#cbd5e1'}}>—</span>; },
                      agg:rows=>{ const p=rows.reduce((s,r)=>s+(r.total_plan||0),0),a=rows.reduce((s,r)=>s+(r.total_actual||0),0); return <AttPill pct={p>0?Math.round((a/p)*100):null}/>; } },
                ];

                // Group perDay by pivotGroup
                const PivotTable = () => {
                    const [pivotGroup, setPivotGroup] = React.useState('daily');

                    // Build columns based on pivot group
                    const cols = React.useMemo(() => {
                        if (pivotGroup === 'daily') {
                        return perDay.map((d,i) => ({ key:d.date, label:d.date.slice(5), sub:d.date.slice(5), rows:[d] }));
                        }
                        if (pivotGroup === 'weekly') {
                            const weeks = {};
                            perDay.forEach(d => {
                                const wk = getWeekKey(d.date);
                                if (!weeks[wk]) weeks[wk] = { key:wk, label:`Wk ${wk}`, sub:'', rows:[] };
                                weeks[wk].rows.push(d);
                            });
                            return Object.values(weeks).map(w => ({ ...w, sub:`${w.rows[0].date.slice(5)}–${w.rows[w.rows.length-1].date.slice(5)}` }));
                        }
                        // quarterly
                        const quarters = {};
                        perDay.forEach(d => {
                            const dt = new Date(d.date);
                            const qKey = `${dt.getFullYear()}-Q${Math.floor(dt.getMonth()/3)+1}`;
                            if (!quarters[qKey]) quarters[qKey] = { key:qKey, label:qKey, sub:'', rows:[] };
                            quarters[qKey].rows.push(d);
                        });
                        return Object.values(quarters).map(q => ({ ...q, sub:`${q.rows[0].date.slice(5)}–${q.rows[q.rows.length-1].date.slice(5)}` }));
                    }, [pivotGroup]);

                    return (
                        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, boxShadow:'0 1px 4px rgba(14,40,65,.06)', overflow:'hidden', marginBottom:16 }}>
                            <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, borderBottom:'1px solid #f1f5f9' }}>
                                <div style={{ fontSize:12, fontWeight:700, color:'#0e2841', textTransform:'uppercase', letterSpacing:'.06em' }}>
                                    Team Rotation — Plan vs Output
                                    {(factory||area)&&<span style={{ marginLeft:10, fontWeight:400, color:'#64748b', fontSize:11, textTransform:'none' }}>{factory&&`Factory: ${factory}`}{factory&&area&&' · '}{area&&`Area: ${area}`}</span>}
                                </div>
                                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                                    <Toggle value={pivotGroup} onChange={setPivotGroup} options={[
                                        { value:'daily',     label:'Daily' },
                                        { value:'weekly',    label:'Weekly' },
                                        { value:'quarterly', label:'Quarterly' },
                                    ]} />
                                    <span style={{ fontSize:11, color:'#94a3b8' }}>{from} → {to}</span>
                                </div>
                            </div>
                            <div style={{ overflowX:'auto' }}>
                                <table style={{ borderCollapse:'collapse', minWidth:'100%' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ background:'#0e2841', color:'#fff', padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700, position:'sticky', left:0, zIndex:3, minWidth:148, borderRight:'2px solid #1e3a5f' }}>METRIC</th>
                                            {cols.map(col=>(
                                                <th key={col.key} style={{ background:'#0e2841', color:'#fff', padding:'8px 12px', textAlign:'center', fontSize:11, fontWeight:700, minWidth:pivotGroup==='daily'?76:110, borderLeft:'1px solid #1e3a5f' }}>
                                                    <div>{col.sub || col.label}</div>
                                                </th>
                                            ))}
                                            <th style={{ background:'#0e2841', color:'#ffd080', padding:'8px 12px', textAlign:'right', fontSize:11, fontWeight:700, minWidth:90, borderLeft:'2px solid #1e3a5f' }}>TOTAL</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ROWS.map((row,ri)=>{
                                            if(row.divider) return <tr key={`div-${ri}`}><td colSpan={cols.length+2} style={{ height:4, background:'#f1f5f9', padding:0 }}/></tr>;
                                            return(
                                                <tr key={row.label}>
                                                    <td style={{ background:row.hdrBg, color:row.hdrFg, padding:'9px 16px', fontWeight:700, fontSize:11, whiteSpace:'nowrap', position:'sticky', left:0, zIndex:1, borderRight:'2px solid #e2e8f0', borderBottom:'1px solid rgba(0,0,0,.06)' }}>{row.label}</td>
                                                    {cols.map(col=>(
                                                        <td key={col.key} style={{ background:row.cellBg, padding:'9px 12px', textAlign:'center', verticalAlign:'middle', borderLeft:'1px solid #e2e8f0', borderBottom:'1px solid #e2e8f0' }}>
                                                            {col.rows.length===1
                                                                ? row.render(col.rows[0])
                                                                : row.agg ? row.agg(col.rows) : <span style={{color:'#cbd5e1'}}>—</span>}
                                                        </td>
                                                    ))}
                                                    <td style={{ background:row.cellBg, padding:'9px 12px', textAlign:'right', verticalAlign:'middle', borderLeft:'2px solid #e2e8f0', borderBottom:'1px solid #e2e8f0' }}>
                                                        {row.agg ? row.agg(perDay) : null}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                };
                return <PivotTable />;
            })()}

            {/* ── Lot Progress ───────────────────────────────── */}
            {lotProg && lotProg.lots?.length > 0 && (
                <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, boxShadow:'0 1px 4px rgba(14,40,65,.06)', overflow:'hidden', marginBottom:16 }}>
                    <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid #f1f5f9' }}>
                        <div style={{ fontSize:12, fontWeight:700, color:'#0e2841', textTransform:'uppercase', letterSpacing:'.06em' }}>Lot Progress — {from}</div>
                        <span style={{ fontSize:11, color:'#94a3b8' }}>{lotProg.finished_lots}/{lotProg.total_lots} done · {lotProg.overall_pct}%</span>
                    </div>
                    <div style={{ padding:'10px 16px', borderBottom:'1px solid #f1f5f9' }}>
                        <div style={{ background:'#e2e8f0', borderRadius:99, height:8, overflow:'hidden' }}>
                            <div style={{ width:`${lotProg.overall_pct}%`, height:'100%', borderRadius:99, background:attColor(lotProg.overall_pct) }} />
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', marginTop:5, fontSize:11, color:'#64748b' }}>
                            <span>Plan: {fmt(lotProg.total_plan)}</span>
                            <span>Actual: {fmt(lotProg.total_actual)}</span>
                            <span>{lotProg.overall_pct}% attainment</span>
                        </div>
                    </div>
                    <div style={{ overflowX:'auto' }}>
                        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                            <thead>
                                <tr>
                                    {[['Lot ID','left'],['Part Name','left'],['Plan Qty','right'],['Actual Qty','right'],['Progress','left'],['Att%','right'],['Status','left']].map(([h,a])=>(
                                        <th key={h} style={{ background:'#0e2841', color:'#fff', padding:'8px 10px', fontSize:11, fontWeight:700, textAlign:a, whiteSpace:'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {lotProg.lots.map((l,i) => {
                                    const c  = attColor(l.attainment);
                                    const bg = l.finished ? '#f0fdf4' : i%2===0 ? '#f8fafc' : '#fff';
                                    return (
                                        <tr key={l.lot_id}>
                                            <td style={{ padding:'7px 10px', background:bg, borderBottom:'1px solid #e2e8f0' }}><b style={{ color:'#0e2841' }}>{l.lot_id}</b></td>
                                            <td style={{ padding:'7px 10px', background:bg, borderBottom:'1px solid #e2e8f0' }}>{l.part_name||'—'}</td>
                                            <td style={{ padding:'7px 10px', textAlign:'right', fontVariantNumeric:'tabular-nums', background:bg, borderBottom:'1px solid #e2e8f0' }}>{fmt(l.plan_qty)}</td>
                                            <td style={{ padding:'7px 10px', textAlign:'right', fontVariantNumeric:'tabular-nums', background:bg, borderBottom:'1px solid #e2e8f0' }}><b style={{ color:'#16a34a' }}>{fmt(l.actual_qty)}</b></td>
                                            <td style={{ padding:'7px 10px', background:bg, borderBottom:'1px solid #e2e8f0', minWidth:110 }}>
                                                <div style={{ background:'#e2e8f0', borderRadius:99, height:6, overflow:'hidden' }}>
                                                    <div style={{ width:`${Math.min(100,l.attainment)}%`, height:'100%', borderRadius:99, background:c }} />
                                                </div>
                                            </td>
                                            <td style={{ padding:'7px 10px', textAlign:'right', background:bg, borderBottom:'1px solid #e2e8f0', fontWeight:700, color:c }}>{l.attainment}%</td>
                                            <td style={{ padding:'7px 10px', background:bg, borderBottom:'1px solid #e2e8f0' }}>
                                                {l.finished
                                                    ? <span style={{ background:'#dcfce7', color:'#166534', padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:700 }}>✓ Done</span>
                                                    : l.actual_qty>0
                                                        ? <span style={{ background:'#fef9c3', color:'#854d0e', padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:700 }}>In Progress</span>
                                                        : <span style={{ background:'#f3f4f6', color:'#6b7280', padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:700 }}>Not Started</span>}
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
