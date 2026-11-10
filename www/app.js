import {
  calcularTurno, detallarTurnos, estimarNomina, filtrarPeriodo, periodosDelMes, horasDelAnio,
  validarTurno, semanaDe, sumarDias, rejillaMes, topeDeFecha, validarJornadas, diasEntre,
  cruzaMedianoche, tramosSolapan, periodosCierre, periodoCierreDe, validarCierres,
} from './calculo.js';
import { crearAlmacen } from './almacen.js';
import { pedirHora } from './selector-hora.js';
import { buscarActualizacion } from './actualizar.js';
import { VERSION } from './version.js';

const almacen = crearAlmacen(window.localStorage);
const ahora = new Date();
const dos = (n) => String(n).padStart(2, '0');
const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
};

const estado = {
  vista: 'calendario', // calendario | semana | mes | turno | anual | ajustes
  anio: ahora.getFullYear(),
  mes: ahora.getMonth() + 1,
  ancla: hoyISO(), // una fecha cualquiera de la semana que se está viendo
  periodo: 'mes', // 'mes' | 'q1' | 'q2' (solo en la vista Mes, modo «natural»)
  modoMes: 'cierre', // 'cierre' (periodos de nómina de la empresa) | 'natural' (mes del calendario)
  cierreDesde: null, // inicio del periodo de cierre que se está viendo (null = el de `ancla`)
  editandoId: null,
  fechaNueva: null, // fecha con la que se abre un turno nuevo
  volverA: 'calendario', // pantalla a la que se vuelve al cerrar el formulario
};

const $ = (s) => document.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const num = (n) => n.toFixed(2).replace('.', ',');
const horas = (n) => `${num(n)} h`;
const euros = (n) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const resta = (n) => (n > 0 ? `−${euros(n)}` : euros(0));
const redondear = (n) => Math.round(n * 100) / 100;
const fechaUTC = (f) => new Date(`${f}T00:00:00Z`);
const corto = (f) => fechaUTC(f).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const etiquetaDia = (f) => fechaUTC(f).toLocaleDateString('es-ES',
  { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });

const VISTAS_CON_MAS = ['calendario', 'semana', 'mes'];

function render() {
  $('#nuevo').hidden = !VISTAS_CON_MAS.includes(estado.vista);
  $('#menu').hidden = estado.vista === 'turno';
  document.querySelectorAll('#menu button').forEach((b) => {
    b.classList.toggle('activo', b.dataset.vista === estado.vista);
  });
  const vistas = {
    calendario: vistaCalendario, semana: vistaSemana, mes: vistaMes,
    turno: vistaTurno, anual: vistaAnual, ajustes: vistaAjustes,
  };
  vistas[estado.vista]($('#vista'));
  window.scrollTo(0, 0);
}

function irA(vista) {
  estado.vista = vista;
  estado.editandoId = null;
  estado.fechaNueva = null;
  render();
}

// Abre el formulario de turno (nuevo con una fecha, o uno existente) y recuerda de dónde viene.
function abrirTurno({ id = null, fecha = null } = {}) {
  estado.volverA = VISTAS_CON_MAS.includes(estado.vista) ? estado.vista : 'calendario';
  estado.editandoId = id;
  estado.fechaNueva = fecha;
  estado.vista = 'turno';
  // Una entrada en el historial para que el botón «atrás» de Android cierre el formulario
  // en vez de salir de la app (el WebView de Capacitor retrocede por este historial).
  history.pushState({ turno: true }, '');
  render();
}

let cerrando = false; // evita retroceder dos veces si se toca dos veces seguidas
function cerrarTurno() {
  if (cerrando) return;
  if (history.state && history.state.turno) {
    cerrando = true;
    history.back(); // el aviso 'popstate' de abajo es el que cambia de pantalla
  } else {
    irA(estado.volverA || 'calendario');
  }
}

window.addEventListener('popstate', () => {
  cerrando = false;
  if (estado.vista === 'turno') irA(estado.volverA || 'calendario');
});

function datos() {
  const todos = almacen.listarTurnos();
  const ajustes = almacen.cargarAjustes();
  const libres = new Set(almacen.listarLibres());
  return { todos, libres, ajustes, detalle: detallarTurnos(todos, ajustes.jornadas) };
}

function cabeceraNav(idAnt, texto, idSig, textoAnt, textoSig) {
  return `<div class="cabecera">
    <button class="icono" id="${idAnt}" aria-label="${textoAnt}">‹</button>
    <b>${esc(texto)}</b>
    <button class="icono" id="${idSig}" aria-label="${textoSig}">›</button>
  </div>`;
}

