"use client";
import { useState, useEffect } from "react";
import { supabase, supabaseAdmin, supabaseReady } from "@/lib/supabase";
import { Empleado, Marcacion, Turno } from "@/lib/types";
import { CARGO_LABEL, formatDateTime, formatHora } from "@/lib/format";
import { getSession } from "@/lib/session";
import {
  MOCK_EMPLEADOS, MOCK_MARCACIONES, MOCK_MARCACIONES_HISTORICAS,
  MOCK_HORAS_SEMANA, MOCK_PERMISOS, ResumenHoras, Permiso, TipoPermiso,
} from "@/lib/mock";
import {
  Clock, ChevronLeft, ChevronRight, Plus, Trash2,
  Calendar, ClipboardList, AlertTriangle, CheckCircle,
  LogIn, LogOut as LogOutIcon, Zap, Users, BarChart2, Delete, Timer,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────
type Tab = "estado" | "horarios" | "horas" | "historial" | "permisos";
type PeriodoHoras = "semana" | "mes";

const TIPO_PERMISO_LABEL: Record<TipoPermiso, string> = {
  ausencia: "Ausencia", tardanza: "Tardanza", permiso: "Permiso",
  vacaciones: "Vacaciones", incapacidad: "Incapacidad",
};
const TIPO_PERMISO_COLOR: Record<TipoPermiso, { bg: string; color: string }> = {
  ausencia:    { bg: "rgba(248,113,113,0.15)", color: "#f87171" },
  tardanza:    { bg: "rgba(251,191,36,0.15)",  color: "#fcd34d" },
  permiso:     { bg: "rgba(96,165,250,0.15)",  color: "#60a5fa" },
  vacaciones:  { bg: "rgba(52,211,153,0.15)",  color: "#34d399" },
  incapacidad: { bg: "rgba(167,139,250,0.15)", color: "#a78bfa" },
};
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const NUMPAD_VALS = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

// ── Helpers ────────────────────────────────────────────────────
function getInitials(n: string) { return n.split(" ").slice(0,2).map(x=>x[0]).join("").toUpperCase(); }
function toDateStr(d: Date) { return d.toISOString().split("T")[0]; }
function getMondayOfWeek(d: Date): Date {
  const date = new Date(d); const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day)); date.setHours(0,0,0,0); return date;
}
function getWeekDays(mon: Date): Date[] {
  return Array.from({length:7},(_,i)=>{ const d=new Date(mon); d.setDate(d.getDate()+i); return d; });
}
function normalH(h: string) { return h.slice(0,5); }
function calcDurMins(ini: string, fin: string): number {
  const [h1,m1]=ini.split(":").map(Number); const [h2,m2]=fin.split(":").map(Number);
  return Math.max(0,(h2*60+m2)-(h1*60+m1));
}
function formatDur(mins: number): string { const h=Math.floor(mins/60),m=mins%60; return m>0?`${h}h ${m}m`:`${h}h`; }
function agruparPorFecha(marcas: Marcacion[]): [string, Marcacion[]][] {
  const map: Record<string,Marcacion[]>={};
  marcas.forEach(m=>{ const f=m.timestamp.split("T")[0]; (map[f]??=[]).push(m); });
  return Object.entries(map).sort((a,b)=>b[0].localeCompare(a[0]));
}
function calcHorasDia(marcas: Marcacion[]): number {
  const e=marcas.find(m=>m.tipo==="entrada"); const s=marcas.find(m=>m.tipo==="salida");
  if(!e||!s) return 0;
  return (new Date(s.timestamp).getTime()-new Date(e.timestamp).getTime())/3600000;
}
function generateWeekTurnos(monday: Date): Turno[] {
  const days=getWeekDays(monday); const result:Turno[]=[]; let id=5000;
  const sched=[
    {empId:1,nombre:"Ana García Ruiz",  cargo:"cajero",    off:[5,6],ini:"08:00",fin:"16:00"},
    {empId:2,nombre:"Luis Pérez Mora",  cargo:"confitero", off:[2,6],ini:"09:00",fin:"17:00"},
    {empId:3,nombre:"María Torres",     cargo:"supervisor",off:[6],  ini:"08:00",fin:"20:00"},
    {empId:4,nombre:"Carlos Ruiz López",cargo:"acomodador",off:[0,1],ini:"14:00",fin:"22:00"},
    {empId:5,nombre:"Sofía Martínez",   cargo:"cajero",    off:[5,6],ini:"09:00",fin:"17:00"},
  ] as const;
  sched.forEach(emp=>{ days.forEach((day,di)=>{
    if(!(emp.off as readonly number[]).includes(di))
      result.push({id:id++,empleado_id:emp.empId,fecha:toDateStr(day),hora_inicio:emp.ini,hora_fin:emp.fin,empleados:{nombre:emp.nombre,cargo:emp.cargo as any}});
  }); });
  return result;
}

