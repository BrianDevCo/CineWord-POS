"use client";
import { useState, useEffect, useRef } from "react";
import {
  Film, Ticket, ShoppingBag, CreditCard,
  Banknote, Smartphone, Gift, Copy, Check,
  CheckCircle, ArrowLeft, X,
} from "lucide-react";
import { supabase, supabaseAdmin, supabaseReady, getSupabaseClient } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { Funcion, ItemCarrito, TipoEntrada, MetodoPago } from "@/lib/types";
import { formatCOP, formatHora, ENTRADA_LABEL, METODO_LABEL } from "@/lib/format";
import { MOCK_FUNCIONES, MOCK_ASIENTOS_OCUPADOS } from "@/lib/mock";

const DESCUENTOS: Record<TipoEntrada, number> = {
  regular: 0, vip: 0, nino: 0.3, adulto_mayor: 0.3, estudiante: 0.2,
};

type Paso = "funcion" | "asientos" | "carrito" | "pago" | "exito";

const METODO_META: Record<MetodoPago, { Icon: React.ElementType; label: string }> = {
  efectivo: { Icon: Banknote,   label: "Efectivo" },
  tarjeta:  { Icon: CreditCard, label: "Tarjeta"  },
  nequi:    { Icon: Smartphone, label: "Nequi"    },
  cortesia: { Icon: Gift,       label: "Cortesía" },
};

const PASOS_STEPPER: { key: Paso; label: string }[] = [
  { key: "funcion",  label: "Función"  },
  { key: "asientos", label: "Asientos" },
  { key: "carrito",  label: "Carrito"  },
  { key: "pago",     label: "Pago"     },
];

