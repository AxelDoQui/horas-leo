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