// ── Main Component ─────────────────────────────────────────────
export default function EmpleadosPage() {
  const sesion = getSession();
  const isAdmin = sesion?.cargo==="admin"||sesion?.cargo==="supervisor";
  const [empleados,setEmpleados]   = useState<Empleado[]>([]);
  const [marcaciones,setMarcaciones] = useState<Marcacion[]>([]);
  const [turnos,setTurnos]         = useState<Turno[]>([]);
  const [historial,setHistorial]   = useState<Marcacion[]>([]);
  const [marcadoOk,setMarcadoOk]   = useState<{nombre:string;tipo:"entrada"|"salida"}|null>(null);
  const [marcandoDirecto,setMarcandoDirecto] = useState(false);

  useEffect(()=>{ cargar(); },[]);
  useEffect(()=>{ if(!isAdmin&&sesion) cargarHistorial(); },[]);

  async function cargar() {
    if(!supabaseReady()){
      setEmpleados(MOCK_EMPLEADOS); setMarcaciones(MOCK_MARCACIONES);
      setTurnos(generateWeekTurnos(getMondayOfWeek(new Date()))); return;
    }
    const hoy=new Date().toISOString().split("T")[0];
    const [empR,marR,turR]=await Promise.all([
      supabase.from("empleados").select("*").eq("activo",true).order("nombre"),
      supabase.from("marcaciones").select("*,empleados(nombre,cargo)").gte("timestamp",hoy+"T00:00:00").order("timestamp",{ascending:false}),
      supabase.from("turnos").select("*,empleados(nombre,cargo)").gte("fecha",hoy).lte("fecha",new Date(Date.now()+6*86400000).toISOString().split("T")[0]).order("fecha").order("hora_inicio"),
    ]);
    setEmpleados((empR.data as Empleado[])??[]);
    setMarcaciones((marR.data as Marcacion[])??[]);
    setTurnos((turR.data as Turno[])??[]);
  }

  async function cargarHistorial() {
    if(!sesion) return;
    if(!supabaseReady()){
      const h=[...MOCK_MARCACIONES_HISTORICAS,...MOCK_MARCACIONES]
        .filter(m=>m.empleado_id===sesion.id)
        .sort((a,b)=>b.timestamp.localeCompare(a.timestamp));
      setHistorial(h); return;
    }
    const hace14=new Date(); hace14.setDate(hace14.getDate()-14);
    const {data}=await supabase.from("marcaciones").select("*").eq("empleado_id",sesion.id).gte("timestamp",hace14.toISOString()).order("timestamp",{ascending:false});
    setHistorial((data as Marcacion[])??[]);
  }

  async function marcarDirecto() {
    if(!sesion||marcandoDirecto) return;
    setMarcandoDirecto(true);
    const misMarcHoy=marcaciones.filter(m=>m.empleado_id===sesion.id);
    const ultima=misMarcHoy[0];
    const tipo:"entrada"|"salida"=(!ultima||ultima.tipo==="salida")?"entrada":"salida";
    if(!supabaseReady()){
      const nueva:Marcacion={id:Date.now(),empleado_id:sesion.id,tipo,timestamp:new Date().toISOString(),empleados:{nombre:sesion.nombre,cargo:sesion.cargo}};
      setMarcaciones(prev=>[nueva,...prev]); setHistorial(prev=>[nueva,...prev]);
    } else {
      await supabaseAdmin.from("marcaciones").insert({empleado_id:sesion.id,tipo});
      await cargar(); await cargarHistorial();
    }
    setMarcadoOk({nombre:sesion.nombre,tipo});
    setTimeout(()=>setMarcadoOk(null),3500);
    setMarcandoDirecto(false);
  }

  if(!sesion) return null;
  if(isAdmin) return <SupervisorView sesion={sesion} empleados={empleados} marcaciones={marcaciones} turnos={turnos} setTurnos={setTurnos} recargar={cargar}/>;

  const hoy=new Date().toISOString().split("T")[0];
  const misMarcHoy=marcaciones.filter(m=>m.empleado_id===sesion.id&&m.timestamp.startsWith(hoy));
  const ultimaMarca=misMarcHoy[0];
  const enTurno=ultimaMarca?.tipo==="entrada";
  const miTurno=turnos.find(t=>t.empleado_id===sesion.id&&t.fecha===hoy);
  const lunes=getMondayOfWeek(new Date());
  const histSemana=historial.filter(m=>new Date(m.timestamp)>=lunes);
  const horasSemana=agruparPorFecha(histSemana).reduce((s,[,ms])=>s+calcHorasDia(ms),0);

  return <MiTurnoView sesion={sesion} enTurno={enTurno} ultimaMarca={ultimaMarca} miTurno={miTurno} horasSemana={horasSemana} historial={historial} marcadoOk={marcadoOk} marcandoDirecto={marcandoDirecto} onMarcar={marcarDirecto}/>;
}

