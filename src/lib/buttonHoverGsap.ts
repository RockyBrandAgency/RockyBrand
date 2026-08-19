import { gsap } from 'gsap';

// COPIA EXACTA de 06-dashboard-web/src/lib/buttonHoverGsap.ts (2026-08-19).
// Los dos paneles usan el mismo hover a proposito: la plataforma es
// multi-cliente y el gesto de un boton no puede cambiar segun en que panel
// se este. Si se toca uno, se toca el otro.

// Hover con GSAP para TODOS los botones del panel (pedido original de Mato,
// 2026-08-04: "falta agregar interacciones, como hover a los botones...
// utilicemos GSAP"). En vez de cablear un hover a mano en cada uno de los
// ~60 <button> del codebase (la mayoría con style={{all:'unset'}}, así que
// un :hover de CSS no alcanza sin tocar cada archivo), se usa delegación de
// eventos a nivel de documento: un solo listener detecta CUALQUIER <button>
// real y le anima el hover. Botón nuevo en cualquier pantalla futura →
// hover gratis, sin tocar este archivo ni el componente nuevo.
//
// 2026-08-18 — SE FUE LA SOMBRA. Pedido explícito de Mato: "los hover de los
// componentes deben ser sin sombras, déjalos de manera mas elegante". La
// versión anterior levantaba el botón 2px y le crecía una sombra de apoyo
// (--shadow-card -> --shadow-card-hover). Ahora hace lo que define Material
// Design 3 para el mismo gesto: una STATE LAYER, o sea una capa del color
// del propio label sobre el contenedor, sin elevación y sin desplazamiento.
// Opacidades de la spec de M3 (State layers): hover 8%, pressed 10%.
//
// Cómo se pinta esa capa sin tocar 40 componentes: un box-shadow INSET de
// spread enorme (`inset 0 0 0 999px rgba(...)`). No es una sombra proyectada
// -no hay desenfoque ni desplazamiento, no sobresale del botón-, es un
// relleno que se recorta solo con el border-radius del botón y se compone
// encima de cualquier fondo, incluido `transparent`. Es la única propiedad
// que se puede animar por delegación sin conocer ni pisar el fondo real de
// cada botón: para un Filled (label blanco sobre primario) da el blanco al
// 8% que pide M3, y para un Text/Outlined (label oscuro sobre transparente)
// da el oscuro al 8%. La misma regla sirve para los dos casos.
//
// Si el botón ya traía una sombra propia en reposo (las tarjetas-botón del
// mini-dash llevan --shadow-card), se conserva: la capa se antepone en la
// lista y la sombra original queda detrás, así el hover no la borra.
//
// mouseover/mouseout (no mouseenter/mouseleave) a propósito: son los que
// burbujean, así que un solo listener en document los recibe para cualquier
// botón sin importar cuán anidado esté. relatedTarget + .contains() evita
// togglear la animación en cada pixel de movimiento dentro del mismo botón.
//
// Solo se activa en dispositivos con hover real (mouse/trackpad) - un tap en
// celular no debe simular un hover fantasma. Respeta prefers-reduced-motion
// (spec 43/44: "todas las clases animadas por GSAP se anulan de manera
// estricta"): con movimiento reducido la capa se pone igual, pero sin
// transición.

const OPACIDAD_HOVER = 0.08;
const OPACIDAD_PRESSED = 0.1;
const DURACION = 0.18;

interface Estado {
  /** Lo que el atributo style traía antes de que tocáramos nada (casi
   *  siempre ''), para devolverlo tal cual al salir en vez de adivinarlo. */
  sombraInline: string;
  /** Sombra en reposo ya resuelta, para que la capa se anteponga sin
   *  borrarla. '' si el botón no tiene ninguna. */
  sombraReposo: string;
  /** Color del label del botón, en "r, g, b". Es el color de la capa. */
  rgb: string;
  /** Opacidad que la capa tiene puesta ahora mismo. Es el punto de partida
   *  de la próxima animación: sin esto, pasar de hover (8%) a pressed (10%)
   *  arrancaría de 0 y daría un parpadeo en vez de un refuerzo. */
  alpha: number;
}

