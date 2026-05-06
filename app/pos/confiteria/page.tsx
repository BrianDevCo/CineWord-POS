"use client";
import { useState, useEffect } from "react";
import { supabase, supabaseAdmin, supabaseReady } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { Producto, ItemCarrito, MetodoPago } from "@/lib/types";
import { formatCOP, CATEGORIA_LABEL, METODO_LABEL } from "@/lib/format";
import { MOCK_PRODUCTOS } from "@/lib/mock";
import {
  Package, Utensils, Coffee, Heart, Tag, ShoppingBag,
  Plus, Minus, Trash2, CheckCircle, Banknote, CreditCard,
  Smartphone, Gift, X,
} from "lucide-react";

// ── Mapas categoría → ícono + color ───────────────────
const CAT_META: Record<string, { Icon: React.ElementType; color: string; bg: string }> = {
  combo:    { Icon: Package,  color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  snack:    { Icon: Utensils, color: "#f97316", bg: "rgba(249,115,22,0.15)" },
  bebida:   { Icon: Coffee,   color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
  dulce:    { Icon: Heart,    color: "#ec4899", bg: "rgba(236,72,153,0.15)" },
  otro:     { Icon: Tag,      color: "#8b5cf6", bg: "rgba(139,92,246,0.15)" },
};

const METODO_META: Record<MetodoPago, { Icon: React.ElementType; label: string }> = {
  efectivo: { Icon: Banknote,    label: "Efectivo" },
  tarjeta:  { Icon: CreditCard,  label: "Tarjeta" },
  nequi:    { Icon: Smartphone,  label: "Nequi" },
  cortesia: { Icon: Gift,        label: "Cortesía" },
};

const CATEGORIAS = ["todos", "combo", "snack", "bebida", "dulce", "otro"] as const;

export default function ConfiteriaPage() {
  const [productos, setProductos]   = useState<Producto[]>([]);
  const [catSel, setCatSel]         = useState<string>("todos");
  const [carrito, setCarrito]       = useState<ItemCarrito[]>([]);
  const [metodo, setMetodo]         = useState<MetodoPago>("efectivo");
  const [efectivo, setEfectivo]     = useState("");
  const [descuento, setDescuento]   = useState(0);
  const [paso, setPaso]             = useState<"venta" | "exito">("venta");
  const [loading, setLoading]       = useState(false);
  const [ventaId, setVentaId]       = useState<number | null>(null);
  const empleado = getSession();

  useEffect(() => { cargarProductos(); }, []);

  async function cargarProductos() {
    if (!supabaseReady()) { setProductos(MOCK_PRODUCTOS); return; }
    const { data } = await supabase.from("productos").select("*").eq("activo", true).order("orden");
    setProductos((data as Producto[]) ?? MOCK_PRODUCTOS);
  }

  function agregarProducto(p: Producto) {
    setCarrito(prev => {
      const idx = prev.findIndex(i => i.meta?.producto_id === p.id);
      if (idx >= 0) {
        const u = [...prev];
        u[idx] = { ...u[idx], cantidad: u[idx].cantidad + 1, subtotal: (u[idx].cantidad + 1) * p.precio };
        return u;
      }
      return [...prev, { tipo: "producto", label: p.nombre, cantidad: 1, precio_unitario: p.precio, subtotal: p.precio, meta: { producto_id: p.id } }];
    });
  }

  function cambiarCantidad(i: number, delta: number) {
    setCarrito(prev => {
      const u = [...prev];
      const nc = u[i].cantidad + delta;
      if (nc <= 0) return u.filter((_, idx) => idx !== i);
      u[i] = { ...u[i], cantidad: nc, subtotal: nc * u[i].precio_unitario };
      return u;
    });
  }

  const filtrados = catSel === "todos" ? productos : productos.filter(p => p.categoria === catSel);
  const subtotal  = carrito.reduce((s, i) => s + i.subtotal, 0);
  const total     = Math.max(0, subtotal - descuento);
  const cambio    = metodo === "efectivo" ? (parseFloat(efectivo) || 0) - total : 0;
  const cantTotal = carrito.reduce((s, i) => s + i.cantidad, 0);

  async function procesarVenta() {
    if (carrito.length === 0) return;
    setLoading(true);
    if (!supabaseReady()) {
      await new Promise(r => setTimeout(r, 600));
      setVentaId(Math.floor(Math.random() * 900) + 100);
      setPaso("exito"); setLoading(false); return;
    }
    try {
      const { data: venta, error } = await supabaseAdmin
        .from("ventas_pos")
        .insert({ empleado_id: empleado?.id, metodo_pago: metodo, subtotal, descuento, total, tipo: "confiteria" })
        .select().single();
      if (error || !venta) throw error;
      await supabaseAdmin.from("items_venta_pos").insert(
        carrito.map(item => ({ venta_id: venta.id, tipo: "producto", producto_id: item.meta?.producto_id, cantidad: item.cantidad, precio_unitario: item.precio_unitario, subtotal: item.subtotal }))
      );
      for (const item of carrito) {
        if (item.meta?.producto_id) {
          try {
            const { data: inv } = await supabaseAdmin.from("inventario").select("cantidad").eq("producto_id", item.meta.producto_id).single();
            if (inv) await supabaseAdmin.from("inventario").update({ cantidad: Math.max(0, inv.cantidad - item.cantidad), updated_at: new Date().toISOString() }).eq("producto_id", item.meta.producto_id);
          } catch { /* inventario no crítico */ }
        }
      }
      setVentaId(venta.id); setPaso("exito");
    } catch { alert("Error al procesar la venta"); }
    setLoading(false);
  }

  function reset() { setCarrito([]); setDescuento(0); setEfectivo(""); setMetodo("efectivo"); setVentaId(null); setPaso("venta"); }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

      {/* ── Catálogo ────────────────────────────────────── */}
      <div style={{ flex: 1, padding: "22px 24px", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShoppingBag size={18} color="#f59e0b" />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "white", marginBottom: 0 }}>Confitería</h2>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>Selecciona los productos</p>
          </div>
        </div>

        {/* Filtros de categoría */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <CatBtn active={catSel === "todos"} onClick={() => setCatSel("todos")} color="#6b7280">
            Todos
          </CatBtn>
          {(["combo","snack","bebida","dulce","otro"] as const).map(c => {
            const { Icon, color } = CAT_META[c];
            return (
              <CatBtn key={c} active={catSel === c} onClick={() => setCatSel(c)} color={color}>
                <Icon size={13} />
                {CATEGORIA_LABEL[c]}
              </CatBtn>
            );
          })}
        </div>

        {/* Grid de productos */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
          {filtrados.map(p => {
            const enCarrito = carrito.find(i => i.meta?.producto_id === p.id);
            const meta = CAT_META[p.categoria] ?? CAT_META.otro;
            const { Icon, color, bg } = meta;
            return (
              <ProductCard
                key={p.id}
                producto={p}
                Icon={Icon}
                color={color}
                bg={bg}
                cantidad={enCarrito?.cantidad ?? 0}
                onClick={() => agregarProducto(p)}
              />
            );
          })}
        </div>
      </div>

      {/* ── Panel de venta ──────────────────────────────── */}
      <div style={{ width: 300, borderLeft: "1px solid var(--borde)", background: "var(--fondo2)", display: "flex", flexDirection: "column", flexShrink: 0 }}>

        {paso === "venta" && (
          <>
            {/* Carrito header */}
            <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--borde)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShoppingBag size={16} color={cantTotal > 0 ? "var(--rojo)" : "var(--muted)"} />
                <span style={{ fontWeight: 700, color: "white", fontSize: 15 }}>Carrito</span>
                {cantTotal > 0 && (
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--rojo)", color: "white", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {cantTotal}
                  </div>
                )}
              </div>
              {carrito.length > 0 && (
                <button onClick={() => setCarrito([])} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, transition: "color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
                  onMouseLeave={e => e.currentTarget.style.color = "var(--muted)"}
                >
                  <Trash2 size={12} /> Limpiar
                </button>
              )}
            </div>

            {/* Items */}
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
              {carrito.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--muted)", marginTop: 60, lineHeight: 2 }}>
                  <ShoppingBag size={36} color="#2a2a3e" style={{ marginBottom: 10 }} />
                  <div style={{ fontSize: 13 }}>Selecciona productos<br/>del catálogo</div>
                </div>
              ) : (
                carrito.map((item, i) => {
                  const pid = item.meta?.producto_id;
                  const prod = productos.find(p => p.id === pid);
                  const meta = prod ? (CAT_META[prod.categoria] ?? CAT_META.otro) : CAT_META.otro;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "10px 12px", background: "var(--fondo3)", borderRadius: 12, border: "1px solid var(--borde)" }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: meta.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <meta.Icon size={14} color={meta.color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{formatCOP(item.precio_unitario)} c/u</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        <QtyBtn onClick={() => cambiarCantidad(i, -1)} icon={item.cantidad === 1 ? <Trash2 size={11} /> : <Minus size={11} />} danger={item.cantidad === 1} />
                        <span style={{ fontSize: 14, fontWeight: 700, color: "white", minWidth: 18, textAlign: "center" }}>{item.cantidad}</span>
                        <QtyBtn onClick={() => cambiarCantidad(i, 1)} icon={<Plus size={11} />} />
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", minWidth: 52, textAlign: "right", flexShrink: 0 }}>{formatCOP(item.subtotal)}</div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Resumen + pago */}
            <div style={{ padding: "12px 14px", borderTop: "1px solid var(--borde)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
                <span>Subtotal</span><span>{formatCOP(subtotal)}</span>
              </div>
              <input
                type="number" className="input"
                style={{ marginBottom: 10, fontSize: 13 }}
                value={descuento || ""}
                onChange={e => setDescuento(Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="Descuento $"
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, fontWeight: 900, color: "white", marginBottom: 14 }}>
                <span>Total</span>
                <span style={{ color: "var(--rojo)" }}>{formatCOP(total)}</span>
              </div>

              {/* Métodos de pago */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                {(["efectivo","tarjeta","nequi","cortesia"] as MetodoPago[]).map(m => {
                  const { Icon, label } = METODO_META[m];
                  const active = metodo === m;
                  return (
                    <button key={m} onClick={() => setMetodo(m)} style={{ padding: "9px 6px", borderRadius: 9, border: `1px solid ${active ? "var(--rojo)" : "var(--borde)"}`, background: active ? "rgba(204,18,68,0.12)" : "var(--fondo3)", color: active ? "var(--rojo)" : "var(--muted)", fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, transition: "all 0.15s" }}>
                      <Icon size={13} />{label}
                    </button>
                  );
                })}
              </div>

              {metodo === "efectivo" && (
                <input type="number" className="input" style={{ marginBottom: 8, fontSize: 14 }} value={efectivo} onChange={e => setEfectivo(e.target.value)} placeholder="Efectivo recibido" />
              )}
              {metodo === "efectivo" && cambio > 0 && (
                <div style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ color: "#4ade80", fontSize: 13, fontWeight: 600 }}>Cambio</span>
                  <span style={{ color: "#4ade80", fontSize: 16, fontWeight: 800 }}>{formatCOP(cambio)}</span>
                </div>
              )}

              <button
                className="btn btn-primary"
                style={{ width: "100%", fontSize: 15, padding: "13px" }}
                disabled={carrito.length === 0 || loading}
                onClick={procesarVenta}
              >
                {loading ? "Procesando..." : <><CheckCircle size={16} /> Cobrar {formatCOP(total)}</>}
              </button>
            </div>
          </>
        )}

        {/* ── Pantalla de éxito ───────────────────────── */}
        {paso === "exito" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, textAlign: "center" }} className="fade-up">
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(74,222,128,0.12)", border: "2px solid rgba(74,222,128,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
              <CheckCircle size={36} color="#4ade80" />
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "white", marginBottom: 4 }}>¡Venta registrada!</div>
            <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>Venta #{ventaId}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#4ade80", marginBottom: 20 }}>{formatCOP(total)}</div>
            {metodo === "efectivo" && cambio > 0 && (
              <div style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 12, padding: "14px 20px", marginBottom: 20, width: "100%" }}>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Devolver cambio</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#4ade80" }}>{formatCOP(cambio)}</div>
              </div>
            )}
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={reset}>
              <Plus size={16} /> Nueva venta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────
function CatBtn({ active, onClick, color, children }: { active: boolean; onClick: () => void; color: string; children: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "7px 14px", borderRadius: 20, border: `1px solid ${active ? color : "var(--borde)"}`,
        background: active ? `${color}22` : hov ? "rgba(255,255,255,0.04)" : "var(--fondo3)",
        color: active ? color : hov ? "var(--texto)" : "var(--muted)",
        fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer",
        display: "flex", alignItems: "center", gap: 5,
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );
}

function ProductCard({ producto, Icon, color, bg, cantidad, onClick }: {
  producto: Producto; Icon: React.ElementType; color: string; bg: string; cantidad: number; onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  const enCarrito = cantidad > 0;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: enCarrito ? `${color}10` : hov ? "rgba(255,255,255,0.03)" : "var(--fondo2)",
        border: `1px solid ${enCarrito ? color + "55" : hov ? "rgba(255,255,255,0.1)" : "var(--borde)"}`,
        borderRadius: 14, padding: "16px 12px",
        cursor: "pointer", textAlign: "center", color: "inherit",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        position: "relative",
        transform: hov && !enCarrito ? "translateY(-2px)" : "none",
        boxShadow: hov ? "0 6px 20px rgba(0,0,0,0.2)" : "none",
        transition: "all 0.15s",
      }}
    >
      {enCarrito && (
        <div style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: "50%", background: color, color: "white", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {cantidad}
        </div>
      )}
      <div style={{ width: 48, height: 48, borderRadius: 14, background: bg, display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.15s", transform: hov ? "scale(1.08)" : "scale(1)" }}>
        <Icon size={22} color={color} strokeWidth={2} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "white", lineHeight: 1.3 }}>{producto.nombre}</div>
      {producto.descripcion && (
        <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.3 }}>{producto.descripcion}</div>
      )}
      <div style={{ fontSize: 15, fontWeight: 800, color: "#4ade80" }}>{formatCOP(producto.precio)}</div>
    </button>
  );
}

function QtyBtn({ onClick, icon, danger }: { onClick: () => void; icon: React.ReactNode; danger?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${danger && hov ? "rgba(248,113,113,0.4)" : "var(--borde)"}`, background: danger && hov ? "rgba(248,113,113,0.1)" : hov ? "var(--fondo2)" : "var(--fondo3)", color: danger && hov ? "#f87171" : "var(--texto)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.1s" }}
    >
      {icon}
    </button>
  );
}
