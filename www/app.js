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