let current: HTMLElement | null = null;
let estado: Estado | null = null;
let initialized = false;

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// getComputedStyle().color siempre resuelve a rgb()/rgba() en todos los
// browsers que soporta este panel, pero si alguna vez no lo hiciera se cae a
// negro en vez de romper la animación con un string inválido.
function rgbDe(valor: string): string {
  const m = valor.match(/(-?[\d.]+)[,\s]+(-?[\d.]+)[,\s]+(-?[\d.]+)/);
  return m ? `${m[1]}, ${m[2]}, ${m[3]}` : '0, 0, 0';
}

function capa(rgb: string, alpha: number, sombraReposo: string): string {
  const layer = `inset 0 0 0 999px rgba(${rgb}, ${alpha})`;
  return sombraReposo ? `${layer}, ${sombraReposo}` : layer;
}

function leerEstado(el: HTMLElement): Estado {
  const cs = getComputedStyle(el);
  const propia = cs.boxShadow;
  return {
    sombraInline: el.style.boxShadow,
    // 'none' es lo que devuelve el computed cuando no hay ninguna; no sirve
    // como parte de una lista de sombras.
    sombraReposo: propia && propia !== 'none' ? propia : '',
    rgb: rgbDe(cs.color),
    alpha: 0,
  };
}

function animarA(el: HTMLElement, e: Estado, alpha: number) {
  // fromTo y no to: el valor de partida se declara explícito para que GSAP
  // nunca tenga que interpolar desde un `none` computado, que no es una
  // sombra y no tiene con qué compararse.
  gsap.fromTo(
    el,
    { boxShadow: capa(e.rgb, e.alpha, e.sombraReposo) },
    { boxShadow: capa(e.rgb, alpha, e.sombraReposo), duration: reducedMotion() ? 0 : DURACION, ease: 'power2.out', overwrite: 'auto' },
  );
  e.alpha = alpha;
}

function animateIn(el: HTMLElement) {
  estado = leerEstado(el);
  animarA(el, estado, OPACIDAD_HOVER);
}

function animateOut(el: HTMLElement) {
  const e = estado;
  if (!e) return;
  gsap.fromTo(el, { boxShadow: capa(e.rgb, e.alpha, e.sombraReposo) }, {
    boxShadow: capa(e.rgb, 0, e.sombraReposo),
    duration: reducedMotion() ? 0 : DURACION,
    ease: 'power2.out',
    overwrite: 'auto',
    onComplete: () => {
      // Devuelve el atributo style a como estaba: si no había box-shadow
      // inline, se borra la propiedad y vuelve a mandar la hoja de estilos.
      // Dejar puesto un `rgba(...,0)` inline dejaría al botón sin su sombra
      // de reposo si esa sombra venía de CSS.
      el.style.boxShadow = e.sombraInline;
    },
  });
  estado = null;
}

function closestButton(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest('button:not(:disabled)');
}

function handleOver(e: MouseEvent) {
  const btn = closestButton(e.target);
  if (!btn || btn === current) return;
  if (current) animateOut(current);
  current = btn;
  animateIn(btn);
}

function handleOut(e: MouseEvent) {
  const btn = closestButton(e.target);
  if (!btn || btn !== current) return;
  const related = e.relatedTarget;
  if (related instanceof Node && btn.contains(related)) return;
  animateOut(btn);
  current = null;
}

// Pressed (M3: 10%). Se apoya en el estado ya leído en el hover-in; si el
// click llegó sin pasar por el hover (no debería en un mouse real), no hace
// nada en vez de leer el DOM a mitad de una animación.
function handleDown(e: MouseEvent) {
  const btn = closestButton(e.target);
  if (!btn || btn !== current || !estado) return;
  animarA(btn, estado, OPACIDAD_PRESSED);
}

function handleUp() {
  if (!current || !estado) return;
  animarA(current, estado, OPACIDAD_HOVER);
}

export function initButtonHoverGsap(): () => void {
  if (initialized || typeof window === 'undefined') return () => {};
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};
  initialized = true;
  document.addEventListener('mouseover', handleOver);
  document.addEventListener('mouseout', handleOut);
  document.addEventListener('mousedown', handleDown);
  document.addEventListener('mouseup', handleUp);
  return () => {
    document.removeEventListener('mouseover', handleOver);
    document.removeEventListener('mouseout', handleOut);
    document.removeEventListener('mousedown', handleDown);
    document.removeEventListener('mouseup', handleUp);
    initialized = false;
  };
}
