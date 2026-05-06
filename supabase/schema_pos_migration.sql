-- ================================================================
-- CINEWORLD POS — Migración completa
-- Ejecutar en Supabase SQL Editor (una sola vez)
-- Asume que schema.sql (cineworld-web) ya fue ejecutado
-- ================================================================

-- ================================================================
-- 1. Extender tabla reservas (del sitio web)
-- ================================================================
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS origen text DEFAULT 'web'
  CHECK (origen IN ('web', 'pos'));
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS usado boolean DEFAULT false;

-- ================================================================
-- 2. Productos de confitería
-- ================================================================
CREATE TABLE IF NOT EXISTS productos (
  id serial PRIMARY KEY,
  nombre text NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('bebida', 'combo', 'dulce', 'snack', 'otro')),
  precio integer NOT NULL,
  imagen_url text,
  descripcion text,
  activo boolean DEFAULT true,
  orden integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ================================================================
-- 3. Inventario
-- ================================================================
CREATE TABLE IF NOT EXISTS inventario (
  id serial PRIMARY KEY,
  producto_id integer NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  cantidad integer NOT NULL DEFAULT 0,
  minimo integer NOT NULL DEFAULT 5,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(producto_id)
);

-- ================================================================
-- 4. Empleados
-- ================================================================
CREATE TABLE IF NOT EXISTS empleados (
  id serial PRIMARY KEY,
  nombre text NOT NULL,
  cedula text NOT NULL UNIQUE,
  cargo text NOT NULL CHECK (cargo IN ('cajero', 'confitero', 'supervisor', 'admin', 'acomodador')),
  pin text NOT NULL,
  activo boolean DEFAULT true,
  foto_url text,
  created_at timestamptz DEFAULT now()
);

-- ================================================================
-- 5. Turnos programados
-- ================================================================
CREATE TABLE IF NOT EXISTS turnos (
  id serial PRIMARY KEY,
  empleado_id integer NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  hora_inicio time NOT NULL,
  hora_fin time NOT NULL,
  notas text,
  created_at timestamptz DEFAULT now()
);

-- ================================================================
-- 6. Marcaciones de entrada/salida
-- ================================================================
CREATE TABLE IF NOT EXISTS marcaciones (
  id serial PRIMARY KEY,
  empleado_id integer NOT NULL REFERENCES empleados(id),
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'salida')),
  timestamp timestamptz DEFAULT now(),
  notas text
);

-- ================================================================
-- 7. Permisos / novedades de personal
-- ================================================================
CREATE TABLE IF NOT EXISTS permisos (
  id serial PRIMARY KEY,
  empleado_id integer NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('ausencia', 'tardanza', 'permiso', 'vacaciones', 'incapacidad')),
  fecha date NOT NULL,
  descripcion text NOT NULL,
  aprobado boolean DEFAULT false,
  aprobado_por integer REFERENCES empleados(id),
  created_at timestamptz DEFAULT now()
);

-- ================================================================
-- 8. Cuadre de caja
-- ================================================================
CREATE TABLE IF NOT EXISTS cuadre_caja (
  id serial PRIMARY KEY,
  empleado_id integer NOT NULL REFERENCES empleados(id),
  fondo_inicial integer NOT NULL DEFAULT 0,
  ventas_efectivo integer NOT NULL DEFAULT 0,
  total_esperado integer NOT NULL DEFAULT 0,
  monto_real integer,
  diferencia integer,
  notas text,
  abierto_en timestamptz DEFAULT now(),
  cerrado_en timestamptz,
  CONSTRAINT cuadre_caja_abierto_unico UNIQUE NULLS NOT DISTINCT (empleado_id, cerrado_en)
    DEFERRABLE INITIALLY DEFERRED
);

-- ================================================================
-- 9. Ventas POS (cabecera)
-- ================================================================
CREATE TABLE IF NOT EXISTS ventas_pos (
  id serial PRIMARY KEY,
  empleado_id integer REFERENCES empleados(id),
  reserva_id integer REFERENCES reservas(id),
  metodo_pago text NOT NULL CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'nequi', 'cortesia')),
  subtotal integer NOT NULL,
  descuento integer DEFAULT 0,
  total integer NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('taquilla', 'confiteria', 'mixta')),
  anulada boolean DEFAULT false,
  motivo_anulacion text,
  anulada_por integer REFERENCES empleados(id),
  created_at timestamptz DEFAULT now()
);

-- ================================================================
-- 10. Items de cada venta POS
-- ================================================================
CREATE TABLE IF NOT EXISTS items_venta_pos (
  id serial PRIMARY KEY,
  venta_id integer NOT NULL REFERENCES ventas_pos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('boleto', 'producto')),
  funcion_id integer REFERENCES funciones(id),
  asientos jsonb DEFAULT '[]',
  tipo_entrada text CHECK (tipo_entrada IN ('regular', 'vip', 'nino', 'adulto_mayor', 'estudiante')),
  producto_id integer REFERENCES productos(id),
  cantidad integer NOT NULL DEFAULT 1,
  precio_unitario integer NOT NULL,
  subtotal integer NOT NULL
);

-- ================================================================
-- 11. RLS — Políticas de acceso
-- ================================================================
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE marcaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE permisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuadre_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_pos ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_venta_pos ENABLE ROW LEVEL SECURITY;

