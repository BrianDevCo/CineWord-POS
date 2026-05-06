import { Funcion, Empleado, Marcacion, Turno, Producto, VentaPos, Inventario, Cargo } from "./types";

export type TipoPermiso = "ausencia" | "tardanza" | "permiso" | "vacaciones" | "incapacidad";

export interface Permiso {
  id: number;
  empleado_id: number;
  tipo: TipoPermiso;
  fecha: string;
  descripcion: string;
  aprobado: boolean;
  empleado_nombre?: string;
}

const HOY = new Date().toISOString().split("T")[0];
const MANANA = new Date(Date.now() + 86400000).toISOString().split("T")[0];

export const MOCK_FUNCIONES: Funcion[] = [
  {
    id: 1, pelicula_id: 1, sala_id: 1, fecha: HOY, hora: "14:30:00", formato: "2D",
    precio_regular: 16000, precio_vip: 26000, activa: true,
    peliculas: { id: 1, titulo: "Spider-Man: No Way Home", clasificacion: "PG-13", duracion: "2h 28min", poster_url: "", estado: "en_cartelera", activa: true },
    salas: { nombre: "Sala 1", tipo: "2D", filas: 8, columnas: 12, filas_vip: ["A", "B"] },
  },
  {
    id: 2, pelicula_id: 1, sala_id: 1, fecha: HOY, hora: "17:00:00", formato: "2D",
    precio_regular: 16000, precio_vip: 26000, activa: true,
    peliculas: { id: 1, titulo: "Spider-Man: No Way Home", clasificacion: "PG-13", duracion: "2h 28min", poster_url: "", estado: "en_cartelera", activa: true },
    salas: { nombre: "Sala 1", tipo: "2D", filas: 8, columnas: 12, filas_vip: ["A", "B"] },
  },
  {
    id: 3, pelicula_id: 1, sala_id: 1, fecha: HOY, hora: "20:00:00", formato: "2D",
    precio_regular: 16000, precio_vip: 26000, activa: true,
    peliculas: { id: 1, titulo: "Spider-Man: No Way Home", clasificacion: "PG-13", duracion: "2h 28min", poster_url: "", estado: "en_cartelera", activa: true },
    salas: { nombre: "Sala 1", tipo: "2D", filas: 8, columnas: 12, filas_vip: ["A", "B"] },
  },
  {
    id: 4, pelicula_id: 2, sala_id: 2, fecha: HOY, hora: "15:00:00", formato: "3D",
    precio_regular: 20000, precio_vip: 32000, activa: true,
    peliculas: { id: 2, titulo: "Avatar: El Camino del Agua", clasificacion: "PG-13", duracion: "3h 12min", poster_url: "", estado: "en_cartelera", activa: true },
    salas: { nombre: "Sala 2 — 3D", tipo: "3D", filas: 10, columnas: 14, filas_vip: ["A", "B", "C"] },
  },
  {
    id: 5, pelicula_id: 2, sala_id: 2, fecha: HOY, hora: "19:30:00", formato: "3D",
    precio_regular: 20000, precio_vip: 32000, activa: true,
    peliculas: { id: 2, titulo: "Avatar: El Camino del Agua", clasificacion: "PG-13", duracion: "3h 12min", poster_url: "", estado: "en_cartelera", activa: true },
    salas: { nombre: "Sala 2 — 3D", tipo: "3D", filas: 10, columnas: 14, filas_vip: ["A", "B", "C"] },
  },
  {
    id: 6, pelicula_id: 3, sala_id: 3, fecha: HOY, hora: "13:00:00", formato: "2D",
    precio_regular: 16000, precio_vip: 26000, activa: true,
    peliculas: { id: 3, titulo: "Oppenheimer", clasificacion: "R", duracion: "3h 00min", poster_url: "", estado: "en_cartelera", activa: true },
    salas: { nombre: "Sala 3", tipo: "2D", filas: 7, columnas: 10, filas_vip: ["A"] },
  },
  {
    id: 7, pelicula_id: 3, sala_id: 3, fecha: HOY, hora: "16:30:00", formato: "2D",
    precio_regular: 16000, precio_vip: 26000, activa: true,
    peliculas: { id: 3, titulo: "Oppenheimer", clasificacion: "R", duracion: "3h 00min", poster_url: "", estado: "en_cartelera", activa: true },
    salas: { nombre: "Sala 3", tipo: "2D", filas: 7, columnas: 10, filas_vip: ["A"] },
  },
  {
    id: 8, pelicula_id: 4, sala_id: 4, fecha: HOY, hora: "12:00:00", formato: "VIP",
    precio_regular: 22000, precio_vip: 38000, activa: true,
    peliculas: { id: 4, titulo: "Dune: Parte Dos", clasificacion: "PG-13", duracion: "2h 46min", poster_url: "", estado: "en_cartelera", activa: true },
    salas: { nombre: "Sala VIP", tipo: "VIP", filas: 5, columnas: 8, filas_vip: ["A", "B", "C", "D", "E"] },
  },
  {
    id: 9, pelicula_id: 4, sala_id: 4, fecha: HOY, hora: "18:00:00", formato: "VIP",
    precio_regular: 22000, precio_vip: 38000, activa: true,
    peliculas: { id: 4, titulo: "Dune: Parte Dos", clasificacion: "PG-13", duracion: "2h 46min", poster_url: "", estado: "en_cartelera", activa: true },
    salas: { nombre: "Sala VIP", tipo: "VIP", filas: 5, columnas: 8, filas_vip: ["A", "B", "C", "D", "E"] },
  },
  {
    id: 10, pelicula_id: 5, sala_id: 1, fecha: MANANA, hora: "15:00:00", formato: "2D",
    precio_regular: 16000, precio_vip: 26000, activa: true,
    peliculas: { id: 5, titulo: "Kung Fu Panda 4", clasificacion: "G", duracion: "1h 34min", poster_url: "", estado: "en_cartelera", activa: true },
    salas: { nombre: "Sala 1", tipo: "2D", filas: 8, columnas: 12, filas_vip: ["A", "B"] },
  },
];