export default function TaquillaPage() {
  const [paso, setPaso] = useState<Paso>("funcion");
  const [funciones, setFunciones] = useState<Funcion[]>([]);
  const [funcionSel, setFuncionSel] = useState<Funcion | null>(null);
  const [asientosOcupados, setAsientosOcupados] = useState<string[]>([]);
  const [asientosSel, setAsientosSel] = useState<string[]>([]);
  const [tipoEntrada, setTipoEntrada] = useState<TipoEntrada>("regular");
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [efectivoRecibido, setEfectivoRecibido] = useState("");
  const [descuento, setDescuento] = useState(0);
  const [loading, setLoading] = useState(false);
  const [ventaId, setVentaId] = useState<number | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const canalRef = useRef<ReturnType<NonNullable<ReturnType<typeof getSupabaseClient>>["channel"]> | null>(null);
  const empleado = getSession();

  useEffect(() => { cargarFunciones(); }, []);

  async function cargarFunciones() {
    if (!supabaseReady()) { setFunciones(MOCK_FUNCIONES); return; }
    const hoy = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("funciones")
      .select("*, peliculas(id,titulo,clasificacion,duracion), salas(nombre,tipo,filas,columnas,filas_vip)")
      .eq("activa", true).gte("fecha", hoy).order("fecha").order("hora");
    setFunciones((data as Funcion[]) ?? MOCK_FUNCIONES);
  }

  async function seleccionarFuncion(f: Funcion) {
    setFuncionSel(f);
    if (canalRef.current) { canalRef.current.unsubscribe(); canalRef.current = null; }

    if (!supabaseReady()) {
      setAsientosOcupados(MOCK_ASIENTOS_OCUPADOS[f.id] ?? []);
    } else {
      const { data } = await supabase.from("asientos_ocupados").select("fila,columna").eq("funcion_id", f.id);
      setAsientosOcupados((data ?? []).map((a: { fila: string; columna: number }) => `${a.fila}${a.columna}`));

      const client = getSupabaseClient();
      if (client) {
        const canal = client
          .channel(`asientos-funcion-${f.id}`)
          .on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "asientos_ocupados",
            filter: `funcion_id=eq.${f.id}`,
          }, (payload) => {
            const nuevo = payload.new as { fila: string; columna: number };
            const id = `${nuevo.fila}${nuevo.columna}`;
            setAsientosOcupados(prev => prev.includes(id) ? prev : [...prev, id]);
            setAsientosSel(prev => prev.filter(a => a !== id));
          })
          .subscribe();
        canalRef.current = canal;
      }
    }
    setAsientosSel([]);
    setPaso("asientos");
  }

  useEffect(() => {
    return () => { canalRef.current?.unsubscribe(); };
  }, []);

  function toggleAsiento(id: string) {
    setAsientosSel((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]);
  }

  function agregarAlCarrito() {
    if (!funcionSel || asientosSel.length === 0) return;
    const sala = funcionSel.salas!;
    const items: ItemCarrito[] = asientosSel.map((asiento) => {
      const fila = asiento.slice(0, 1);
      const esVip = sala.filas_vip?.includes(fila);
      const precioBase = esVip ? funcionSel.precio_vip : funcionSel.precio_regular;
      const precio = Math.round(precioBase * (1 - DESCUENTOS[tipoEntrada]));
      return {
        tipo: "boleto",
        label: `${funcionSel.peliculas!.titulo} — Asiento ${asiento} (${ENTRADA_LABEL[tipoEntrada]})`,
        cantidad: 1, precio_unitario: precio, subtotal: precio,
        meta: { funcion_id: funcionSel.id, asiento, tipo_entrada: tipoEntrada, fila, esVip },
      };
    });
    setCarrito((prev) => [...prev, ...items]);
    setPaso("carrito");
  }

  function quitarItem(i: number) { setCarrito((prev) => prev.filter((_, idx) => idx !== i)); }

  const subtotal = carrito.reduce((s, i) => s + i.subtotal, 0);
  const total = Math.max(0, subtotal - descuento);
  const cambio = metodo === "efectivo" ? (parseFloat(efectivoRecibido) || 0) - total : 0;

  async function procesarVenta() {
    if (carrito.length === 0) return;
    setLoading(true);

    if (!supabaseReady()) {
      await new Promise((r) => setTimeout(r, 800));
      setVentaId(Math.floor(Math.random() * 900) + 100);
      setQrToken("demo-" + Math.random().toString(36).slice(2, 10));
      setPaso("exito");
      setLoading(false);
      return;
    }

    try {
      const boletos = carrito.filter((i) => i.tipo === "boleto");
      const funcion = funcionSel!;

      const asientosJsonb = boletos.map(b => ({ fila: b.meta?.fila, columna: parseInt(String(b.meta?.asiento).slice(1)) }));
      const { data: reserva, error: errReserva } = await supabaseAdmin
        .from("reservas")
        .insert({
          funcion_id: funcion.id,
          email: "taquilla@cineworld.co",
          nombre: "Venta en taquilla",
          telefono: "",
          asientos: asientosJsonb,
          total,
          estado: "pagado",
          origen: "pos",
        })
        .select("id, qr_token")
        .single();
      if (errReserva || !reserva) throw errReserva;

      if (boletos.length > 0) {
        const { error: errAsientos } = await supabaseAdmin.from("asientos_ocupados").insert(
          boletos.map((b) => ({
            funcion_id: b.meta?.funcion_id,
            fila: b.meta?.fila,
            columna: parseInt(String(b.meta?.asiento).slice(1)),
            reserva_id: reserva.id,
          }))
        );
        if (errAsientos) throw errAsientos;
      }

      const { data: venta, error: errVenta } = await supabaseAdmin
        .from("ventas_pos")
        .insert({ empleado_id: empleado?.id, reserva_id: reserva.id, metodo_pago: metodo, subtotal, descuento, total, tipo: "taquilla" })
        .select("id")
        .single();
      if (errVenta || !venta) throw errVenta;

      await supabaseAdmin.from("items_venta_pos").insert(
        carrito.map((item) => ({
          venta_id: venta.id, tipo: item.tipo,
          funcion_id: item.meta?.funcion_id ?? null,
          asientos: item.meta?.asiento ? [item.meta.asiento] : [],
          tipo_entrada: item.meta?.tipo_entrada ?? null,
          producto_id: item.meta?.producto_id ?? null,
          cantidad: item.cantidad, precio_unitario: item.precio_unitario, subtotal: item.subtotal,
        }))
      );

      setVentaId(venta.id);
      setQrToken(reserva.qr_token);
      setPaso("exito");
    } catch (err) {
      console.error(err);
      alert("Error al procesar la venta. Verifica que los asientos no estén ya ocupados.");
    }
    setLoading(false);
  }

  function copiarToken() {
    if (!qrToken) return;
    navigator.clipboard.writeText(qrToken);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  function reset() {
    setPaso("funcion"); setFuncionSel(null); setAsientosSel([]);
    setCarrito([]); setDescuento(0); setEfectivoRecibido(""); setMetodo("efectivo");
    setVentaId(null); setQrToken(null); setCopiado(false);
  }

  const porPelicula = funciones.reduce((acc, f) => {
    const key = f.peliculas?.titulo ?? "Sin título";
    if (!acc[key]) acc[key] = [];
    acc[key].push(f);
    return acc;
  }, {} as Record<string, Funcion[]>);

  return (
    <div style={{ padding: 24, height: "100%", display: "flex", flexDirection: "column" }}>

      {/* Stepper */}
      <Stepper paso={paso} />

      {/* PASO 1: Selección de función */}
      {paso === "funcion" && (
        <div className="fade-up" style={{ overflowY: "auto", flex: 1 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "white", marginBottom: 20 }}>Cartelera de hoy</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {Object.entries(porPelicula).map(([titulo, fs]) => {
              const f0 = fs[0];
              return (
                <div key={titulo}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                      background: "rgba(204,18,68,0.12)",
                      border: "1px solid rgba(204,18,68,0.25)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Film size={22} color="var(--rojo)" strokeWidth={2} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, color: "white", fontSize: 16 }}>{titulo}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        {f0.peliculas?.clasificacion} · {f0.peliculas?.duracion}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {fs.map((f) => <FunctionCard key={f.id} funcion={f} onSelect={() => seleccionarFuncion(f)} />)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PASO 2: Asientos */}
      {paso === "asientos" && funcionSel && (
        <div className="fade-up" style={{ flex: 1, display: "flex", gap: 20 }}>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "white" }}>{funcionSel.peliculas?.titulo}</h2>
                <p style={{ color: "var(--muted)", fontSize: 13 }}>
                  {formatHora(funcionSel.hora)} · {funcionSel.formato} · {funcionSel.salas?.nombre}
                  {supabaseReady() && <span style={{ color: "#4ade80", marginLeft: 8, fontSize: 11 }}>● En vivo</span>}
                </p>
              </div>
              <BackBtn onClick={() => setPaso("funcion")} />
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {(Object.keys(ENTRADA_LABEL) as TipoEntrada[]).map((t) => (
                <button key={t} onClick={() => setTipoEntrada(t)} className={`btn btn-sm ${tipoEntrada === t ? "btn-primary" : "btn-ghost"}`}>
                  {ENTRADA_LABEL[t]}{DESCUENTOS[t] > 0 && <span style={{ fontSize: 10, opacity: 0.7 }}> -{DESCUENTOS[t] * 100}%</span>}
                </button>
              ))}
            </div>

            <div style={{ background: "linear-gradient(to bottom, rgba(204,18,68,0.5), transparent)", height: 6, borderRadius: 4, margin: "0 60px 6px" }} />
            <div style={{ textAlign: "center", fontSize: 10, color: "#444", marginBottom: 20, letterSpacing: 3, textTransform: "uppercase" }}>Pantalla</div>

            <div style={{ overflowX: "auto", paddingBottom: 8 }}>
              {Array.from({ length: funcionSel.salas!.filas }, (_, fi) => {
                const fila = String.fromCharCode(65 + fi);
                const esVip = funcionSel.salas!.filas_vip?.includes(fila);
                return (
                  <div key={fila} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5, justifyContent: "center" }}>
                    <span style={{ width: 20, fontSize: 11, color: "#444", textAlign: "right", flexShrink: 0 }}>{fila}</span>
                    {Array.from({ length: funcionSel.salas!.columnas }, (_, ci) => {
                      const id = `${fila}${ci + 1}`;
                      const ocupado = asientosOcupados.includes(id);
                      const sel = asientosSel.includes(id);
                      return (
                        <button key={id} onClick={() => !ocupado && toggleAsiento(id)} disabled={ocupado} title={id}
                          style={{
                            width: 32, height: 30, borderRadius: 7, fontSize: 10, fontWeight: 700, transition: "all 0.1s",
                            cursor: ocupado ? "not-allowed" : "pointer",
                            background: ocupado ? "#151520" : sel ? "var(--rojo)" : esVip ? "rgba(168,85,247,0.2)" : "var(--fondo3)",
                            color: ocupado ? "#252535" : sel ? "white" : esVip ? "#c084fc" : "#555",
                            border: ocupado || sel ? "none" : `1px solid ${esVip ? "rgba(168,85,247,0.35)" : "var(--borde)"}`,
                          }}
                        >{ci + 1}</button>
                      );
                    })}
                    {esVip && <span style={{ fontSize: 10, color: "#c084fc", marginLeft: 4, flexShrink: 0 }}>VIP</span>}
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 18, justifyContent: "center", marginTop: 16, fontSize: 12, color: "var(--muted)" }}>
              {[
                { bg: "var(--fondo3)",              border: "var(--borde)",                  label: "Disponible"   },
                { bg: "var(--rojo)",                border: "none",                          label: "Seleccionado" },
                { bg: "#151520",                    border: "none",                          label: "Ocupado"      },
                { bg: "rgba(168,85,247,0.2)",       border: "rgba(168,85,247,0.35)",         label: "VIP"          },
              ].map(({ bg, border, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: bg, border: `1px solid ${border}` }} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Panel lateral */}
          <div style={{ width: 240, flexShrink: 0 }}>
            <div className="card">
              <div style={{ fontWeight: 700, marginBottom: 12, color: "white" }}>Seleccionados</div>
              {asientosSel.length === 0
                ? <p style={{ color: "var(--muted)", fontSize: 13 }}>Haz clic en un asiento</p>
                : <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {asientosSel.map((a) => (
                      <span key={a} className="badge" style={{ background: "rgba(204,18,68,0.15)", color: "var(--rojo)" }}>{a}</span>
                    ))}
                  </div>
              }
              <div style={{ borderTop: "1px solid var(--borde)", paddingTop: 12, marginTop: 8 }}>
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>Tipo: {ENTRADA_LABEL[tipoEntrada]}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>
                  c/u: {formatCOP(Math.round(funcionSel.precio_regular * (1 - DESCUENTOS[tipoEntrada])))}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "white", marginTop: 8 }}>
                  Total: {formatCOP(asientosSel.length * Math.round(funcionSel.precio_regular * (1 - DESCUENTOS[tipoEntrada])))}
                </div>
              </div>
              <button className="btn btn-primary" style={{ width: "100%", marginTop: 14 }} disabled={asientosSel.length === 0} onClick={agregarAlCarrito}>
                Agregar al carrito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PASO 3: Carrito */}
      {paso === "carrito" && (
        <div className="fade-up" style={{ display: "flex", gap: 20, flex: 1 }}>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "white" }}>Carrito</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setPaso("asientos")}>+ Más asientos</button>
            </div>
            {carrito.map((item, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px",
                background: "var(--fondo2)",
                border: "1px solid var(--borde)",
                borderRadius: 12,
                marginBottom: 8,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: "rgba(139,92,246,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Ticket size={17} color="#c084fc" strokeWidth={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: "white", fontWeight: 600 }}>{item.label}</div>
                </div>
                <div style={{ fontWeight: 700, color: "#4ade80", flexShrink: 0 }}>{formatCOP(item.subtotal)}</div>
                <button onClick={() => quitarItem(i)} style={{
                  background: "none", border: "none", color: "var(--muted)", cursor: "pointer",
                  display: "flex", alignItems: "center", padding: 4, borderRadius: 6,
                  transition: "color 0.15s",
                }}>
                  <X size={16} />
                </button>
              </div>
            ))}
            {carrito.length === 0 && (
              <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
                El carrito está vacío
              </div>
            )}
          </div>

          <div style={{ width: 260, flexShrink: 0 }}>
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 16, color: "white", marginBottom: 16 }}>Resumen</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 14, color: "var(--muted)" }}>
                <span>Subtotal</span><span>{formatCOP(subtotal)}</span>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>Descuento ($)</label>
                <input type="number" className="input" value={descuento || ""} onChange={(e) => setDescuento(Math.max(0, parseInt(e.target.value) || 0))} placeholder="0" />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, fontWeight: 900, color: "white", borderTop: "1px solid var(--borde)", paddingTop: 14 }}>
                <span>Total</span>
                <span style={{ color: "var(--rojo)" }}>{formatCOP(total)}</span>
              </div>
              <button className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 16 }} disabled={carrito.length === 0} onClick={() => setPaso("pago")}>
                Ir a pagar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PASO 4: Pago */}
      {paso === "pago" && (
        <div className="fade-up" style={{ maxWidth: 440, margin: "0 auto", width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "white" }}>Método de pago</h2>
            <BackBtn onClick={() => setPaso("carrito")} />
          </div>

          {/* Total */}
          <div className="card" style={{ marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: "white", marginBottom: 4, letterSpacing: -1 }}>
              {formatCOP(total)}
            </div>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>Total a cobrar</div>
          </div>

          {/* Métodos */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {(["efectivo", "tarjeta", "nequi", "cortesia"] as MetodoPago[]).map((m) => (
              <MetodoBtn key={m} value={m} selected={metodo === m} onClick={() => setMetodo(m)} />
            ))}
          </div>

          {/* Efectivo recibido */}
          {metodo === "efectivo" && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: "var(--muted)", display: "block", marginBottom: 6 }}>Efectivo recibido</label>
              <input
                type="number" className="input"
                style={{ fontSize: 20, textAlign: "center" }}
                value={efectivoRecibido}
                onChange={(e) => setEfectivoRecibido(e.target.value)}
                placeholder="$0"
              />
              {cambio >= 0 && parseFloat(efectivoRecibido) > 0 && (
                <div style={{
                  marginTop: 10, padding: "12px 16px",
                  background: "rgba(74,222,128,0.08)",
                  border: "1px solid rgba(74,222,128,0.25)",
                  borderRadius: 10,
                  display: "flex", justifyContent: "space-between",
                }}>
                  <span style={{ color: "#4ade80", fontWeight: 600 }}>Cambio</span>
                  <span style={{ color: "#4ade80", fontWeight: 800, fontSize: 20 }}>{formatCOP(cambio)}</span>
                </div>
              )}
            </div>
          )}

          <button
            className="btn btn-primary btn-xl"
            style={{ width: "100%" }}
            disabled={loading || (metodo === "efectivo" && (parseFloat(efectivoRecibido) || 0) < total && efectivoRecibido !== "")}
            onClick={procesarVenta}
          >
            {loading ? "Procesando..." : "Confirmar venta"}
          </button>
        </div>
      )}

      {/* PASO 5: Éxito + QR */}
      {paso === "exito" && (
        <div className="fade-up" style={{ maxWidth: 460, margin: "40px auto", textAlign: "center", width: "100%" }}>
          {/* Icono éxito */}
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "rgba(74,222,128,0.12)",
            border: "2px solid rgba(74,222,128,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
            boxShadow: "0 0 24px rgba(74,222,128,0.15)",
          }}>
            <CheckCircle size={40} color="#4ade80" strokeWidth={1.5} />
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 900, color: "white", marginBottom: 6 }}>¡Venta registrada!</h2>
          <p style={{ color: "var(--muted)", marginBottom: 4 }}>Venta #{ventaId}</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: "#4ade80", marginBottom: 24 }}>{formatCOP(total)}</p>

          {metodo === "efectivo" && cambio > 0 && (
            <div style={{
              background: "rgba(74,222,128,0.08)",
              border: "1px solid rgba(74,222,128,0.25)",
              borderRadius: 14, padding: "14px 20px",
              marginBottom: 20,
              fontSize: 20, fontWeight: 800, color: "#4ade80",
            }}>
              Cambio: {formatCOP(cambio)}
            </div>
          )}

          {/* Token QR */}
          {qrToken && (
            <div style={{
              background: "var(--fondo2)",
              border: "1px solid var(--borde)",
              borderRadius: 16, padding: "20px 24px",
              marginBottom: 20, textAlign: "left",
            }}>
              <div style={{
                fontSize: 11, color: "var(--muted)", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10,
              }}>
                Código de acceso
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  flex: 1, fontFamily: "monospace", fontSize: 13, color: "white",
                  background: "var(--fondo3)", padding: "10px 14px",
                  borderRadius: 8, wordBreak: "break-all", lineHeight: 1.4,
                }}>
                  {qrToken}
                </div>
                <button
                  onClick={copiarToken}
                  title={copiado ? "Copiado" : "Copiar"}
                  style={{
                    background: "none",
                    border: `1px solid ${copiado ? "rgba(74,222,128,0.3)" : "var(--borde)"}`,
                    borderRadius: 8, padding: "8px 10px",
                    cursor: "pointer",
                    color: copiado ? "#4ade80" : "var(--muted)",
                    display: "flex", alignItems: "center",
                    transition: "all 0.15s",
                    flexShrink: 0,
                  }}
                >
                  {copiado ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
                Presenta este código en control de acceso · Se puede escanear como QR
              </div>
            </div>
          )}

          <button className="btn btn-primary btn-lg" onClick={reset} style={{ width: "100%" }}>
            Nueva venta
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Stepper ──────────────────────────────────────────────── */
function Stepper({ paso }: { paso: Paso }) {
  if (paso === "exito") return null;
  const idx = PASOS_STEPPER.findIndex((p) => p.key === paso);
  return (
    <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 28 }}>
      {PASOS_STEPPER.map((p, i) => {
        const done   = i < idx;
        const active = i === idx;
        return (
          <div key={p.key} style={{ display: "flex", alignItems: "flex-start", flex: i < PASOS_STEPPER.length - 1 ? 1 : 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: done
                  ? "rgba(74,222,128,0.15)"
                  : active
                  ? "var(--rojo)"
                  : "var(--fondo2)",
                border: `2px solid ${done
                  ? "rgba(74,222,128,0.4)"
                  : active
                  ? "var(--rojo)"
                  : "var(--borde)"}`,
                fontSize: 12, fontWeight: 800,
                color: done ? "#4ade80" : active ? "white" : "var(--muted)",
                boxShadow: active ? "0 0 12px rgba(204,18,68,0.4)" : "none",
                transition: "all 0.2s",
                flexShrink: 0,
              }}>
                {done ? <Check size={13} /> : i + 1}
              </div>
              <span style={{
                fontSize: 11, fontWeight: active ? 700 : 400,
                color: active ? "white" : "var(--muted)",
                whiteSpace: "nowrap",
              }}>
                {p.label}
              </span>
            </div>
            {i < PASOS_STEPPER.length - 1 && (
              <div style={{
                flex: 1,
                height: 2,
                background: done ? "rgba(74,222,128,0.3)" : "var(--borde)",
                marginTop: 15,
                marginLeft: 8, marginRight: 8,
                transition: "background 0.3s",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── FunctionCard ─────────────────────────────────────────── */
function FunctionCard({ funcion, onSelect }: { funcion: Funcion; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "rgba(204,18,68,0.06)" : "var(--fondo2)",
        border: `1px solid ${hovered ? "rgba(204,18,68,0.4)" : "var(--borde)"}`,
        borderRadius: 14,
        padding: "14px 18px",
        cursor: "pointer",
        textAlign: "left",
        color: "inherit",
        transition: "all 0.15s",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? "0 8px 24px rgba(0,0,0,0.25)" : "none",
        minWidth: 150,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 800, color: "white", marginBottom: 8 }}>
        {formatHora(funcion.hora)}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <span className="badge" style={{ background: "rgba(168,85,247,0.15)", color: "#c084fc" }}>{funcion.formato}</span>
        <span className="badge" style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80"  }}>{funcion.salas?.nombre}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>
        Regular: {formatCOP(funcion.precio_regular)} · VIP: {formatCOP(funcion.precio_vip)}
      </div>
    </button>
  );
}

/* ── MetodoBtn ────────────────────────────────────────────── */
function MetodoBtn({
  value, selected, onClick,
}: { value: MetodoPago; selected: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const { Icon, label } = METODO_META[value];
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "16px",
        borderRadius: 14,
        border: `2px solid ${selected
          ? "var(--rojo)"
          : hovered ? "var(--borde-hover)" : "var(--borde)"}`,
        background: selected
          ? "rgba(204,18,68,0.1)"
          : hovered ? "rgba(255,255,255,0.04)" : "var(--fondo2)",
        color: selected ? "var(--rojo)" : hovered ? "var(--texto)" : "var(--muted)",
        fontWeight: selected ? 700 : 500,
        cursor: "pointer",
        fontSize: 13,
        transition: "all 0.15s",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Icon size={22} strokeWidth={selected ? 2.5 : 2} />
      {label}
    </button>
  );
}

/* ── BackBtn ──────────────────────────────────────────────── */
function BackBtn({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "7px 12px",
        borderRadius: 8,
        border: `1px solid ${hovered ? "var(--borde-hover)" : "var(--borde)"}`,
        background: hovered ? "rgba(255,255,255,0.04)" : "transparent",
        color: hovered ? "var(--texto)" : "var(--muted)",
        fontSize: 13, cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      <ArrowLeft size={14} />
      Volver
    </button>
  );
}
