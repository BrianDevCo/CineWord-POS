export function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatHora(hora: string) {
  const [h, m] = hora.split(":");
  const hNum = parseInt(h);
  const ampm = hNum >= 12 ? "PM" : "AM";
  const h12 = hNum % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export function formatFecha(fecha: string) {
  return new Date(fecha + "T00:00:00").toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatDateTime(ts: string) {
  return new Date(ts).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const CARGO_LABEL: Record<string, string> = {
  cajero: "Cajero",
  confitero: "Confitero",
  supervisor: "Supervisor",
  admin: "Administrador",
  acomodador: "Acomodador",
};

export const CATEGORIA_LABEL: Record<string, string> = {
  bebida: "Bebida",
  combo: "Combo",
  dulce: "Dulce",
  snack: "Snack",
  otro: "Otro",
};

export const ENTRADA_LABEL: Record<string, string> = {
  regular: "Regular",
  vip: "VIP",
  nino: "Niño",
  adulto_mayor: "Adulto Mayor",
  estudiante: "Estudiante",
};

export const METODO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  nequi: "Nequi",
  cortesia: "Cortesía",
};
