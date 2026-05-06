"use client";
import { useState, useEffect } from "react";
import { supabase, supabaseAdmin, supabaseReady } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { formatCOP, formatDateTime } from "@/lib/format";
import { MOCK_VENTAS } from "@/lib/mock";

type EstadoCaja = "cerrada" | "abierta" | "cerrada_hoy";

interface TurnoCaja {
  id: number;
  empleado_id: number;
  fondo_inicial: number;
  monto_real?: number;
  diferencia?: number;
  abierto_en: string;
  cerrado_en?: string;
  estado: EstadoCaja;
  notas?: string;
  empleado_nombre?: string;
}

const MOCK_TURNO_ABIERTO: TurnoCaja = {
  id: 1,
  empleado_id: 1,
  fondo_inicial: 200000,
  abierto_en: new Date().toISOString().replace(/T.*/, "T08:10:00.000Z"),
  estado: "abierta",
  empleado_nombre: "Ana García Ruiz",
};

export default function CajaPage() {
  const empleado = getSession();
  const [turnoActual, setTurnoActual] = useState<TurnoCaja | null>(null);
  const [historial, setHistorial] = useState<TurnoCaja[]>([]);
  const [fondo, setFondo] = useState("");
  const [montoReal, setMontoReal] = useState("");
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);
  const [paso, setPaso] = useState<"ver" | "abrir" | "cerrar">("ver");
  const [efectivoEnCaja, setEfectivoEnCaja] = useState(0);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    if (!supabaseReady()) {
      setTurnoActual(MOCK_TURNO_ABIERTO);
      const efectivo = MOCK_VENTAS.filter(v => v.metodo_pago === "efectivo" && !v.anulada).reduce((s, v) => s + v.total, 0);
      setEfectivoEnCaja(efectivo);
      setHistorial([
        { id: 2, empleado_id: 5, fondo_inicial: 150000, monto_real: 487000, diferencia: -13000, abierto_en: new Date(Date.now() - 86400000).toISOString().replace(/T.*/, "T08:05:00.000Z"), cerrado_en: new Date(Date.now() - 86400000).toISOString().replace(/T.*/, "T17:02:00.000Z"), estado: "cerrada_hoy", empleado_nombre: "Sofía Martínez" },
        { id: 3, empleado_id: 1, fondo_inicial: 200000, monto_real: 612000, diferencia: 0, abierto_en: new Date(Date.now() - 172800000).toISOString().replace(/T.*/, "T08:00:00.000Z"), cerrado_en: new Date(Date.now() - 172800000).toISOString().replace(/T.*/, "T16:58:00.000Z"), estado: "cerrada_hoy", empleado_nombre: "Ana García Ruiz" },
      ]);
      return;
    }
    // Con Supabase real
    const hoy = new Date().toISOString().split("T")[0];
    const { data: turno } = await supabase.from("cuadre_caja").select("*, empleados(nombre)").eq("empleado_id", empleado?.id).is("cerrado_en", null).maybeSingle();
    if (turno) {
      setTurnoActual({ ...turno, empleado_nombre: turno.empleados?.nombre, estado: "abierta" });
      // Calcular efectivo desde apertura de este turno
      const { data: ventasEfectivo } = await supabase.from("ventas_pos").select("total").eq("metodo_pago", "efectivo").eq("anulada", false).gte("created_at", turno.abierto_en);
      setEfectivoEnCaja((ventasEfectivo ?? []).reduce((s: number, v: { total: number }) => s + v.total, 0));
    } else {
      const { data: ventasEfectivo } = await supabase.from("ventas_pos").select("total").eq("metodo_pago", "efectivo").eq("anulada", false).gte("created_at", hoy + "T00:00:00");
      setEfectivoEnCaja((ventasEfectivo ?? []).reduce((s: number, v: { total: number }) => s + v.total, 0));
    }
    const { data: hist } = await supabase.from("cuadre_caja").select("*, empleados(nombre)").not("cerrado_en", "is", null).order("abierto_en", { ascending: false }).limit(10);
    setHistorial((hist ?? []).map((h: TurnoCaja & { empleados?: { nombre: string } }) => ({ ...h, empleado_nombre: h.empleados?.nombre, estado: "cerrada_hoy" as EstadoCaja })));
  }

  async function abrirCaja() {
    if (!fondo) return;
    setLoading(true);
    const fondoNum = parseInt(fondo.replace(/\D/g, "")) || 0;
    if (!supabaseReady()) {
      setTurnoActual({ id: Date.now(), empleado_id: empleado?.id ?? 0, fondo_inicial: fondoNum, abierto_en: new Date().toISOString(), estado: "abierta", empleado_nombre: empleado?.nombre });
      setPaso("ver"); setFondo(""); setLoading(false); return;
    }
    await supabaseAdmin.from("cuadre_caja").insert({ empleado_id: empleado?.id, fondo_inicial: fondoNum, ventas_efectivo: 0, total_esperado: fondoNum });
    await cargar(); setPaso("ver"); setFondo(""); setLoading(false);
  }

  async function cerrarCaja() {
    if (!turnoActual || !montoReal) return;
    setLoading(true);
    const montoNum = parseInt(montoReal.replace(/\D/g, "")) || 0;
    const esperado = turnoActual.fondo_inicial + efectivoEnCaja;
    const diferencia = montoNum - esperado;
    if (!supabaseReady()) {
      setHistorial(prev => [{ ...turnoActual, monto_real: montoNum, diferencia, cerrado_en: new Date().toISOString(), estado: "cerrada_hoy" }, ...prev]);
      setTurnoActual(null); setPaso("ver"); setMontoReal(""); setNotas(""); setLoading(false); return;
    }
    await supabaseAdmin.from("cuadre_caja").update({ monto_real: montoNum, diferencia, ventas_efectivo: efectivoEnCaja, total_esperado: esperado, cerrado_en: new Date().toISOString(), notas }).eq("id", turnoActual.id);
    await cargar(); setPaso("ver"); setMontoReal(""); setNotas(""); setLoading(false);
  }

  const esperadoEnCaja = (turnoActual?.fondo_inicial ?? 0) + efectivoEnCaja;
  const diferenciaCierre = montoReal ? (parseInt(montoReal.replace(/\D/g, "")) || 0) - esperadoEnCaja : null;

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "white" }}>Cuadre de caja</h2>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Apertura y cierre de turno</p>
      </div>

      {/* Estado actual */}
      {paso === "ver" && (
        <>
          {turnoActual ? (
            <div style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 8px #4ade80" }} />
                    <span style={{ color: "#4ade80", fontWeight: 700, fontSize: 14 }}>Caja abierta</span>
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: 13 }}>Cajero: {turnoActual.empleado_nombre}</div>
                  <div style={{ color: "var(--muted)", fontSize: 13 }}>Apertura: {formatDateTime(turnoActual.abierto_en)}</div>
                </div>
                <button className="btn btn-danger" onClick={() => setPaso("cerrar")}>Cerrar caja</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
                {[
                  { label: "Fondo inicial", value: formatCOP(turnoActual.fondo_inicial), color: "#60a5fa" },
                  { label: "Efectivo en ventas", value: formatCOP(efectivoEnCaja), color: "#4ade80" },
                  { label: "Total esperado en caja", value: formatCOP(esperadoEnCaja), color: "white" },
                ].map(s => (
                  <div key={s.label} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 16, padding: 24, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f87171" }} />
                  <span style={{ color: "#f87171", fontWeight: 700, fontSize: 14 }}>Caja cerrada</span>
                </div>
                <div style={{ color: "var(--muted)", fontSize: 13 }}>Abre la caja para empezar el turno</div>
              </div>
              <button className="btn btn-success" onClick={() => setPaso("abrir")}>Abrir caja</button>
            </div>
          )}

          {/* Historial */}
          {historial.length > 0 && (
            <>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Historial de turnos</h3>
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                {historial.map((h, i) => {
                  const ok = h.diferencia === 0;
                  const sobrante = (h.diferencia ?? 0) > 0;
                  return (
                    <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderBottom: i < historial.length - 1 ? "1px solid var(--borde)" : "none" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: "white", fontSize: 14 }}>{h.empleado_nombre}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                          {formatDateTime(h.abierto_en)} → {h.cerrado_en ? formatDateTime(h.cerrado_en) : "—"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 2 }}>Fondo: {formatCOP(h.fondo_inicial)}</div>
                        {h.monto_real !== undefined && (
                          <div style={{ fontWeight: 700, color: ok ? "#4ade80" : sobrante ? "#60a5fa" : "#f87171", fontSize: 14 }}>
                            {ok ? "✓ Cuadrado" : sobrante ? `+${formatCOP(h.diferencia ?? 0)}` : `${formatCOP(h.diferencia ?? 0)}`}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* Abrir caja */}
      {paso === "abrir" && (
        <div className="fade-up card" style={{ maxWidth: 400 }}>
          <h3 style={{ fontWeight: 800, color: "white", fontSize: 16, marginBottom: 20 }}>Apertura de caja</h3>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: "var(--muted)", display: "block", marginBottom: 6 }}>Cajero</label>
            <div style={{ fontSize: 15, fontWeight: 600, color: "white" }}>{empleado?.nombre}</div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, color: "var(--muted)", display: "block", marginBottom: 6 }}>Fondo inicial en efectivo ($)</label>
            <input type="number" className="input" style={{ fontSize: 20, textAlign: "center" }} value={fondo} onChange={e => setFondo(e.target.value)} placeholder="200000" autoFocus />
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>Ingresa el dinero que hay en la caja al comenzar el turno</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setPaso("ver")}>Cancelar</button>
            <button className="btn btn-success" style={{ flex: 1 }} disabled={!fondo || loading} onClick={abrirCaja}>
              {loading ? "Abriendo..." : "✓ Abrir caja"}
            </button>
          </div>
        </div>
      )}

      {/* Cerrar caja */}
      {paso === "cerrar" && turnoActual && (
        <div className="fade-up card" style={{ maxWidth: 440 }}>
          <h3 style={{ fontWeight: 800, color: "white", fontSize: 16, marginBottom: 20 }}>Cierre de caja</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            <div style={{ background: "var(--fondo3)", borderRadius: 12, padding: "14px" }}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Fondo inicial</div>
              <div style={{ fontWeight: 700, color: "white" }}>{formatCOP(turnoActual.fondo_inicial)}</div>
            </div>
            <div style={{ background: "var(--fondo3)", borderRadius: 12, padding: "14px" }}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Ventas en efectivo</div>
              <div style={{ fontWeight: 700, color: "#4ade80" }}>{formatCOP(efectivoEnCaja)}</div>
            </div>
          </div>
          <div style={{ background: "var(--fondo3)", borderRadius: 12, padding: "14px 16px", marginBottom: 20, display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--muted)", fontSize: 14 }}>Total esperado en caja</span>
            <span style={{ fontWeight: 800, color: "white", fontSize: 16 }}>{formatCOP(esperadoEnCaja)}</span>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: "var(--muted)", display: "block", marginBottom: 6 }}>Efectivo contado en caja ($)</label>
            <input type="number" className="input" style={{ fontSize: 18, textAlign: "center" }} value={montoReal} onChange={e => setMontoReal(e.target.value)} placeholder="0" autoFocus />
          </div>
          {diferenciaCierre !== null && (
            <div style={{ padding: "14px 16px", borderRadius: 12, marginBottom: 16, background: diferenciaCierre === 0 ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)", border: `1px solid ${diferenciaCierre === 0 ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, color: diferenciaCierre === 0 ? "#4ade80" : "#f87171" }}>
                  {diferenciaCierre === 0 ? "✓ Caja cuadrada" : diferenciaCierre > 0 ? "Sobrante" : "Faltante"}
                </span>
                <span style={{ fontWeight: 800, fontSize: 18, color: diferenciaCierre === 0 ? "#4ade80" : "#f87171" }}>
                  {diferenciaCierre === 0 ? "" : diferenciaCierre > 0 ? "+" : ""}{formatCOP(diferenciaCierre)}
                </span>
              </div>
            </div>
          )}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, color: "var(--muted)", display: "block", marginBottom: 6 }}>Notas (opcional)</label>
            <input type="text" className="input" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones del turno..." />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setPaso("ver")}>Cancelar</button>
            <button className="btn btn-danger" style={{ flex: 1 }} disabled={!montoReal || loading} onClick={cerrarCaja}>
              {loading ? "Cerrando..." : "Cerrar turno"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
