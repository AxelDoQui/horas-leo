# Horas Leonardo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App de Android (APK) con la que Leonardo apunta fecha y hora de entrada y salida de cada turno y ve horas asignadas, extra, nocturnas y una estimación de su nómina.

**Architecture:** Web estática (HTML + JS con módulos ES) en `www/`, sin dependencias en tiempo de ejecución. La lógica de cálculo (`calculo.js`) y el almacenamiento (`almacen.js`) son módulos puros que se prueban con `node --test`. Capacitor empaqueta `www/` como proyecto Android y Gradle genera el APK de depuración.

**Tech Stack:** JavaScript (ES modules), `node:test` (Node 24), Capacitor (`@capacitor/core`, `@capacitor/android`, `@capacitor/cli`), Gradle con el JDK de Android Studio.

## Global Constraints

- Todo en español: textos de la interfaz, comentarios y mensajes de commit.
- Proyecto en `C:\Users\axeld\Documents\1. Proyectos Apps\Horas Leonardo APP` con su propio git. No tocar el proyecto «Cierre de Caja APP».
- Sin cuentas, sin red, sin sincronización: los datos viven en `localStorage` del móvil.
- Tiempo parcial: límite anual 896 h. Franja nocturna: 22:00–07:00.
- Si la salida es anterior o igual a la entrada, el turno cruza la medianoche y acaba al día siguiente.
- Ajustes por defecto: precioBase 9,54; precioExtra 9,54; precioNocturna 0,48; descuentosPct 6,5; irpfPct 0; limiteAnual 896.
- Las horas se calculan con `Date.UTC` (hora «de reloj», sin cambios de horario de verano).
- Cada tarea termina con tests en verde y un commit.
- Rutas de shell: Git Bash. Comando base de todas las tareas: `cd "C:/Users/axeld/Documents/1. Proyectos Apps/Horas Leonardo APP"`.

## Estructura de archivos

```
Horas Leonardo APP/
  package.json            scripts y "type": "module"
  .gitignore
  capacitor.config.json   (tarea 7)
  www/
    index.html            esqueleto de la app
    estilos.css           aspecto para móvil
    calculo.js            lógica pura: horas, extra, nocturnas, nómina, periodos, validación
    almacen.js            localStorage: turnos, ajustes, exportar/importar
    app.js                pantallas y eventos
  tests/
    calculo.test.js
    almacen.test.js
  docs/superpowers/{specs,plans}/
```

---

### Task 1: Esqueleto del proyecto

**Files:**
- Create: `package.json`, `.gitignore`

- [ ] **Step 1: Crear `package.json`**

```json
{
  "name": "horas-leonardo",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test \"tests/*.test.js\""
  }
}
```

- [ ] **Step 2: Crear `.gitignore`**

```
node_modules/
*.apk
android/local.properties
android/.gradle/
android/build/
android/app/build/
android/capacitor-cordova-android-plugins/
```

- [ ] **Step 3: Iniciar git y hacer el primer commit**

```bash
cd "C:/Users/axeld/Documents/1. Proyectos Apps/Horas Leonardo APP"
git init
git add package.json .gitignore docs
git commit -m "chore: esqueleto del proyecto, diseño y plan"
```

Expected: `Initial commit` (o similar) con los archivos listados.

---

### Task 2: Cálculo de un turno (asignadas, extra, nocturnas)

**Files:**
- Create: `www/calculo.js`
- Test: `tests/calculo.test.js`

**Interfaces:**
- Produces (todo exportado de `www/calculo.js`):
  - `redondear(n: number, dec = 2): number`
  - `intervalo(fecha: 'AAAA-MM-DD', entrada: 'HH:MM', salida: 'HH:MM'): { ini: number, fin: number }` (milisegundos UTC; si `salida <= entrada`, `fin` es +24 h)
  - `horasNocturnas(iv: {ini, fin}): number` (horas entre 22:00 y 07:00)
  - `calcularTurno(t): { asignadas, trabajadas, extra, nocturnas, diferencia }` (horas redondeadas a 2 decimales)
  - Un turno `t` es `{ id?, fecha, asignadoEntrada, asignadoSalida, realEntrada, realSalida, nota? }`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/calculo.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { intervalo, calcularTurno, horasNocturnas } from '../www/calculo.js';

const turno = (ae, as, re, rs, fecha = '2026-10-05') => ({
  fecha, asignadoEntrada: ae, asignadoSalida: as, realEntrada: re, realSalida: rs,
});

test('intervalo: turno normal dura lo que dice', () => {
  const iv = intervalo('2026-10-05', '16:00', '20:00');
  assert.equal(iv.fin - iv.ini, 4 * 3600000);
});

test('intervalo: si la salida es anterior cruza la medianoche', () => {
  const iv = intervalo('2026-10-05', '22:00', '06:00');
  assert.equal(iv.fin - iv.ini, 8 * 3600000);
});

test('turno cumplido tal cual: sin extra ni diferencia', () => {
  const c = calcularTurno(turno('16:00', '20:00', '16:00', '20:00'));
  assert.deepEqual(c, { asignadas: 4, trabajadas: 4, extra: 0, nocturnas: 0, diferencia: 0 });
});

test('se queda 1,5 h después de la salida asignada: 1,5 h extra', () => {
  const c = calcularTurno(turno('16:00', '20:00', '16:00', '21:30'));
  assert.equal(c.extra, 1.5);
  assert.equal(c.diferencia, 1.5);
});

test('entra 30 min antes de lo asignado: 0,5 h extra', () => {
  const c = calcularTurno(turno('16:00', '20:00', '15:30', '20:00'));
  assert.equal(c.extra, 0.5);
});

test('extra por los dos lados: 15-21 con turno 16-20 son 2 h extra', () => {
  const c = calcularTurno(turno('16:00', '20:00', '15:00', '21:00'));
  assert.equal(c.extra, 2);
  assert.equal(c.trabajadas, 6);
});

test('trabaja menos de lo asignado: no hay extra y la diferencia es negativa', () => {
  const c = calcularTurno(turno('16:00', '20:00', '17:00', '19:00'));
  assert.equal(c.extra, 0);
  assert.equal(c.diferencia, -2);
});

test('turno de noche 22:00-06:00: 8 h, todas nocturnas', () => {
  const c = calcularTurno(turno('22:00', '06:00', '22:00', '06:00'));
  assert.equal(c.asignadas, 8);
  assert.equal(c.nocturnas, 8);
  assert.equal(c.extra, 0);
});

test('noche con extra: real 21:00-06:30 sobre 22:00-06:00 → 1,5 extra y 8,5 nocturnas', () => {
  const c = calcularTurno(turno('22:00', '06:00', '21:00', '06:30'));
  assert.equal(c.extra, 1.5);
  assert.equal(c.nocturnas, 8.5);
});

test('nocturnas: 20:00-23:00 tiene 1 h nocturna', () => {
  const iv = intervalo('2026-10-05', '20:00', '23:00');
  assert.equal(horasNocturnas(iv), 1);
});

test('nocturnas: 05:00-09:00 tiene 2 h nocturnas (hasta las 07:00)', () => {
  const iv = intervalo('2026-10-05', '05:00', '09:00');
  assert.equal(horasNocturnas(iv), 2);
});