export const MOCK_ASIENTOS_OCUPADOS: Record<number, string[]> = {
  1: ["C3","C4","C5","D6","D7","E1","E2","E3","F8","F9","G4","G5"],
  2: ["B1","B2","C7","C8","D3","D4","E5","E6"],
  3: ["A1","A2","A3","C1","C2","D9","D10","E4","E5","F6","G7","G8","H1","H2"],
  4: ["B2","B3","B4","C5","C6","D1","D2","E8","E9","F3","F4"],
  5: ["A1","A2","B1","B2","C3","C4","C5","D6","D7","E1","F2"],
  6: ["B3","B4","C1","C2","D5","D6","E4","E5","F3","G2"],
  7: ["A1","B2","B3","C4","C5","D1","E3","F4","F5","G6"],
  8: ["A1","A2","A3","B4","B5","C2","C3","D1","D4","E5"],
  9: ["A1","A2","B3","B4","C5"],
  10: [],
};

export const MOCK_EMPLEADOS: Empleado[] = [
  { id: 1, nombre: "Ana García Ruiz", cedula: "1006011001", cargo: "cajero", pin: "1111", activo: true, created_at: "" },
  { id: 2, nombre: "Luis Pérez Mora", cedula: "1006011002", cargo: "confitero", pin: "2222", activo: true, created_at: "" },
  { id: 3, nombre: "María Torres", cedula: "1006011003", cargo: "supervisor", pin: "3333", activo: true, created_at: "" },
  { id: 4, nombre: "Carlos Ruiz López", cedula: "1006011004", cargo: "acomodador", pin: "4444", activo: true, created_at: "" },
  { id: 5, nombre: "Sofía Martínez", cedula: "1006011005", cargo: "cajero", pin: "5555", activo: true, created_at: "" },
];

