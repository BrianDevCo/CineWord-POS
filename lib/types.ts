export type Cargo = "cajero" | "confitero" | "supervisor" | "admin" | "acomodador";
export type MetodoPago = "efectivo" | "tarjeta" | "nequi" | "cortesia";
export type TipoVenta = "taquilla" | "confiteria" | "mixta";
export type TipoEntrada = "regular" | "vip" | "nino" | "adulto_mayor" | "estudiante";
export type CategoriaProducto = "bebida" | "combo" | "dulce" | "snack" | "otro";

export interface Empleado {
  id: number;
  nombre: string;
  cedula: string;
  cargo: Cargo;
  pin: string;
  activo: boolean;
  foto_url?: string;
  created_at: string;
}

export interface Turno {
  id: number;
  empleado_id: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  notas?: string;
  empleados?: { nombre: string; cargo: Cargo };
}

export interface Marcacion {
  id: number;
  empleado_id: number;
  tipo: "entrada" | "salida";
  timestamp: string;
  notas?: string;
  empleados?: { nombre: string; cargo: Cargo };
}

export interface Producto {
  id: number;
  nombre: string;
  categoria: CategoriaProducto;
  precio: number;
  imagen_url?: string;
  descripcion?: string;
  activo: boolean;
  orden: number;
}

export interface Inventario {
  id: number;
  producto_id: number;
  cantidad: number;
  minimo: number;
  updated_at: string;
  productos?: Producto;
}

export interface VentaPos {
  id: number;
  empleado_id?: number;
  metodo_pago: MetodoPago;
  subtotal: number;
  descuento: number;
  total: number;
  tipo: TipoVenta;
  anulada: boolean;
  created_at: string;
  empleados?: { nombre: string };
  items_venta_pos?: ItemVentaPos[];
}

export interface ItemVentaPos {
  id: number;
  venta_id: number;
  tipo: "boleto" | "producto";
  funcion_id?: number;
  asientos?: string[];
  tipo_entrada?: TipoEntrada;
  producto_id?: number;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  productos?: Producto;
  funciones?: { peliculas?: { titulo: string } };
}

export interface Pelicula {
  id: number;
  titulo: string;
  poster_url?: string;
  duracion: string;
  clasificacion: string;
  estado: string;
  activa: boolean;
}

export interface Funcion {
  id: number;
  pelicula_id: number;
  sala_id: number;
  fecha: string;
  hora: string;
  formato: string;
  precio_regular: number;
  precio_vip: number;
  activa: boolean;
  peliculas?: Pelicula;
  salas?: { nombre: string; tipo: string; filas: number; columnas: number; filas_vip: string[] };
}

export interface ItemCarrito {
  tipo: "boleto" | "producto";
  label: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  meta?: Record<string, unknown>;
}
