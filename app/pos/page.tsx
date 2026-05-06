"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { supabase, supabaseReady } from "@/lib/supabase";
import { formatCOP, formatDateTime } from "@/lib/format";
import { VentaPos } from "@/lib/types";
import { MOCK_VENTAS } from "@/lib/mock";
import {
  TrendingUp, Receipt, Ticket, ShoppingBag,
  QrCode, Clock, BarChart2, Wallet,
} from "lucide-react";

const ADMIN_CARGOS = ["admin", "supervisor"] as const;

interface Stats {
  ventasHoy: number;
  boletosHoy: number;
  confiteriaHoy: number;
  ventasCount: number;
}

const STAT_CARDS = [
  {
    label: "Ventas hoy",     key: "ventasHoy",     icon: TrendingUp,  color: "#CC1244",
    iconBg: "rgba(204,18,68,0.15)",  accent: "red",
  },
  {
    label: "Transacciones",  key: "ventasCount",   icon: Receipt,     color: "#3b82f6",
    iconBg: "rgba(59,130,246,0.15)", accent: "blue",
  },
  {
    label: "Taquilla",       key: "boletosHoy",    icon: Ticket,      color: "#8b5cf6",
    iconBg: "rgba(139,92,246,0.15)", accent: "purple",
  },
  {
    label: "Confitería",     key: "confiteriaHoy", icon: ShoppingBag, color: "#f59e0b",
    iconBg: "rgba(245,158,11,0.15)", accent: "amber",
  },
] as const;

const ACCESOS_RAPIDOS = [
  {
    href: "/pos/taquilla",   icon: Ticket,    label: "Taquilla",
    desc: "Vender boletos",       color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.3)",
  },
  {
    href: "/pos/confiteria", icon: ShoppingBag, label: "Confitería",
    desc: "Snacks y combos",      color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)",
  },
  {
    href: "/pos/acceso",     icon: QrCode,    label: "Acceso",
    desc: "Validar QR",           color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)",
  },
  {
    href: "/pos/empleados",  icon: Clock,     label: "Turno",
    desc: "Entrada / salida",     color: "#3b82f6", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)",
  },
  {
    href: "/pos/reportes",   icon: BarChart2, label: "Reportes",
    desc: "Ventas y corte",       color: "#CC1244", bg: "rgba(204,18,68,0.12)",  border: "rgba(204,18,68,0.3)",
  },
  {
    href: "/pos/caja",       icon: Wallet,    label: "Caja",
    desc: "Cuadre de caja",       color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.3)",
  },
];