export const MOCK_MARCACIONES: Marcacion[] = [
  { id: 1, empleado_id: 3, tipo: "entrada", timestamp: new Date().toISOString().replace(/T.*/, "T08:02:00.000Z"), empleados: { nombre: "María Torres", cargo: "supervisor" } },
  { id: 2, empleado_id: 1, tipo: "entrada", timestamp: new Date().toISOString().replace(/T.*/, "T08:15:00.000Z"), empleados: { nombre: "Ana García Ruiz", cargo: "cajero" } },
  { id: 3, empleado_id: 2, tipo: "entrada", timestamp: new Date().toISOString().replace(/T.*/, "T08:58:00.000Z"), empleados: { nombre: "Luis Pérez Mora", cargo: "confitero" } },
  { id: 4, empleado_id: 5, tipo: "entrada", timestamp: new Date().toISOString().replace(/T.*/, "T09:03:00.000Z"), empleados: { nombre: "Sofía Martínez", cargo: "cajero" } },
  { id: 5, empleado_id: 4, tipo: "entrada", timestamp: new Date().toISOString().replace(/T.*/, "T11:30:00.000Z"), empleados: { nombre: "Carlos Ruiz López", cargo: "acomodador" } },
  { id: 6, empleado_id: 2, tipo: "salida", timestamp: new Date().toISOString().replace(/T.*/, "T13:01:00.000Z"), empleados: { nombre: "Luis Pérez Mora", cargo: "confitero" } },
  { id: 7, empleado_id: 2, tipo: "entrada", timestamp: new Date().toISOString().replace(/T.*/, "T14:00:00.000Z"), empleados: { nombre: "Luis Pérez Mora", cargo: "confitero" } },
];

export const MOCK_TURNOS: Turno[] = [
  { id: 1, empleado_id: 1, fecha: HOY, hora_inicio: "08:00:00", hora_fin: "16:00:00", empleados: { nombre: "Ana García Ruiz", cargo: "cajero" } },
  { id: 2, empleado_id: 2, fecha: HOY, hora_inicio: "08:00:00", hora_fin: "16:00:00", empleados: { nombre: "Luis Pérez Mora", cargo: "confitero" } },
  { id: 3, empleado_id: 3, fecha: HOY, hora_inicio: "08:00:00", hora_fin: "20:00:00", empleados: { nombre: "María Torres", cargo: "supervisor" } },
  { id: 4, empleado_id: 5, fecha: HOY, hora_inicio: "09:00:00", hora_fin: "17:00:00", empleados: { nombre: "Sofía Martínez", cargo: "cajero" } },
  { id: 5, empleado_id: 4, fecha: HOY, hora_inicio: "11:00:00", hora_fin: "22:00:00", empleados: { nombre: "Carlos Ruiz López", cargo: "acomodador" } },
];