function nombreMes() {
  return new Date(Date.UTC(estado.anio, estado.mes - 1, 1))
    .toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function cambiarMes(delta) {
  estado.mes += delta;
  if (estado.mes < 1) { estado.mes = 12; estado.anio -= 1; }
  if (estado.mes > 12) { estado.mes = 1; estado.anio += 1; }
  render();
}

// Una fila de turno. `c` es el detalle del turno (con extra y ordinarias).
function filaTurno(t, c, conFecha = true) {
  const chips = [];
  if (c.extra > 0) chips.push(`<span class="chip extra">+${horas(c.extra)} extra</span>`);
  if (c.diferencia < 0) chips.push(`<span class="chip menos">${horas(c.diferencia)}</span>`);
  if (c.nocturnas > 0) chips.push(`<span class="chip noche">${horas(c.nocturnas)} noche</span>`);
  const dia = fechaUTC(t.fecha).toLocaleDateString('es-ES',
    { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
  return `<li><button class="fila" data-id="${esc(t.id)}">
    ${conFecha ? `<b>${esc(dia)}</b>` : ''}
    <span>Asignado ${esc(t.asignadoEntrada)}–${esc(t.asignadoSalida)} · Real ${esc(t.realEntrada)}–${esc(t.realSalida)}</span>
    <span class="chips">${chips.join('')}</span>
  </button></li>`;
}

function enlazarFilas(el) {
  el.querySelectorAll('.fila').forEach((b) => {
    b.onclick = () => abrirTurno({ id: b.dataset.id });
  });
}

function tarjetaHoras(est) {
  return `<div class="tarjeta">
    <h2>Horas</h2>
    <table class="tabla">
      <tr><td>Asignadas</td><td>${horas(est.horasAsignadas)}</td></tr>
      <tr><td>Ordinarias</td><td>${horas(est.horasOrdinarias)}</td></tr>
      <tr><td>Extra (pasan del tope semanal)</td><td>${horas(est.horasExtra)}</td></tr>
      <tr><td>Nocturnas</td><td>${horas(est.horasNocturnas)}</td></tr>
    </table>
  </div>`;
}

function tarjetaEstimacion(est, ajustes) {
  const avisoPrecio = ajustes.precioBase === 0
    ? '<p class="aviso">El precio por hora de la base está a 0 en Ajustes: la estimación no cuenta el salario base.</p>'
    : '';
  return `<div class="tarjeta">
    <h2>Estimación de nómina</h2>
    <table class="tabla">
      <tr><td>Salario base</td><td>${euros(est.base)}</td></tr>
      <tr><td>Horas extra</td><td>${euros(est.extra)}</td></tr>
      <tr><td>Nocturnidad</td><td>${euros(est.nocturnidad)}</td></tr>
      <tr class="total"><td>Bruto</td><td>${euros(est.bruto)}</td></tr>
      <tr><td>Descuentos</td><td>${resta(est.descuentos)}</td></tr>
      <tr><td>IRPF</td><td>${resta(est.irpf)}</td></tr>
      <tr class="total"><td>Líquido aprox.</td><td>${euros(est.liquido)}</td></tr>
    </table>
    ${avisoPrecio}
    <p class="nota">Es una estimación: la nómina real paga el salario base por días y redondea los precios.</p>
  </div>`;
}

// ---------- Calendario ----------

// Versión nueva en GitHub (se rellena al abrir la app, si hay internet).
let novedad = null;
function avisoNovedad() {
  if (!novedad) return '';
  return `<div class="tarjeta"><p class="aviso">Hay una versión nueva: <b>${esc(novedad.version)}</b> (tienes la ${esc(VERSION)}). Tus datos se conservan al instalarla.</p>
    <div class="acciones"><button class="primario" id="bajar-apk">Descargar e instalar</button></div></div>`;
}

// Aviso de copia de seguridad: los datos solo viven en este móvil.
function avisoCopia() {
  if (!almacen.listarTurnos().length) return '';
  const ultima = almacen.ultimaCopia();
  const dias = ultima ? diasEntre(ultima, hoyISO()) : null;
  if (dias !== null && dias <= 14) return '';
  const cuando = dias === null
    ? 'Todavía no has hecho ninguna copia de seguridad.'
    : `Hace ${dias} días que no haces una copia de seguridad.`;
  return `<div class="tarjeta"><p class="aviso">${cuando} Los datos solo están en este móvil.</p>
    <div class="acciones"><button class="secundario" id="ir-copia">Hacer copia ahora</button></div></div>`;
}

function vistaCalendario(el) {
  $('#titulo').textContent = 'Calendario';
  const { todos, libres, detalle } = datos();
  const porFecha = new Map();
  for (const t of todos) porFecha.set(t.fecha, (porFecha.get(t.fecha) || 0) + 1);
  const hoy = hoyISO();
  const celdas = rejillaMes(estado.anio, estado.mes);

  let rellenados = 0;
  let sinRellenar = 0;
  const casillas = celdas.map((f) => {
    if (!f) return '<span class="vacio"></span>';
    const lleno = porFecha.has(f);
    const libre = !lleno && libres.has(f);
    const falta = !lleno && !libre && f <= hoy;
    if (lleno || libre) rellenados += 1;
    if (falta) sinRellenar += 1;
    const clases = ['dia', lleno ? 'lleno' : '', libre ? 'libre' : '', falta ? 'falta' : '', f === hoy ? 'hoy' : ''].join(' ');
    const marca = lleno ? '✓' : (libre ? '–' : (falta ? '○' : ''));
    const estadoTxt = lleno ? 'con turno' : (libre ? 'día libre' : (falta ? 'sin rellenar' : ''));
    return `<button class="${clases}" data-f="${f}" aria-label="${esc(etiquetaDia(f))} ${estadoTxt}"><b>${Number(f.slice(8))}</b><i>${marca}</i></button>`;
  }).join('');

  const cab = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => `<span class="cab">${d}</span>`).join('');
  el.innerHTML = `
    ${avisoNovedad()}
    ${avisoCopia()}
    ${cabeceraNav('mes-ant', nombreMes(), 'mes-sig', 'Mes anterior', 'Mes siguiente')}
    <div class="calendario">${cab}${casillas}</div>
    <p class="leyenda">✓ turno · – libre · ○ sin rellenar · Rellenados: ${rellenados} · Sin rellenar: ${sinRellenar}</p>
    <p class="nota">Toca un día para añadir su turno o marcarlo como libre. Tocar un día libre lo quita.</p>`;

  el.querySelector('#mes-ant').onclick = () => cambiarMes(-1);
  el.querySelector('#mes-sig').onclick = () => cambiarMes(1);
  const bajar = el.querySelector('#bajar-apk');
  if (bajar) bajar.onclick = () => window.open(novedad.apk || novedad.pagina, '_blank');
  const irCopia = el.querySelector('#ir-copia');
  if (irCopia) irCopia.onclick = () => irA('ajustes');
  el.querySelectorAll('.dia').forEach((b) => {
    b.onclick = () => {
      const f = b.dataset.f;
      if (libres.has(f)) {
        if (confirm(`¿Quitar el día libre del ${etiquetaDia(f)}?`)) { almacen.quitarLibre(f); render(); }
        return;
      }
      const delDia = todos.filter((t) => t.fecha === f);
      if (delDia.length === 0) abrirTurno({ fecha: f });
      else hojaDia(f, delDia, detalle); // el detalle de ese día, con todos sus tramos
    };
  });
}

// Hoja con lo de un día: cada tramo con sus horas, el total, y para editar o añadir otro tramo.
function hojaDia(fecha, turnos, detalle) {
  const filas = turnos.map((t) => filaTurno(t, detalle.get(t), false)).join('');
  const total = turnos.reduce((a, t) => a + detalle.get(t).trabajadas, 0);
  const noche = turnos.reduce((a, t) => a + detalle.get(t).nocturnas, 0);
  const fondo = document.createElement('div');
  fondo.className = 'selector-fondo';
  fondo.innerHTML = `
    <div class="hoja" role="dialog" aria-modal="true" aria-label="${esc(etiquetaDia(fecha))}">
      <h2>${esc(etiquetaDia(fecha))}</h2>
      <ul>${filas}</ul>
      <p class="resumen-turno">Total del día: <b>${horas(total)}</b>${noche > 0 ? ` · ${horas(noche)} nocturnas` : ''}</p>
      <div class="acciones">
        <button type="button" class="secundario" data-a="otro">+ Otro tramo</button>
        <button type="button" class="secundario" data-a="cerrar">Cerrar</button>
      </div>
    </div>`;
  document.body.append(fondo);
  fondo.addEventListener('click', (e) => {
    const fila = e.target.closest('.fila');
    const accion = e.target.dataset?.a;
    if (fila) { fondo.remove(); abrirTurno({ id: fila.dataset.id }); }
    else if (accion === 'otro') { fondo.remove(); abrirTurno({ fecha }); }
    else if (accion === 'cerrar' || e.target === fondo) fondo.remove();
  });
}

// ---------- Semana ----------

function vistaSemana(el) {
  $('#titulo').textContent = 'Semana';
  const { todos, libres, ajustes, detalle } = datos();
  const sem = semanaDe(estado.ancla);
  const turnos = filtrarPeriodo(todos, sem.desde, sem.hasta);
  const est = estimarNomina(turnos, ajustes, todos);
  const trabajadas = redondear(est.horasOrdinarias + est.horasExtra);
  const tope = topeDeFecha(sem.desde, ajustes.jornadas);
  const hoy = hoyISO();

  const dias = [];
  for (let i = 0; i < 7; i++) {
    const f = sumarDias(sem.desde, i);
    const delDia = turnos.filter((t) => t.fecha === f);
    const filas = delDia.length
      ? `<ul>${delDia.map((t) => filaTurno(t, detalle.get(t), false)).join('')}</ul>`
      : '';
    const sinTurno = !delDia.length;
    const falta = sinTurno && libres.has(f) ? '<span class="libre-txt">– día libre</span>'
      : (sinTurno && f <= hoy ? '<span class="vacio-txt">○ sin rellenar</span>' : '<span></span>');
    dias.push(`<div class="dia-semana"><b>${esc(etiquetaDia(f))}</b>${falta}
      <button class="secundario" data-nuevo="${f}">${delDia.length ? '+ Otro' : '+ Añadir'}</button></div>${filas}`);
  }

  const pasaDelTope = trabajadas > tope
    ? `<p class="aviso">Te has pasado ${horas(redondear(trabajadas - tope))} del tope: cuentan como extra.</p>`
    : '';
  el.innerHTML = `
    ${cabeceraNav('sem-ant', `${corto(sem.desde)} – ${corto(sem.hasta)}`, 'sem-sig', 'Semana anterior', 'Semana siguiente')}
    <div class="tarjeta">
      <h2>Tope semanal</h2>
      <progress max="${tope}" value="${Math.min(trabajadas, tope)}"></progress>
      <table class="tabla">
        <tr><td>Trabajadas</td><td>${horas(trabajadas)} de ${horas(tope)}</td></tr>
        <tr><td>Te quedan hasta el tope</td><td>${horas(Math.max(0, redondear(tope - trabajadas)))}</td></tr>
      </table>
      ${pasaDelTope}
    </div>
    ${tarjetaHoras(est)}
    ${tarjetaEstimacion(est, ajustes)}
    ${dias.join('')}`;

  el.querySelector('#sem-ant').onclick = () => { estado.ancla = sumarDias(sem.desde, -7); render(); };
  el.querySelector('#sem-sig').onclick = () => { estado.ancla = sumarDias(sem.desde, 7); render(); };
  el.querySelectorAll('[data-nuevo]').forEach((b) => {
    b.onclick = () => abrirTurno({ fecha: b.dataset.nuevo });
  });
  enlazarFilas(el);
}

// ---------- Mes ----------

// «Cierre de noviembre» = el periodo que acaba en noviembre (así lo agrupa la empresa).
function nombreCierre(per) {
  const mes = fechaUTC(per.hasta).toLocaleDateString('es-ES', { month: 'long', timeZone: 'UTC' });
  return `Cierre de ${mes}`;
}

function vistaMes(el) {
  $('#titulo').textContent = 'Mes';
  const { todos, ajustes, detalle } = datos();
  const natural = estado.modoMes === 'natural';
  const modos = `
    <div class="pestanas" style="margin-top:10px">
      <button class="pestana ${natural ? '' : 'activo'}" data-m="cierre">Cierre de nómina</button>
      <button class="pestana ${natural ? 'activo' : ''}" data-m="natural">Mes natural</button>
    </div>`;
  const cuerpo = (desde, hasta) => {
    const turnos = filtrarPeriodo(todos, desde, hasta);
    const est = estimarNomina(turnos, ajustes, todos);
    const filas = turnos.map((t) => filaTurno(t, detalle.get(t))).join('');
    return `${tarjetaHoras(est)}
      ${tarjetaEstimacion(est, ajustes)}
      <ul>${filas || '<li class="nota">No hay turnos en este periodo. Pulsa + para añadir uno.</li>'}</ul>`;
  };
  let periodos = [];
  let actual = null;

  if (natural) {
    const per = periodosDelMes(estado.anio, estado.mes)[estado.periodo];
    el.innerHTML = `
      ${cabeceraNav('mes-ant', nombreMes(), 'mes-sig', 'Mes anterior', 'Mes siguiente')}
      ${modos}
      <div class="pestanas" style="margin-top:10px">
        <button class="pestana ${estado.periodo === 'mes' ? 'activo' : ''}" data-p="mes">Mes</button>
        <button class="pestana ${estado.periodo === 'q1' ? 'activo' : ''}" data-p="q1">1–15</button>
        <button class="pestana ${estado.periodo === 'q2' ? 'activo' : ''}" data-p="q2">16–fin</button>
      </div>
      ${cuerpo(per.desde, per.hasta)}`;
    el.querySelector('#mes-ant').onclick = () => cambiarMes(-1);
    el.querySelector('#mes-sig').onclick = () => cambiarMes(1);
    el.querySelectorAll('[data-p]').forEach((b) => {
      b.onclick = () => { estado.periodo = b.dataset.p; render(); };
    });
  } else {
    periodos = periodosCierre(ajustes.cierres);
    actual = periodos.find((p) => p.desde === estado.cierreDesde) || periodoCierreDe(estado.ancla, periodos);
    if (!actual) {
      el.innerHTML = `${modos}
        <div class="tarjeta"><p class="aviso">La fecha ${esc(etiquetaDia(estado.ancla))} no cae en ningún periodo de cierre.
        Añade los periodos que falten en Ajustes → «Cierres de nómina».</p></div>`;
    } else {
      const i = periodos.indexOf(actual);
      el.innerHTML = `
        ${cabeceraNav('mes-ant', `${corto(actual.desde)} – ${corto(actual.hasta)}`, 'mes-sig', 'Periodo anterior', 'Periodo siguiente')}
        <p class="nota" style="text-align:center;margin:0">${esc(nombreCierre(actual))} · ${actual.semanas} semanas (lunes a domingo)</p>
        ${modos}
        ${cuerpo(actual.desde, actual.hasta)}`;
      el.querySelector('#mes-ant').onclick = () => {
        if (i > 0) { estado.cierreDesde = periodos[i - 1].desde; render(); }
      };
      el.querySelector('#mes-sig').onclick = () => {
        if (i < periodos.length - 1) { estado.cierreDesde = periodos[i + 1].desde; render(); }
      };
    }
  }
  el.querySelectorAll('[data-m]').forEach((b) => {
    b.onclick = () => { estado.modoMes = b.dataset.m; render(); };
  });
  enlazarFilas(el);
}

// ---------- Añadir / editar turno ----------

const CAMPOS_TRAMO = ['asignadoEntrada', 'asignadoSalida', 'realEntrada', 'realSalida'];
const NOMBRE_HORA = {
  asignadoEntrada: 'Entrada asignada', asignadoSalida: 'Salida asignada',
  realEntrada: 'Entrada real', realSalida: 'Salida real',
};

// Una hora se elige con el selector de ruedas; el valor vive en un input oculto para el formulario.
function campoHora(nombre, etiqueta, valor) {
  return `<label>${etiqueta}
    <button type="button" class="hora ${valor ? '' : 'vacia'}" data-hora="${nombre}">${valor ? esc(valor) : '--:--'}</button>
    <input type="hidden" name="${nombre}" value="${esc(valor)}"></label>`;
}

function bloqueTramo(suf, v) {
  const c = (n) => v[n] || '';
  return `
      <h2>Asignado (cuadrante)</h2>
      <div class="rejilla">
        ${campoHora('asignadoEntrada' + suf, 'Entrada', c('asignadoEntrada'))}
        ${campoHora('asignadoSalida' + suf, 'Salida', c('asignadoSalida'))}
      </div>
      <h2>Real (lo que trabajó)</h2>
      <div class="rejilla">
        ${campoHora('realEntrada' + suf, 'Entrada', c('realEntrada'))}
        ${campoHora('realSalida' + suf, 'Salida', c('realSalida'))}
      </div>
      <p class="resumen-turno" data-resumen="${suf}"></p>`;
}

// Saca del formulario los cuatro datos de un tramo (suf = '' el primero, '2' el segundo).
function leerTramo(f, suf, fecha, nota) {
  const t = { fecha, nota };
  for (const n of CAMPOS_TRAMO) t[n] = f.get(n + suf) || '';
  return t;
}

function vistaTurno(el) {
  const editando = estado.editandoId
    ? almacen.listarTurnos().find((t) => t.id === estado.editandoId)
    : null;
  $('#titulo').textContent = editando ? 'Editar turno' : 'Nuevo turno';
  const v = editando || {
    fecha: estado.fechaNueva || hoyISO(),
    asignadoEntrada: '', asignadoSalida: '', realEntrada: '', realSalida: '', nota: '',
  };

  el.innerHTML = `
    <form id="form" class="tarjeta" novalidate>
      <label>Fecha <input type="date" name="fecha" value="${esc(v.fecha)}" required></label>
      ${bloqueTramo('', v)}
      ${editando ? '' : `
      <label class="partido"><input type="checkbox" id="partido"> Turno partido (dos tramos el mismo día)</label>
      <div class="tramo2" id="tramo2" hidden>
        <h2 style="margin-top:12px">Segundo tramo</h2>
        ${bloqueTramo('2', {})}
      </div>`}
      <label>Nota (opcional) <input type="text" name="nota" value="${esc(v.nota || '')}"></label>
      <p class="nota">Turno de noche: de 22:00 a 02:00 cuenta como 4 h y acaba al día siguiente.</p>
      <p class="error" id="msg" role="alert"></p>
      <div class="acciones">
        <button type="button" class="secundario" id="cancelar">Cancelar</button>
        ${editando ? '<button type="button" class="peligro" id="borrar">Borrar</button>' : '<button type="button" class="secundario" id="libre">Día libre</button>'}
        <button type="submit" class="primario">Guardar</button>
      </div>
    </form>`;

  const form = el.querySelector('#form');
  const volver = cerrarTurno;
  const partido = el.querySelector('#partido');
  const tramo2 = el.querySelector('#tramo2');
  const sufijos = () => (partido && partido.checked ? ['', '2'] : ['']);

  // Una línea por tramo con las horas, la noche y si acaba al día siguiente.
  function actualizarResumen() {
    const f = new FormData(form);
    el.querySelectorAll('[data-resumen]').forEach((p) => {
      const suf = p.dataset.resumen;
      const t = leerTramo(f, suf, form.elements.fecha.value || '2000-01-01', '');
      if (CAMPOS_TRAMO.some((n) => !t[n]) || t.realEntrada === t.realSalida) { p.innerHTML = ''; return; }
      const c = calcularTurno(t);
      const dia = cruzaMedianoche(t.realEntrada, t.realSalida) ? ' · <b>sale al día siguiente</b>' : '';
      const noche = c.nocturnas > 0 ? ` · ${horas(c.nocturnas)} nocturnas` : '';
      p.innerHTML = `Trabajado: <b>${horas(c.trabajadas)}</b>${noche}${dia}`;
    });
  }

  function ponerHora(input, valor) {
    input.value = valor;
    const boton = form.querySelector(`[data-hora="${input.name}"]`);
    boton.textContent = valor;
    boton.classList.remove('vacia');
    input.dispatchEvent(new Event('change', { bubbles: true }));
    actualizarResumen();
  }

  // Al rellenar lo asignado, se copia a lo real si estaba vacío (lo normal es cumplir el turno).
  for (const suf of ['', '2']) {
    for (const [asig, real] of [['asignadoEntrada', 'realEntrada'], ['asignadoSalida', 'realSalida']]) {
      const origen = form.elements[asig + suf];
      if (!origen) continue;
      origen.addEventListener('change', () => {
        const dest = form.elements[real + suf];
        if (!dest.value) ponerHora(dest, origen.value);
      });
    }
  }

  form.addEventListener('click', async (e) => {
    const boton = e.target.closest('[data-hora]');
    if (!boton) return;
    const nombre = boton.dataset.hora;
    const input = form.elements[nombre];
    // Si está vacío, la rueda empieza en la entrada del mismo tramo (para una salida).
    const pareja = form.elements[nombre.replace('Salida', 'Entrada')];
    const inicio = input.value || (nombre.includes('Salida') ? pareja.value : '');
    const elegida = await pedirHora(inicio, NOMBRE_HORA[nombre.replace('2', '')]);
    if (elegida) ponerHora(input, elegida);
  });

  if (partido) {
    partido.onchange = () => { tramo2.hidden = !partido.checked; actualizarResumen(); };
  }
  form.elements.fecha.addEventListener('change', actualizarResumen);
  actualizarResumen();

  el.querySelector('#cancelar').onclick = volver;
  const botonLibre = el.querySelector('#libre');
  if (botonLibre) {
    botonLibre.onclick = () => {
      const fecha = form.elements.fecha.value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) { $('#msg').textContent = 'Falta la fecha.'; return; }
      if (almacen.listarTurnos().some((t) => t.fecha === fecha)) {
        $('#msg').textContent = 'Ese día ya tiene un turno. Bórralo primero si en realidad fue libre.';
        return;
      }
      almacen.marcarLibre(fecha);
      const [a, m] = fecha.split('-').map(Number);
      estado.anio = a; estado.mes = m; estado.ancla = fecha;
      volver();
    };
  }
  const borrar = el.querySelector('#borrar');
  if (borrar) {
    borrar.onclick = () => {
      if (!confirm('¿Borrar este turno?')) return;
      almacen.borrarTurno(editando.id);
      volver();
    };
  }

  form.onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const fecha = f.get('fecha');
    const nota = String(f.get('nota') || '').trim();
    const tramos = sufijos().map((suf, i) => leerTramo(f, suf, fecha, i === 0 ? nota : ''));
    if (editando) tramos[0].id = editando.id;

    const errores = [];
    const avisos = [];
    tramos.forEach((t, i) => {
      const r = validarTurno(t);
      const pref = tramos.length > 1 ? `Tramo ${i + 1}: ` : '';
      errores.push(...r.errores.map((x) => pref + x));
      avisos.push(...r.avisos.map((x) => pref + x));
    });
    if (!errores.length && tramos.length === 2 && tramosSolapan(tramos[0], tramos[1])) {
      errores.push('El segundo tramo empieza antes de que acabe el primero.');
    }
    if (errores.length) { $('#msg').textContent = errores.join(' '); return; }
    if (avisos.length && !confirm(`${avisos.join('\n')}\n\n¿Guardar igualmente?`)) return;
    tramos.forEach((t) => almacen.guardarTurno(t));
    const [a, m] = fecha.split('-').map(Number);
    estado.anio = a; estado.mes = m; estado.periodo = 'mes'; estado.ancla = fecha; estado.cierreDesde = null;
    volver();
  };
}

