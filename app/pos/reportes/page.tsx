"use client";
import { useState, useEffect } from "react";
import { supabase, supabaseAdmin, supabaseReady } from "@/lib/supabase";
import { VentaPos } from "@/lib/types";
import { formatCOP, formatDateTime, METODO_LABEL } from "@/lib/format";
import { MOCK_VENTAS, MOCK_EMPLEADOS } from "@/lib/mock";

type Periodo = "hoy" | "semana" | "mes";

const PELICULAS_MOCK = [
  { titulo: "Spider-Man: No Way Home", boletos: 47, emoji: "🕷️" },
  { titulo: "Avatar: El Camino del Agua", boletos: 38, emoji: "🌊" },
  { titulo: "Dune: Parte Dos", boletos: 29, emoji: "🏜️" },
  { titulo: "Oppenheimer", boletos: 21, emoji: "💥" },
];

const HORAS_MOCK = [
  { hora: "10am", ventas: 42000 }, { hora: "11am", ventas: 78000 },
  { hora: "12pm", ventas: 134000 }, { hora: "1pm", ventas: 98000 },
  { hora: "2pm", ventas: 156000 }, { hora: "3pm", ventas: 187000 },
  { hora: "4pm", ventas: 143000 }, { hora: "5pm", ventas: 201000 },
  { hora: "6pm", ventas: 224000 }, { hora: "7pm", ventas: 198000 },
  { hora: "8pm", ventas: 167000 }, { hora: "9pm", ventas: 89000 },
];

// Modal de anulación
function ModalAnulacion({ venta, onConfirm, onClose }: { venta: VentaPos; onConfirm: (pin: string, motivo: string) => void; onClose: () => void }) {
  const [pin, setPin] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");

  function confirmar() {
    if (pin.length < 4) { setError("PIN inválido"); return; }
    if (!motivo.trim()) { setError("Escribe un motivo"); return; }
    onConfirm(pin, motivo);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card fade-up" style={{ width: 400 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(248,113,113,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>⛔</div>
          <div>
            <div style={{ fontWeight: 800, color: "white", fontSize: 16 }}>Anular venta</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Venta #{venta.id} · {formatCOP(venta.total)}</div>
          </div>
        </div>
        <div style={{ background: "var(--fondo3)", borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "var(--muted)" }}>
          Esta acción no se puede deshacer. Se requiere PIN de supervisor.
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 6 }}>PIN del supervisor</label>
          <input type="password" className="input" style={{ textAlign: "center", letterSpacing: 8, fontSize: 20 }} value={pin} onChange={e => setPin(e.target.value)} placeholder="····" maxLength={6} autoFocus />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 6 }}>Motivo de anulación</label>
          <select className="input" value={motivo} onChange={e => setMotivo(e.target.value)}>
            <option value="">Selecciona un motivo...</option>
            <option value="Error del cajero">Error del cajero</option>
            <option value="Solicitud del cliente">Solicitud del cliente</option>
            <option value="Cobro duplicado">Cobro duplicado</option>
            <option value="Falla del sistema">Falla del sistema</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
        {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-danger" style={{ flex: 1 }} onClick={confirmar}>Confirmar anulación</button>
        </div>
      </div>
    </div>
  );
}

