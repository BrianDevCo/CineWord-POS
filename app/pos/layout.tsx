"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { getSession, clearSession } from "@/lib/session";
import { Empleado } from "@/lib/types";
import { CARGO_LABEL } from "@/lib/format";
import {
  Film, Home, Ticket, ShoppingBag, QrCode, Wallet,
  BarChart2, Users, Package, UserCog, Boxes, LogOut, Clock,
} from "lucide-react";

type NavItem = { href: string; icon: React.ElementType; label: string };

const NAV_ADMIN: NavItem[] = [
  { href: "/pos",            icon: Home,        label: "Inicio" },
  { href: "/pos/taquilla",   icon: Ticket,      label: "Taquilla" },
  { href: "/pos/confiteria", icon: ShoppingBag, label: "Confitería" },
  { href: "/pos/acceso",     icon: QrCode,      label: "Acceso" },
  { href: "/pos/caja",       icon: Wallet,      label: "Cuadre de caja" },
  { href: "/pos/reportes",   icon: BarChart2,   label: "Reportes" },
  { href: "/pos/empleados",  icon: Users,       label: "Empleados" },
];

const NAV_CAJERO: NavItem[] = [
  { href: "/pos/taquilla",   icon: Ticket,      label: "Taquilla" },
  { href: "/pos/confiteria", icon: ShoppingBag, label: "Confitería" },
  { href: "/pos/acceso",     icon: QrCode,      label: "Acceso QR" },
  { href: "/pos/empleados",  icon: Clock,       label: "Mi turno" },
];

const NAV_CONFITERO: NavItem[] = [
  { href: "/pos/confiteria", icon: ShoppingBag, label: "Confitería" },
  { href: "/pos/empleados",  icon: Clock,       label: "Mi turno" },
];

const NAV_ACOMODADOR: NavItem[] = [
  { href: "/pos/acceso",    icon: QrCode, label: "Acceso QR" },
  { href: "/pos/empleados", icon: Clock,  label: "Mi turno" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin/productos",  icon: Package, label: "Productos" },
  { href: "/admin/empleados",  icon: UserCog, label: "Personal" },
  { href: "/admin/inventario", icon: Boxes,   label: "Inventario" },
];

function navForCargo(cargo: string): NavItem[] {
  switch (cargo) {
    case "cajero":     return NAV_CAJERO;
    case "confitero":  return NAV_CONFITERO;
    case "acomodador": return NAV_ACOMODADOR;
    default:           return NAV_ADMIN;
  }
}

function getInitials(nombre: string) {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [hora, setHora]         = useState("");

  useEffect(() => {
    const emp = getSession();
    if (!emp) { router.push("/"); return; }
    setEmpleado(emp);
  }, [router]);

  useEffect(() => {
    const tick = () =>
      setHora(new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  function cerrarSesion() {
    clearSession();
    router.push("/");
  }

  if (!empleado) return null;

  const isAdmin   = empleado.cargo === "admin" || empleado.cargo === "supervisor";
  const navItems  = navForCargo(empleado.cargo);
  const isReduced = !isAdmin;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside style={{
        width: 240,
        background: "var(--fondo2)",
        borderRight: "1px solid var(--borde)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: "22px 18px 18px", borderBottom: "1px solid var(--borde)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: "var(--rojo)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 14px rgba(204,18,68,0.45)",
              flexShrink: 0,
            }}>
              <Film size={20} color="white" strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15, color: "white", letterSpacing: -0.3 }}>
                CineWorld
              </div>
              <div style={{ fontSize: 10, color: "var(--rojo)", fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>
                POS
              </div>
            </div>
          </div>
        </div>

        {/* Avatar + empleado */}
        <div style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--borde)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: "50%",
            background: "rgba(204,18,68,0.15)",
            border: "2px solid rgba(204,18,68,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 800, color: "var(--rojo)",
            flexShrink: 0,
          }}>
            {getInitials(empleado.nombre)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: "white",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {empleado.nombre}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>
              {CARGO_LABEL[empleado.cargo]}
            </div>
          </div>
        </div>

        {/* Navegación */}
        <nav style={{ flex: 1, padding: "10px", overflowY: "auto" }}>
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon   = item.icon;
            return (
              <NavItem key={item.href} href={item.href} active={active}>
                <Icon size={17} strokeWidth={active ? 2.5 : 2} />
                {item.label}
              </NavItem>
            );
          })}

          {isAdmin && (
            <>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: "#333",
                textTransform: "uppercase", padding: "16px 12px 6px",
              }}>
                Administración
              </div>
              {ADMIN_NAV.map((item) => {
                const active = pathname === item.href;
                const Icon   = item.icon;
                return (
                  <NavItem key={item.href} href={item.href} active={active}>
                    <Icon size={17} strokeWidth={active ? 2.5 : 2} />
                    {item.label}
                  </NavItem>
                );
              })}
            </>
          )}

          {/* Badge de rol para cargos operativos */}
          {isReduced && (
            <div style={{
              margin: "12px 4px 0",
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--borde)",
              fontSize: 11,
              color: "var(--muted)",
              textAlign: "center",
            }}>
              Acceso: <span style={{ color: "var(--texto)", fontWeight: 600 }}>
                {CARGO_LABEL[empleado.cargo]}
              </span>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div style={{ padding: "12px 10px", borderTop: "1px solid var(--borde)" }}>
          <div style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "var(--fondo3)",
            border: "1px solid var(--borde)",
            marginBottom: 8,
            textAlign: "center",
            fontSize: 22, fontWeight: 900, color: "white",
            letterSpacing: 3, fontVariantNumeric: "tabular-nums",
          }}>
            {hora}
          </div>
          <LogoutBtn onClick={cerrarSesion} />
        </div>
      </aside>

      {/* ── Contenido ───────────────────────────────────── */}
      <main style={{ flex: 1, overflow: "auto", background: "var(--fondo)" }}>
        {children}
      </main>
    </div>
  );
}

/* ── Sub-componentes ──────────────────────────────────── */

function NavItem({
  href, active, children,
}: { href: string; active: boolean; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px",
        borderRadius: 10,
        marginBottom: 2,
        textDecoration: "none",
        borderLeft: active ? "3px solid var(--rojo)" : "3px solid transparent",
        background: active
          ? "rgba(204,18,68,0.12)"
          : hovered ? "rgba(255,255,255,0.04)" : "transparent",
        color: active ? "var(--rojo)" : hovered ? "var(--texto)" : "var(--muted-light)",
        fontWeight: active ? 700 : 500,
        fontSize: 14,
        transition: "all 0.15s",
      }}
    >
      {children}
    </Link>
  );
}

function LogoutBtn({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%", padding: "9px 12px", borderRadius: 10,
        border: `1px solid ${hovered ? "rgba(239,68,68,0.35)" : "var(--borde)"}`,
        background: hovered ? "rgba(239,68,68,0.08)" : "transparent",
        color: hovered ? "#f87171" : "var(--muted)",
        fontSize: 13, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        transition: "all 0.15s",
      }}
    >
      <LogOut size={15} />
      Cerrar sesión
    </button>
  );
}