test('nocturnas: turno de tarde 14:00-22:00 no tiene ninguna', () => {
  const iv = intervalo('2026-10-05', '14:00', '22:00');
  assert.equal(horasNocturnas(iv), 0);
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

```bash
cd "C:/Users/axeld/Documents/1. Proyectos Apps/Horas Leonardo APP" && npm test
```

Expected: FAIL, `Cannot find module '.../www/calculo.js'`.

- [ ] **Step 3: Implementar `www/calculo.js`**

```js
// Lógica de cálculo de horas. Sin pantalla ni navegador: se prueba con node --test.
// Las horas se tratan como «hora de reloj» (Date.UTC), así que el cambio de hora
// de verano no altera la duración de un turno.

const MIN = 60000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

export function redondear(n, dec = 2) {
  const f = 10 ** dec;
  return Math.round((n + Number.EPSILON) * f) / f;
}

function aMs(fecha, hora) {
  const [a, m, d] = fecha.split('-').map(Number);
  const [h, mi] = hora.split(':').map(Number);
  return Date.UTC(a, m - 1, d, h, mi);
}

// Si la salida no es posterior a la entrada, el turno acaba al día siguiente.
export function intervalo(fecha, entrada, salida) {
  const ini = aMs(fecha, entrada);
  let fin = aMs(fecha, salida);
  if (fin <= ini) fin += DIA;
  return { ini, fin };
}

function solape(a, b) {
  return Math.max(0, Math.min(a.fin, b.fin) - Math.max(a.ini, b.ini));
}

// Horas del intervalo que caen entre las 22:00 y las 07:00 del día siguiente.
export function horasNocturnas(iv) {
  let total = 0;
  const medianoche = Math.floor(iv.ini / DIA) * DIA;
  for (let d = medianoche - DIA; d <= iv.fin; d += DIA) {
    total += solape(iv, { ini: d + 22 * HORA, fin: d + DIA + 7 * HORA });
  }
  return total / HORA;
}

// Limitación conocida: asignado y real se anclan a la misma fecha. Si el turno
// asignado cruza la medianoche y el real empieza ya pasada la medianoche
// (llega tarde, p. ej. a la 01:00), no se detecta el solape.
export function calcularTurno(t) {
  const asig = intervalo(t.fecha, t.asignadoEntrada, t.asignadoSalida);
  const real = intervalo(t.fecha, t.realEntrada, t.realSalida);
  const asignadas = (asig.fin - asig.ini) / HORA;
  const trabajadas = (real.fin - real.ini) / HORA;
  const extra = trabajadas - solape(real, asig) / HORA;
  return {
    asignadas: redondear(asignadas),
    trabajadas: redondear(trabajadas),
    extra: redondear(extra),
    nocturnas: redondear(horasNocturnas(real)),
    diferencia: redondear(trabajadas - asignadas),
  };
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

```bash
cd "C:/Users/axeld/Documents/1. Proyectos Apps/Horas Leonardo APP" && npm test
```

Expected: `# pass 12`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/axeld/Documents/1. Proyectos Apps/Horas Leonardo APP"
git add www/calculo.js tests/calculo.test.js
git commit -m "feat: cálculo de horas asignadas, extra y nocturnas por turno"
```

---

### Task 3: Nómina, periodos, contador anual y validación

**Files:**
- Modify: `www/calculo.js` (añadir al final)
- Modify: `tests/calculo.test.js` (añadir al final y ampliar el import de la primera línea)

**Interfaces:**
- Consumes: `calcularTurno`, `redondear` de la tarea 2.
- Produces (exportados de `www/calculo.js`):
  - `estimarNomina(turnos: Turno[], ajustes): { horasAsignadas, horasExtra, horasNocturnas, base, extra, nocturnidad, bruto, descuentos, irpf, liquido }`
  - `periodosDelMes(anio: number, mes: number /*1-12*/): { mes: {desde, hasta}, q1: {desde, hasta}, q2: {desde, hasta} }` (fechas `'AAAA-MM-DD'`)
  - `filtrarPeriodo(turnos, desde, hasta): Turno[]`
  - `horasDelAnio(turnos, anio): number` (suma de horas trabajadas)
  - `validarTurno(t): { errores: string[], avisos: string[] }`
  - `ajustes` = `{ precioBase, precioExtra, precioNocturna, descuentosPct, irpfPct, limiteAnual }`

- [ ] **Step 1: Cambiar el import de `tests/calculo.test.js`**

Reemplazar la línea 3 por:

```js
import {
  intervalo, calcularTurno, horasNocturnas,
  estimarNomina, periodosDelMes, filtrarPeriodo, horasDelAnio, validarTurno,
} from '../www/calculo.js';
```

- [ ] **Step 2: Añadir al final de `tests/calculo.test.js` los tests que fallan**

```js
const AJ = {
  precioBase: 9.54, precioExtra: 9.54, precioNocturna: 0.48,
  descuentosPct: 6.5, irpfPct: 0, limiteAnual: 896,
};

test('estimarNomina: 4 h asignadas, 3 h extra y 1 h nocturna', () => {
  // Real 16:00-23:00 sobre 16:00-20:00 → 3 h extra y 1 h entre 22:00 y 23:00.
  const e = estimarNomina([turno('16:00', '20:00', '16:00', '23:00')], AJ);
  assert.equal(e.horasAsignadas, 4);
  assert.equal(e.horasExtra, 3);
  assert.equal(e.horasNocturnas, 1);
  assert.equal(e.base, 38.16);        // 4 × 9,54
  assert.equal(e.extra, 28.62);       // 3 × 9,54
  assert.equal(e.nocturnidad, 0.48);  // 1 × 0,48
  assert.equal(e.bruto, 67.26);
  assert.equal(e.descuentos, 4.37);   // 6,5 % de 67,26 = 4,3719
  assert.equal(e.irpf, 0);
  assert.equal(e.liquido, 62.89);
});

test('estimarNomina: nocturnidad como en la nómina, 5,95 h × 0,48 = 2,86', () => {
  // La nómina de octubre muestra 2,84 porque redondea el precio; aquí es la cuenta exacta.
  const e = estimarNomina([], { ...AJ });
  assert.equal(e.bruto, 0);
  assert.equal(Math.round(5.95 * 0.48 * 100) / 100, 2.86);
});

test('estimarNomina: sin turnos todo es cero', () => {
  const e = estimarNomina([], AJ);
  assert.equal(e.liquido, 0);
  assert.equal(e.horasAsignadas, 0);
});

test('estimarNomina: aplica el IRPF si se configura', () => {
  const e = estimarNomina([turno('16:00', '20:00', '16:00', '20:00')], { ...AJ, irpfPct: 2 });
  assert.equal(e.bruto, 38.16);
  assert.equal(e.irpf, 0.76); // 2 % de 38,16 = 0,7632
});

test('periodosDelMes: octubre y febrero', () => {
  const oct = periodosDelMes(2026, 10);
  assert.deepEqual(oct.mes, { desde: '2026-10-01', hasta: '2026-10-31' });
  assert.deepEqual(oct.q1, { desde: '2026-10-01', hasta: '2026-10-15' });
  assert.deepEqual(oct.q2, { desde: '2026-10-16', hasta: '2026-10-31' });
  assert.equal(periodosDelMes(2026, 2).mes.hasta, '2026-02-28');
});

test('filtrarPeriodo: incluye los extremos', () => {
  const a = { ...turno('16:00', '20:00', '16:00', '20:00', '2026-10-01') };
  const b = { ...turno('16:00', '20:00', '16:00', '20:00', '2026-10-15') };
  const c = { ...turno('16:00', '20:00', '16:00', '20:00', '2026-10-16') };
  assert.deepEqual(filtrarPeriodo([a, b, c], '2026-10-01', '2026-10-15'), [a, b]);
});

test('horasDelAnio: solo cuenta las horas trabajadas de ese año', () => {
  const t26 = turno('16:00', '20:00', '16:00', '21:00', '2026-10-05');
  const t25 = turno('16:00', '20:00', '16:00', '20:00', '2025-12-31');
  assert.equal(horasDelAnio([t26, t25], 2026), 5);
});

test('validarTurno: faltan datos', () => {
  const v = validarTurno({ fecha: '', asignadoEntrada: '16:00' });
  assert.ok(v.errores.includes('Falta la fecha.'));
  assert.ok(v.errores.includes('Falta la salida asignada.'));
  assert.ok(v.errores.includes('Falta la entrada real.'));
});

test('validarTurno: entrada y salida iguales es un error', () => {
  const v = validarTurno(turno('16:00', '16:00', '16:00', '20:00'));
  assert.deepEqual(v.errores, ['La entrada y la salida asignadas son iguales.']);
});

test('validarTurno: un turno de más de 12 h da un aviso, no un error', () => {
  const v = validarTurno(turno('08:00', '16:00', '08:00', '07:00'));
  assert.equal(v.errores.length, 0);
  assert.equal(v.avisos.length, 1);
});

test('validarTurno: turno correcto no avisa de nada', () => {
  const v = validarTurno(turno('16:00', '20:00', '16:00', '20:00'));
  assert.deepEqual(v, { errores: [], avisos: [] });
});
```

- [ ] **Step 3: Ejecutar y comprobar que falla**

```bash
cd "C:/Users/axeld/Documents/1. Proyectos Apps/Horas Leonardo APP" && npm test
```

Expected: FAIL, `The requested module '../www/calculo.js' does not provide an export named 'estimarNomina'`.

- [ ] **Step 4: Añadir al final de `www/calculo.js`**

```js
// ---- Estimación de nómina ----

export function estimarNomina(turnos, ajustes) {
  let asignadas = 0;
  let extra = 0;
  let nocturnas = 0;
  for (const t of turnos) {
    const c = calcularTurno(t);
    asignadas += c.asignadas;
    extra += c.extra;
    nocturnas += c.nocturnas;
  }
  const base = asignadas * ajustes.precioBase;
  const pExtra = extra * ajustes.precioExtra;
  const pNocturna = nocturnas * ajustes.precioNocturna;
  const bruto = base + pExtra + pNocturna;
  const descuentos = (bruto * ajustes.descuentosPct) / 100;
  const irpf = (bruto * ajustes.irpfPct) / 100;
  return {
    horasAsignadas: redondear(asignadas),
    horasExtra: redondear(extra),
    horasNocturnas: redondear(nocturnas),
    base: redondear(base),
    extra: redondear(pExtra),
    nocturnidad: redondear(pNocturna),
    bruto: redondear(bruto),
    descuentos: redondear(descuentos),
    irpf: redondear(irpf),
    liquido: redondear(bruto - descuentos - irpf),
  };
}

// ---- Periodos ----

const dos = (n) => String(n).padStart(2, '0');

export function periodosDelMes(anio, mes) {
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const p = `${anio}-${dos(mes)}`;
  return {
    mes: { desde: `${p}-01`, hasta: `${p}-${dos(ultimo)}` },
    q1: { desde: `${p}-01`, hasta: `${p}-15` },
    q2: { desde: `${p}-16`, hasta: `${p}-${dos(ultimo)}` },
  };
}

export function filtrarPeriodo(turnos, desde, hasta) {
  return turnos.filter((t) => t.fecha >= desde && t.fecha <= hasta);
}

export function horasDelAnio(turnos, anio) {
  let total = 0;
  for (const t of turnos) {
    if (t.fecha.startsWith(`${anio}-`)) total += calcularTurno(t).trabajadas;
  }
  return redondear(total);
}

// ---- Validación ----

const RE_HORA = /^\d{2}:\d{2}$/;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function validarTurno(t) {
  const errores = [];
  const avisos = [];
  if (!RE_FECHA.test(t.fecha || '')) errores.push('Falta la fecha.');
  const campos = [
    ['asignadoEntrada', 'la entrada asignada'],
    ['asignadoSalida', 'la salida asignada'],
    ['realEntrada', 'la entrada real'],
    ['realSalida', 'la salida real'],
  ];
  for (const [clave, nombre] of campos) {
    if (!RE_HORA.test(t[clave] || '')) errores.push(`Falta ${nombre}.`);
  }
  if (errores.length) return { errores, avisos };

  if (t.asignadoEntrada === t.asignadoSalida) {
    errores.push('La entrada y la salida asignadas son iguales.');
  }
  if (t.realEntrada === t.realSalida) {
    errores.push('La entrada y la salida reales son iguales.');
  }
  if (errores.length) return { errores, avisos };

  const c = calcularTurno(t);
  if (c.asignadas > 12) {
    avisos.push(`El turno asignado dura ${c.asignadas} h. Si la salida es al día siguiente está bien; si no, revisa la hora.`);
  }
  if (c.trabajadas > 12) {
    avisos.push(`El turno real dura ${c.trabajadas} h. Si la salida es al día siguiente está bien; si no, revisa la hora.`);
  }
  return { errores, avisos };
}
```

- [ ] **Step 5: Ejecutar y comprobar que pasa**

```bash
cd "C:/Users/axeld/Documents/1. Proyectos Apps/Horas Leonardo APP" && npm test
```

Expected: `# pass 23`, `# fail 0`.

Nota: el test del turno `08:00-16:00` con real `08:00-07:00` da `asignadas` 8 y `trabajadas` 23, así que sale solo el aviso del turno real (1 aviso). Si saliera otro número de avisos, comprobar `calcularTurno`, no el test.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/axeld/Documents/1. Proyectos Apps/Horas Leonardo APP"
git add www/calculo.js tests/calculo.test.js
git commit -m "feat: estimación de nómina, periodos, contador anual y validación"
```

---

### Task 4: Almacenamiento (turnos, ajustes, copia)

**Files:**
- Create: `www/almacen.js`
- Test: `tests/almacen.test.js`

**Interfaces:**
- Consumes: `validarTurno` de `www/calculo.js`.
- Produces (de `www/almacen.js`):
  - `AJUSTES_POR_DEFECTO` (objeto con los seis ajustes)
  - `crearAlmacen(storage: { getItem, setItem }): { listarTurnos(): Turno[], guardarTurno(t): Turno, borrarTurno(id): void, cargarAjustes(): Ajustes, guardarAjustes(a): void, exportar(): string, importar(texto): number }`
  - `listarTurnos` devuelve ordenado por fecha y entrada asignada. `guardarTurno` crea el `id` si falta y, si ya existe, lo reemplaza. `importar` lanza `Error` con mensaje en español si el texto no es válido y no cambia nada; si va bien devuelve el nº de turnos importados.
  - Si el JSON guardado está dañado, devuelve el valor por defecto y guarda el texto original en `<clave>.corrupto`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/almacen.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { crearAlmacen, AJUSTES_POR_DEFECTO } from '../www/almacen.js';

function storageFalso() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    _m: m,
  };
}

const turno = (fecha, ae = '16:00', as = '20:00') => ({
  fecha, asignadoEntrada: ae, asignadoSalida: as, realEntrada: ae, realSalida: as, nota: '',
});

test('listarTurnos: vacío al principio', () => {
  assert.deepEqual(crearAlmacen(storageFalso()).listarTurnos(), []);
});

test('guardarTurno asigna id y listarTurnos ordena por fecha y hora', () => {
  const a = crearAlmacen(storageFalso());
  a.guardarTurno(turno('2026-10-06'));
  a.guardarTurno(turno('2026-10-05', '18:00', '22:00'));
  a.guardarTurno(turno('2026-10-05', '09:00', '13:00'));
  const l = a.listarTurnos();
  assert.deepEqual(l.map((t) => t.fecha + t.asignadoEntrada),
    ['2026-10-0509:00', '2026-10-0518:00', '2026-10-0616:00']);
  assert.ok(l.every((t) => t.id));
});

test('guardarTurno con id existente lo reemplaza sin duplicar', () => {
  const a = crearAlmacen(storageFalso());
  const t = a.guardarTurno(turno('2026-10-05'));
  a.guardarTurno({ ...t, realSalida: '21:00' });
  const l = a.listarTurnos();
  assert.equal(l.length, 1);
  assert.equal(l[0].realSalida, '21:00');
});

test('borrarTurno quita solo ese turno', () => {
  const a = crearAlmacen(storageFalso());
  const t1 = a.guardarTurno(turno('2026-10-05'));
  a.guardarTurno(turno('2026-10-06'));
  a.borrarTurno(t1.id);
  assert.deepEqual(a.listarTurnos().map((t) => t.fecha), ['2026-10-06']);
});

test('cargarAjustes devuelve los de por defecto y guarda los cambios', () => {
  const a = crearAlmacen(storageFalso());
  assert.deepEqual(a.cargarAjustes(), AJUSTES_POR_DEFECTO);
  a.guardarAjustes({ ...AJUSTES_POR_DEFECTO, precioBase: 10.5 });
  assert.equal(a.cargarAjustes().precioBase, 10.5);
  assert.equal(a.cargarAjustes().limiteAnual, 896);
});

test('exportar e importar en otro almacén conserva turnos y ajustes', () => {
  const a = crearAlmacen(storageFalso());
  a.guardarTurno(turno('2026-10-05'));
  a.guardarAjustes({ ...AJUSTES_POR_DEFECTO, precioBase: 11 });
  const texto = a.exportar();

  const b = crearAlmacen(storageFalso());
  assert.equal(b.importar(texto), 1);
  assert.equal(b.listarTurnos().length, 1);
  assert.equal(b.cargarAjustes().precioBase, 11);
});

test('importar un texto que no es una copia lanza error y no cambia nada', () => {
  const a = crearAlmacen(storageFalso());
  a.guardarTurno(turno('2026-10-05'));
  assert.throws(() => a.importar('esto no es json'), /no es una copia válida/);
  assert.throws(() => a.importar('{"otra":1}'), /no es una copia válida/);
  assert.equal(a.listarTurnos().length, 1);
});

test('importar rechaza turnos con datos incompletos y no cambia nada', () => {
  const a = crearAlmacen(storageFalso());
  a.guardarTurno(turno('2026-10-05'));
  const mala = JSON.stringify({ turnos: [{ fecha: '2026-10-09' }] });
  assert.throws(() => a.importar(mala), /turno/);
  assert.equal(a.listarTurnos().length, 1);
});

test('JSON dañado: devuelve vacío pero guarda el texto original aparte', () => {
  const s = storageFalso();
  s.setItem('horas.turnos', '{roto');
  const a = crearAlmacen(s);
  assert.deepEqual(a.listarTurnos(), []);
  assert.equal(s.getItem('horas.turnos.corrupto'), '{roto');
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

```bash
cd "C:/Users/axeld/Documents/1. Proyectos Apps/Horas Leonardo APP" && npm test
```

Expected: FAIL, `Cannot find module '.../www/almacen.js'`.

- [ ] **Step 3: Implementar `www/almacen.js`**

```js
// Guardado en el móvil (localStorage). Recibe el «storage» para poder probarlo
// con uno falso y no depender del navegador.
import { validarTurno } from './calculo.js';

const CLAVE_TURNOS = 'horas.turnos';
const CLAVE_AJUSTES = 'horas.ajustes';

export const AJUSTES_POR_DEFECTO = {
  precioBase: 9.54,
  precioExtra: 9.54,
  precioNocturna: 0.48,
  descuentosPct: 6.5,
  irpfPct: 0,
  limiteAnual: 896,
};

const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function crearAlmacen(storage) {
  // Si lo guardado está dañado, NO se da por vacío en silencio: se aparta el
  // texto original para poder recuperarlo y se devuelve el valor por defecto.
  function leer(clave, defecto) {
    const crudo = storage.getItem(clave);
    if (crudo === null) return defecto;
    try {
      return JSON.parse(crudo);
    } catch {
      storage.setItem(`${clave}.corrupto`, crudo);
      return defecto;
    }
  }

  function escribir(clave, valor) {
    storage.setItem(clave, JSON.stringify(valor));
  }

  function listarTurnos() {
    return leer(CLAVE_TURNOS, [])
      .slice()
      .sort((a, b) => (a.fecha + a.asignadoEntrada).localeCompare(b.fecha + b.asignadoEntrada));
  }

  function guardarTurno(turno) {
    const todos = leer(CLAVE_TURNOS, []);
    const t = { ...turno, id: turno.id || nuevoId() };
    const i = todos.findIndex((x) => x.id === t.id);
    if (i >= 0) todos[i] = t;
    else todos.push(t);
    escribir(CLAVE_TURNOS, todos);
    return t;
  }

  function borrarTurno(id) {
    escribir(CLAVE_TURNOS, leer(CLAVE_TURNOS, []).filter((t) => t.id !== id));
  }

  function cargarAjustes() {
    return { ...AJUSTES_POR_DEFECTO, ...leer(CLAVE_AJUSTES, {}) };
  }

  function guardarAjustes(ajustes) {
    escribir(CLAVE_AJUSTES, { ...AJUSTES_POR_DEFECTO, ...ajustes });
  }

  function exportar() {
    return JSON.stringify(
      { version: 1, turnos: leer(CLAVE_TURNOS, []), ajustes: cargarAjustes() },
      null,
      2,
    );
  }

  // Valida todo antes de escribir nada: si algo falla, los datos actuales quedan como están.
  function importar(texto) {
    let datos;
    try {
      datos = JSON.parse(texto);
    } catch {
      throw new Error('El texto no es una copia válida.');
    }
    if (!datos || !Array.isArray(datos.turnos)) {
      throw new Error('El texto no es una copia válida.');
    }
    const turnos = datos.turnos.map((t) => ({ ...t, id: t.id || nuevoId() }));
    for (const t of turnos) {
      const { errores } = validarTurno(t);
      if (errores.length) {
        throw new Error(`Hay un turno con datos incompletos (${t.fecha || 'sin fecha'}): ${errores[0]}`);
      }
    }
    escribir(CLAVE_TURNOS, turnos);
    if (datos.ajustes) guardarAjustes(datos.ajustes);
    return turnos.length;
  }

  return { listarTurnos, guardarTurno, borrarTurno, cargarAjustes, guardarAjustes, exportar, importar };
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

```bash
cd "C:/Users/axeld/Documents/1. Proyectos Apps/Horas Leonardo APP" && npm test
```

Expected: `# pass 32`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/axeld/Documents/1. Proyectos Apps/Horas Leonardo APP"
git add www/almacen.js tests/almacen.test.js
git commit -m "feat: almacenamiento de turnos y ajustes con copia exportable"
```

---

### Task 5: Interfaz (pantallas Mes, Turno, Año y Ajustes)

**Files:**
- Create: `www/index.html`, `www/estilos.css`, `www/app.js`

**Interfaces:**
- Consumes: `calcularTurno`, `estimarNomina`, `filtrarPeriodo`, `periodosDelMes`, `horasDelAnio`, `validarTurno` (de `calculo.js`); `crearAlmacen` (de `almacen.js`).
- Produces: la app completa en `www/`, que se abre con un servidor estático.

La interfaz no tiene tests automáticos: se verifica a mano en la tarea 6. La lógica ya está cubierta por las tareas 2 a 4.

- [ ] **Step 1: Crear `www/index.html`**

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Horas Leonardo</title>
  <link rel="stylesheet" href="estilos.css">
</head>
<body>
  <header><h1 id="titulo">Mes</h1></header>
  <main id="vista"></main>
  <button id="nuevo" aria-label="Añadir turno">+</button>
  <nav id="menu">
    <button data-vista="mes">Mes</button>
    <button data-vista="anual">Año</button>
    <button data-vista="ajustes">Ajustes</button>
  </nav>
  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Crear `www/estilos.css`**

```css
:root {
  --fondo: #f4f5f7;
  --tarjeta: #ffffff;
  --texto: #1b1f24;
  --suave: #5b6570;
  --borde: #dde1e6;
  --acento: #1f6feb;
  --extra: #1a7f37;
  --menos: #b42318;
  --noche: #5a32a3;
  --aviso: #9a6700;
}
@media (prefers-color-scheme: dark) {
  :root {
    --fondo: #0e1116;
    --tarjeta: #171b22;
    --texto: #e6e9ee;
    --suave: #9aa4af;
    --borde: #2a313b;
    --acento: #58a6ff;
    --extra: #3fb950;
    --menos: #f85149;
    --noche: #b392f0;
    --aviso: #d29922;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--fondo);
  color: var(--texto);
  font: 16px/1.4 system-ui, sans-serif;
  padding-bottom: calc(76px + env(safe-area-inset-bottom));
}
header {
  position: sticky; top: 0; z-index: 2;
  background: var(--fondo);
  padding: calc(12px + env(safe-area-inset-top)) 16px 8px;
}
h1 { margin: 0; font-size: 1.4rem; }
main { padding: 0 16px; max-width: 640px; margin: 0 auto; }
.tarjeta {
  background: var(--tarjeta); border: 1px solid var(--borde);
  border-radius: 12px; padding: 12px 14px; margin: 10px 0;
}
.tarjeta h2 { margin: 0 0 8px; font-size: 1rem; }
.cabecera { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.cabecera b { text-transform: capitalize; }
button { font: inherit; color: inherit; }
.icono, .pestana, .primario, .secundario, .peligro {
  border: 1px solid var(--borde); background: var(--tarjeta);
  border-radius: 10px; padding: 10px 14px; min-height: 44px;
}
.primario { background: var(--acento); border-color: var(--acento); color: #fff; }
.peligro { color: var(--menos); }
.pestanas { display: flex; gap: 8px; }
.pestana { flex: 1; }
.pestana.activo { border-color: var(--acento); color: var(--acento); font-weight: 600; }
ul { list-style: none; padding: 0; margin: 0; }
.fila {
  width: 100%; text-align: left; display: grid; gap: 2px;
  background: var(--tarjeta); border: 1px solid var(--borde);
  border-radius: 12px; padding: 10px 14px; margin: 8px 0; min-height: 44px;
}
.fila span { color: var(--suave); font-size: .9rem; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.chip { border-radius: 999px; padding: 2px 10px; font-size: .8rem; border: 1px solid currentColor; }
.chip.extra { color: var(--extra); }
.chip.menos { color: var(--menos); }
.chip.noche { color: var(--noche); }
.tabla { width: 100%; border-collapse: collapse; }
.tabla td { padding: 4px 0; }
.tabla td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
.tabla .total td { border-top: 1px solid var(--borde); font-weight: 600; padding-top: 8px; }
.nota { color: var(--suave); font-size: .85rem; }
.aviso { color: var(--aviso); font-size: .9rem; }
.error { color: var(--menos); min-height: 1.4em; }
label { display: grid; gap: 4px; margin: 10px 0; color: var(--suave); font-size: .9rem; }
input, textarea {
  font: inherit; color: var(--texto); background: var(--fondo);
  border: 1px solid var(--borde); border-radius: 10px; padding: 10px; min-height: 44px; width: 100%;
}
textarea { min-height: 120px; font-family: ui-monospace, monospace; font-size: .8rem; }
.rejilla { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.acciones { display: flex; gap: 10px; flex-wrap: wrap; margin: 14px 0; }
.acciones > * { flex: 1; }
progress { width: 100%; height: 14px; }
#nuevo {
  position: fixed; right: 16px; bottom: calc(76px + env(safe-area-inset-bottom));
  width: 56px; height: 56px; border-radius: 50%;
  border: 0; background: var(--acento); color: #fff; font-size: 2rem; line-height: 1;
  box-shadow: 0 2px 8px rgba(0,0,0,.3); z-index: 3;
}
#menu {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 3;
  display: flex; background: var(--tarjeta); border-top: 1px solid var(--borde);
  padding-bottom: env(safe-area-inset-bottom);
}
#menu button { flex: 1; border: 0; background: none; min-height: 56px; color: var(--suave); }
#menu button.activo { color: var(--acento); font-weight: 600; }
[hidden] { display: none !important; }
```

- [ ] **Step 3: Crear `www/app.js`**

```js
import {
  calcularTurno, estimarNomina, filtrarPeriodo, periodosDelMes, horasDelAnio, validarTurno,
} from './calculo.js';
import { crearAlmacen } from './almacen.js';

const almacen = crearAlmacen(window.localStorage);
const hoy = new Date();
const estado = {
  vista: 'mes',
  anio: hoy.getFullYear(),
  mes: hoy.getMonth() + 1,
  periodo: 'mes', // 'mes' | 'q1' | 'q2'
  editandoId: null,
};

const $ = (s) => document.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const num = (n) => n.toFixed(2).replace('.', ',');
const horas = (n) => `${num(n)} h`;
const euros = (n) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const dos = (n) => String(n).padStart(2, '0');
const hoyISO = () => `${hoy.getFullYear()}-${dos(hoy.getMonth() + 1)}-${dos(hoy.getDate())}`;

function render() {
  $('#nuevo').hidden = estado.vista !== 'mes';
  $('#menu').hidden = estado.vista === 'turno';
  document.querySelectorAll('#menu button').forEach((b) => {
    b.classList.toggle('activo', b.dataset.vista === estado.vista);
  });
  const vistas = { mes: vistaMes, turno: vistaTurno, anual: vistaAnual, ajustes: vistaAjustes };
  vistas[estado.vista]($('#vista'));
  window.scrollTo(0, 0);
}

function irA(vista) {
  estado.vista = vista;
  estado.editandoId = null;
  render();
}

// ---------- Mes ----------

function cambiarMes(delta) {
  estado.mes += delta;
  if (estado.mes < 1) { estado.mes = 12; estado.anio -= 1; }
  if (estado.mes > 12) { estado.mes = 1; estado.anio += 1; }
  render();
}

function vistaMes(el) {
  $('#titulo').textContent = 'Mes';
  const per = periodosDelMes(estado.anio, estado.mes)[estado.periodo];
  const turnos = filtrarPeriodo(almacen.listarTurnos(), per.desde, per.hasta);
  const ajustes = almacen.cargarAjustes();
  const est = estimarNomina(turnos, ajustes);
  const nombreMes = new Date(Date.UTC(estado.anio, estado.mes - 1, 1))
    .toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const filas = turnos.map((t) => {
    const c = calcularTurno(t);
    const chips = [];
    if (c.extra > 0) chips.push(`<span class="chip extra">+${horas(c.extra)} extra</span>`);
    if (c.diferencia < 0) chips.push(`<span class="chip menos">${horas(c.diferencia)}</span>`);
    if (c.nocturnas > 0) chips.push(`<span class="chip noche">${horas(c.nocturnas)} noche</span>`);
    const dia = new Date(`${t.fecha}T00:00:00Z`).toLocaleDateString('es-ES',
      { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
    return `<li><button class="fila" data-id="${esc(t.id)}">
      <b>${esc(dia)}</b>
      <span>Asignado ${esc(t.asignadoEntrada)}–${esc(t.asignadoSalida)} · Real ${esc(t.realEntrada)}–${esc(t.realSalida)}</span>
      <span class="chips">${chips.join('')}</span>
    </button></li>`;
  }).join('');

  const avisoPrecio = ajustes.precioBase === 0
    ? '<p class="aviso">El precio por hora de la base está a 0 en Ajustes: la estimación no cuenta el salario base.</p>'
    : '';

  el.innerHTML = `
    <div class="cabecera">
      <button class="icono" id="mes-ant" aria-label="Mes anterior">‹</button>
      <b>${esc(nombreMes)}</b>
      <button class="icono" id="mes-sig" aria-label="Mes siguiente">›</button>
    </div>
    <div class="pestanas" style="margin-top:10px">
      <button class="pestana ${estado.periodo === 'mes' ? 'activo' : ''}" data-p="mes">Mes</button>
      <button class="pestana ${estado.periodo === 'q1' ? 'activo' : ''}" data-p="q1">1–15</button>
      <button class="pestana ${estado.periodo === 'q2' ? 'activo' : ''}" data-p="q2">16–fin</button>
    </div>
    <div class="tarjeta">
      <h2>Horas</h2>
      <table class="tabla">
        <tr><td>Asignadas</td><td>${horas(est.horasAsignadas)}</td></tr>
        <tr><td>Extra (complementarias)</td><td>${horas(est.horasExtra)}</td></tr>
        <tr><td>Nocturnas</td><td>${horas(est.horasNocturnas)}</td></tr>
      </table>
    </div>
    <div class="tarjeta">
      <h2>Estimación de nómina</h2>
      <table class="tabla">
        <tr><td>Salario base</td><td>${euros(est.base)}</td></tr>
        <tr><td>Horas extra</td><td>${euros(est.extra)}</td></tr>
        <tr><td>Nocturnidad</td><td>${euros(est.nocturnidad)}</td></tr>
        <tr class="total"><td>Bruto</td><td>${euros(est.bruto)}</td></tr>
        <tr><td>Descuentos</td><td>−${euros(est.descuentos)}</td></tr>
        <tr><td>IRPF</td><td>−${euros(est.irpf)}</td></tr>
        <tr class="total"><td>Líquido aprox.</td><td>${euros(est.liquido)}</td></tr>
      </table>
      ${avisoPrecio}
      <p class="nota">Es una estimación: la nómina real paga el salario base por días y redondea los precios.</p>
    </div>
    <ul>${filas || '<li class="nota">No hay turnos en este periodo. Pulsa + para añadir uno.</li>'}</ul>`;

  el.querySelector('#mes-ant').onclick = () => cambiarMes(-1);
  el.querySelector('#mes-sig').onclick = () => cambiarMes(1);
  el.querySelectorAll('.pestana').forEach((b) => {
    b.onclick = () => { estado.periodo = b.dataset.p; render(); };
  });
  el.querySelectorAll('.fila').forEach((b) => {
    b.onclick = () => { estado.editandoId = b.dataset.id; estado.vista = 'turno'; render(); };
  });
}

// ---------- Añadir / editar turno ----------

function vistaTurno(el) {
  const editando = estado.editandoId
    ? almacen.listarTurnos().find((t) => t.id === estado.editandoId)
    : null;
  $('#titulo').textContent = editando ? 'Editar turno' : 'Nuevo turno';
  const v = editando || { fecha: hoyISO(), asignadoEntrada: '', asignadoSalida: '', realEntrada: '', realSalida: '', nota: '' };

  el.innerHTML = `
    <form id="form" class="tarjeta" novalidate>
      <label>Fecha <input type="date" name="fecha" value="${esc(v.fecha)}" required></label>
      <h2>Asignado (cuadrante)</h2>
      <div class="rejilla">
        <label>Entrada <input type="time" name="asignadoEntrada" value="${esc(v.asignadoEntrada)}" required></label>
        <label>Salida <input type="time" name="asignadoSalida" value="${esc(v.asignadoSalida)}" required></label>
      </div>
      <h2>Real (lo que trabajó)</h2>
      <div class="rejilla">
        <label>Entrada <input type="time" name="realEntrada" value="${esc(v.realEntrada)}" required></label>
        <label>Salida <input type="time" name="realSalida" value="${esc(v.realSalida)}" required></label>
      </div>
      <label>Nota (opcional) <input type="text" name="nota" value="${esc(v.nota || '')}"></label>
      <p class="nota">Si la salida es anterior a la entrada, el turno acaba al día siguiente.</p>
      <p class="error" id="msg" role="alert"></p>
      <div class="acciones">
        <button type="button" class="secundario" id="cancelar">Cancelar</button>
        ${editando ? '<button type="button" class="peligro" id="borrar">Borrar</button>' : ''}
        <button type="submit" class="primario">Guardar</button>
      </div>
    </form>`;

  const form = el.querySelector('#form');

  // Al rellenar lo asignado, se copia a lo real si estaba vacío (lo normal es cumplir el turno).
  for (const [asig, real] of [['asignadoEntrada', 'realEntrada'], ['asignadoSalida', 'realSalida']]) {
    form.elements[asig].addEventListener('change', () => {
      if (!form.elements[real].value) form.elements[real].value = form.elements[asig].value;
    });
  }

  el.querySelector('#cancelar').onclick = () => irA('mes');
  const borrar = el.querySelector('#borrar');
  if (borrar) {
    borrar.onclick = () => {
      if (!confirm('¿Borrar este turno?')) return;
      almacen.borrarTurno(editando.id);
      irA('mes');
    };
  }

  form.onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const turno = {
      id: editando ? editando.id : undefined,
      fecha: f.get('fecha'),
      asignadoEntrada: f.get('asignadoEntrada'),
      asignadoSalida: f.get('asignadoSalida'),
      realEntrada: f.get('realEntrada'),
      realSalida: f.get('realSalida'),
      nota: String(f.get('nota') || '').trim(),
    };
    const { errores, avisos } = validarTurno(turno);
    if (errores.length) { $('#msg').textContent = errores.join(' '); return; }
    if (avisos.length && !confirm(`${avisos.join('\n')}\n\n¿Guardar igualmente?`)) return;
    almacen.guardarTurno(turno);
    const [a, m] = turno.fecha.split('-').map(Number);
    estado.anio = a; estado.mes = m; estado.periodo = 'mes';
    irA('mes');
  };
}

// ---------- Año ----------

function vistaAnual(el) {
  $('#titulo').textContent = 'Año';
  const ajustes = almacen.cargarAjustes();
  const hechas = horasDelAnio(almacen.listarTurnos(), estado.anio);
  const restantes = Math.round((ajustes.limiteAnual - hechas) * 100) / 100;

  el.innerHTML = `
    <div class="cabecera">
      <button class="icono" id="anio-ant" aria-label="Año anterior">‹</button>
      <b>${estado.anio}</b>
      <button class="icono" id="anio-sig" aria-label="Año siguiente">›</button>
    </div>
    <div class="tarjeta">
      <h2>Horas del contrato</h2>
      <progress max="${ajustes.limiteAnual}" value="${Math.min(hechas, ajustes.limiteAnual)}"></progress>
      <table class="tabla">
        <tr><td>Hechas</td><td>${horas(hechas)}</td></tr>
        <tr><td>Límite anual</td><td>${horas(ajustes.limiteAnual)}</td></tr>
        <tr class="total"><td>${restantes >= 0 ? 'Te quedan' : 'Te has pasado'}</td><td>${horas(Math.abs(restantes))}</td></tr>
      </table>
      <p class="nota">Cuenta todas las horas reales trabajadas del año (asignadas + extra).</p>
    </div>`;
  el.querySelector('#anio-ant').onclick = () => { estado.anio -= 1; render(); };
  el.querySelector('#anio-sig').onclick = () => { estado.anio += 1; render(); };
}

// ---------- Ajustes ----------

const CAMPOS_AJUSTES = [
  ['precioBase', 'Precio por hora (salario base, €)'],
  ['precioExtra', 'Precio hora extra / complementaria (€)'],
  ['precioNocturna', 'Plus por hora nocturna (€)'],
  ['descuentosPct', 'Descuentos de Seguridad Social (%)'],
  ['irpfPct', 'IRPF (%)'],
  ['limiteAnual', 'Límite anual de horas'],
];

function vistaAjustes(el) {
  $('#titulo').textContent = 'Ajustes';
  const ajustes = almacen.cargarAjustes();
  const campos = CAMPOS_AJUSTES.map(([clave, texto]) => `
    <label>${esc(texto)}
      <input type="number" name="${clave}" step="0.01" min="0" inputmode="decimal" value="${ajustes[clave]}">
    </label>`).join('');

  el.innerHTML = `
    <form id="form-aj" class="tarjeta" novalidate>
      ${campos}
      <p class="nota">Valores de la nómina de octubre de 2026. El precio por hora del salario base no sale de la nómina (se paga por días): empieza igual que la hora extra y se puede cambiar.</p>
      <p class="error" id="msg-aj" role="alert"></p>
      <div class="acciones"><button type="submit" class="primario">Guardar ajustes</button></div>
    </form>
    <div class="tarjeta">
      <h2>Copia de seguridad</h2>
      <p class="nota">Los datos solo están en este móvil. Copia el texto y guárdalo (por ejemplo en Notas o WhatsApp) para no perderlos.</p>
      <div class="acciones">
        <button class="secundario" id="exportar">Ver copia</button>
        <button class="secundario" id="importar-ver">Restaurar copia</button>
      </div>
      <div id="copia"></div>
    </div>`;

  el.querySelector('#form-aj').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const nuevos = {};
    for (const [clave] of CAMPOS_AJUSTES) {
      const n = Number(f.get(clave));
      if (!Number.isFinite(n) || n < 0) { $('#msg-aj').textContent = 'Revisa los números: tienen que ser cero o más.'; return; }
      nuevos[clave] = n;
    }
    almacen.guardarAjustes(nuevos);
    $('#msg-aj').textContent = 'Guardado.';
  };

  const zona = el.querySelector('#copia');
  el.querySelector('#exportar').onclick = () => {
    zona.innerHTML = `<textarea id="texto-copia" readonly>${esc(almacen.exportar())}</textarea>
      <div class="acciones"><button class="primario" id="copiar">Copiar al portapapeles</button></div>
      <p class="nota" id="msg-copia"></p>`;
    zona.querySelector('#copiar').onclick = async () => {
      const ta = zona.querySelector('#texto-copia');
      try {
        await navigator.clipboard.writeText(ta.value);
        zona.querySelector('#msg-copia').textContent = 'Copiado.';
      } catch {
        ta.select();
        zona.querySelector('#msg-copia').textContent = 'Selecciónalo y cópialo a mano.';
      }
    };
  };
  el.querySelector('#importar-ver').onclick = () => {
    zona.innerHTML = `<textarea id="texto-importar" placeholder="Pega aquí el texto de la copia"></textarea>
      <p class="error" id="msg-imp" role="alert"></p>
      <div class="acciones"><button class="peligro" id="importar">Restaurar (reemplaza lo actual)</button></div>`;
    zona.querySelector('#importar').onclick = () => {
      if (!confirm('Esto reemplaza todos los turnos y ajustes actuales. ¿Seguro?')) return;
      try {
        const n = almacen.importar(zona.querySelector('#texto-importar').value);
        zona.querySelector('#msg-imp').textContent = `Restaurados ${n} turnos.`;
      } catch (err) {
        zona.querySelector('#msg-imp').textContent = err.message;
      }
    };
  };
}

// ---------- Arranque ----------

document.querySelectorAll('#menu button').forEach((b) => {
  b.onclick = () => irA(b.dataset.vista);
});
$('#nuevo').onclick = () => { estado.editandoId = null; estado.vista = 'turno'; render(); };
render();
```

- [ ] **Step 4: Comprobar que sigue todo en verde y la sintaxis de `app.js`**

```bash
cd "C:/Users/axeld/Documents/1. Proyectos Apps/Horas Leonardo APP" && npm test && node --check www/app.js
```

Expected: `# fail 0` y `node --check` sin salida (sin errores).

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/axeld/Documents/1. Proyectos Apps/Horas Leonardo APP"
git add www/index.html www/estilos.css www/app.js
git commit -m "feat: pantallas de mes, turno, año y ajustes"
```

---

### Task 6: Prueba de la interfaz en el navegador

**Files:**
- Modify: los de `www/` solo si aparece un fallo.

- [ ] **Step 1: Arrancar un servidor estático en segundo plano**

```bash
cd "C:/Users/axeld/Documents/1. Proyectos Apps/Horas Leonardo APP" && py -m http.server 8123 --directory www
```

Ejecutarlo con `run_in_background`. Expected: `Serving HTTP on :: port 8123`.

- [ ] **Step 2: Abrir `http://localhost:8123` en el navegador integrado con tamaño móvil**

Usar `mcp__Claude_Browser__navigate` y `mcp__Claude_Browser__resize_window` con `preset: "mobile"`. Después recargar la página.

- [ ] **Step 3: Recorrer este guion y comprobar cada resultado**

1. Pulsar **+**. Fecha de hoy. Poner asignado `16:00`–`20:00`: debe copiarse solo a real. Cambiar real salida a `21:30` y guardar → vuelve a Mes y la fila muestra el chip «+1,50 h extra»; Horas: asignadas 4,00, extra 1,50, nocturnas 0,00.
2. Añadir otro turno `22:00`–`06:00` con real igual → chip «8,00 h noche»; asignadas suma 12,00.
3. Añadir turno con asignado `08:00`–`16:00` y real `08:00`–`07:00` → sale el aviso de más de 12 h; cancelar el aviso no guarda.
4. Añadir turno sin hora de salida real → mensaje «Falta la salida real.» y no guarda.
5. Tocar una fila → Editar; cambiar una hora y guardar; probar Borrar.
6. Pestañas 1–15 / 16–fin: los turnos se reparten según el día.
7. Año: «Hechas» coincide con la suma de horas reales; la barra se mueve.
8. Ajustes: cambiar precio base a `0` → en Mes sale el aviso del precio; volver a `9,54`.
9. Ajustes → «Ver copia», copiar; añadir un turno; «Restaurar copia» pegando el texto → vuelve al estado anterior; pegar `hola` → «El texto no es una copia válida.».
10. Recargar la página: todo sigue ahí (localStorage).

- [ ] **Step 4: Revisar la consola**

Con `mcp__Claude_Browser__read_console_messages` (`onlyErrors: true`). Expected: sin errores.

- [ ] **Step 5: Parar el servidor y devolver el navegador a escritorio**

`resize_window` con `preset: "desktop"`, y detener el proceso del servidor.

- [ ] **Step 6: Si hubo correcciones, commit**

```bash
cd "C:/Users/axeld/Documents/1. Proyectos Apps/Horas Leonardo APP"
git add www
git commit -m "fix: correcciones tras probar la interfaz"
```

Si no hubo cambios, no hay commit.

---

### Task 7: Empaquetar el APK con Capacitor

**Files:**
- Create: `capacitor.config.json`
- Modify: `package.json` (lo hace `npm install`)
- Create (generado): `android/`

- [ ] **Step 1: Comprobar las herramientas**

```bash
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
"$JAVA_HOME/bin/java" -version
ls "/c/Users/axeld/AppData/Local/Android/Sdk/platforms" "/c/Users/axeld/AppData/Local/Android/Sdk/build-tools"
```

Expected: una versión de Java (21 o superior) y al menos una carpeta en `platforms` y otra en `build-tools`. Si falta alguna, abrir Android Studio → SDK Manager e instalar «Android SDK Platform» más reciente y «Build-Tools»; avisar a Axel antes de seguir.

- [ ] **Step 2: Crear `capacitor.config.json`**

```json
{
  "appId": "com.leonardo.horas",
  "appName": "Horas Leonardo",
  "webDir": "www"
}
```

- [ ] **Step 3: Instalar Capacitor**

```bash
cd "C:/Users/axeld/Documents/1. Proyectos Apps/Horas Leonardo APP"
npm install @capacitor/core @capacitor/android
npm install --save-dev @capacitor/cli
```

Expected: `added N packages` sin errores.

- [ ] **Step 4: Añadir la plataforma Android**

```bash
cd "C:/Users/axeld/Documents/1. Proyectos Apps/Horas Leonardo APP"
npx cap add android
```

Expected: `Android platform added!` y carpeta `android/`.

- [ ] **Step 5: Decirle a Gradle dónde está el SDK**

Crear `android/local.properties` con:

```
sdk.dir=C\:\\Users\\axeld\\AppData\\Local\\Android\\Sdk
```

(Está en `.gitignore`.)

- [ ] **Step 6: Sincronizar la web con Android**

```bash
cd "C:/Users/axeld/Documents/1. Proyectos Apps/Horas Leonardo APP"
npx cap sync android
```

Expected: `Sync finished` y `www` copiado a `android/app/src/main/assets/public`.

- [ ] **Step 7: Compilar el APK de depuración**

```bash
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
cd "C:/Users/axeld/Documents/1. Proyectos Apps/Horas Leonardo APP/android"
./gradlew assembleDebug
```

Ejecutarlo con `run_in_background` y `timeout` largo: la primera vez Gradle descarga dependencias (varios minutos). Expected: `BUILD SUCCESSFUL`. Si falla por la versión de Java, anotar el mensaje exacto antes de cambiar nada.

- [ ] **Step 8: Copiar el APK a una ruta fácil**

```bash
cd "C:/Users/axeld/Documents/1. Proyectos Apps/Horas Leonardo APP"
mkdir -p dist
cp android/app/build/outputs/apk/debug/app-debug.apk "dist/Horas Leonardo.apk"
ls -l "dist/Horas Leonardo.apk"
```

Expected: archivo de unos pocos MB. Enviarlo al usuario con SendUserFile.

- [ ] **Step 9: Commit**

```bash
cd "C:/Users/axeld/Documents/1. Proyectos Apps/Horas Leonardo APP"
git add capacitor.config.json package.json package-lock.json android
git commit -m "feat: proyecto Android con Capacitor y APK de depuración"
```

(`dist/` y `*.apk` quedan fuera por el `.gitignore`.)

- [ ] **Step 10: Instrucciones de instalación para Leonardo**

Pasar `Horas Leonardo.apk` al móvil (cable, Drive o WhatsApp), abrirlo y aceptar «Instalar de orígenes desconocidos» cuando Android lo pida. Comprobar en el móvil real: que se ve bien, que el selector de hora funciona y que los datos siguen tras cerrar y abrir la app.

---

## Autorrevisión contra el diseño

- Modelo de turno (fecha, asignado, real, nota) → tareas 2, 4 y 5.
- Horas asignadas, extra y nocturnas, con medianoche → tarea 2.
- Estimación (base, extra, nocturnidad, descuentos, IRPF, líquido) → tarea 3; se muestra en tarea 5.
- Pantallas Mes (con quincenas), Turno con avisos, Ajustes y Año → tarea 5; periodos y contador en tarea 3.
- Copia exportar/importar → tareas 4 y 5 (como texto, según el diseño corregido).
- Datos dañados no se pierden en silencio → tarea 4 (`.corrupto`).
- APK con Capacitor → tarea 7. Verificación en navegador → tarea 6.
- Fuera de alcance (cuentas, sincronización, Google Play, cálculo de IRPF): no hay tareas, correcto.
- Nombres coherentes entre tareas: `calcularTurno`, `estimarNomina`, `periodosDelMes`, `filtrarPeriodo`, `horasDelAnio`, `validarTurno`, `crearAlmacen`, `AJUSTES_POR_DEFECTO`.