export const MOCK_PRODUCTOS: Producto[] = [
  { id: 1, nombre: "Combo Personal", categoria: "combo", precio: 18000, descripcion: "Crispetas medianas + gaseosa mediana", activo: true, orden: 1 },
  { id: 2, nombre: "Combo Pareja", categoria: "combo", precio: 32000, descripcion: "Crispetas grandes + 2 gaseosas medianas", activo: true, orden: 2 },
  { id: 3, nombre: "Combo Familiar", categoria: "combo", precio: 48000, descripcion: "Crispetas jumbo + 4 gaseosas", activo: true, orden: 3 },
  { id: 4, nombre: "Crispetas Pequeñas", categoria: "snack", precio: 8000, descripcion: "Sal o caramelo", activo: true, orden: 4 },
  { id: 5, nombre: "Crispetas Medianas", categoria: "snack", precio: 12000, descripcion: "Sal o caramelo", activo: true, orden: 5 },
  { id: 6, nombre: "Crispetas Grandes", categoria: "snack", precio: 16000, descripcion: "Sal o caramelo", activo: true, orden: 6 },
  { id: 7, nombre: "Gaseosa Mediana", categoria: "bebida", precio: 7000, descripcion: "Coca-Cola, Pepsi, Sprite", activo: true, orden: 7 },
  { id: 8, nombre: "Gaseosa Grande", categoria: "bebida", precio: 9000, descripcion: "Coca-Cola, Pepsi, Sprite", activo: true, orden: 8 },
  { id: 9, nombre: "Agua Botella", categoria: "bebida", precio: 4000, descripcion: "600ml", activo: true, orden: 9 },
  { id: 10, nombre: "Nachos con Queso", categoria: "snack", precio: 11000, descripcion: "Con salsa de queso o guacamole", activo: true, orden: 10 },
  { id: 11, nombre: "Hot Dog", categoria: "snack", precio: 9000, descripcion: "Con mostaza, kétchup y mayonesa", activo: true, orden: 11 },
  { id: 12, nombre: "Chocolatina Jet", categoria: "dulce", precio: 4500, descripcion: "", activo: true, orden: 12 },
  { id: 13, nombre: "M&M's", categoria: "dulce", precio: 6000, descripcion: "", activo: true, orden: 13 },
  { id: 14, nombre: "Café Americano", categoria: "bebida", precio: 5000, descripcion: "Caliente o frío", activo: true, orden: 14 },
];

export const MOCK_INVENTARIO: Inventario[] = MOCK_PRODUCTOS.map((p, i) => ({
  id: i + 1,
  producto_id: p.id,
  cantidad: [45, 8, 62, 30, 22, 14, 55, 40, 70, 6, 25, 38, 20, 33][i] ?? 30,
  minimo: [10, 10, 10, 5, 5, 5, 10, 10, 10, 8, 5, 5, 5, 5][i] ?? 5,
  updated_at: new Date().toISOString(),
  productos: p,
}));

const makeTs = (h: number, m: number) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

// Genera marcaciones históricas de los últimos 7 días
function diasAtras(d: number, h: number, m: number) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - d);
  fecha.setHours(h, m, 0, 0);
  return fecha.toISOString();
}

// [empleado_id, dias_atras, entrada_h, entrada_m, salida_h, salida_m]
const HORARIOS_SEMANA: [number, number, number, number, number, number][] = [
  // Ana García (id 1)
  [1, 6, 8, 5, 16, 12], [1, 5, 8, 2, 16, 8], [1, 4, 8, 10, 16, 5],
  [1, 3, 8, 0, 16, 15], [1, 2, 8, 8, 16, 2], [1, 1, 8, 3, 16, 10],
  // Luis Pérez (id 2) — faltó hace 4 días
  [2, 6, 9, 2, 17, 5], [2, 5, 8, 58, 17, 3], [2, 3, 9, 1, 17, 8],
  [2, 2, 8, 55, 17, 0], [2, 1, 9, 4, 17, 2],
  // María Torres (id 3) — supervisora, jornada larga
  [3, 6, 8, 0, 20, 5], [3, 5, 8, 2, 20, 1], [3, 4, 8, 0, 20, 8],
  [3, 3, 8, 1, 20, 3], [3, 2, 8, 0, 20, 6], [3, 1, 8, 2, 20, 4],
  // Carlos Ruiz (id 4) — part time
  [4, 6, 14, 5, 22, 10], [4, 5, 14, 2, 22, 5],
  [4, 2, 14, 8, 22, 3], [4, 1, 14, 0, 22, 7],
  // Sofía Martínez (id 5) — llegó tarde hace 3 días
  [5, 6, 9, 1, 17, 5], [5, 5, 9, 3, 17, 2], [5, 4, 9, 0, 17, 8],
  [5, 3, 9, 42, 17, 5], // tardanza
  [5, 2, 9, 2, 17, 1], [5, 1, 9, 0, 17, 3],
];