// ---------- Año ----------

function vistaAnual(el) {
  $('#titulo').textContent = 'Año';
  const ajustes = almacen.cargarAjustes();
  const hechas = horasDelAnio(almacen.listarTurnos(), estado.anio);
  const restantes = redondear(ajustes.limiteAnual - hechas);

  el.innerHTML = `
    ${cabeceraNav('anio-ant', String(estado.anio), 'anio-sig', 'Año anterior', 'Año siguiente')}
    <div class="tarjeta">
      <h2>Horas del contrato</h2>
      <progress max="${ajustes.limiteAnual}" value="${Math.min(hechas, ajustes.limiteAnual)}"></progress>
      <table class="tabla">
        <tr><td>Hechas</td><td>${horas(hechas)}</td></tr>
        <tr><td>Límite anual</td><td>${horas(ajustes.limiteAnual)}</td></tr>
        <tr class="total"><td>${restantes >= 0 ? 'Te quedan' : 'Te has pasado'}</td><td>${horas(Math.abs(restantes))}</td></tr>
      </table>
      <p class="nota">Cuenta todas las horas reales trabajadas del año (ordinarias + extra).</p>
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

function filaJornada(j) {
  return `<div class="rejilla jornada">
    <label>Desde <input type="date" name="jdesde" value="${esc(j.desde)}"></label>
    <label>Horas por semana <input type="number" name="jhoras" step="0.5" min="0" inputmode="decimal" value="${esc(j.horas)}"></label>
    <button type="button" class="peligro quitar-j" style="grid-column:1/-1">Quitar</button>
  </div>`;
}

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
      <h2>Jornada semanal</h2>
      <p class="nota">Horas ordinarias por semana (lunes a domingo). Lo que pasa de ahí cuenta como extra. Cada semana usa la jornada vigente el lunes. Añade una fila cuando cambie el contrato.</p>
      <div id="jornadas">${ajustes.jornadas.map(filaJornada).join('')}</div>
      <div class="acciones"><button type="button" class="secundario" id="mas-jornada">+ Añadir cambio de jornada</button></div>
      <p class="nota">Valores de la nómina de octubre de 2026. El precio por hora del salario base no sale de la nómina (se paga por días): empieza igual que la hora extra y se puede cambiar.</p>
      <p class="error" id="msg-aj" role="alert"></p>
      <div class="acciones"><button type="submit" class="primario">Guardar ajustes</button></div>
    </form>
    <div class="tarjeta">
      <h2>Cierres de nómina</h2>
      <p class="nota">Los periodos del calendario «Horas complementarias, periodo cierre nóminas» de la empresa: la vista Mes suma por ellos. Cuando publiquen el del año siguiente, añade los periodos que falten (se guarda al momento).</p>
      <ul id="lista-cierres" class="lista-cierres"></ul>
      <p class="nota">Para añadir el siguiente, pulsa lo que dura el último periodo:</p>
      <div class="acciones">
        <button type="button" class="secundario" id="c4">Dura 4 semanas</button>
        <button type="button" class="secundario" id="c5">Dura 5 semanas</button>
      </div>
      <div class="acciones"><button type="button" class="peligro" id="cq">Quitar el último periodo</button></div>
      <p class="error" id="msg-ci" role="alert"></p>
    </div>
    <div class="tarjeta">
      <h2>Copia de seguridad</h2>
      <p class="nota">Los datos solo están en este móvil. Copia el texto y guárdalo (por ejemplo en Notas o WhatsApp) para no perderlos.</p>
      <div class="acciones">
        <button class="secundario" id="exportar">Ver copia</button>
        <button class="secundario" id="importar-ver">Restaurar copia</button>
      </div>
      <div id="copia"></div>
    </div>
    <p class="nota" style="text-align:center">Horas Leo · versión ${esc(VERSION)}</p>`;

  const contenedor = el.querySelector('#jornadas');
  contenedor.addEventListener('click', (e) => {
    if (e.target.classList.contains('quitar-j')) e.target.closest('.jornada').remove();
  });
  el.querySelector('#mas-jornada').onclick = () => {
    contenedor.insertAdjacentHTML('beforeend', filaJornada({ desde: hoyISO(), horas: 25 }));
  };

  // Periodos de cierre: se guardan al momento (no esperan al botón de arriba).
  const largo = (f) => fechaUTC(f).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  function pintarCierres() {
    const per = periodosCierre(almacen.cargarAjustes().cierres);
    el.querySelector('#lista-cierres').innerHTML = per.map((p, i) => `<li>${esc(largo(p.desde))} → ${i === per.length - 1
      ? '<i>hasta que abras el siguiente</i>' : `${esc(largo(p.hasta))} · ${p.semanas} sem.`}</li>`).join('');
  }
  function cambiarCierres(inicios) {
    const error = validarCierres(inicios);
    if (error) { $('#msg-ci').textContent = error; return; }
    almacen.guardarAjustes({ ...almacen.cargarAjustes(), cierres: inicios });
    estado.cierreDesde = null;
    $('#msg-ci').textContent = '';
    pintarCierres();
  }
  pintarCierres();
  const siguiente = (semanas) => {
    const inicios = almacen.cargarAjustes().cierres;
    const ultimo = periodosCierre(inicios).at(-1);
    cambiarCierres([...inicios, sumarDias(ultimo.desde, semanas * 7)]);
  };
  el.querySelector('#c4').onclick = () => siguiente(4);
  el.querySelector('#c5').onclick = () => siguiente(5);
  el.querySelector('#cq').onclick = () => {
    const inicios = almacen.cargarAjustes().cierres;
    if (inicios.length <= 1) { $('#msg-ci').textContent = 'Tiene que quedar al menos un periodo.'; return; }
    if (confirm('¿Quitar el último periodo de cierre?')) cambiarCierres(periodosCierre(inicios).slice(0, -1).map((p) => p.desde));
  };

  el.querySelector('#form-aj').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const jornadas = [...contenedor.querySelectorAll('.jornada')].map((fila) => ({
      desde: fila.querySelector('[name=jdesde]').value,
      horas: Number(fila.querySelector('[name=jhoras]').value),
    }));
    const errorJornadas = validarJornadas(jornadas);
    if (errorJornadas) { $('#msg-aj').textContent = errorJornadas; return; }
    const nuevos = { jornadas: jornadas.sort((a, b) => a.desde.localeCompare(b.desde)) };
    for (const [clave] of CAMPOS_AJUSTES) {
      const n = Number(f.get(clave));
      if (!Number.isFinite(n) || n < 0) { $('#msg-aj').textContent = 'Revisa los números: tienen que ser cero o más.'; return; }
      nuevos[clave] = n;
    }
    almacen.guardarAjustes({ ...almacen.cargarAjustes(), ...nuevos });
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
        almacen.registrarCopia(hoyISO());
        zona.querySelector('#msg-copia').textContent = 'Copiado.';
      } catch {
        ta.select();
        almacen.registrarCopia(hoyISO()); // el texto está a la vista y seleccionado para copiarlo a mano
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
// Botón «atrás» de Android (solo existe dentro de la app instalada, no en el navegador).
// Sin este aviso, Android cierra la app y se pierde lo que se estaba escribiendo.
// Se accede por window.Capacitor porque esta web no usa empaquetador.
const AppNativa = window.Capacitor?.Plugins?.App;
if (AppNativa) {
  AppNativa.addListener('backButton', () => {
    const selector = document.querySelector('.selector-fondo');
    if (selector) selector.click(); // el selector de hora abierto: «atrás» lo cancela
    else if (estado.vista === 'turno') cerrarTurno();
    else if (estado.vista !== 'calendario') irA('calendario');
    else AppNativa.exitApp();
  });
}

buscarActualizacion().then((r) => {
  novedad = r;
  if (r && estado.vista === 'calendario') render();
});

$('#nuevo').onclick = () => {
  let fecha = hoyISO();
  if (estado.vista === 'semana') {
    const sem = semanaDe(estado.ancla);
    if (fecha < sem.desde || fecha > sem.hasta) fecha = sem.desde;
  }
  abrirTurno({ fecha });
};
render();
