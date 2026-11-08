// Selector de hora con dos ruedas (horas y minutos), como el reloj de Android/iOS.
// Cada rueda es infinita: tras el 59 viene el 00. Devuelve 'HH:MM' o null si se cancela.
const ALTO = 56; // alto de cada número, en px (debe coincidir con --alto-rueda en el CSS)
const VUELTAS = 3; // la lista se repite 3 veces y se recentra para dar la sensación de infinita

const dos = (n) => String(n).padStart(2, '0');

function rueda(cantidad, inicial, etiqueta) {
  const col = document.createElement('div');
  col.className = 'rueda';
  col.setAttribute('role', 'listbox');
  col.setAttribute('aria-label', etiqueta);
  for (let i = 0; i < cantidad * VUELTAS; i++) {
    const n = document.createElement('div');
    n.className = 'num';
    n.textContent = etiqueta === 'Horas' ? String(i % cantidad) : dos(i % cantidad);
    col.append(n);
  }
  col.dataset.cantidad = cantidad;
  const poner = (valor) => { col.scrollTop = (cantidad + valor) * ALTO; };
  col.valor = () => Math.round(col.scrollTop / ALTO) % cantidad;
  // Al parar, si se ha ido a la primera o última copia, se vuelve a la del medio sin que se note.
  let t;
  col.addEventListener('scroll', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const idx = Math.round(col.scrollTop / ALTO);
      if (idx < cantidad || idx >= cantidad * 2) poner(idx % cantidad);
      marcar();
    }, 120);
  });
  const marcar = () => {
    const sel = Math.round(col.scrollTop / ALTO);
    [...col.children].forEach((n, i) => n.classList.toggle('sel', i === sel));
  };
  col.poner = (v) => { poner(v); marcar(); };
  col.inicial = inicial;
  return col;
}

export function pedirHora(valorActual, titulo) {
  return new Promise((resolver) => {
    const [h, m] = /^\d{2}:\d{2}$/.test(valorActual || '') ? valorActual.split(':').map(Number) : [9, 0];
    const fondo = document.createElement('div');
    fondo.className = 'selector-fondo';
    fondo.innerHTML = `
      <div class="selector" role="dialog" aria-modal="true" aria-label="${titulo}">
        <p class="selector-titulo">${titulo}</p>
        <div class="ruedas"><div class="banda"></div></div>
        <div class="acciones">
          <button type="button" class="secundario" data-r="no">Cancelar</button>
          <button type="button" class="primario" data-r="si">Aceptar</button>
        </div>
      </div>`;
    const caja = fondo.querySelector('.ruedas');
    const rh = rueda(24, h, 'Horas');
    const rm = rueda(60, m, 'Minutos');
    const dp = document.createElement('div');
    dp.className = 'dospuntos';
    dp.textContent = ':';
    caja.append(rh, dp, rm);
    document.body.append(fondo);
    rh.poner(h);
    rm.poner(m);

    const cerrar = (res) => { fondo.remove(); resolver(res); };
    fondo.addEventListener('click', (e) => {
      const r = e.target.dataset?.r;
      if (r === 'si') cerrar(`${dos(rh.valor())}:${dos(rm.valor())}`);
      else if (r === 'no' || e.target === fondo) cerrar(null);
    });
  });
}
