"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase, supabaseReady } from "@/lib/supabase";
import { setSession } from "@/lib/session";
import { Empleado } from "@/lib/types";
import { Film, Delete } from "lucide-react";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

function homeForCargo(cargo: string): string {
  switch (cargo) {
    case "cajero":     return "/pos/taquilla";
    case "confitero":  return "/pos/confiteria";
    case "acomodador": return "/pos/acceso";
    default:           return "/pos";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin]     = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (pin.length === 4) verificarPin();
  }, [pin]);

  async function verificarPin() {
    setLoading(true);
    setError("");

    if (!supabaseReady()) {
      const demo: Empleado = {
        id: 1,
        nombre: "Demo Cajero",
        cedula: "0000",
        cargo: "cajero",
        pin,
        activo: true,
        created_at: new Date().toISOString(),
      };
      setSession(demo);
      router.push(homeForCargo(demo.cargo));
      return;
    }

    const { data, error: err } = await supabase
      .from("empleados")
      .select("*")
      .eq("pin", pin)
      .eq("activo", true)
      .single();

    if (err || !data) {
      setError("PIN incorrecto");
      setPin("");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } else {
      const emp = data as Empleado;
      setSession(emp);
      router.push(homeForCargo(emp.cargo));
    }
    setLoading(false);
  }

  function presionar(d: string) {
    if (loading) return;
    if (d === "⌫") {
      setPin((p) => p.slice(0, -1));
      setError("");
    } else if (d !== "" && pin.length < 4) {
      setPin((p) => p + d);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--fondo)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Glow de fondo */}
      <div style={{
        position: "absolute",
        width: 600, height: 600,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(204,18,68,0.12) 0%, transparent 70%)",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
      }} />

      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 40, position: "relative" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: "var(--rojo)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 24px rgba(204,18,68,0.5)",
          }}>
            <Film size={24} color="white" strokeWidth={2} />
          </div>
          <span style={{ fontSize: 30, fontWeight: 900, color: "white", letterSpacing: -1 }}>
            CineWorld <span style={{ color: "var(--rojo)" }}>POS</span>
          </span>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Ingresa tu PIN para continuar</p>
      </div>

      {/* Card */}
      <div
        className={shake ? "shake" : "scale-in"}
        style={{
          background: "var(--fondo2)",
          border: "1px solid var(--borde)",
          borderRadius: 20,
          padding: "32px 28px",
          width: "100%",
          maxWidth: 320,
          position: "relative",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Puntos PIN */}
        <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 28 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{
              width: 16, height: 16, borderRadius: "50%",
              background: i < pin.length ? "var(--rojo)" : "transparent",
              border: `2px solid ${i < pin.length ? "var(--rojo)" : "var(--borde-hover)"}`,
              boxShadow: i < pin.length ? "0 0 8px rgba(204,18,68,0.6)" : "none",
              transition: "all 0.15s",
            }} />
          ))}
        </div>

        {/* Error */}
        {error && (
          <p style={{
            color: "#f87171", textAlign: "center", fontSize: 13,
            marginBottom: 16, fontWeight: 600,
          }}>
            {error}
          </p>
        )}

        {/* Teclado */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {DIGITS.map((d, i) => (
            <PinBtn key={i} digit={d} loading={loading} onPress={presionar} />
          ))}
        </div>
      </div>

      <p style={{ color: "#2a2a3e", fontSize: 12, marginTop: 32, position: "relative" }}>
        CineWorld POS v1.0
      </p>
    </div>
  );
}

function PinBtn({
  digit, loading, onPress,
}: { digit: string; loading: boolean; onPress: (d: string) => void }) {
  const [pressed, setPressed] = useState(false);
  const isEmpty   = digit === "";
  const isDelete  = digit === "⌫";

  if (isEmpty) return <div />;

  return (
    <button
      onClick={() => onPress(digit)}
      disabled={loading}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        height: 62,
        borderRadius: 12,
        border: `1px solid ${isDelete ? "rgba(248,113,113,0.25)" : "var(--borde)"}`,
        background: pressed
          ? "#22222e"
          : isDelete ? "rgba(248,113,113,0.08)" : "var(--fondo3)",
        color: isDelete ? "#f87171" : "var(--texto)",
        fontSize: 22, fontWeight: 700,
        cursor: "pointer",
        transform: pressed ? "scale(0.93)" : "scale(1)",
        transition: "all 0.1s",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {loading && isDelete
        ? <span style={{ fontSize: 14, fontWeight: 600 }}>...</span>
        : isDelete
        ? <Delete size={20} color="#f87171" />
        : digit
      }
    </button>
  );
}
