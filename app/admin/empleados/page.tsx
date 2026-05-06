"use client";
import { useState, useEffect } from "react";
import { supabase, supabaseAdmin, supabaseReady } from "@/lib/supabase";
import { Empleado, Cargo, Turno } from "@/lib/types";
import { CARGO_LABEL, formatHora } from "@/lib/format";

const EMPTY_EMP = { nombre: "", cedula: "", cargo: "cajero" as Cargo, pin: "", activo: true };
const EMPTY_TURNO = { empleado_id: 0, fecha: "", hora_inicio: "08:00", hora_fin: "16:00", notas: "" };

export default function EmpleadosAdminPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [modalEmp, setModalEmp] = useState(false);
  const [modalTurno, setModalTurno] = useState(false);
  const [formEmp, setFormEmp] = useState(EMPTY_EMP);
  const [formTurno, setFormTurno] = useState(EMPTY_TURNO);
  const [editId, setEditId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"empleados" | "turnos">("empleados");
  const [fechaTurnos, setFechaTurnos] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => { cargar(); }, [fechaTurnos]);

  async function cargar() {
    if (!supabaseReady()) return;
    const [empRes, turRes] = await Promise.all([
      supabase.from("empleados").select("*").order("nombre"),
      supabase.from("turnos").select("*, empleados(nombre,cargo)").eq("fecha", fechaTurnos).order("hora_inicio"),
    ]);
    setEmpleados((empRes.data as Empleado[]) ?? []);
    setTurnos((turRes.data as Turno[]) ?? []);
  }

  function abrirEmp(e?: Empleado) {
    if (e) { setFormEmp({ nombre: e.nombre, cedula: e.cedula, cargo: e.cargo, pin: e.pin, activo: e.activo }); setEditId(e.id); }
    else { setFormEmp(EMPTY_EMP); setEditId(null); }
    setModalEmp(true);
  }

  async function guardarEmp() {
    setLoading(true);
    if (editId) await supabaseAdmin.from("empleados").update(formEmp).eq("id", editId);
    else await supabaseAdmin.from("empleados").insert(formEmp);
    setModalEmp(false);
    await cargar();
    setLoading(false);
  }

  function abrirTurno(empId?: number) {
    setFormTurno({ ...EMPTY_TURNO, empleado_id: empId ?? 0, fecha: fechaTurnos });
    setModalTurno(true);
  }

  async function guardarTurno() {
    setLoading(true);
    await supabaseAdmin.from("turnos").insert(formTurno);
    setModalTurno(false);
    await cargar();
    setLoading(false);
  }

  async function eliminarTurno(id: number) {
    await supabaseAdmin.from("turnos").delete().eq("id", id);
    cargar();
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "white" }}>Gestión de personal</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {tab === "empleados" ? (
            <button className="btn btn-primary" onClick={() => abrirEmp()}>+ Nuevo empleado</button>
          ) : (
            <button className="btn btn-primary" onClick={() => abrirTurno()}>+ Asignar turno</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button className={`btn btn-sm ${tab === "empleados" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("empleados")}>
          Empleados
        </button>
        <button className={`btn btn-sm ${tab === "turnos" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("turnos")}>
          Turnos
        </button>
      </div>

      {/* Empleados */}
      {tab === "empleados" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {empleados.map((e) => (
            <div key={e.id} className="card" style={{ opacity: e.activo ? 1 : 0.5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--fondo3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                  👤
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "white" }}>{e.nombre}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{CARGO_LABEL[e.cargo]} · CC {e.cedula}</div>
                </div>
                {!e.activo && <span className="badge" style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", marginLeft: "auto" }}>Inactivo</span>}
              </div>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>PIN: {"•".repeat(e.pin.length)}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => abrirEmp(e)}>Editar</button>
                <button className="btn btn-ghost btn-sm" onClick={() => abrirTurno(e.id)}>+ Turno</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Turnos */}
      {tab === "turnos" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: "var(--muted)" }}>Fecha:</label>
            <input type="date" className="input" style={{ width: "auto" }} value={fechaTurnos} onChange={(e) => setFechaTurnos(e.target.value)} />
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {turnos.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>Sin turnos para esta fecha</div>
            ) : (
              turnos.map((t, i) => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderBottom: i < turnos.length - 1 ? "1px solid var(--borde)" : "none" }}>
                  <span style={{ fontSize: 20 }}>🕐</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: "white", fontSize: 14 }}>{(t.empleados as { nombre: string })?.nombre}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {formatHora(t.hora_inicio)} – {formatHora(t.hora_fin)}
                    </div>
                    {t.notas && <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{t.notas}</div>}
                  </div>
                  <span className="badge" style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}>
                    {CARGO_LABEL[(t.empleados as { cargo: string })?.cargo ?? "cajero"]}
                  </span>
                  <button onClick={() => eliminarTurno(t.id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 18 }}>×</button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal empleado */}
      {modalEmp && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={(e) => e.target === e.currentTarget && setModalEmp(false)}>
          <div className="card fade-up" style={{ width: 400 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "white", marginBottom: 20 }}>
              {editId ? "Editar empleado" : "Nuevo empleado"}
            </div>
            {[
              { label: "Nombre completo", key: "nombre", type: "text" },
              { label: "Cédula", key: "cedula", type: "text" },
              { label: "PIN (4-6 dígitos)", key: "pin", type: "text" },
            ].map((f) => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>{f.label}</label>
                <input type={f.type} className="input" value={(formEmp as Record<string, unknown>)[f.key] as string}
                  onChange={(e) => setFormEmp((p) => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>Cargo</label>
              <select className="input" value={formEmp.cargo} onChange={(e) => setFormEmp((p) => ({ ...p, cargo: e.target.value as Cargo }))}>
                {(["cajero", "confitero", "supervisor", "admin", "acomodador"] as Cargo[]).map((c) => (
                  <option key={c} value={c}>{CARGO_LABEL[c]}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setModalEmp(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={loading || !formEmp.nombre || !formEmp.pin} onClick={guardarEmp}>
                {loading ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal turno */}
      {modalTurno && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={(e) => e.target === e.currentTarget && setModalTurno(false)}>
          <div className="card fade-up" style={{ width: 380 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "white", marginBottom: 20 }}>Asignar turno</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>Empleado</label>
              <select className="input" value={formTurno.empleado_id} onChange={(e) => setFormTurno((p) => ({ ...p, empleado_id: parseInt(e.target.value) }))}>
                <option value={0}>Selecciona...</option>
                {empleados.filter((e) => e.activo).map((e) => (
                  <option key={e.id} value={e.id}>{e.nombre} — {CARGO_LABEL[e.cargo]}</option>
                ))}
              </select>
            </div>
            {[
              { label: "Fecha", key: "fecha", type: "date" },
              { label: "Hora inicio", key: "hora_inicio", type: "time" },
              { label: "Hora fin", key: "hora_fin", type: "time" },
              { label: "Notas (opcional)", key: "notas", type: "text" },
            ].map((f) => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>{f.label}</label>
                <input type={f.type} className="input" value={(formTurno as Record<string, unknown>)[f.key] as string}
                  onChange={(e) => setFormTurno((p) => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setModalTurno(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={loading || !formTurno.empleado_id || !formTurno.fecha} onClick={guardarTurno}>
                {loading ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
