"use client";
import { useState, useEffect } from "react";
import { supabase, supabaseAdmin, supabaseReady } from "@/lib/supabase";
import { Inventario } from "@/lib/types";
import { formatCOP } from "@/lib/format";
import { MOCK_INVENTARIO } from "@/lib/mock";

export default function InventarioPage() {
  const [inventario, setInventario] = useState<Inventario[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [minimo, setMinimo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    if (!supabaseReady()) { setInventario(MOCK_INVENTARIO); return; }
    const { data } = await supabase.from("inventario").select("*, productos(*)").order("productos(orden)");
    setInventario((data as Inventario[]) ?? MOCK_INVENTARIO);
  }

  function abrirEdicion(inv: Inventario) { setEditId(inv.id); setCantidad(inv.cantidad.toString()); setMinimo(inv.minimo.toString()); }

  async function guardar(inv: Inventario) {
    setLoading(true);
    if (!supabaseReady()) {
      setInventario(prev => prev.map(i => i.id === inv.id ? { ...i, cantidad: parseInt(cantidad) || 0, minimo: parseInt(minimo) || 5 } : i));
      setEditId(null); setLoading(false); return;
    }
    await supabaseAdmin.from("inventario").update({ cantidad: parseInt(cantidad) || 0, minimo: parseInt(minimo) || 5, updated_at: new Date().toISOString() }).eq("id", inv.id);
    setEditId(null); await cargar(); setLoading(false);
  }

  async function ajustar(inv: Inventario, delta: number) {
    const nueva = Math.max(0, inv.cantidad + delta);
    if (!supabaseReady()) { setInventario(prev => prev.map(i => i.id === inv.id ? { ...i, cantidad: nueva } : i)); return; }
    await supabaseAdmin.from("inventario").update({ cantidad: nueva, updated_at: new Date().toISOString() }).eq("id", inv.id);
    cargar();
  }

  const bajoStock = inventario.filter((i) => i.cantidad <= i.minimo);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "white" }}>Control de inventario</h2>
          {bajoStock.length > 0 && (
            <p style={{ color: "#f87171", fontSize: 13, marginTop: 4 }}>⚠️ {bajoStock.length} producto{bajoStock.length > 1 ? "s" : ""} con stock bajo</p>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--borde)" }}>
              {["Producto", "Categoría", "Precio", "Stock actual", "Mínimo", "Estado", "Acciones"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inventario.map((inv, i) => {
              const p = inv.productos!;
              const bajo = inv.cantidad <= inv.minimo;
              const critico = inv.cantidad === 0;
              const editando = editId === inv.id;
              return (
                <tr key={inv.id} style={{ borderBottom: i < inventario.length - 1 ? "1px solid var(--borde)" : "none", background: critico ? "rgba(248,113,113,0.04)" : bajo ? "rgba(251,191,36,0.02)" : "transparent" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: "white", fontSize: 14 }}>{p.nombre}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span className="badge" style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa" }}>{p.categoria}</span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#4ade80", fontWeight: 600 }}>{formatCOP(p.precio)}</td>
                  <td style={{ padding: "12px 16px" }}>
                    {editando
                      ? <input type="number" className="input" style={{ width: 80 }} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
                      : <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <button onClick={() => ajustar(inv, -1)} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--borde)", background: "var(--fondo3)", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>−</button>
                          <span style={{ fontWeight: 700, color: critico ? "#f87171" : bajo ? "#fcd34d" : "white", minWidth: 32, textAlign: "center", fontSize: 16 }}>{inv.cantidad}</span>
                          <button onClick={() => ajustar(inv, 1)} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--borde)", background: "var(--fondo3)", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>+</button>
                        </div>
                    }
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {editando
                      ? <input type="number" className="input" style={{ width: 80 }} value={minimo} onChange={(e) => setMinimo(e.target.value)} />
                      : <span style={{ color: "var(--muted)", fontSize: 14 }}>{inv.minimo}</span>
                    }
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span className="badge" style={{ background: critico ? "rgba(248,113,113,0.15)" : bajo ? "rgba(251,191,36,0.15)" : "rgba(74,222,128,0.12)", color: critico ? "#f87171" : bajo ? "#fcd34d" : "#4ade80" }}>
                      {critico ? "⛔ Agotado" : bajo ? "⚠️ Bajo" : "✓ OK"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {editando
                      ? <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-success btn-sm" disabled={loading} onClick={() => guardar(inv)}>Guardar</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}>Cancelar</button>
                        </div>
                      : <button className="btn btn-ghost btn-sm" onClick={() => abrirEdicion(inv)}>Editar</button>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