export const MOCK_MARCACIONES_HISTORICAS: Marcacion[] = HORARIOS_SEMANA.flatMap(
  ([empId, diasA, eH, eM, sH, sM], i) => {
    const emp = [
      { nombre: "Ana García Ruiz", cargo: "cajero" as Cargo },
      { nombre: "Luis Pérez Mora", cargo: "confitero" as Cargo },
      { nombre: "María Torres", cargo: "supervisor" as Cargo },
      { nombre: "Carlos Ruiz López", cargo: "acomodador" as Cargo },
      { nombre: "Sofía Martínez", cargo: "cajero" as Cargo },
    ][empId - 1];
    return [
      { id: 1000 + i * 2, empleado_id: empId, tipo: "entrada" as const, timestamp: diasAtras(diasA, eH, eM), empleados: emp },
      { id: 1001 + i * 2, empleado_id: empId, tipo: "salida" as const, timestamp: diasAtras(diasA, sH, sM), empleados: emp },
    ];
  }
);

// Horas trabajadas por empleado esta semana
export interface ResumenHoras {
  empleado_id: number;
  nombre: string;
  cargo: string;
  dias_trabajados: number;
  horas_totales: number;
  horas_esperadas: number;
  dias_ausente: number;
  tardanzas: number;
}

export const MOCK_HORAS_SEMANA: ResumenHoras[] = [
  { empleado_id: 1, nombre: "Ana García Ruiz",   cargo: "cajero",     dias_trabajados: 6, horas_totales: 48.2, horas_esperadas: 48, dias_ausente: 0, tardanzas: 0 },
  { empleado_id: 2, nombre: "Luis Pérez Mora",   cargo: "confitero",  dias_trabajados: 5, horas_totales: 40.1, horas_esperadas: 48, dias_ausente: 1, tardanzas: 0 },
  { empleado_id: 3, nombre: "María Torres",      cargo: "supervisor", dias_trabajados: 6, horas_totales: 72.1, horas_esperadas: 72, dias_ausente: 0, tardanzas: 0 },
  { empleado_id: 4, nombre: "Carlos Ruiz López", cargo: "acomodador", dias_trabajados: 4, horas_totales: 32.4, horas_esperadas: 40, dias_ausente: 2, tardanzas: 0 },
  { empleado_id: 5, nombre: "Sofía Martínez",    cargo: "cajero",     dias_trabajados: 6, horas_totales: 47.8, horas_esperadas: 48, dias_ausente: 0, tardanzas: 1 },
];

export const MOCK_PERMISOS: Permiso[] = [
  { id: 1, empleado_id: 2, tipo: "ausencia",     fecha: diasAtras(4, 0, 0).split("T")[0], descripcion: "No se presentó sin avisar",         aprobado: false, empleado_nombre: "Luis Pérez Mora" },
  { id: 2, empleado_id: 5, tipo: "tardanza",     fecha: diasAtras(3, 0, 0).split("T")[0], descripcion: "Llegó 42 minutos tarde",             aprobado: false, empleado_nombre: "Sofía Martínez" },
  { id: 3, empleado_id: 4, tipo: "ausencia",     fecha: diasAtras(5, 0, 0).split("T")[0], descripcion: "Ausencia injustificada",             aprobado: false, empleado_nombre: "Carlos Ruiz López" },
  { id: 4, empleado_id: 1, tipo: "permiso",      fecha: diasAtras(10, 0, 0).split("T")[0], descripcion: "Cita médica — salió 2h antes",     aprobado: true,  empleado_nombre: "Ana García Ruiz" },
  { id: 5, empleado_id: 3, tipo: "vacaciones",   fecha: diasAtras(20, 0, 0).split("T")[0], descripcion: "Vacaciones 5 días",                aprobado: true,  empleado_nombre: "María Torres" },
  { id: 6, empleado_id: 4, tipo: "incapacidad",  fecha: diasAtras(15, 0, 0).split("T")[0], descripcion: "Incapacidad médica 3 días",        aprobado: true,  empleado_nombre: "Carlos Ruiz López" },
];

