// Guardado en el móvil (localStorage). Recibe el «storage» para poder probarlo
// con uno falso y no depender del navegador.
import { validarTurno } from './calculo.js';

const CLAVE_TURNOS = 'horas.turnos';
const CLAVE_AJUSTES = 'horas.ajustes';
const CLAVE_LIBRES = 'horas.libres'; // días marcados como libres: ['AAAA-MM-DD', ...]
const CLAVE_COPIA = 'horas.ultimaCopia'; // fecha de la última copia de seguridad hecha
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export const AJUSTES_POR_DEFECTO = {
  precioBase: 9.54,
  precioExtra: 9.54,
  precioNocturna: 0.48,
  descuentosPct: 6.5,
  irpfPct: 0,
  // 896 h/año era el contrato de 20 h/semana; con 25 h/semana (desde el 19/10/2026) son 1.120 h.
  limiteAnual: 1120,
  // Horas semanales ordinarias: 20 h desde el inicio del contrato (02/10/2026) y 25 h desde
  // el 19/10/2026 (variación de jornada firmada el 16/10/2026). Lo que pasa del tope es extra.
  jornadas: [
    { desde: '2026-10-02', horas: 20 },
    { desde: '2026-10-19', horas: 25 },
  ],
  // Inicio (lunes) de cada periodo de cierre de nóminas, del calendario «Horas complementarias,
  // periodo cierre nóminas 2026» de la empresa. Cada periodo son 4 o 5 semanas enteras.
  cierres: [
    '2025-12-29', '2026-01-26', '2026-02-23', '2026-03-23', '2026-04-20', '2026-05-25',
    '2026-06-22', '2026-07-20', '2026-08-24', '2026-09-21', '2026-10-26', '2026-11-23',
    '2026-12-21',
  ],
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
    quitarLibre(t.fecha); // un día con turno ya no es libre
    return t;
  }

  function listarLibres() {
    return leer(CLAVE_LIBRES, []).slice().sort();
  }

  function marcarLibre(fecha) {
    const libres = leer(CLAVE_LIBRES, []);
    if (!libres.includes(fecha)) {
      libres.push(fecha);
      escribir(CLAVE_LIBRES, libres);
    }
  }

  function quitarLibre(fecha) {
    const libres = leer(CLAVE_LIBRES, []);
    if (libres.includes(fecha)) escribir(CLAVE_LIBRES, libres.filter((f) => f !== fecha));
  }

  function ultimaCopia() {
    return leer(CLAVE_COPIA, null);
  }

  function registrarCopia(fecha) {
    escribir(CLAVE_COPIA, fecha);
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
      { version: 1, turnos: leer(CLAVE_TURNOS, []), libres: listarLibres(), ajustes: cargarAjustes() },
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
    const libres = datos.libres ?? [];
    if (!Array.isArray(libres) || libres.some((f) => !RE_FECHA.test(f))) {
      throw new Error('El texto no es una copia válida.');
    }
    escribir(CLAVE_TURNOS, turnos);
    escribir(CLAVE_LIBRES, libres);
    if (datos.ajustes) guardarAjustes(datos.ajustes);
    return turnos.length;
  }

  return {
    listarTurnos, guardarTurno, borrarTurno,
    listarLibres, marcarLibre, quitarLibre,
    cargarAjustes, guardarAjustes,
    ultimaCopia, registrarCopia,
    exportar, importar,
  };
}