export default function ReportesPage() {
  const [periodo, setPeriodo] = useState<Periodo>("hoy");
  const [ventas, setVentas] = useState<VentaPos[]>([]);
  const [loading, setLoading] = useState(true);
  const [ventaAAnular, setVentaAAnular] = useState<VentaPos | null>(null);
  const [anulando, setAnulando] = useState(false);

  useEffect(() => { cargar(); }, [periodo]);

  async function cargar() {
    setLoading(true);
    if (!supabaseReady()) {
      if (periodo === "hoy") {
        setVentas(MOCK_VENTAS);
      } else {
        const extras: VentaPos[] = [];
        const dias = periodo === "semana" ? 6 : 22;
        for (let d = 1; d <= dias; d++) {
          MOCK_VENTAS.slice(0, 7).forEach((v, i) => {
            const fecha = new Date(); fecha.setDate(fecha.getDate() - d); fecha.setHours(9 + i * 2, 15);
            extras.push({ ...v, id: v.id + d * 100 + i, created_at: fecha.toISOString() });
          });
        }
        setVentas([...MOCK_VENTAS, ...extras].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      }
      setLoading(false);
      return;
    }
    const ahora = new Date();
    let desde: string;
    if (periodo === "hoy") desde = ahora.toISOString().split("T")[0] + "T00:00:00";
    else if (periodo === "semana") { const d = new Date(ahora); d.setDate(d.getDate() - 7); desde = d.toISOString(); }
    else { const d = new Date(ahora); d.setDate(1); desde = d.toISOString().split("T")[0] + "T00:00:00"; }
    const { data } = await supabase.from("ventas_pos").select("*, empleados(nombre)").gte("created_at", desde).order("created_at", { ascending: false });
    setVentas((data as VentaPos[]) ?? []);
    setLoading(false);
  }

  async function anularVenta(pin: string, motivo: string) {
    if (!ventaAAnular) return;
    setAnulando(true);

    if (!supabaseReady()) {
      // Verificar PIN demo (supervisor = 3333)
      const supervisor = MOCK_EMPLEADOS.find(e => e.pin === pin && (e.cargo === "supervisor" || e.cargo === "admin"));
      if (!supervisor) { alert("PIN incorrecto o no tienes permisos de supervisor"); setAnulando(false); return; }
      setVentas(prev => prev.map(v => v.id === ventaAAnular.id ? { ...v, anulada: true } : v));
      setVentaAAnular(null); setAnulando(false); return;
    }
    const supervisor = await supabase.from("empleados").select("*").eq("pin", pin).in("cargo", ["supervisor", "admin"]).single();
    if (supervisor.error || !supervisor.data) { alert("PIN incorrecto o no tienes permisos de supervisor"); setAnulando(false); return; }
    await supabaseAdmin.from("ventas_pos").update({ anulada: true, notas_anulacion: `${motivo} — ${supervisor.data.nombre}` } as object).eq("id", ventaAAnular.id);
    await cargar();
    setVentaAAnular(null); setAnulando(false);
  }

  const ventasValidas = ventas.filter(v => !v.anulada);
  const ventasAnuladas = ventas.filter(v => v.anulada);
  const totalGeneral = ventasValidas.reduce((s, v) => s + v.total, 0);
  const totalTaquilla = ventasValidas.filter(v => v.tipo === "taquilla" || v.tipo === "mixta").reduce((s, v) => s + v.total, 0);
  const totalConfiteria = ventasValidas.filter(v => v.tipo === "confiteria").reduce((s, v) => s + v.total, 0);
  const ticketPromedio = ventasValidas.length > 0 ? Math.round(totalGeneral / ventasValidas.length) : 0;
  const porMetodo = ventasValidas.reduce((acc, v) => { acc[v.metodo_pago] = (acc[v.metodo_pago] ?? 0) + v.total; return acc; }, {} as Record<string, number>);

  // Horas para gráfica
  const horaData = periodo === "hoy" ? HORAS_MOCK : HORAS_MOCK.map(h => ({ ...h, ventas: h.ventas * (periodo === "semana" ? 5.8 : 23) }));
  const maxHora = Math.max(...horaData.map(h => h.ventas));

  // Películas para gráfica
  const pelisData = periodo === "hoy" ? PELICULAS_MOCK : PELICULAS_MOCK.map(p => ({ ...p, boletos: p.boletos * (periodo === "semana" ? 6 : 24) }));
  const maxBoletos = Math.max(...pelisData.map(p => p.boletos));

  return (
    <div style={{ padding: 24 }}>
      {ventaAAnular && <ModalAnulacion venta={ventaAAnular} onConfirm={anularVenta} onClose={() => setVentaAAnular(null)} />}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "white" }}>Reportes</h2>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>{ventasValidas.length} transacciones · {ventasAnuladas.length > 0 && `${ventasAnuladas.length} anuladas`}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["hoy", "semana", "mes"] as Periodo[]).map(p => (
            <button key={p} onClick={() => setPeriodo(p)} className={`btn btn-sm ${periodo === p ? "btn-primary" : "btn-ghost"}`}>
              {p === "hoy" ? "Hoy" : p === "semana" ? "7 días" : "Este mes"}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Total ventas", value: formatCOP(totalGeneral), color: "#CC1244", icon: "💰" },
          { label: "Transacciones", value: ventasValidas.length.toString(), color: "#3b82f6", icon: "🧾" },
          { label: "Taquilla", value: formatCOP(totalTaquilla), color: "#8b5cf6", icon: "🎟️" },
          { label: "Confitería", value: formatCOP(totalConfiteria), color: "#f59e0b", icon: "🍿" },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: "20px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</span>
              <span style={{ fontSize: 18 }}>{s.icon}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{loading ? "..." : s.value}</div>
          </div>
        ))}
      </div>

      {/* Gráficas */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

        {/* Gráfica ventas por hora */}
        <div className="card">
          <div style={{ fontWeight: 700, color: "white", marginBottom: 18, fontSize: 14 }}>Ventas por hora</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
            {horaData.map(h => {
              const pct = maxHora > 0 ? (h.ventas / maxHora) * 100 : 0;
              const esPico = h.ventas === maxHora;
              return (
                <div key={h.hora} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", height: `${pct}%`, borderRadius: "4px 4px 0 0", background: esPico ? "var(--rojo)" : "rgba(204,18,68,0.3)", transition: "height 0.5s ease", minHeight: 3, position: "relative" }}
                    title={formatCOP(h.ventas)} />
                  <span style={{ fontSize: 9, color: esPico ? "var(--rojo)" : "#444", fontWeight: esPico ? 700 : 400 }}>{h.hora}</span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: "var(--muted)", textAlign: "right" }}>
            Hora pico: {horaData.find(h => h.ventas === maxHora)?.hora} · {formatCOP(maxHora)}
          </div>
        </div>

        {/* Gráfica películas más vendidas */}
        <div className="card">
          <div style={{ fontWeight: 700, color: "white", marginBottom: 18, fontSize: 14 }}>Películas más vendidas</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pelisData.map((p, i) => {
              const pct = maxBoletos > 0 ? (p.boletos / maxBoletos) * 100 : 0;
              return (
                <div key={p.titulo}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14 }}>{p.emoji}</span>
                      <span style={{ fontSize: 12, color: "white", fontWeight: 600 }}>{p.titulo.split(":")[0]}</span>
                    </div>
                    <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>{p.boletos} boletos</span>
                  </div>
                  <div style={{ height: 8, background: "var(--fondo3)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: i === 0 ? "var(--rojo)" : i === 1 ? "#8b5cf6" : i === 2 ? "#3b82f6" : "#555", borderRadius: 4, transition: "width 0.6s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Por método */}
        <div>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Por método de pago</h3>
          <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 14 }}>
            {Object.entries(porMetodo).sort((a,b) => b[1]-a[1]).map(([metodo, monto], i, arr) => {
              const pct = totalGeneral > 0 ? Math.round((monto / totalGeneral) * 100) : 0;
              return (
                <div key={metodo} style={{ padding: "14px 16px", borderBottom: i < arr.length - 1 ? "1px solid var(--borde)" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{metodo === "efectivo" ? "💵" : metodo === "tarjeta" ? "💳" : metodo === "nequi" ? "📲" : "🎁"}</span>
                      <span style={{ fontSize: 14, color: "white", fontWeight: 600 }}>{METODO_LABEL[metodo] ?? metodo}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800, color: "#4ade80", fontSize: 15 }}>{formatCOP(monto)}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{pct}%</div>
                    </div>
                  </div>
                  <div style={{ height: 4, background: "var(--fondo3)", borderRadius: 2 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "#CC1244", borderRadius: 2, transition: "width 0.5s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Ticket promedio</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "white" }}>{formatCOP(ticketPromedio)}</div>
            </div>
            <span style={{ fontSize: 28 }}>📈</span>
          </div>
        </div>

        {/* Transacciones con anulación */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1.5 }}>Transacciones</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => {
              const csv = ["ID,Tipo,Metodo,Total,Anulada,Empleado,Fecha", ...ventas.map(v => `${v.id},${v.tipo},${v.metodo_pago},${v.total},${v.anulada},${(v.empleados as { nombre: string })?.nombre ?? ""},${v.created_at}`)].join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
              a.download = `ventas_${periodo}_${new Date().toISOString().split("T")[0]}.csv`; a.click();
            }}>⬇️ CSV</button>
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden", maxHeight: 420, overflowY: "auto" }}>
            {ventas.slice(0, 30).map((v, i) => (
              <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: i < Math.min(30, ventas.length) - 1 ? "1px solid var(--borde)" : "none", opacity: v.anulada ? 0.4 : 1 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: v.anulada ? "rgba(100,100,100,0.15)" : v.tipo === "taquilla" ? "rgba(139,92,246,0.15)" : "rgba(245,158,11,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
                  {v.anulada ? "⛔" : v.tipo === "taquilla" ? "🎟️" : "🍿"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: v.anulada ? "var(--muted)" : "white", fontWeight: 600, textTransform: "capitalize", textDecoration: v.anulada ? "line-through" : "none" }}>
                    {v.tipo} · {METODO_LABEL[v.metodo_pago]}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    {(v.empleados as { nombre: string })?.nombre?.split(" ")[0]} · {formatDateTime(v.created_at)}
                  </div>
                </div>
                <div style={{ fontWeight: 800, color: v.anulada ? "#555" : "#4ade80", fontSize: 13, textDecoration: v.anulada ? "line-through" : "none" }}>
                  {formatCOP(v.total)}
                </div>
                {!v.anulada && (
                  <button onClick={() => setVentaAAnular(v)} title="Anular venta"
                    style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--borde)", background: "transparent", color: "#555", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#f87171"; e.currentTarget.style.color = "#f87171"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--borde)"; e.currentTarget.style.color = "#555"; }}
                  >⛔</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