export const MOCK_VENTAS: VentaPos[] = [
  { id: 1001, empleado_id: 1, metodo_pago: "efectivo", subtotal: 64000, descuento: 0, total: 64000, tipo: "taquilla", anulada: false, created_at: makeTs(9, 15), empleados: { nombre: "Ana García Ruiz" } },
  { id: 1002, empleado_id: 2, metodo_pago: "efectivo", subtotal: 32000, descuento: 0, total: 32000, tipo: "confiteria", anulada: false, created_at: makeTs(9, 22), empleados: { nombre: "Luis Pérez Mora" } },
  { id: 1003, empleado_id: 5, metodo_pago: "tarjeta", subtotal: 80000, descuento: 0, total: 80000, tipo: "taquilla", anulada: false, created_at: makeTs(10, 5), empleados: { nombre: "Sofía Martínez" } },
  { id: 1004, empleado_id: 2, metodo_pago: "nequi", subtotal: 48000, descuento: 0, total: 48000, tipo: "confiteria", anulada: false, created_at: makeTs(10, 40), empleados: { nombre: "Luis Pérez Mora" } },
  { id: 1005, empleado_id: 1, metodo_pago: "tarjeta", subtotal: 40000, descuento: 5000, total: 35000, tipo: "taquilla", anulada: false, created_at: makeTs(11, 10), empleados: { nombre: "Ana García Ruiz" } },
  { id: 1006, empleado_id: 5, metodo_pago: "efectivo", subtotal: 18000, descuento: 0, total: 18000, tipo: "confiteria", anulada: false, created_at: makeTs(11, 45), empleados: { nombre: "Sofía Martínez" } },
  { id: 1007, empleado_id: 1, metodo_pago: "efectivo", subtotal: 96000, descuento: 0, total: 96000, tipo: "taquilla", anulada: false, created_at: makeTs(12, 30), empleados: { nombre: "Ana García Ruiz" } },
  { id: 1008, empleado_id: 2, metodo_pago: "tarjeta", subtotal: 62000, descuento: 0, total: 62000, tipo: "confiteria", anulada: false, created_at: makeTs(13, 15), empleados: { nombre: "Luis Pérez Mora" } },
  { id: 1009, empleado_id: 5, metodo_pago: "efectivo", subtotal: 32000, descuento: 0, total: 32000, tipo: "taquilla", anulada: false, created_at: makeTs(14, 0), empleados: { nombre: "Sofía Martínez" } },
  { id: 1010, empleado_id: 1, metodo_pago: "nequi", subtotal: 25000, descuento: 0, total: 25000, tipo: "confiteria", anulada: false, created_at: makeTs(14, 30), empleados: { nombre: "Ana García Ruiz" } },
  { id: 1011, empleado_id: 2, metodo_pago: "efectivo", subtotal: 112000, descuento: 0, total: 112000, tipo: "taquilla", anulada: false, created_at: makeTs(15, 10), empleados: { nombre: "Luis Pérez Mora" } },
  { id: 1012, empleado_id: 5, metodo_pago: "tarjeta", subtotal: 44000, descuento: 0, total: 44000, tipo: "confiteria", anulada: false, created_at: makeTs(15, 55), empleados: { nombre: "Sofía Martínez" } },
  { id: 1013, empleado_id: 1, metodo_pago: "cortesia", subtotal: 32000, descuento: 32000, total: 0, tipo: "taquilla", anulada: false, created_at: makeTs(16, 20), empleados: { nombre: "Ana García Ruiz" } },
  { id: 1014, empleado_id: 2, metodo_pago: "efectivo", subtotal: 56000, descuento: 0, total: 56000, tipo: "taquilla", anulada: false, created_at: makeTs(17, 0), empleados: { nombre: "Luis Pérez Mora" } },
  { id: 1015, empleado_id: 5, metodo_pago: "tarjeta", subtotal: 38000, descuento: 0, total: 38000, tipo: "confiteria", anulada: false, created_at: makeTs(17, 35), empleados: { nombre: "Sofía Martínez" } },
];
