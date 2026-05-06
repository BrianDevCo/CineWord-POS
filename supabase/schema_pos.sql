-- ================================================================
-- CINEWORLD POS — Tablas adicionales
-- Ejecutar DESPUÉS del schema.sql del sitio web
-- ================================================================

-- Productos de confitería
create table if not exists productos (
  id serial primary key,
  nombre text not null,
  categoria text not null check (categoria in ('bebida', 'combo', 'dulce', 'snack', 'otro')),
  precio integer not null,
  imagen_url text,
  descripcion text,
  activo boolean default true,
  orden integer default 0,
  created_at timestamptz default now()
);

-- Inventario de productos
create table if not exists inventario (
  id serial primary key,
  producto_id integer not null references productos(id) on delete cascade,
  cantidad integer not null default 0,
  minimo integer not null default 5,
  updated_at timestamptz default now(),
  unique(producto_id)
);

-- Empleados
create table if not exists empleados (
  id serial primary key,
  nombre text not null,
  cedula text not null unique,
  cargo text not null check (cargo in ('cajero', 'confitero', 'supervisor', 'admin', 'acomodador')),
  pin text not null,
  activo boolean default true,
  foto_url text,
  created_at timestamptz default now()
);

-- Turnos programados
create table if not exists turnos (
  id serial primary key,
  empleado_id integer not null references empleados(id) on delete cascade,
  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,
  notas text,
  created_at timestamptz default now()
);

-- Marcaciones de entrada/salida
create table if not exists marcaciones (
  id serial primary key,
  empleado_id integer not null references empleados(id),
  tipo text not null check (tipo in ('entrada', 'salida')),
  timestamp timestamptz default now(),
  notas text
);

-- Ventas POS (cabecera)
create table if not exists ventas_pos (
  id serial primary key,
  empleado_id integer references empleados(id),
  metodo_pago text not null check (metodo_pago in ('efectivo', 'tarjeta', 'nequi', 'cortesia')),
  subtotal integer not null,
  descuento integer default 0,
  total integer not null,
  tipo text not null check (tipo in ('taquilla', 'confiteria', 'mixta')),
  anulada boolean default false,
  created_at timestamptz default now()
);

-- Items de cada venta POS
create table if not exists items_venta_pos (
  id serial primary key,
  venta_id integer not null references ventas_pos(id) on delete cascade,
  tipo text not null check (tipo in ('boleto', 'producto')),
  funcion_id integer references funciones(id),
  asientos jsonb default '[]',
  tipo_entrada text check (tipo_entrada in ('regular', 'vip', 'nino', 'adulto_mayor', 'estudiante')),
  producto_id integer references productos(id),
  cantidad integer not null default 1,
  precio_unitario integer not null,
  subtotal integer not null
);

-- ================================================================
-- RLS
-- ================================================================
alter table productos enable row level security;
alter table inventario enable row level security;
alter table empleados enable row level security;
alter table turnos enable row level security;
alter table marcaciones enable row level security;
alter table ventas_pos enable row level security;
alter table items_venta_pos enable row level security;

-- Acceso con service role key (POS usa service role)
create policy "productos_all" on productos using (true) with check (true);
create policy "inventario_all" on inventario using (true) with check (true);
create policy "empleados_all" on empleados using (true) with check (true);
create policy "turnos_all" on turnos using (true) with check (true);
create policy "marcaciones_all" on marcaciones using (true) with check (true);
create policy "ventas_pos_all" on ventas_pos using (true) with check (true);
create policy "items_venta_pos_all" on items_venta_pos using (true) with check (true);

-- ================================================================
-- Seed inicial: productos de confitería de ejemplo
-- ================================================================
insert into productos (nombre, categoria, precio, descripcion, orden) values
  ('Combo Personal', 'combo', 18000, 'Crispetas medianas + gaseosa mediana', 1),
  ('Combo Pareja', 'combo', 32000, 'Crispetas grandes + 2 gaseosas medianas', 2),
  ('Combo Familiar', 'combo', 48000, 'Crispetas jumbo + 4 gaseosas medianas', 3),
  ('Crispetas Pequeñas', 'snack', 8000, 'Crispetas con sal o caramelo', 4),
  ('Crispetas Medianas', 'snack', 12000, 'Crispetas con sal o caramelo', 5),
  ('Crispetas Grandes', 'snack', 16000, 'Crispetas con sal o caramelo', 6),
  ('Gaseosa Mediana', 'bebida', 7000, 'Coca-Cola, Pepsi, Sprite o agua', 7),
  ('Gaseosa Grande', 'bebida', 9000, 'Coca-Cola, Pepsi, Sprite o agua', 8),
  ('Agua Botella', 'bebida', 4000, 'Agua 600ml', 9),
  ('Nachos', 'snack', 10000, 'Nachos con queso o guacamole', 10),
  ('Hot Dog', 'snack', 9000, 'Hot dog con salsas', 11),
  ('Chocolatina', 'dulce', 5000, 'Jet, Snickers o M&M', 12)
on conflict do nothing;

-- Inventario inicial
insert into inventario (producto_id, cantidad, minimo)
select id, 50, 10 from productos
on conflict do nothing;
