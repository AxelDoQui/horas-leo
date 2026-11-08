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
  assert.equal(a.cargarAjustes().limiteAnual, 1120);
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

test('días libres: se marcan sin duplicar, salen ordenados y se quitan', () => {
  const a = crearAlmacen(storageFalso());
  a.marcarLibre('2026-10-09');
  a.marcarLibre('2026-10-03');
  a.marcarLibre('2026-10-09');
  assert.deepEqual(a.listarLibres(), ['2026-10-03', '2026-10-09']);
  a.quitarLibre('2026-10-03');
  assert.deepEqual(a.listarLibres(), ['2026-10-09']);
  a.quitarLibre('2026-12-01'); // quitar uno que no está no falla
  assert.deepEqual(a.listarLibres(), ['2026-10-09']);
});

test('guardar un turno en un día libre lo quita de los libres', () => {
  const a = crearAlmacen(storageFalso());
  a.marcarLibre('2026-10-05');
  a.marcarLibre('2026-10-06');
  a.guardarTurno(turno('2026-10-05'));
  assert.deepEqual(a.listarLibres(), ['2026-10-06']);
});

test('la copia incluye los días libres y al restaurarla vuelven', () => {
  const a = crearAlmacen(storageFalso());
  a.guardarTurno(turno('2026-10-05'));
  a.marcarLibre('2026-10-06');
  const b = crearAlmacen(storageFalso());
  b.marcarLibre('2026-01-01'); // lo que hubiera antes se reemplaza
  b.importar(a.exportar());
  assert.deepEqual(b.listarLibres(), ['2026-10-06']);
});

test('importar una copia antigua sin días libres funciona (quedan vacíos)', () => {
  const b = crearAlmacen(storageFalso());
  assert.equal(b.importar(JSON.stringify({ turnos: [turno('2026-10-05')] })), 1);
  assert.deepEqual(b.listarLibres(), []);
});

test('importar con días libres mal escritos lanza error y no cambia nada', () => {
  const a = crearAlmacen(storageFalso());
  a.marcarLibre('2026-10-06');
  const mala = JSON.stringify({ turnos: [], libres: ['mañana'] });
  assert.throws(() => a.importar(mala), /no es una copia válida/);
  assert.deepEqual(a.listarLibres(), ['2026-10-06']);
});

test('última copia: vacía al principio, y se guarda y se lee', () => {
  const a = crearAlmacen(storageFalso());
  assert.equal(a.ultimaCopia(), null);
  a.registrarCopia('2026-11-08');
  assert.equal(a.ultimaCopia(), '2026-11-08');
});

test('JSON dañado: devuelve vacío pero guarda el texto original aparte', () => {
  const s = storageFalso();
  s.setItem('horas.turnos', '{roto');
  const a = crearAlmacen(s);
  assert.deepEqual(a.listarTurnos(), []);
  assert.equal(s.getItem('horas.turnos.corrupto'), '{roto');
});