export default function Dashboard() {
  const router   = useRouter();
  const empleado = getSession();
  const [stats, setStats]   = useState<Stats>({ ventasHoy: 0, boletosHoy: 0, confiteriaHoy: 0, ventasCount: 0 });
  const [ultimas, setUltimas] = useState<VentaPos[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empleado) return;
    if (!(ADMIN_CARGOS as readonly string[]).includes(empleado.cargo)) {
      const destinos: Record<string, string> = {
        cajero:     "/pos/taquilla",
        confitero:  "/pos/confiteria",
        acomodador: "/pos/acceso",
      };
      router.replace(destinos[empleado.cargo] ?? "/pos/taquilla");
    }
  }, [empleado, router]);

  useEffect(() => { cargarStats(); }, []);

  async function cargarStats() {
    let ventas: VentaPos[] = [];
    if (!supabaseReady()) {
      ventas = MOCK_VENTAS;
    } else {
      const hoy = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("ventas_pos")
        .select("*")
        .eq("anulada", false)
        .gte("created_at", hoy + "T00:00:00")
        .order("created_at", { ascending: false });
      ventas = (data as VentaPos[]) ?? [];
    }

    const activas = ventas.filter((v) => !v.anulada);
    setStats({
      ventasHoy:     activas.reduce((s, v) => s + v.total, 0),
      ventasCount:   activas.length,
      boletosHoy:    activas.filter((v) => v.tipo === "taquilla" || v.tipo === "mixta").reduce((s, v) => s + v.total, 0),
      confiteriaHoy: activas.filter((v) => v.tipo === "confiteria" || v.tipo === "mixta").reduce((s, v) => s + v.total, 0),
    });
    setUltimas(activas.slice(0, 5));
    setLoading(false);
  }

  const TIPO_ICON: Record<string, { icon: typeof Ticket; color: string; bg: string }> = {
    taquilla:   { icon: Ticket,      color: "#8b5cf6", bg: "rgba(139,92,246,0.15)" },
    confiteria: { icon: ShoppingBag, color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
    mixta:      { icon: Receipt,     color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }} className="fade-up">
      {/* Saludo */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: "white", marginBottom: 4, letterSpacing: -0.5 }}>
          Hola, {empleado?.nombre?.split(" ")[0]} 👋
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          {new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 32 }}>
        {STAT_CARDS.map((s) => {
          const Icon  = s.icon;
          const value = s.key === "ventasCount"
            ? (loading ? "—" : String(stats[s.key]))
            : (loading ? "—" : formatCOP(stats[s.key]));
          return (
            <div key={s.label} className={`stat-card ${s.accent}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>
                  {s.label}
                </span>
                <div style={{
                  width: 34, height: 34, borderRadius: 9,
                  background: s.iconBg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Icon size={16} color={s.color} strokeWidth={2.5} />
                </div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "white", letterSpacing: -0.5 }}>
                {value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid inferior */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24 }}>

        {/* Accesos rápidos — tiles */}
        <div>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 14, textTransform: "uppercase", letterSpacing: 1.5 }}>
            Acceso rápido
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {ACCESOS_RAPIDOS.map((a) => {
              const Icon = a.icon;
              return <ActionTile key={a.href} tile={a}><Icon size={24} color={a.color} strokeWidth={2} /></ActionTile>;
            })}
          </div>
        </div>

        {/* Últimas ventas */}
        <div>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 14, textTransform: "uppercase", letterSpacing: 1.5 }}>
            Últimas ventas
          </h2>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {!loading && ultimas.length === 0 && (
              <div style={{ padding: "36px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                Sin ventas registradas hoy
              </div>
            )}
            {ultimas.map((v, i) => {
              const meta  = TIPO_ICON[v.tipo] ?? TIPO_ICON.mixta;
              const VIcon = meta.icon;
              return (
                <div key={v.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "13px 16px",
                  borderBottom: i < ultimas.length - 1 ? "1px solid var(--borde)" : "none",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: meta.bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <VIcon size={16} color={meta.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "white", fontWeight: 600, textTransform: "capitalize" }}>
                      {v.tipo} — {(v.empleados as { nombre: string })?.nombre?.split(" ")[0]}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      {formatDateTime(v.created_at)}
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, color: "#4ade80", fontSize: 14, flexShrink: 0 }}>
                    {formatCOP(v.total)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── ActionTile ───────────────────────────────────────── */
function ActionTile({
  tile, children,
}: {
  tile: { href: string; label: string; desc: string; color: string; bg: string; border: string };
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={tile.href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 10, padding: "22px 12px",
        background: hovered ? tile.bg : "var(--fondo2)",
        border: `1px solid ${hovered ? tile.border : "var(--borde)"}`,
        borderRadius: 16, textDecoration: "none", color: "inherit",
        cursor: "pointer", textAlign: "center",
        transform: hovered ? "translateY(-3px)" : "none",
        boxShadow: hovered ? `0 10px 28px rgba(0,0,0,0.25)` : "none",
        transition: "all 0.18s ease",
      }}
    >
      <div style={{
        width: 50, height: 50, borderRadius: 14,
        background: tile.bg,
        border: `1px solid ${tile.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "transform 0.18s",
        transform: hovered ? "scale(1.08)" : "scale(1)",
      }}>
        {children}
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: "white", marginBottom: 2 }}>
          {tile.label}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>
          {tile.desc}
        </div>
      </div>
    </Link>
  );
}