-- El POS usa service_role key — acceso total
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'productos' AND policyname = 'productos_all') THEN
    CREATE POLICY "productos_all" ON productos USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventario' AND policyname = 'inventario_all') THEN
    CREATE POLICY "inventario_all" ON inventario USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'empleados' AND policyname = 'empleados_all') THEN
    CREATE POLICY "empleados_all" ON empleados USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'turnos' AND policyname = 'turnos_all') THEN
    CREATE POLICY "turnos_all" ON turnos USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marcaciones' AND policyname = 'marcaciones_all') THEN
    CREATE POLICY "marcaciones_all" ON marcaciones USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'permisos' AND policyname = 'permisos_all') THEN
    CREATE POLICY "permisos_all" ON permisos USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cuadre_caja' AND policyname = 'cuadre_caja_all') THEN
    CREATE POLICY "cuadre_caja_all" ON cuadre_caja USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ventas_pos' AND policyname = 'ventas_pos_all') THEN
    CREATE POLICY "ventas_pos_all" ON ventas_pos USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'items_venta_pos' AND policyname = 'items_venta_pos_all') THEN
    CREATE POLICY "items_venta_pos_all" ON items_venta_pos USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Permitir que el anon lea reservas propias por qr_token (para acceso)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reservas' AND policyname = 'reservas_read_by_token') THEN
    CREATE POLICY "reservas_read_by_token" ON reservas FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reservas' AND policyname = 'reservas_update_usado') THEN
    CREATE POLICY "reservas_update_usado" ON reservas FOR UPDATE USING (true);
  END IF;
END $$;

-- ================================================================
-- 12. Habilitar Realtime en asientos_ocupados y reservas
-- ================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE asientos_ocupados;
ALTER PUBLICATION supabase_realtime ADD TABLE reservas;
ALTER PUBLICATION supabase_realtime ADD TABLE ventas_pos;

-- ================================================================
-- 13. Seed: Empleados
-- ================================================================
INSERT INTO empleados (nombre, cedula, cargo, pin, activo) VALUES
  ('Ana García Ruiz',   '1006011001', 'cajero',     '1111', true),
  ('Luis Pérez Mora',   '1006011002', 'confitero',  '2222', true),
  ('María Torres',      '1006011003', 'supervisor', '3333', true),
  ('Carlos Ruiz López', '1006011004', 'acomodador', '4444', true),
  ('Sofía Martínez',    '1006011005', 'cajero',     '5555', true)
ON CONFLICT (cedula) DO NOTHING;

-- ================================================================
-- 14. Seed: Turnos de hoy
-- ================================================================
INSERT INTO turnos (empleado_id, fecha, hora_inicio, hora_fin)
SELECT e.id, CURRENT_DATE,
  CASE e.cedula
    WHEN '1006011001' THEN '08:00'::time
    WHEN '1006011002' THEN '08:00'::time
    WHEN '1006011003' THEN '08:00'::time
    WHEN '1006011004' THEN '11:00'::time
    WHEN '1006011005' THEN '09:00'::time
  END,
  CASE e.cedula
    WHEN '1006011001' THEN '16:00'::time
    WHEN '1006011002' THEN '16:00'::time
    WHEN '1006011003' THEN '20:00'::time
    WHEN '1006011004' THEN '22:00'::time
    WHEN '1006011005' THEN '17:00'::time
  END
FROM empleados e
WHERE e.cedula IN ('1006011001','1006011002','1006011003','1006011004','1006011005');

-- ================================================================
-- 15. Seed: Productos de confitería
-- ================================================================
INSERT INTO productos (nombre, categoria, precio, descripcion, orden) VALUES
  ('Combo Personal',    'combo',  18000, 'Crispetas medianas + gaseosa mediana', 1),
  ('Combo Pareja',      'combo',  32000, 'Crispetas grandes + 2 gaseosas medianas', 2),
  ('Combo Familiar',    'combo',  48000, 'Crispetas jumbo + 4 gaseosas', 3),
  ('Crispetas Pequeñas','snack',   8000, 'Crispetas con sal o caramelo', 4),
  ('Crispetas Medianas','snack',  12000, 'Crispetas con sal o caramelo', 5),
  ('Crispetas Grandes', 'snack',  16000, 'Crispetas con sal o caramelo', 6),
  ('Gaseosa Mediana',   'bebida',  7000, 'Coca-Cola, Pepsi, Sprite o agua', 7),
  ('Gaseosa Grande',    'bebida',  9000, 'Coca-Cola, Pepsi, Sprite o agua', 8),
  ('Agua Botella',      'bebida',  4000, 'Agua 600ml', 9),
  ('Nachos',            'snack',  10000, 'Nachos con queso o guacamole', 10),
  ('Hot Dog',           'snack',   9000, 'Hot dog con salsas', 11),
  ('Chocolatina',       'dulce',   5000, 'Jet, Snickers o M&M', 12),
  ('Agua con Gas',      'bebida',  5000, 'Agua con gas 400ml', 13),
  ('Maní',              'dulce',   4000, 'Maní dulce o salado', 14)
ON CONFLICT DO NOTHING;

-- Inventario inicial
INSERT INTO inventario (producto_id, cantidad, minimo)
SELECT id, 50, 10 FROM productos
ON CONFLICT DO NOTHING;
