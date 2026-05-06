"use client";
import { useState, useEffect } from "react";
import { supabase, supabaseAdmin, supabaseReady } from "@/lib/supabase";
import { Producto, CategoriaProducto } from "@/lib/types";
import { formatCOP, CATEGORIA_LABEL } from "@/lib/format";

const EMPTY: Omit<Producto, "id"> = {
  nombre: "", categoria: "combo", precio: 0, descripcion: "", activo: true, orden: 0,
};

export default function ProductosAdminPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Omit<Producto, "id">>(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    if (!supabaseReady()) return;
    const { data } = await supabase.from("productos").select("*").order("orden");
    setProductos((data as Producto[]) ?? []);
  }

  function abrir(p?: Producto) {
    if (p) { setForm({ nombre: p.nombre, categoria: p.categoria, precio: p.precio, descripcion: p.descripcion ?? "", activo: p.activo, orden: p.orden }); setEditId(p.id); }
    else { setForm(EMPTY); setEditId(null); }
    setModal(true);
  }

  async function guardar() {
    setLoading(true);
    if (editId) {
      await supabaseAdmin.from("productos").update(form).eq("id", editId);
    } else {
      const { data } = await supabaseAdmin.from("productos").insert(form).select().single();
      if (data) await supabaseAdmin.from("inventario").insert({ producto_id: (data as Producto).id, cantidad: 0, minimo: 5 });
    }
    setModal(false);
    await cargar();
    setLoading(false);
  }

  async function toggleActivo(p: Producto) {
    await supabaseAdmin.from("productos").update({ activo: !p.activo }).eq("id", p.id);
    cargar();
  }

  const EMOJI: Record<string, string> = { combo: "🎁", snack: "🍿", bebida: "🥤", dulce: "🍫", otro: "🛒" };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "white" }}>Productos de confitería</h2>
        <button className="btn btn-primary" onClick={() => abrir()}>+ Nuevo producto</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {productos.map((p) => (
          <div key={p.id} className="card" style={{ opacity: p.activo ? 1 : 0.5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <span style={{ fontSize: 28 }}>{EMOJI[p.categoria]}</span>
              <span className="badge" style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}>
                {CATEGORIA_LABEL[p.categoria]}
              </span>
            </div>
            <div style={{ fontWeight: 700, color: "white", marginBottom: 4 }}>{p.nombre}</div>
            {p.descripcion && <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{p.descripcion}</div>}
            <div style={{ fontSize: 18, fontWeight: 900, color: "#4ade80", marginBottom: 12 }}>{formatCOP(p.precio)}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => abrir(p)}>Editar</button>
              <button
                className={`btn btn-sm ${p.activo ? "btn-danger" : "btn-success"}`}
                onClick={() => toggleActivo(p)}
              >
                {p.activo ? "Desactivar" : "Activar"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={(e) => e.target === e.currentTarget && setModal(false)}
        >
          <div className="card fade-up" style={{ width: 400, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "white", marginBottom: 20 }}>
              {editId ? "Editar producto" : "Nuevo producto"}
            </div>
            {[
              { label: "Nombre", key: "nombre", type: "text" },
              { label: "Precio (COP)", key: "precio", type: "number" },
              { label: "Descripción", key: "descripcion", type: "text" },
              { label: "Orden", key: "orden", type: "number" },
            ].map((f) => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>{f.label}</label>
                <input
                  type={f.type}
                  className="input"
                  value={(form as Record<string, unknown>)[f.key] as string}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: f.type === "number" ? parseInt(e.target.value) || 0 : e.target.value }))}
                />
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>Categoría</label>
              <select className="input" value={form.categoria} onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value as CategoriaProducto }))}>
                {(["combo", "snack", "bebida", "dulce", "otro"] as CategoriaProducto[]).map((c) => (
                  <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={loading || !form.nombre} onClick={guardar}>
                {loading ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
