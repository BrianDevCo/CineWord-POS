"use client";
import { useState, useRef } from "react";
import { supabase, supabaseAdmin, supabaseReady } from "@/lib/supabase";

interface ResultadoQR {
  valido: boolean;
  mensaje: string;
  reservaId?: number;
  detalle?: {
    pelicula: string;
    funcion: string;
    asientos: string[];
    nombre: string;
    email: string;
    origen: string;
    usado: boolean;
  };
}

export default function AccesoPage() {
  const [token, setToken] = useState("");
  const [resultado, setResultado] = useState<ResultadoQR | null>(null);
  const [loading, setLoading] = useState(false);
  const [marcandoUsado, setMarcandoUsado] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function validarToken(t: string) {
    const tk = t.trim();
    if (!tk) return;
    setLoading(true);
    setResultado(null);

    if (!supabaseReady()) {
      setResultado({
        valido: true,
        mensaje: "Boleto válido (modo demo)",
        detalle: {
          pelicula: "Spider-Man: No Way Home",
          funcion: "Hoy · 8:00 PM · Sala 1",
          asientos: ["C5", "C6"],
          nombre: "Juan Pérez",
          email: "juan@email.com",
          origen: "web",
          usado: false,
        },
      });
      setLoading(false);
      return;
    }

    const { data: reserva, error } = await supabase
      .from("reservas")
      .select(`
        id, estado, nombre, email, asientos, usado, origen,
        funciones(
          fecha, hora,
          peliculas(titulo),
          salas(nombre)
        )
      `)
      .eq("qr_token", tk)
      .single();

    if (error || !reserva) {
      setResultado({ valido: false, mensaje: "QR no encontrado o inválido" });
      setLoading(false);
      return;
    }

    if (reserva.estado === "cancelado") {
      setResultado({ valido: false, mensaje: "Este boleto fue cancelado" });
      setLoading(false);
      return;
    }

    if (reserva.estado === "pendiente") {
      setResultado({ valido: false, mensaje: "Pago pendiente — boleto no confirmado" });
      setLoading(false);
      return;
    }

    if (reserva.usado) {
      const f = reserva.funciones as unknown as { fecha: string; hora: string; peliculas: { titulo: string }; salas: { nombre: string } };
      const asientos = Array.isArray(reserva.asientos)
        ? reserva.asientos.map((a: { fila: string; columna: number }) => `${a.fila}${a.columna}`)
        : [];
      setResultado({
        valido: false,
        mensaje: "⚠️ Boleto ya utilizado",
        detalle: {
          pelicula: f.peliculas?.titulo ?? "—",
          funcion: `${new Date(f.fecha + "T00:00:00").toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" })} · ${f.hora} · ${f.salas?.nombre}`,
          asientos, nombre: reserva.nombre, email: reserva.email,
          origen: reserva.origen ?? "web", usado: true,
        },
      });
      setLoading(false);
      return;
    }

    const f = reserva.funciones as unknown as { fecha: string; hora: string; peliculas: { titulo: string }; salas: { nombre: string } };
    const asientos = Array.isArray(reserva.asientos)
      ? reserva.asientos.map((a: { fila: string; columna: number }) => `${a.fila}${a.columna}`)
      : [];

    setResultado({
      valido: true,
      mensaje: "Boleto válido ✓",
      reservaId: reserva.id,
      detalle: {
        pelicula: f.peliculas?.titulo ?? "—",
        funcion: `${new Date(f.fecha + "T00:00:00").toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" })} · ${f.hora} · ${f.salas?.nombre}`,
        asientos, nombre: reserva.nombre, email: reserva.email,
        origen: reserva.origen ?? "web", usado: false,
      },
    });
    setLoading(false);
    setToken("");
    inputRef.current?.focus();
  }

  async function marcarUsado() {
    if (!resultado?.reservaId || !supabaseReady()) {
      // En demo, solo cierra
      reset(); return;
    }
    setMarcandoUsado(true);
    await supabaseAdmin.from("reservas").update({ usado: true }).eq("id", resultado.reservaId);
    setMarcandoUsado(false);
    reset();
  }

  function reset() {
    setResultado(null);
    setToken("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <div style={{ padding: 24, maxWidth: 560, margin: "0 auto" }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "white", marginBottom: 6 }}>Control de acceso</h2>
      <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>
        Escanea el QR o ingresa el token manualmente
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <input
          ref={inputRef} autoFocus className="input"
          style={{ fontSize: 15, letterSpacing: 1 }}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && validarToken(token)}
          placeholder="Token del QR o código de reserva..."
        />
        <button className="btn btn-primary" disabled={loading || !token.trim()} onClick={() => validarToken(token)} style={{ flexShrink: 0 }}>
          {loading ? "..." : "Validar"}
        </button>
      </div>

      {resultado && (
        <div className="fade-up" style={{
          background: resultado.valido ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
          border: `2px solid ${resultado.valido ? "rgba(74,222,128,0.4)" : "rgba(248,113,113,0.4)"}`,
          borderRadius: 18, padding: 28, textAlign: "center",
        }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>
            {resultado.valido ? "✅" : resultado.detalle?.usado ? "🔁" : "❌"}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: resultado.valido ? "#4ade80" : "#f87171", marginBottom: 16 }}>
            {resultado.mensaje}
          </div>

          {resultado.detalle && (
            <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: "16px 20px", textAlign: "left", marginBottom: 20 }}>
              {[
                { label: "Película", value: resultado.detalle.pelicula },
                { label: "Función", value: resultado.detalle.funcion },
                { label: "Asientos", value: resultado.detalle.asientos.join(", ") },
                { label: "Cliente", value: resultado.detalle.nombre },
                { label: "Email", value: resultado.detalle.email },
                { label: "Origen", value: resultado.detalle.origen === "pos" ? "🏢 Taquilla" : "🌐 Web" },
              ].map((row) => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 14 }}>
                  <span style={{ color: "var(--muted)" }}>{row.label}</span>
                  <span style={{ color: "white", fontWeight: 600, textAlign: "right", maxWidth: "60%" }}>{row.value}</span>
                </div>
              ))}
            </div>
          )}

          {resultado.valido ? (
            <button className="btn btn-success" style={{ width: "100%", fontSize: 16, padding: "14px" }} onClick={marcarUsado} disabled={marcandoUsado}>
              {marcandoUsado ? "Registrando..." : "✓ Permitir entrada"}
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={reset} style={{ width: "100%" }}>
              Siguiente boleto
            </button>
          )}
        </div>
      )}

      {!resultado && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
          <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>
            Conecta un lector de QR USB y apunta al código del boleto.<br />
            El resultado aparece automáticamente.
          </p>
        </div>
      )}
    </div>
  );
}