// ── Vista personal del empleado ────────────────────────────────
function MiTurnoView({sesion,enTurno,ultimaMarca,miTurno,horasSemana,historial,marcadoOk,marcandoDirecto,onMarcar}:{
  sesion:Empleado; enTurno:boolean; ultimaMarca:Marcacion|undefined; miTurno:Turno|undefined;
  horasSemana:number; historial:Marcacion[]; marcadoOk:{nombre:string;tipo:"entrada"|"salida"}|null;
  marcandoDirecto:boolean; onMarcar:()=>void;
}) {
  const hoy=new Date().toISOString().split("T")[0];
  const horasR=Math.round(horasSemana*10)/10;
  const horasEsp=40;
  const pct=Math.min(100,(horasSemana/horasEsp)*100);
  const horaExtra=horasSemana>horasEsp?horasSemana-horasEsp:0;
  const grupos=agruparPorFecha(historial).slice(0,8);

  return (
    <div style={{padding:"28px 32px",maxWidth:900,margin:"0 auto"}} className="fade-up">
      <div style={{marginBottom:28}}>
        <h1 style={{fontSize:24,fontWeight:900,color:"white",marginBottom:4}}>Mi Turno</h1>
        <p style={{color:"var(--muted)",fontSize:14}}>{new Date().toLocaleDateString("es-CO",{weekday:"long",day:"numeric",month:"long"})}</p>
      </div>

      {marcadoOk&&(
        <div className="fade-up" style={{background:marcadoOk.tipo==="entrada"?"rgba(74,222,128,0.1)":"rgba(248,113,113,0.1)",border:`1px solid ${marcadoOk.tipo==="entrada"?"rgba(74,222,128,0.35)":"rgba(248,113,113,0.35)"}`,borderRadius:12,padding:"14px 18px",marginBottom:24,display:"flex",alignItems:"center",gap:12}}>
          {marcadoOk.tipo==="entrada"?<LogIn size={20} color="#4ade80"/>:<LogOutIcon size={20} color="#f87171"/>}
          <div>
            <div style={{fontWeight:700,color:"white",fontSize:15}}>{marcadoOk.tipo==="entrada"?"¡Bienvenido! Entrada registrada":"¡Hasta luego! Salida registrada"}</div>
            <div style={{fontSize:13,color:"var(--muted)"}}>{new Date().toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"})}</div>
          </div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:24}}>
        {/* Estado + botón */}
        <div style={{background:"var(--fondo2)",border:`1px solid ${enTurno?"rgba(74,222,128,0.25)":"var(--borde)"}`,borderRadius:20,padding:"24px",display:"flex",flexDirection:"column",gap:20}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:52,height:52,borderRadius:"50%",background:"rgba(204,18,68,0.15)",border:"2px solid rgba(204,18,68,0.35)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:"var(--rojo)",flexShrink:0}}>
              {getInitials(sesion.nombre)}
            </div>
            <div>
              <div style={{fontWeight:800,color:"white",fontSize:16}}>{sesion.nombre}</div>
              <div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>{CARGO_LABEL[sesion.cargo]}</div>
            </div>
          </div>

          <div style={{background:enTurno?"rgba(74,222,128,0.07)":"rgba(255,255,255,0.02)",border:`1px solid ${enTurno?"rgba(74,222,128,0.18)":"var(--borde)"}`,borderRadius:12,padding:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:enTurno?"#4ade80":"#444",boxShadow:enTurno?"0 0 6px #4ade80":"none"}}/>
              <span style={{fontSize:12,fontWeight:700,color:enTurno?"#4ade80":"var(--muted)",textTransform:"uppercase",letterSpacing:1}}>
                {enTurno?"En turno":"Fuera del turno"}
              </span>
            </div>
            {ultimaMarca?.tipo==="entrada"&&(
              <div style={{fontSize:13,color:"var(--muted)"}}>
                Entrada: <span style={{color:"white",fontWeight:600}}>{new Date(ultimaMarca.timestamp).toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"})}</span>
              </div>
            )}
            {miTurno?(
              <div style={{fontSize:13,color:"var(--muted)",marginTop:4}}>
                Turno: <span style={{color:"#60a5fa",fontWeight:600}}>{normalH(miTurno.hora_inicio)} – {normalH(miTurno.hora_fin)}</span>
                <span style={{marginLeft:8,fontSize:11,color:"#555"}}>({formatDur(calcDurMins(normalH(miTurno.hora_inicio),normalH(miTurno.hora_fin)))})</span>
              </div>
            ):(
              <div style={{fontSize:13,color:"#444",marginTop:4}}>Sin turno asignado hoy</div>
            )}
          </div>

          <button onClick={onMarcar} disabled={marcandoDirecto} style={{padding:"15px",borderRadius:14,border:"none",background:enTurno?"rgba(248,113,113,0.12)":"var(--rojo)",color:enTurno?"#f87171":"white",fontSize:15,fontWeight:800,cursor:marcandoDirecto?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,transition:"all 0.15s",boxShadow:enTurno?"none":"0 4px 14px rgba(204,18,68,0.4)",opacity:marcandoDirecto?0.6:1}}>
            {marcandoDirecto?<><Clock size={18}/>Registrando...</>:enTurno?<><LogOutIcon size={18}/>Marcar salida</>:<><LogIn size={18}/>Marcar entrada</>}
          </button>
        </div>

        {/* Horas semana */}
        <div className="card" style={{padding:"22px 24px",display:"flex",flexDirection:"column",gap:0}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:14}}>Esta semana</div>
          <div style={{fontSize:34,fontWeight:900,color:"white",marginBottom:2}}>
            {horasR}<span style={{fontSize:16,color:"var(--muted)",fontWeight:400}}>h</span>
          </div>
          <div style={{fontSize:13,color:"var(--muted)",marginBottom:16}}>de {horasEsp}h esperadas</div>
          <div style={{background:"var(--fondo3)",borderRadius:6,height:8,overflow:"hidden",marginBottom:8}}>
            <div style={{height:"100%",borderRadius:6,background:pct>=100?"linear-gradient(90deg,#f59e0b,#fbbf24)":"linear-gradient(90deg,var(--rojo),#ff3d6e)",width:`${pct}%`,transition:"width 0.5s"}}/>
          </div>
          <div style={{fontSize:12,color:"var(--muted)"}}>{Math.round(pct)}% completado</div>
          {horaExtra>0&&(
            <div style={{marginTop:14,padding:"8px 12px",borderRadius:8,background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.22)",display:"flex",alignItems:"center",gap:6}}>
              <Zap size={13} color="#f59e0b"/>
              <span style={{fontSize:12,color:"#f59e0b",fontWeight:700}}>+{Math.round(horaExtra*10)/10}h horas extra esta semana</span>
            </div>
          )}
        </div>
      </div>

      {/* Historial */}
      <h2 style={{fontSize:11,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:14}}>Historial reciente</h2>
      <div className="card" style={{padding:0,overflow:"hidden"}}>
        {grupos.length===0&&<div style={{padding:36,textAlign:"center",color:"var(--muted)",fontSize:13}}>Sin registros</div>}
        {grupos.map(([fecha,marcas],i,arr)=>{
          const entrada=marcas.find(m=>m.tipo==="entrada");
          const salida=marcas.find(m=>m.tipo==="salida");
          const horas=calcHorasDia(marcas);
          const esHoy=fecha===hoy;
          const tardanza=entrada&&(()=>{const h=new Date(entrada.timestamp).getHours(),m=new Date(entrada.timestamp).getMinutes();return h>9||(h===9&&m>15);})();
          return (
            <div key={fecha} style={{display:"flex",alignItems:"center",gap:16,padding:"13px 20px",borderBottom:i<arr.length-1?"1px solid var(--borde)":"none",background:esHoy?"rgba(204,18,68,0.04)":"transparent"}}>
              <div style={{minWidth:88}}>
                <div style={{fontSize:13,fontWeight:700,color:esHoy?"var(--rojo)":"white"}}>
                  {esHoy?"Hoy":new Date(fecha+"T12:00:00").toLocaleDateString("es-CO",{weekday:"short",day:"numeric",month:"short"})}
                </div>
              </div>
              <div style={{display:"flex",gap:24,flex:1}}>
                <div><div style={{fontSize:11,color:"var(--muted)",marginBottom:2}}>Entrada</div><div style={{fontSize:14,fontWeight:700,color:entrada?"#4ade80":"#444"}}>{entrada?new Date(entrada.timestamp).toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"}):"—"}</div></div>
                <div><div style={{fontSize:11,color:"var(--muted)",marginBottom:2}}>Salida</div><div style={{fontSize:14,fontWeight:700,color:salida?"#60a5fa":"#444"}}>{salida?new Date(salida.timestamp).toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"}):"—"}</div></div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                {horas>0&&<div style={{background:"var(--fondo3)",border:"1px solid var(--borde)",borderRadius:8,padding:"4px 10px",fontSize:13,fontWeight:700,color:"white"}}>{formatDur(Math.round(horas*60))}</div>}
                {tardanza&&<span className="badge" style={{background:"rgba(251,191,36,0.1)",color:"#fcd34d",fontSize:10}}>tardanza</span>}
                {esHoy&&!salida&&entrada&&<span className="badge" style={{background:"rgba(74,222,128,0.1)",color:"#4ade80",fontSize:10}}>en turno</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Vista Supervisor ───────────────────────────────────────────
function SupervisorView({sesion,empleados,marcaciones,turnos,setTurnos,recargar}:{
  sesion:Empleado; empleados:Empleado[]; marcaciones:Marcacion[]; turnos:Turno[];
  setTurnos:React.Dispatch<React.SetStateAction<Turno[]>>; recargar:()=>void;
}) {
  const [tab,setTab]=useState<Tab>("estado");
  const [periodoHoras,setPeriodoHoras]=useState<PeriodoHoras>("semana");
  const [empSelHist,setEmpSelHist]=useState<number|null>(null);
  const [marcHistorial,setMarcHistorial]=useState<Marcacion[]>([]);
  const [permisos,setPermisos]=useState<Permiso[]>([]);
  const [modalPermiso,setModalPermiso]=useState(false);
  const [formPermiso,setFormPermiso]=useState({empleado_id:0,tipo:"ausencia" as TipoPermiso,fecha:new Date().toISOString().split("T")[0],descripcion:""});
  const [resumenHoras,setResumenHoras]=useState<ResumenHoras[]>([]);
  // Marcar asistencia modal
  const [modalMarcar,setModalMarcar]=useState(false);
  const [cedulaM,setCedulaM]=useState(""); const [pinM,setPinM]=useState(""); const [errM,setErrM]=useState(""); const [marcandoM,setMarcandoM]=useState(false); const [resultM,setResultM]=useState<{nombre:string;tipo:"entrada"|"salida"}|null>(null);

  useEffect(()=>{ if(tab==="horas") cargarHoras(); },[tab,periodoHoras]);
  useEffect(()=>{ if(tab==="historial"&&empSelHist) cargarHistEmpl(empSelHist); },[tab,empSelHist]);
  useEffect(()=>{ if(tab==="permisos") cargarPermisos(); },[tab]);
  useEffect(()=>{ if(pinM.length===4) confirmarMarcacion(); },[pinM]);

  async function cargarHoras(){ if(!supabaseReady()){setResumenHoras(MOCK_HORAS_SEMANA);return;} setResumenHoras(MOCK_HORAS_SEMANA); }
  async function cargarHistEmpl(id:number){
    if(!supabaseReady()){
      const h=[...MOCK_MARCACIONES_HISTORICAS,...marcaciones].filter(m=>m.empleado_id===id).sort((a,b)=>b.timestamp.localeCompare(a.timestamp));
      setMarcHistorial(h);return;
    }
    const hace30=new Date();hace30.setDate(hace30.getDate()-30);
    const{data}=await supabase.from("marcaciones").select("*,empleados(nombre,cargo)").eq("empleado_id",id).gte("timestamp",hace30.toISOString()).order("timestamp",{ascending:false});
    setMarcHistorial((data as Marcacion[])??[]);
  }
  async function cargarPermisos(){
    if(!supabaseReady()){setPermisos(MOCK_PERMISOS);return;}
    const{data}=await supabase.from("permisos").select("*,empleados(nombre)").order("fecha",{ascending:false});
    setPermisos((data as Permiso[])??MOCK_PERMISOS);
  }
  async function guardarPermiso(){
    if(!supabaseReady()){const emp=MOCK_EMPLEADOS.find(e=>e.id===formPermiso.empleado_id);setPermisos(p=>[{id:Date.now(),...formPermiso,aprobado:false,empleado_nombre:emp?.nombre},...p]);}
    else{await supabaseAdmin.from("permisos").insert(formPermiso);await cargarPermisos();}
    setModalPermiso(false);setFormPermiso({empleado_id:0,tipo:"ausencia",fecha:new Date().toISOString().split("T")[0],descripcion:""});
  }
  async function toggleAprobado(p:Permiso){
    if(!supabaseReady()){setPermisos(prev=>prev.map(x=>x.id===p.id?{...x,aprobado:!x.aprobado}:x));return;}
    await supabaseAdmin.from("permisos").update({aprobado:!p.aprobado}).eq("id",p.id);cargarPermisos();
  }
  function presNumpad(v:string){if(v==="⌫")setPinM(p=>p.slice(0,-1));else if(pinM.length<4)setPinM(p=>p+v);}
  async function confirmarMarcacion(){
    if(!cedulaM.trim()){setErrM("Ingresa tu cédula");setPinM("");return;}
    setMarcandoM(true);setErrM("");
    let emp:Empleado|undefined;
    if(!supabaseReady()){emp=MOCK_EMPLEADOS.find(e=>e.cedula===cedulaM.trim()&&e.pin===pinM);}
    else{const{data}=await supabase.from("empleados").select("*").eq("cedula",cedulaM.trim()).eq("pin",pinM).eq("activo",true).single();emp=data as Empleado|undefined;}
    if(!emp){setErrM("Cédula o PIN incorrectos");setPinM("");setMarcandoM(false);return;}
    const ultima=marcaciones.find(m=>m.empleado_id===emp!.id);
    const tipo:"entrada"|"salida"=(!ultima||ultima.tipo==="salida")?"entrada":"salida";
    if(!supabaseReady()){const nueva:Marcacion={id:Date.now(),empleado_id:emp.id,tipo,timestamp:new Date().toISOString(),empleados:{nombre:emp.nombre,cargo:emp.cargo}};marcaciones.unshift(nueva);}
    else{await supabaseAdmin.from("marcaciones").insert({empleado_id:emp.id,tipo});await recargar();}
    setResultM({nombre:emp.nombre,tipo});setMarcandoM(false);
  }
  function abrirMarcar(){setCedulaM("");setPinM("");setErrM("");setResultM(null);setModalMarcar(true);}

  const hoy=new Date().toISOString().split("T")[0];
  const ausentes=empleados.filter(emp=>{
    const t=turnos.find(x=>x.empleado_id===emp.id&&x.fecha===hoy);
    if(!t) return false;
    const[h]=t.hora_inicio.split(":").map(Number);
    const yaDebio=new Date().getHours()>=h+1;
    const ultima=marcaciones.find(m=>m.empleado_id===emp.id);
    return yaDebio&&(!ultima||ultima.tipo==="salida");
  });

  const TABS=[
    {id:"estado" as Tab,label:"Estado",Icon:Users},
    {id:"horarios" as Tab,label:"Horarios",Icon:Calendar},
    {id:"horas" as Tab,label:"Horas",Icon:BarChart2},
    {id:"historial" as Tab,label:"Historial",Icon:Clock},
    {id:"permisos" as Tab,label:"Permisos",Icon:ClipboardList},
  ];

  return (
    <div style={{padding:24}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:800,color:"white"}}>Control de empleados</h2>
          <p style={{color:"var(--muted)",fontSize:14}}>{new Date().toLocaleDateString("es-CO",{weekday:"long",day:"numeric",month:"long"})}</p>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          {ausentes.length>0&&(
            <div style={{background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:10,padding:"8px 14px",display:"flex",alignItems:"center",gap:8}}>
              <AlertTriangle size={16} color="#f87171"/>
              <span style={{fontSize:13,color:"#f87171",fontWeight:600}}>{ausentes.length} sin marcar entrada</span>
            </div>
          )}
          <button className="btn btn-primary" onClick={abrirMarcar}><Clock size={15}/>Marcar asistencia</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:24,borderBottom:"1px solid var(--borde)",paddingBottom:0}}>
        {TABS.map(t=>{
          const active=tab===t.id;
          return(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"10px 16px",background:"none",border:"none",cursor:"pointer",fontSize:13,fontWeight:active?700:500,color:active?"white":"var(--muted)",borderBottom:`2px solid ${active?"var(--rojo)":"transparent"}`,marginBottom:-1,display:"flex",alignItems:"center",gap:6,transition:"color 0.15s"}}>
              <t.Icon size={14}/>{t.label}
            </button>
          );
        })}
      </div>

      {/* TAB: Estado */}
      {tab==="estado"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          <div>
            <h3 style={{fontSize:11,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>Personal hoy</h3>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {empleados.map(emp=>{
                const ultima=marcaciones.find(m=>m.empleado_id===emp.id);
                const turno=turnos.find(t=>t.empleado_id===emp.id&&t.fecha===hoy);
                const adentro=ultima?.tipo==="entrada";
                const alerta=ausentes.find(a=>a.id===emp.id);
                return(
                  <div key={emp.id} style={{background:"var(--fondo2)",border:`1px solid ${alerta?"rgba(248,113,113,0.35)":adentro?"rgba(74,222,128,0.2)":"var(--borde)"}`,borderRadius:14,padding:"12px 14px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:40,height:40,borderRadius:10,background:alerta?"rgba(248,113,113,0.1)":adentro?"rgba(74,222,128,0.1)":"var(--fondo3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:alerta?"#f87171":adentro?"#4ade80":"var(--muted)",flexShrink:0}}>
                        {getInitials(emp.nombre)}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:700,color:"white",fontSize:14}}>{emp.nombre}</div>
                        <div style={{fontSize:12,color:alerta?"#f87171":adentro?"#4ade80":"var(--muted)",marginTop:1}}>
                          {CARGO_LABEL[emp.cargo]} · {alerta?"⚠ Sin marcar":adentro?"Trabajando":"Fuera"}
                        </div>
                        {turno&&<div style={{fontSize:11,color:"#60a5fa",marginTop:1}}>Turno: {normalH(turno.hora_inicio)} – {normalH(turno.hora_fin)}</div>}
                        {ultima&&<div style={{fontSize:11,color:"#444",marginTop:1}}>Última marca: {ultima.tipo} — {formatDateTime(ultima.timestamp)}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <h3 style={{fontSize:11,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>Marcaciones de hoy</h3>
            <div className="card" style={{padding:0,overflow:"hidden",maxHeight:260,overflowY:"auto"}}>
              {[...marcaciones].sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime()).map((m,i,arr)=>(
                <div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:i<arr.length-1?"1px solid var(--borde)":"none"}}>
                  <div style={{width:30,height:30,borderRadius:8,background:m.tipo==="entrada"?"rgba(74,222,128,0.1)":"rgba(248,113,113,0.1)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {m.tipo==="entrada"?<LogIn size={13} color="#4ade80"/>:<LogOutIcon size={13} color="#f87171"/>}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:"white"}}>{(m.empleados as {nombre:string})?.nombre}</div>
                    <div style={{fontSize:11,color:"var(--muted)"}}>{formatDateTime(m.timestamp)}</div>
                  </div>
                  <span className="badge" style={{background:m.tipo==="entrada"?"rgba(74,222,128,0.1)":"rgba(248,113,113,0.1)",color:m.tipo==="entrada"?"#4ade80":"#f87171"}}>{m.tipo}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Horarios */}
      {tab==="horarios"&&(
        <HorariosTab empleados={empleados} turnos={turnos} setTurnos={setTurnos} recargar={recargar}/>
      )}

      {/* TAB: Horas */}
      {tab==="horas"&&(
        <div>
          <div style={{display:"flex",gap:8,marginBottom:18}}>
            {(["semana","mes"] as PeriodoHoras[]).map(p=>(
              <button key={p} onClick={()=>setPeriodoHoras(p)} className={`btn btn-sm ${periodoHoras===p?"btn-primary":"btn-ghost"}`}>{p==="semana"?"Esta semana":"Este mes"}</button>
            ))}
          </div>
          <div className="card" style={{padding:0,overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{borderBottom:"1px solid var(--borde)"}}>
                  {["Empleado","Cargo","Días","Horas trab.","Horas esp.","Diferencia","Tardanzas","Ausencias"].map(h=>(
                    <th key={h} style={{padding:"12px 14px",textAlign:"left",fontSize:11,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:0.5}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resumenHoras.map((r,i)=>{
                  const fac=periodoHoras==="mes"?4.3:1;
                  const ht=+(r.horas_totales*fac).toFixed(1); const he=r.horas_esperadas*fac;
                  const d=+(ht-he).toFixed(1); const dias=Math.round(r.dias_trabajados*fac); const aus=Math.round(r.dias_ausente*fac);
                  return(
                    <tr key={r.empleado_id} style={{borderBottom:i<resumenHoras.length-1?"1px solid var(--borde)":"none"}}>
                      <td style={{padding:"13px 14px"}}><div style={{fontWeight:700,color:"white",fontSize:14}}>{r.nombre}</div></td>
                      <td style={{padding:"13px 14px"}}><span className="badge" style={{background:"rgba(59,130,246,0.1)",color:"#60a5fa"}}>{CARGO_LABEL[r.cargo]}</span></td>
                      <td style={{padding:"13px 14px",color:"white",fontWeight:600}}>{dias}</td>
                      <td style={{padding:"13px 14px",fontWeight:700,color:ht>he?"#f59e0b":"white"}}>{ht}h {ht>he&&<Zap size={12} color="#f59e0b" style={{display:"inline"}}/>}</td>
                      <td style={{padding:"13px 14px",color:"var(--muted)"}}>{he}h</td>
                      <td style={{padding:"13px 14px"}}><span style={{fontWeight:700,color:d>=0?"#4ade80":"#f87171"}}>{d>=0?"+":""}{d}h</span></td>
                      <td style={{padding:"13px 14px"}}>{r.tardanzas>0?<span className="badge" style={{background:"rgba(251,191,36,0.1)",color:"#fcd34d"}}>{r.tardanzas}</span>:<span style={{color:"#333"}}>—</span>}</td>
                      <td style={{padding:"13px 14px"}}>{aus>0?<span className="badge" style={{background:"rgba(248,113,113,0.1)",color:"#f87171"}}>{aus}</span>:<CheckCircle size={14} color="#4ade80"/>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: Historial */}
      {tab==="historial"&&(
        <div>
          <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
            {empleados.map(e=>(
              <button key={e.id} onClick={()=>setEmpSelHist(e.id)} className={`btn btn-sm ${empSelHist===e.id?"btn-primary":"btn-ghost"}`}>{e.nombre.split(" ")[0]}</button>
            ))}
          </div>
          {!empSelHist&&<div className="card" style={{textAlign:"center",padding:60,color:"var(--muted)"}}>Selecciona un empleado para ver su historial</div>}
          {empSelHist&&(
            <div>
              <div style={{fontSize:13,color:"var(--muted)",marginBottom:14}}>Últimos 30 días · {empleados.find(e=>e.id===empSelHist)?.nombre}</div>
              {marcHistorial.length===0?<div className="card" style={{textAlign:"center",padding:40,color:"var(--muted)"}}>Sin registros</div>:(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {agruparPorFecha(marcHistorial).map(([fecha,marcas])=>{
                    const entrada=marcas.find(m=>m.tipo==="entrada"); const salida=marcas.find(m=>m.tipo==="salida");
                    const horas=calcHorasDia(marcas);
                    return(
                      <div key={fecha} style={{background:"var(--fondo2)",border:"1px solid var(--borde)",borderRadius:12,padding:"14px 18px",display:"flex",alignItems:"center",gap:16}}>
                        <div style={{minWidth:96}}><div style={{fontWeight:700,color:"white",fontSize:13}}>{new Date(fecha+"T12:00:00").toLocaleDateString("es-CO",{weekday:"short",day:"numeric",month:"short"})}</div></div>
                        <div style={{display:"flex",gap:20,flex:1}}>
                          <div><div style={{fontSize:11,color:"var(--muted)",marginBottom:2}}>Entrada</div><div style={{fontSize:14,fontWeight:600,color:entrada?"#4ade80":"#f87171"}}>{entrada?new Date(entrada.timestamp).toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"}):"—"}</div></div>
                          <div><div style={{fontSize:11,color:"var(--muted)",marginBottom:2}}>Salida</div><div style={{fontSize:14,fontWeight:600,color:salida?"#60a5fa":"#f87171"}}>{salida?new Date(salida.timestamp).toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"}):"—"}</div></div>
                        </div>
                        {horas>0&&<div style={{background:"var(--fondo3)",borderRadius:8,padding:"5px 11px",fontWeight:700,color:"white",fontSize:13,flexShrink:0}}>{formatDur(Math.round(horas*60))}</div>}
                        {!salida&&<span className="badge" style={{background:"rgba(74,222,128,0.1)",color:"#4ade80",flexShrink:0}}>En turno</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB: Permisos */}
      {tab==="permisos"&&(
        <div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>
            <button className="btn btn-primary" onClick={()=>setModalPermiso(true)}><Plus size={15}/>Registrar novedad</button>
          </div>
          <div className="card" style={{padding:0,overflow:"hidden"}}>
            {permisos.length===0&&<div style={{padding:40,textAlign:"center",color:"var(--muted)"}}>Sin novedades</div>}
            {permisos.map((p,i)=>{
              const c=TIPO_PERMISO_COLOR[p.tipo];
              return(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",borderBottom:i<permisos.length-1?"1px solid var(--borde)":"none"}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                      <span style={{fontWeight:700,color:"white",fontSize:14}}>{p.empleado_nombre}</span>
                      <span className="badge" style={{background:c.bg,color:c.color}}>{TIPO_PERMISO_LABEL[p.tipo]}</span>
                    </div>
                    <div style={{fontSize:13,color:"var(--muted)"}}>{p.descripcion}</div>
                    <div style={{fontSize:11,color:"#444",marginTop:3}}>{new Date(p.fecha+"T12:00:00").toLocaleDateString("es-CO",{weekday:"long",day:"numeric",month:"long"})}</div>
                  </div>
                  <button onClick={()=>toggleAprobado(p)} className={`btn btn-sm ${p.aprobado?"btn-ghost":"btn-success"}`}>{p.aprobado?"✓ Aprobado":"Aprobar"}</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal marcar asistencia */}
      {modalMarcar&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50}} onClick={e=>{if(e.target===e.currentTarget&&!marcandoM)setModalMarcar(false);}}>
          <div className="card fade-up" style={{width:360,textAlign:"center"}}>
            {resultM?(
              <div>
                <div style={{width:64,height:64,borderRadius:"50%",background:resultM.tipo==="entrada"?"rgba(74,222,128,0.15)":"rgba(248,113,113,0.15)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
                  {resultM.tipo==="entrada"?<LogIn size={28} color="#4ade80"/>:<LogOutIcon size={28} color="#f87171"/>}
                </div>
                <div style={{fontSize:20,fontWeight:900,color:"white",marginBottom:6}}>{resultM.tipo==="entrada"?"¡Bienvenido!":"¡Hasta luego!"}</div>
                <div style={{fontSize:15,color:"var(--muted)",marginBottom:4}}>{resultM.nombre}</div>
                <div style={{fontSize:13,color:resultM.tipo==="entrada"?"#4ade80":"#f87171",fontWeight:700,marginBottom:24}}>{resultM.tipo.toUpperCase()} · {new Date().toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"})}</div>
                <button className="btn btn-primary" style={{width:"100%"}} onClick={()=>setModalMarcar(false)}>Listo</button>
              </div>
            ):(
              <div>
                <div style={{fontWeight:800,fontSize:17,color:"white",marginBottom:4}}>Marcar asistencia</div>
                <div style={{fontSize:13,color:"var(--muted)",marginBottom:20}}>Ingresa cédula y PIN</div>
                <div style={{marginBottom:14,textAlign:"left"}}>
                  <label style={{fontSize:12,color:"var(--muted)",display:"block",marginBottom:6}}>Cédula</label>
                  <input className="input" type="text" inputMode="numeric" placeholder="Ej: 1006011001" value={cedulaM} onChange={e=>{setCedulaM(e.target.value);setErrM("");}} style={{textAlign:"center",fontSize:16,letterSpacing:2}} autoFocus/>
                </div>
                <div style={{marginBottom:14}}>
                  <label style={{fontSize:12,color:"var(--muted)",display:"block",marginBottom:10}}>PIN</label>
                  <div style={{display:"flex",justifyContent:"center",gap:10,marginBottom:14}}>
                    {[0,1,2,3].map(i=>(
                      <div key={i} style={{width:40,height:40,borderRadius:9,background:i<pinM.length?"var(--rojo)":"var(--fondo3)",border:`2px solid ${i<pinM.length?"var(--rojo)":"var(--borde)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"white",transition:"all 0.1s"}}>
                        {i<pinM.length?"●":""}
                      </div>
                    ))}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,maxWidth:210,margin:"0 auto"}}>
                    {NUMPAD_VALS.map((n,i)=>(
                      <button key={i} onClick={()=>n&&presNumpad(n)} disabled={marcandoM} style={{height:50,borderRadius:10,background:n==="⌫"?"rgba(248,113,113,0.08)":"var(--fondo3)",border:`1px solid ${n==="⌫"?"rgba(248,113,113,0.2)":"var(--borde)"}`,color:n==="⌫"?"#f87171":"white",fontSize:n==="⌫"?16:18,fontWeight:700,cursor:n?"pointer":"default",opacity:n?1:0,transition:"all 0.1s"}}>
                        {n==="⌫"?<Delete size={16} color="#f87171"/>:n}
                      </button>
                    ))}
                  </div>
                </div>
                {errM&&<div style={{background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:8,padding:"9px 14px",color:"#f87171",fontSize:13,fontWeight:600,marginBottom:12}}>{errM}</div>}
                {marcandoM&&<div style={{color:"var(--muted)",fontSize:13,marginBottom:12}}>Verificando...</div>}
                <button className="btn btn-ghost" style={{width:"100%"}} onClick={()=>setModalMarcar(false)}>Cancelar</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal permiso */}
      {modalPermiso&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50}} onClick={e=>e.target===e.currentTarget&&setModalPermiso(false)}>
          <div className="card fade-up" style={{width:420}}>
            <div style={{fontWeight:800,fontSize:16,color:"white",marginBottom:18}}>Registrar novedad</div>
            <div style={{marginBottom:12}}><label style={{fontSize:12,color:"var(--muted)",display:"block",marginBottom:6}}>Empleado</label><select className="input" value={formPermiso.empleado_id} onChange={e=>setFormPermiso(p=>({...p,empleado_id:parseInt(e.target.value)}))}><option value={0}>Selecciona...</option>{empleados.map(e=><option key={e.id} value={e.id}>{e.nombre}</option>)}</select></div>
            <div style={{marginBottom:12}}><label style={{fontSize:12,color:"var(--muted)",display:"block",marginBottom:6}}>Tipo</label><select className="input" value={formPermiso.tipo} onChange={e=>setFormPermiso(p=>({...p,tipo:e.target.value as TipoPermiso}))}>{(Object.keys(TIPO_PERMISO_LABEL) as TipoPermiso[]).map(t=><option key={t} value={t}>{TIPO_PERMISO_LABEL[t]}</option>)}</select></div>
            <div style={{marginBottom:12}}><label style={{fontSize:12,color:"var(--muted)",display:"block",marginBottom:6}}>Fecha</label><input type="date" className="input" value={formPermiso.fecha} onChange={e=>setFormPermiso(p=>({...p,fecha:e.target.value}))}/></div>
            <div style={{marginBottom:18}}><label style={{fontSize:12,color:"var(--muted)",display:"block",marginBottom:6}}>Descripción</label><input type="text" className="input" value={formPermiso.descripcion} onChange={e=>setFormPermiso(p=>({...p,descripcion:e.target.value}))} placeholder="Ej: Llegó 30 min tarde"/></div>
            <div style={{display:"flex",gap:10}}><button className="btn btn-ghost" style={{flex:1}} onClick={()=>setModalPermiso(false)}>Cancelar</button><button className="btn btn-primary" style={{flex:1}} disabled={!formPermiso.empleado_id||!formPermiso.descripcion} onClick={guardarPermiso}>Guardar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab Horarios ───────────────────────────────────────────────
type ModalTurnoState={turno:Turno|null;empId:number;empNombre:string;fecha:string};

function HorariosTab({empleados,turnos,setTurnos,recargar}:{
  empleados:Empleado[]; turnos:Turno[]; setTurnos:React.Dispatch<React.SetStateAction<Turno[]>>; recargar:()=>void;
}) {
  const [semana,setSemana]=useState(()=>getMondayOfWeek(new Date()));
  const [modal,setModal]=useState<ModalTurnoState|null>(null);
  const dias=getWeekDays(semana);
  const hoy=toDateStr(new Date());

  // Índice rápido turno por empId-fecha
  const turnoIdx: Record<string,Turno>={};
  turnos.forEach(t=>{ turnoIdx[`${t.empleado_id}-${t.fecha}`]=t; });

  function prevSemana(){const d=new Date(semana);d.setDate(d.getDate()-7);setSemana(d);}
  function nextSemana(){const d=new Date(semana);d.setDate(d.getDate()+7);setSemana(d);}

  const totalTurnos=empleados.reduce((s,emp)=>s+dias.filter(d=>turnoIdx[`${emp.id}-${toDateStr(d)}`]).length,0);
  const totalHoras=empleados.reduce((s,emp)=>dias.reduce((ss,d)=>{
    const t=turnoIdx[`${emp.id}-${toDateStr(d)}`];
    return ss+(t?calcDurMins(normalH(t.hora_inicio),normalH(t.hora_fin))/60:0);
  },s),0);

  function abrirModal(turno:Turno|null,emp:Empleado,fecha:string){
    setModal({turno,empId:emp.id,empNombre:emp.nombre,fecha});
  }

  async function guardarTurno(ini:string,fin:string,notas:string){
    if(!modal) return;
    const existing=modal.turno;
    if(!supabaseReady()){
      if(existing){
        setTurnos(prev=>prev.map(t=>t.id===existing.id?{...t,hora_inicio:ini,hora_fin:fin,notas}:t));
      } else {
        const nuevo:Turno={id:Date.now(),empleado_id:modal.empId,fecha:modal.fecha,hora_inicio:ini,hora_fin:fin,notas,empleados:{nombre:modal.empNombre,cargo:empleados.find(e=>e.id===modal.empId)?.cargo as any}};
        setTurnos(prev=>[...prev,nuevo]);
      }
    } else {
      if(existing) await supabaseAdmin.from("turnos").update({hora_inicio:ini,hora_fin:fin,notas}).eq("id",existing.id);
      else await supabaseAdmin.from("turnos").insert({empleado_id:modal.empId,fecha:modal.fecha,hora_inicio:ini,hora_fin:fin,notas});
      recargar();
    }
    setModal(null);
  }

  async function eliminarTurno(){
    if(!modal?.turno) return;
    if(!supabaseReady()){
      setTurnos(prev=>prev.filter(t=>t.id!==modal.turno!.id));
    } else {
      await supabaseAdmin.from("turnos").delete().eq("id",modal.turno.id);
      recargar();
    }
    setModal(null);
  }

  return (
    <div>
      {/* Header semana */}
      <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:24}}>
        <button className="btn btn-ghost btn-sm" onClick={prevSemana}><ChevronLeft size={16}/></button>
        <div style={{flex:1,textAlign:"center"}}>
          <span style={{fontWeight:700,color:"white",fontSize:15}}>
            {dias[0].toLocaleDateString("es-CO",{day:"numeric",month:"long"})} — {dias[6].toLocaleDateString("es-CO",{day:"numeric",month:"long",year:"numeric"})}
          </span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={nextSemana}><ChevronRight size={16}/></button>
      </div>

      {/* Grid */}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 0"}}>
          <thead>
            <tr>
              <th style={{width:160,padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:0.5}}>Empleado</th>
              {dias.map((d,i)=>{
                const esHoy=toDateStr(d)===hoy;
                return(
                  <th key={i} style={{padding:"10px 6px",textAlign:"center",minWidth:88,fontSize:11,fontWeight:700,color:esHoy?"var(--rojo)":"var(--muted)",background:esHoy?"rgba(204,18,68,0.05)":"transparent",borderRadius:esHoy?"8px 8px 0 0":0}}>
                    <div>{DIAS[i]}</div>
                    <div style={{fontSize:14,fontWeight:900,color:esHoy?"var(--rojo)":"white",marginTop:2}}>{d.getDate()}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {empleados.map((emp,ei)=>(
              <tr key={emp.id} style={{background:ei%2===0?"transparent":"rgba(255,255,255,0.01)"}}>
                <td style={{padding:"8px 14px",verticalAlign:"middle"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:30,height:30,borderRadius:"50%",background:"rgba(204,18,68,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"var(--rojo)",flexShrink:0}}>{getInitials(emp.nombre)}</div>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:"white",whiteSpace:"nowrap"}}>{emp.nombre.split(" ")[0]} {emp.nombre.split(" ")[1]}</div>
                      <div style={{fontSize:11,color:"var(--muted)"}}>{CARGO_LABEL[emp.cargo]}</div>
                    </div>
                  </div>
                </td>
                {dias.map((d,di)=>{
                  const key=`${emp.id}-${toDateStr(d)}`;
                  const turno=turnoIdx[key];
                  const esHoy=toDateStr(d)===hoy;
                  return(
                    <td key={di} style={{padding:"6px",verticalAlign:"middle",background:esHoy?"rgba(204,18,68,0.03)":"transparent"}}>
                      <TurnoCell turno={turno} onClick={()=>abrirModal(turno??null,emp,toDateStr(d))}/>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Resumen */}
      <div style={{display:"flex",gap:20,marginTop:20,paddingTop:16,borderTop:"1px solid var(--borde)"}}>
        <div style={{fontSize:13,color:"var(--muted)"}}>Turnos esta semana: <span style={{color:"white",fontWeight:700}}>{totalTurnos}</span></div>
        <div style={{fontSize:13,color:"var(--muted)"}}>Total horas programadas: <span style={{color:"white",fontWeight:700}}>{Math.round(totalHoras)}h</span></div>
      </div>

      {/* Modal turno */}
      {modal&&(
        <ModalTurno
          estado={modal}
          onSave={guardarTurno}
          onDelete={eliminarTurno}
          onClose={()=>setModal(null)}
        />
      )}
    </div>
  );
}

// ── Celda del grid ─────────────────────────────────────────────
function TurnoCell({turno,onClick}:{turno:Turno|undefined;onClick:()=>void}) {
  const [hov,setHov]=useState(false);
  if(!turno){
    return(
      <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} onClick={onClick} style={{height:54,borderRadius:10,border:"1px dashed #252535",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all 0.15s",background:hov?"rgba(255,255,255,0.03)":"transparent",opacity:hov?1:0.5}}>
        {hov&&<Plus size={14} color="#555"/>}
      </div>
    );
  }
  const mins=calcDurMins(normalH(turno.hora_inicio),normalH(turno.hora_fin));
  const esExtra=mins>480;
  return(
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} onClick={onClick} style={{height:54,borderRadius:10,background:esExtra?"rgba(249,115,22,0.1)":"rgba(59,130,246,0.1)",border:`1px solid ${esExtra?"rgba(249,115,22,0.3)":"rgba(59,130,246,0.22)"}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,cursor:"pointer",position:"relative",transition:"all 0.15s"}}>
      <div style={{fontSize:12,fontWeight:700,color:esExtra?"#f97316":"#60a5fa"}}>{normalH(turno.hora_inicio)}</div>
      <div style={{fontSize:11,color:"var(--muted)"}}>{normalH(turno.hora_fin)}</div>
      {esExtra&&<Zap size={9} color="#f97316" style={{position:"absolute",top:4,right:5}}/>}
      {hov&&<div style={{position:"absolute",inset:0,borderRadius:10,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center"}}><Timer size={14} color="white"/></div>}
    </div>
  );
}

// ── Modal crear/editar turno ───────────────────────────────────
function ModalTurno({estado,onSave,onDelete,onClose}:{
  estado:ModalTurnoState; onSave:(ini:string,fin:string,notas:string)=>void;
  onDelete:()=>void; onClose:()=>void;
}) {
  const [ini,setIni]=useState(estado.turno?normalH(estado.turno.hora_inicio):"08:00");
  const [fin,setFin]=useState(estado.turno?normalH(estado.turno.hora_fin):"16:00");
  const [notas,setNotas]=useState(estado.turno?.notas??"");
  const [confirmDel,setConfirmDel]=useState(false);

  const mins=calcDurMins(ini,fin);
  const esExtra=mins>480;
  const fechaLabel=new Date(estado.fecha+"T12:00:00").toLocaleDateString("es-CO",{weekday:"long",day:"numeric",month:"long"});

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="card fade-up" style={{width:380}}>
        <div style={{marginBottom:18}}>
          <div style={{fontWeight:800,fontSize:16,color:"white"}}>{estado.turno?"Editar turno":"Nuevo turno"}</div>
          <div style={{fontSize:13,color:"var(--muted)",marginTop:3}}>{estado.empNombre} · {fechaLabel}</div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div>
            <label style={{fontSize:12,color:"var(--muted)",display:"block",marginBottom:6}}>Hora inicio</label>
            <input type="time" className="input" value={ini} onChange={e=>setIni(e.target.value)}/>
          </div>
          <div>
            <label style={{fontSize:12,color:"var(--muted)",display:"block",marginBottom:6}}>Hora fin</label>
            <input type="time" className="input" value={fin} onChange={e=>setFin(e.target.value)}/>
          </div>
        </div>

        {mins>0&&(
          <div style={{marginBottom:12,padding:"10px 12px",borderRadius:10,background:esExtra?"rgba(249,115,22,0.1)":"rgba(59,130,246,0.08)",border:`1px solid ${esExtra?"rgba(249,115,22,0.25)":"rgba(59,130,246,0.15)"}`,display:"flex",alignItems:"center",gap:8}}>
            {esExtra?<Zap size={15} color="#f97316"/>:<Clock size={15} color="#60a5fa"/>}
            <span style={{fontSize:13,fontWeight:700,color:esExtra?"#f97316":"#60a5fa"}}>
              {formatDur(mins)}
              {esExtra&&` · +${formatDur(mins-480)} horas extra`}
            </span>
          </div>
        )}

        <div style={{marginBottom:18}}>
          <label style={{fontSize:12,color:"var(--muted)",display:"block",marginBottom:6}}>Notas (opcional)</label>
          <input type="text" className="input" value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Ej: Turno especial por evento"/>
        </div>

        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          {estado.turno&&!confirmDel&&(
            <button onClick={()=>setConfirmDel(true)} className="btn btn-danger btn-sm" style={{marginRight:"auto"}}>
              <Trash2 size={14}/>Eliminar
            </button>
          )}
          {confirmDel&&(
            <button onClick={onDelete} className="btn btn-danger btn-sm" style={{marginRight:"auto"}}>
              ¿Confirmar?
            </button>
          )}
          <button className="btn btn-ghost" style={{flex:1}} onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" style={{flex:1}} disabled={!ini||!fin||mins<=0} onClick={()=>onSave(ini,fin,notas)}>
            {estado.turno?"Guardar cambios":"Crear turno"}
          </button>
        </div>
      </div>
    </div>
  );
}
