// Recorrido del login con desafíos (MFA) y de los accesos con rol/MFA,
// con la API mockeada en local (qa/vite.qa.config.ts): sin red real.
//
//   PLAYWRIGHT_CORE=/ruta/a/node_modules/playwright-core node qa/mfa-roles.mjs
//
// Opcional: CHROMIUM_PATH=/ruta/al/ejecutable (si no, el del caché de
// Playwright que corresponde a esa versión), QA_PORT (5199).
// Sale con 0 si todo pasa y 1 si algo falla.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rutaPw = process.env.PLAYWRIGHT_CORE;
if (!rutaPw) {
  console.error('Falta PLAYWRIGHT_CORE con la ruta a node_modules/playwright-core');
  process.exit(2);
}
const { chromium } = createRequire(import.meta.url)(rutaPw);
const PUERTO = Number(process.env.QA_PORT || 5199);
const BASE = `http://localhost:${PUERTO}`;

const resultados = [];
function check(nombre, ok, detalle = '') {
  resultados.push({ nombre, ok: !!ok });
  console.log(`${ok ? 'OK  ' : 'FALLA'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
}

const vite = spawn(path.join(raiz, 'node_modules/.bin/vite'), ['--config', 'qa/vite.qa.config.ts', '--port', String(PUERTO), '--strictPort'], { cwd: raiz, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((ok, mal) => {
  const t = setTimeout(() => mal(new Error('Vite no levantó en 20 s')), 20000);
  vite.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok(); } });
  vite.on('exit', (c) => mal(new Error(`Vite terminó con ${c}`)));
});

const navegador = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

async function nuevaPagina({ ancho = 320, alto = 640, reloj = false } = {}) {
  const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const cuerpos = [];
  const errores = [];
  // Nada sale a la red: todo lo que no es el servidor local se corta. Las
  // fuentes de Google (las carga index.css desde antes) se cortan sin contar
  // como falla; cualquier otro destino externo sí falla la prueba.
  await ctx.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(BASE) || url.startsWith('data:')) return route.continue();
    if (!/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url)) errores.push(`red externa: ${url}`);
    return route.abort();
  });
  const page = await ctx.newPage();
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/__mock_api')) cuerpos.push(JSON.parse(r.postData() || '{}'));
  });
  page.on('pageerror', (e) => errores.push(String(e)));
  if (reloj) await page.clock.install();
  return { ctx, page, cuerpos, errores };
}

/** Sin desborde horizontal y la caja del login dentro de la pantalla. */
async function sinDesborde(page, nombre) {
  const m = await page.evaluate(() => {
    const d = document.documentElement;
    const caja = document.querySelector('.login-box')?.getBoundingClientRect();
    const chicos = [...document.querySelectorAll('button, a, input, select')]
      .filter((e) => e.offsetParent && !e.hidden)
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width > 0 && (r.width < 24 || r.height < 24)).length;
    return { sobra: d.scrollWidth - d.clientWidth, cajaDer: caja ? caja.right : 0, ancho: d.clientWidth, chicos };
  });
  check(`${nombre}: sin desborde a ${m.ancho} px`, m.sobra <= 0 && m.cajaDer <= m.ancho, `scroll ${m.sobra} px, caja hasta ${Math.round(m.cajaDer)}`);
  check(`${nombre}: objetivos ≥ 24 px`, m.chicos === 0, `${m.chicos} chicos`);
}

// /aprobaciones y no /: la portada pide datos de costos que este mock no
// trae y su WelcomeCard se cae sin ellos (fuera del alcance de esta prueba).
const RUTA = '/aprobaciones';
// Tras «Ahora no» el foco no cae en <body>: queda en el título de la página
// (dentro de .main) y la página no se movió.
async function focoTrasAhoraNo(page, tam) {
  const f = await page.evaluate(() => {
    const a = document.activeElement;
    return {
      tag: a?.tagName ?? 'null',
      texto: (a?.textContent ?? '').trim().slice(0, 40),
      enMain: !!a?.closest('.app-shell .main'),
      scrollY: window.scrollY,
      outline: a ? getComputedStyle(a).outlineStyle + ' ' + getComputedStyle(a).outlineWidth : '',
    };
  });
  console.log(`  activeElement ${tam}: ${f.tag} «${f.texto}» enMain=${f.enMain} scrollY=${f.scrollY} outline=${f.outline}`);
  check(`foco ${tam}: no cae en BODY, queda en .main`, f.tag !== 'BODY' && f.enMain, JSON.stringify(f));
  check(`foco ${tam}: la página no se movió`, f.scrollY === 0, String(f.scrollY));
}
async function entrar(page, correo) {
  await page.goto(`${BASE}${RUTA}`);
  await page.fill('#login-username', correo);
  await page.fill('#login-password', 'cualquiera');
  await page.click('button[type=submit]');
}
// Nada sensible queda guardado en el navegador: ni el secreto TOTP, ni la
// sesión de Cognito, ni ninguna contraseña usada en la prueba.
const SENSIBLES = ['pide-clave', 'clave-bloqueada', 'clave-sesion-respaldo', 'clave-400-vacio', 'clave-500-vacio', 'JBSWY3DPEHPK3PXP', 'ses-cognito-', 'cta-qa-', 'cualquiera', 'ClaveNueva12', 'ClaveVencida1', 'minusculas', 'clave-staff', 'clave-respaldo', 'clave-activo', 'clave-pendiente', 'mala'];
async function sinSecretos(page, paso) {
  const guardado = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]));
  const hallado = SENSIBLES.filter((x) => guardado.includes(x));
  check(`${paso}: storage sin secretos`, hallado.length === 0, hallado.join(', '));
}
const alerta = (page) => page.locator('[role=alert]').first();
const dentro = (page) => page.locator('.app-shell').waitFor({ timeout: 5000 }).then(() => true, () => false);

// El aviso se ve sin scroll, entero dentro del viewport, nada lo tapa y no
// tapa nada. Mide cajas (getBoundingClientRect), no isVisible().
async function avisoEnPantalla(page, nombre) {
  const r = await page.evaluate(() => {
    window.scrollTo(0, 0);
    const avisos = document.querySelectorAll('aside.mfa-aviso');
    const av = avisos[0];
    if (!av) return { n: 0 };
    const a = av.getBoundingClientRect();
    const dentro = a.top >= 0 && a.left >= 0 && a.bottom <= innerHeight && a.right <= document.documentElement.clientWidth;
    // ¿Algo encima de lo que se lee o se toca del aviso? elementFromPoint no ve
    // lo que tiene pointer-events:none (.credit-tag), así que los fixed/sticky
    // se cruzan aparte, caja contra caja.
    let tapado = 0;
    const fijos = [...document.querySelectorAll('body *')].filter((e) => !av.contains(e) && ['fixed', 'sticky'].includes(getComputedStyle(e).position));
    for (const el of av.querySelectorAll('.mfa-aviso-titulo,.mfa-aviso-detalle,a,button')) {
      const b = el.getBoundingClientRect();
      for (const f of fijos) {
        const c = f.getBoundingClientRect();
        if (c.width && c.height && c.left < b.right && c.right > b.left && c.top < b.bottom && c.bottom > b.top) tapado++;
      }
      for (const [x, y] of [[b.left + 2, b.top + 2], [b.right - 2, b.top + 2], [b.left + 2, b.bottom - 2], [b.right - 2, b.bottom - 2], [(b.left + b.right) / 2, (b.top + b.bottom) / 2]]) {
        const arriba = document.elementFromPoint(x, y);
        if (arriba && !av.contains(arriba)) tapado++;
      }
    }
    // ¿El aviso queda encima de algo? Elementos fuera de él que cruzan su caja.
    let tapa = 0;
    for (const el of document.querySelectorAll('body *')) {
      if (av.contains(el) || el.contains(av)) continue;
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      if (b.left < a.right && b.right > a.left && b.top < a.bottom && b.bottom > a.top && getComputedStyle(el).position !== 'fixed' && !el.closest('[style*="fixed"]')) tapa++;
    }
    return { n: avisos.length, dentro, tapado, tapa, caja: [a.left, a.top, a.width, a.height].map(Math.round).join(','), alto: innerHeight };
  });
  check(`aviso ${nombre}: uno solo`, r.n === 1, JSON.stringify(r));
  check(`aviso ${nombre}: entero en pantalla sin scroll`, r.dentro === true, JSON.stringify(r));
  check(`aviso ${nombre}: nada lo tapa y no tapa nada`, r.tapado === 0 && r.tapa === 0, JSON.stringify(r));
}

try {
  // 1b. Aviso a 320x640: en pantalla, «Ahora no» lo oculta y sigue oculto al recargar
  {
    const { ctx, page } = await nuevaPagina({ ancho: 320, alto: 640 });
    await entrar(page, 'directo@qa.test');
    check('aviso 320: entra al panel', await dentro(page));
    await page.locator('aside.mfa-aviso').waitFor({ timeout: 3000 }).catch(() => {});
    await avisoEnPantalla(page, '320x640');
    await page.getByRole('button', { name: 'Ahora no' }).focus();
    await page.keyboard.press('Enter');
    check('«Ahora no» → el aviso desaparece', (await page.locator('aside.mfa-aviso').count()) === 0);
    await focoTrasAhoraNo(page, '320x640');
    await page.reload({ waitUntil: 'networkidle' });
    check('«Ahora no» → recargar → sigue oculto', (await dentro(page)) && (await page.locator('aside.mfa-aviso').count()) === 0);
    await ctx.close();
  }
  // 1c. Lo mismo a 1280x800: Enter en «Ahora no» deja el foco en la página
  {
    const { ctx, page } = await nuevaPagina({ ancho: 1280, alto: 800 });
    await entrar(page, 'directo@qa.test');
    await page.locator('aside.mfa-aviso').waitFor({ timeout: 3000 }).catch(() => {});
    await page.getByRole('button', { name: 'Ahora no' }).focus();
    await page.keyboard.press('Enter');
    check('1280: «Ahora no» → el aviso desaparece', (await page.locator('aside.mfa-aviso').count()) === 0);
    await focoTrasAhoraNo(page, '1280x800');
    await ctx.close();
  }

  // 1. Sin desafío, mfa_inscrito:false → aviso discreto → activar desde el panel
  {
    const { ctx, page, cuerpos, errores } = await nuevaPagina({ ancho: 1280, alto: 800 });
    await entrar(page, 'directo@qa.test');
    check('sin desafío: entra al panel', await dentro(page));
    await sinSecretos(page, 'sin desafío');
    const aviso = page.locator('aside.mfa-aviso');
    await aviso.waitFor({ timeout: 3000 }).catch(() => {});
    check('sin desafío: aviso de MFA visible', await aviso.isVisible());
    await avisoEnPantalla(page, '1280x800');
    check('aviso no bloquea (no es diálogo ni modal)', (await page.locator('[role=dialog][aria-modal=true]').count()) === 0);
    await aviso.getByRole('link', { name: 'Activar' }).click();
    await page.waitForURL('**/usuarios-acceso#mfa');
    check('aviso lleva a /usuarios-acceso#mfa con foco en la clave', await page.evaluate(() => document.activeElement?.id === 'mfa-clave'));
    await page.fill('#mfa-clave', 'mala');
    await page.getByRole('button', { name: 'Activar código de verificación' }).click();
    await page.locator('#mfa [role=alert]', { hasText: 'La contraseña no es correcta.' }).waitFor({ timeout: 3000 }).catch(() => {});
    check('activar MFA: clave mala → error claro', (await page.locator('#mfa [role=alert]').innerText()).includes('La contraseña no es correcta.'));
    await page.fill('#mfa-clave', 'clave-staff');
    await page.getByRole('button', { name: 'Activar código de verificación' }).click();
    const qr = page.locator('#mfa svg.mfa-qr path');
    await qr.waitFor({ timeout: 3000 });
    check('activar MFA: QR dibujado en SVG', ((await qr.getAttribute('d')) || '').length > 100);
    await sinSecretos(page, 'activar MFA con QR');
    await page.getByRole('button', { name: 'Copiar clave' }).click();
    check('activar MFA: «Copiar clave» copia la clave', (await page.evaluate(() => navigator.clipboard.readText())) === 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP');
    await page.fill('#mfa-codigo', '000001');
    await page.getByRole('button', { name: 'Verificar y activar' }).click();
    await page.waitForTimeout(300);
    check('activar MFA: 400 codigo_formato → «6 dígitos» y sigue en el QR', (await page.locator('#mfa [role=alert]').innerText()) === 'El código tiene 6 dígitos.' && (await page.locator('#mfa-codigo').isVisible()));
    await page.fill('#mfa-codigo', '999999');
    await page.getByRole('button', { name: 'Verificar y activar' }).click();
    await page.waitForTimeout(300);
    check('activar MFA: 500 error_servidor → texto del servidor', (await page.locator('#mfa [role=alert]').innerText()) === 'No se pudo activar el codigo. Intenta de nuevo.');
    await page.fill('#mfa-codigo', '000000');
    await page.getByRole('button', { name: 'Verificar y activar' }).click();
    await page.waitForTimeout(300);
    check('activar MFA: 400 codigo_incorrecto → «código no es correcto»', (await page.locator('#mfa [role=alert]').innerText()).startsWith('El código no es correcto.'));
    await page.fill('#mfa-codigo', '123456');
    await page.getByRole('button', { name: 'Verificar y activar' }).click();
    await page.locator('#mfa .pill', { hasText: 'Activo' }).waitFor({ timeout: 3000 }).catch(() => {});
    check('activar MFA: queda «Activo»', await page.locator('#mfa .pill', { hasText: 'Activo' }).isVisible());
    await sinSecretos(page, 'MFA activado');
    const verif = cuerpos.find((c) => c.__action === 'staff_mfa_verificar' && c.code === '123456');
    check('verificar manda reauth_password y code', verif && verif.reauth_password === 'clave-staff');
    await page.goto(`${BASE}${RUTA}`);
    await page.locator('.app-shell').waitFor();
    check('con MFA activo el aviso ya no aparece', !(await page.locator('aside.mfa-aviso').isVisible()));
    check('sin errores ni red externa (1)', errores.length === 0, errores.join(' | '));
    await ctx.close();
  }

  // 2. SOFTWARE_TOKEN_MFA: incorrecto y luego correcto
  {
    const { ctx, page, cuerpos, errores } = await nuevaPagina();
    await entrar(page, 'codigo@qa.test');
    await page.getByRole('heading', { name: 'Código de verificación' }).waitFor();
    const campo = page.locator('#login-codigo');
    check('código: inputmode=numeric', (await campo.getAttribute('inputmode')) === 'numeric');
    check('código: autocomplete=one-time-code', (await campo.getAttribute('autocomplete')) === 'one-time-code');
    check('código: foco en el campo', await page.evaluate(() => document.activeElement?.id === 'login-codigo'));
    await campo.fill('12ab34');
    check('código: solo acepta dígitos', (await campo.inputValue()) === '1234');
    for (const pegado of ['123 456', '123-456', ' 12 34 56 7']) {
      await campo.fill('');
      await campo.focus();
      await page.keyboard.insertText(pegado);
      check(`código: pegar «${pegado}» deja 6 dígitos`, (await campo.inputValue()) === pegado.replace(/\D/g, '').slice(0, 6), await campo.inputValue());
    }
    check('código: sin maxLength', (await campo.getAttribute('maxlength')) === null);
    await sinDesborde(page, 'paso código');
    await sinSecretos(page, 'paso código');
    await campo.fill('000000');
    await page.click('button[type=submit]');
    await page.waitForTimeout(300);
    check('código incorrecto (codigo_incorrecto) → alerta sin afirmar que venció', (await alerta(page).innerText()) === 'El código no es correcto o el inicio de sesión ya no es válido. Intenta de nuevo; si sigue fallando, vuelve al inicio.');
    await campo.fill('111111');
    await page.click('button[type=submit]');
    await page.waitForTimeout(300);
    check('desafío: 401 sin codigo → texto del servidor', (await alerta(page).innerText()) === 'El codigo no es valido.');
    await campo.fill('222222');
    await page.click('button[type=submit]');
    await page.waitForTimeout(300);
    check('desafío: 400 sin codigo → texto del servidor, no «6 dígitos»', (await alerta(page).innerText()) === 'Solicitud invalida.');
    for (const [cod, esperado, nombre] of [
      ['888888', 'El código tiene 6 dígitos.', '400 codigo_formato → «6 dígitos»'],
      ['242424', 'Hubo demasiados intentos. Espera unos minutos e intenta de nuevo.', '429 bloqueado'],
    ]) {
      await campo.fill(cod);
      await page.click('button[type=submit]');
      await page.waitForTimeout(300);
      const t = await alerta(page).innerText();
      check(`desafío: ${nombre}, el paso sigue activo`, t === esperado && (await campo.isVisible()), t);
      if (cod === '242424')
        check('desafío: tras 429 se puede reintentar (campo y botón activos)', (await campo.isEditable()) && (await page.locator('button[type=submit]').isEnabled()));
    }
    for (const [cod, nombre] of [['444444', '401 sin cuerpo'], ['666666', '400 text/plain']]) {
      await campo.fill(cod);
      await page.click('button[type=submit]');
      await page.waitForTimeout(300);
      const t = await alerta(page).innerText();
      check(`desafío: ${nombre} → mensaje de servidor`, t === 'Hubo un problema en el servidor. Intenta de nuevo en un momento.', t);
    }
    await campo.fill('555555');
    await page.click('button[type=submit]');
    await page.waitForTimeout(300);
    check('desafío: 500 error_servidor → texto del servidor', (await alerta(page).innerText()) === 'No se pudo completar el inicio de sesion. Intenta de nuevo.');
    check('código incorrecto → sigue en el paso', await campo.isVisible());
    await campo.fill('333333');
    await page.click('button[type=submit]');
    await page.waitForTimeout(300);
    check('desafío: 400 faltan_datos → mensaje', (await alerta(page).innerText()) === 'Faltan datos del inicio de sesión. Vuelve a empezar.');
    check('desafío: faltan_datos → botón «Empezar de nuevo»', await page.getByRole('button', { name: 'Empezar de nuevo' }).isVisible());
    check('desafío: faltan_datos → «Volver al inicio» visible', await page.getByRole('button', { name: 'Volver al inicio' }).isVisible());
    await page.getByRole('button', { name: 'Empezar de nuevo' }).click();
    check('faltan_datos → «Empezar de nuevo» vuelve al inicio', await page.locator('#login-codigo').count() === 0);
    await entrar(page, 'codigo@qa.test');
    await page.waitForSelector('#login-codigo');
    await campo.fill('777777');
    await page.click('button[type=submit]');
    await page.waitForTimeout(300);
    check('desafío: desafio_no_soportado → su mensaje', (await alerta(page).innerText()) === 'Tu cuenta pide un paso que el panel aún no maneja. Avísale al equipo.');
    check('desafío: desafio_no_soportado → sin campo de código activo', (await page.locator('#login-codigo').count()) === 0);
    check('desafío: desafio_no_soportado → «Empezar de nuevo»', await page.getByRole('button', { name: 'Empezar de nuevo' }).isVisible());
    await page.getByRole('button', { name: 'Empezar de nuevo' }).click();
    await entrar(page, 'codigo@qa.test');
    await page.waitForSelector('#login-codigo');
    await campo.fill('303030');
    await page.click('button[type=submit]');
    await page.waitForTimeout(300);
    check('desafío: 403 no_es_staff → su mensaje', (await alerta(page).innerText()) === 'Tu usuario no tiene acceso al panel de RockyBrand.');
    check('desafío: 403 no_es_staff → vencido: sin campo de código y «Empezar de nuevo»', (await page.locator('#login-codigo').count()) === 0 && (await page.getByRole('button', { name: 'Empezar de nuevo' }).isVisible()));
    await page.getByRole('button', { name: 'Empezar de nuevo' }).click();
    await entrar(page, 'codigo@qa.test');
    await page.waitForSelector('#login-codigo');
    await campo.fill('123456');
    await page.click('button[type=submit]');
    check('código correcto → entra', await dentro(page));
    await sinSecretos(page, 'después del código');
    const r = cuerpos.filter((c) => c.__action === 'panel_login_challenge').pop();
    check('desafío manda username, challenge, session y code', r && r.username === 'codigo@qa.test' && r.challenge === 'SOFTWARE_TOKEN_MFA' && r.session === 'ses-cognito-1' && r.code === '123456');
    const pasos2 = cuerpos.filter((c) => c.__action === 'panel_login_challenge');
    check('SOFTWARE_TOKEN_MFA: cada paso reenvía la `cuenta` del desafío', pasos2.length > 0 && pasos2.every((c) => c.cuenta === 'cta-qa-1'), String(pasos2.length));
    check('con mfa_inscrito:true no hay aviso', !(await page.locator('aside.mfa-aviso').isVisible()));
    check('sin errores ni red externa (2)', errores.length === 0, errores.join(' | '));
    await ctx.close();
  }

  // 3. MFA_SETUP con QR
  {
    const { ctx, page, cuerpos, errores } = await nuevaPagina();
    await entrar(page, 'inscribir@qa.test');
    await page.getByRole('heading', { name: 'Activa el código de verificación' }).waitFor();
    const svg = page.locator('svg.mfa-qr[role=img]');
    check('inscripción: QR con role=img y etiqueta', (await svg.getAttribute('aria-label'))?.includes('QR'));
    check('inscripción: clave en texto', (await page.locator('.mfa-clave-texto').innerText()).replace(/\s/g, '') === 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP');
    await page.getByRole('button', { name: 'Copiar clave' }).click();
    check('inscripción: «Copiar clave» copia', (await page.evaluate(() => navigator.clipboard.readText())) === 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP');
    await sinDesborde(page, 'paso QR');
    await sinSecretos(page, 'paso QR');
    await page.fill('#login-codigo', '123456');
    await page.click('button[type=submit]');
    check('inscripción: código correcto → entra', await dentro(page));
    const r3 = cuerpos.filter((c) => c.__action === 'panel_login_challenge').pop();
    check('MFA_SETUP: reenvía la `cuenta` del desafío', r3?.cuenta === 'cta-qa-2');
    await sinSecretos(page, 'después de inscribir');
    check('sin errores ni red externa (3)', errores.length === 0, errores.join(' | '));
    await ctx.close();
  }

  // 4. NEW_PASSWORD_REQUIRED → encadena MFA_SETUP; «Volver al inicio»
  {
    const { ctx, page, errores } = await nuevaPagina();
    await entrar(page, 'nueva@qa.test');
    await page.getByRole('heading', { name: 'Crea tu contraseña' }).waitFor();
    check('clave nueva: autocomplete=new-password', (await page.locator('#login-nueva').getAttribute('autocomplete')) === 'new-password');
    await sinDesborde(page, 'paso clave nueva');
    await sinSecretos(page, 'paso clave nueva');
    await page.fill('#login-nueva', 'ClaveNueva123');
    await page.fill('#login-repetir', 'ClaveNueva124');
    await page.click('button[type=submit]');
    check('clave nueva: no coinciden → alerta', (await alerta(page).innerText()) === 'Las dos contraseñas no coinciden.');
    await page.fill('#login-nueva', 'minusculas');
    await page.fill('#login-repetir', 'minusculas');
    await page.click('button[type=submit]');
    await page.waitForTimeout(300);
    check('clave nueva: 400 de política → alerta clara', (await alerta(page).innerText()).includes('no cumple la política'));
    await page.fill('#login-nueva', 'ClaveNueva123');
    await page.fill('#login-repetir', 'ClaveNueva123');
    await page.click('button[type=submit]');
    await page.getByRole('heading', { name: 'Activa el código de verificación' }).waitFor({ timeout: 3000 }).catch(() => {});
    check('clave nueva → encadena la inscripción del código', await page.getByRole('heading', { name: 'Activa el código de verificación' }).isVisible());
    await sinSecretos(page, 'clave nueva encadenada');
    await page.getByRole('button', { name: 'Volver al inicio' }).click();
    // Espera explícita: sin ella, este paso falló intermitente (3 de 7 corridas, 20-oct).
    await page.locator('#login-password').waitFor({ timeout: 5000 }).catch(() => {});
    check('«Volver al inicio» vuelve a email y contraseña', await page.locator('#login-password').isVisible());
    const correo4 = await page.locator('#login-username').inputValue({ timeout: 5000 }).catch(() => '(sin campo)');
    check('«Volver al inicio» conserva el email', correo4 === 'nueva@qa.test', correo4);
    check('sin errores ni red externa (4)', errores.length === 0, errores.join(' | '));
    await ctx.close();
  }

  // 4c. Clave nueva con codigo_incorrecto: la sesión ya no sirve, no hay código que corregir
  {
    const { ctx, page, errores } = await nuevaPagina();
    await entrar(page, 'nueva@qa.test');
    await page.getByRole('heading', { name: 'Crea tu contraseña' }).waitFor();
    await page.fill('#login-nueva', 'ClaveVencida1');
    await page.fill('#login-repetir', 'ClaveVencida1');
    await page.click('button[type=submit]');
    await page.waitForTimeout(300);
    const t = await alerta(page).innerText().catch(() => '');
    check('clave nueva: codigo_incorrecto → «ya no es válido», sin hablar de código', t === 'El inicio de sesión ya no es válido. Empieza de nuevo.', t);
    check('clave nueva: codigo_incorrecto → vencido: sin campos y «Empezar de nuevo»', (await page.locator('#login-nueva').count()) === 0 && (await page.getByRole('button', { name: 'Empezar de nuevo' }).isVisible()));
    await sinSecretos(page, 'clave nueva vencida');
    check('sin errores ni red externa (4c)', errores.length === 0, errores.join(' | '));
    await ctx.close();
  }

  // 4b. Clave nueva → MFA_SETUP encadenado con `cuenta` nueva → entra
  {
    const { ctx, page, cuerpos, errores } = await nuevaPagina();
    await entrar(page, 'nueva@qa.test');
    await page.getByRole('heading', { name: 'Crea tu contraseña' }).waitFor();
    await page.fill('#login-nueva', 'ClaveNueva123');
    await page.fill('#login-repetir', 'ClaveNueva123');
    await page.click('button[type=submit]');
    await page.getByRole('heading', { name: 'Activa el código de verificación' }).waitFor({ timeout: 3000 }).catch(() => {});
    await page.fill('#login-codigo', '123456');
    await page.click('button[type=submit]');
    check('encadenado: código correcto → entra', await dentro(page));
    const pasos4 = cuerpos.filter((c) => c.__action === 'panel_login_challenge');
    check('encadenado: la clave nueva va con la `cuenta` del primer desafío', pasos4[0]?.cuenta === 'cta-qa-3');
    check('encadenado: el código va con la `cuenta` nueva, no la anterior', pasos4[1]?.cuenta === 'cta-qa-4' && pasos4[1]?.session === 'ses-cognito-4');
    await sinSecretos(page, 'encadenado');
    check('sin errores ni red externa (4b)', errores.length === 0, errores.join(' | '));
    await ctx.close();
  }

  // 5. Sesión vencida (más de 3 minutos)
  {
    const { ctx, page, cuerpos, errores } = await nuevaPagina({ reloj: true });
    await entrar(page, 'codigo@qa.test');
    await page.getByRole('heading', { name: 'Código de verificación' }).waitFor();
    await page.clock.fastForward(120000);
    await page.fill('#login-codigo', '000000');
    await page.click('button[type=submit]');
    await page.waitForTimeout(300);
    check('a los 2 min, código malo → no dice que venció', (await alerta(page).innerText()) === 'El código no es correcto o el inicio de sesión ya no es válido. Intenta de nuevo; si sigue fallando, vuelve al inicio.');
    await page.clock.fastForward(61000);
    const antes = cuerpos.length;
    await page.fill('#login-codigo', '123456');
    await page.click('button[type=submit]');
    check('vencida: alerta «más de 3 minutos»', (await alerta(page).innerText()).startsWith('Pasaron más de 3 minutos'));
    check('vencida: no manda el código vencido', cuerpos.length === antes);
    await page.getByRole('button', { name: 'Empezar de nuevo' }).click();
    check('vencida: «Empezar de nuevo» vuelve al login', await page.locator('#login-password').isVisible());
    await sinSecretos(page, 'sesión vencida');
    check('sin errores ni red externa (5)', errores.length === 0, errores.join(' | '));
    await ctx.close();
  }

  // 6. No staff
  {
    const { ctx, page } = await nuevaPagina();
    await entrar(page, 'nostaff@qa.test');
    await page.waitForTimeout(300);
    check('no staff: 403 → mensaje claro', (await alerta(page).innerText()) === 'Tu usuario no tiene acceso al panel de RockyBrand.');
    await sinDesborde(page, 'login');
    const casos = [
      ['mala@qa.test', (t) => t === 'Email o contraseña incorrectos.', '401 → credenciales'],
      ['malasincodigo@qa.test', (t) => t === 'Credenciales invalidas', '401 sin codigo → texto del servidor, no «credenciales»'],
      ['bloqueado@qa.test', (t) => t === 'Hubo demasiados intentos. Espera unos minutos e intenta de nuevo.', '429 bloqueado → texto propio sin minutos'],
      ['nostaffsincodigo@qa.test', (t) => t === 'Requiere acceso de staff.', '403 sin codigo → texto del servidor'],
      ['vacio401@qa.test', (t) => t === 'Hubo un problema en el servidor. Intenta de nuevo en un momento.', '401 sin cuerpo → mensaje de servidor'],
      ['textoplano@qa.test', (t) => t === 'Hubo un problema en el servidor. Intenta de nuevo en un momento.', '400 text/plain «Bad Request» → mensaje de servidor'],
      ['caido@qa.test', (t) => t === 'No se pudo comprobar el acceso. Intenta de nuevo.', '500 → texto del servidor'],
      ['vacio@qa.test', (t) => t === 'Hubo un problema en el servidor. Intenta de nuevo en un momento.', '500 vacío → mensaje de servidor'],
      ['raro@qa.test', (t) => t === 'Tu cuenta pide un paso que el panel aún no maneja. Avísale al equipo.', 'desafio_no_soportado → manda el codigo'],
    ];
    for (const [correo, ok, nombre] of casos) {
      await entrar(page, correo);
      await page.waitForTimeout(300);
      const t = await alerta(page).innerText();
      check(`errores del login: ${nombre}`, ok(t), t);
    }
    await sinSecretos(page, 'errores del login');
    await ctx.close();
  }

  // 6b. Acceso de respaldo (clave compartida, sin MFA)
  {
    const { ctx, page, cuerpos, errores } = await nuevaPagina();
    await page.goto(`${BASE}${RUTA}`);
    await page.getByRole('button', { name: /acceso de respaldo/ }).click();
    check('respaldo: cambia a «Acceso de respaldo»', await page.getByRole('heading', { name: 'Acceso de respaldo' }).isVisible());
    await page.fill('#login-username', 'respaldo');
    await page.fill('#login-password', 'mala');
    await page.click('button[type=submit]');
    await page.waitForTimeout(300);
    check('respaldo: 401 credenciales → «Usuario o contraseña incorrectos.»', (await alerta(page).innerText()) === 'Usuario o contraseña incorrectos.');
    await page.fill('#login-username', 'respaldo-bloqueado');
    await page.click('button[type=submit]');
    await page.waitForTimeout(300);
    check('respaldo: 429 bloqueado → espera unos minutos', (await alerta(page).innerText()) === 'Hubo demasiados intentos. Espera unos minutos e intenta de nuevo.');
    await page.fill('#login-username', 'respaldo-vacio');
    await page.click('button[type=submit]');
    await page.waitForTimeout(300);
    check('respaldo: 401 sin cuerpo → mensaje de servidor', (await alerta(page).innerText()) === 'Hubo un problema en el servidor. Intenta de nuevo en un momento.');
    await page.fill('#login-username', 'respaldo');
    await page.fill('#login-password', 'clave-respaldo');
    await page.click('button[type=submit]');
    check('respaldo: entra', await dentro(page));
    check('respaldo: usa la acción login, no panel_login', cuerpos.some((c) => c.__action === 'login') && !cuerpos.some((c) => c.__action === 'panel_login'));
    check('respaldo: sin aviso de MFA', !(await page.locator('aside.mfa-aviso').isVisible()));
    await page.goto(`${BASE}/usuarios-acceso`, { waitUntil: 'networkidle' });
    check('respaldo: /usuarios-acceso muestra el aviso de respaldo', ((await page.locator('#mfa-respaldo').innerText().catch(() => '')) === 'El acceso de respaldo no tiene usuario propio. Entra con tu cuenta de staff para activar el código.'));
    check('respaldo: sin formulario de activación', (await page.locator('#mfa-clave').count()) === 0 && (await page.getByRole('button', { name: 'Activar código de verificación' }).count()) === 0);
    await sinSecretos(page, 'respaldo');
    await page.getByRole('link', { name: 'Cerrar sesión' }).click();
    check('respaldo: cerrar sesión borra la marca', (await page.evaluate(() => localStorage.getItem('rockybrandPanelRespaldo'))) === null);
    await entrar(page, 'directo@qa.test');
    await dentro(page);
    await page.goto(`${BASE}/usuarios-acceso`, { waitUntil: 'networkidle' });
    check('respaldo → login de staff: vuelve el formulario', (await page.locator('#mfa-clave').count()) === 1 && (await page.locator('#mfa-respaldo').count()) === 0);
    check('sin errores ni red externa (6b)', errores.length === 0, errores.join(' | '));
    await ctx.close();
  }

  // 8. 409 de la inscripción: manda `codigo`, no el texto
  {
    const { ctx, page } = await nuevaPagina({ ancho: 1280, alto: 800 });
    await page.goto(`${BASE}/usuarios-acceso?qa=sesion&mfa=0`);
    for (const [clave, esperado, nombre] of [
      ['pide-clave', 'Escribe tu contraseña para continuar.', '401 reauth_requerida → pide la clave'],
      ['clave-bloqueada', 'Hubo demasiados intentos. Espera unos minutos e intenta de nuevo.', '429 bloqueado → espera unos minutos'],
      ['clave-raro', 'Tu cuenta pide un paso que el panel aún no maneja. Avísale al equipo.', '400 desafio_no_soportado'],
      ['clave-sesion-respaldo', 'El acceso de respaldo no tiene usuario propio. Entra con tu cuenta de staff para activar el código.', '400 sin_usuario_propio → texto propio'],
      ['clave-400-vacio', 'No se pudo completar. Intenta de nuevo.', '400 sin error ni codigo → no culpa al servidor'],
      ['clave-500-vacio', 'Hubo un problema en el servidor. Intenta de nuevo en un momento.', '500 sin error ni codigo → mensaje de servidor'],
    ]) {
      await page.fill('#mfa-clave', clave);
      await page.getByRole('button', { name: 'Activar código de verificación' }).click();
      await page.waitForTimeout(300);
      const t = await page.locator('#mfa [role=alert]').innerText();
      check(`MfaPropio: ${nombre}`, t === esperado, t);
    }
    await page.fill('#mfa-clave', 'clave-pendiente');
    await page.getByRole('button', { name: 'Activar código de verificación' }).click();
    await page.waitForTimeout(300);
    check('409 mfa_paso_pendiente → pide cerrar sesión (aunque el texto diga «ya tiene»)', (await page.locator('#mfa [role=alert]').innerText()).includes('paso pendiente al iniciar sesión'));
    await page.fill('#mfa-clave', 'clave-activo');
    await page.getByRole('button', { name: 'Activar código de verificación' }).click();
    await page.locator('#mfa .pill', { hasText: 'Activo' }).waitFor({ timeout: 3000 }).catch(() => {});
    check('409 mfa_ya_activo → queda «Activo» (aunque el texto no lo diga)', await page.locator('#mfa .pill', { hasText: 'Activo' }).isVisible());
    await sinSecretos(page, '409 de MFA');
    await ctx.close();
  }

  // 9. Desborde de MfaPropio y del aviso a 320 y 360: cada paso suma 0 px al
  // desborde previo del shell (no se toca acá). Se compara la misma pantalla
  // con y sin #mfa en el mismo instante: el resto de la página cambia entre casos.
  for (const ancho of [320, 360]) {
    const { ctx, page } = await nuevaPagina({ ancho, alto: 640 });
    const medir = () =>
      page.evaluate(() => {
        const d = document.documentElement;
        const sobra = d.scrollWidth - d.clientWidth;
        const sec = document.querySelector('#mfa');
        if (!sec) return { sobra, base: sobra };
        sec.style.display = 'none';
        const base = d.scrollWidth - d.clientWidth;
        sec.style.display = '';
        return { sobra, base };
      });
    await page.goto(`${BASE}/usuarios-acceso?qa=sesion&mfa=0#mfa`, { waitUntil: 'networkidle' });
    await page.locator('#mfa-clave').waitFor({ timeout: 5000 });
    const pasos = {};
    pasos.inicio = await medir();
    await page.getByRole('button', { name: 'Activar código de verificación' }).click();
    await page.waitForTimeout(200);
    pasos['inicio con error'] = await medir();
    await page.fill('#mfa-clave', 'clave-staff');
    await page.getByRole('button', { name: 'Activar código de verificación' }).click();
    await page.locator('#mfa-codigo').waitFor({ timeout: 5000 });
    pasos.qr = await medir();
    await page.locator('#mfa-codigo').fill('000000');
    await page.getByRole('button', { name: 'Verificar y activar' }).click();
    await page.waitForTimeout(300);
    pasos['qr con error'] = await medir();
    await page.locator('#mfa-codigo').fill('123456');
    await page.getByRole('button', { name: 'Verificar y activar' }).click();
    await page.locator('#mfa .pill', { hasText: 'Activo' }).waitFor({ timeout: 5000 }).catch(() => {});
    pasos.activo = await medir();
    await page.goto(`${BASE}/aprobaciones?qa=sesion&mfa=0`, { waitUntil: 'networkidle' });
    await page.locator('aside.mfa-aviso').waitFor({ timeout: 5000 }).catch(() => {});
    const conAviso = await medir();
    await page.getByRole('button', { name: 'Ahora no' }).click();
    const sinAviso = await medir();
    console.log(`  desborde ${ancho} (con #mfa/sin #mfa): ` + Object.entries(pasos).map(([k, v]) => `${k}=${v.sobra}/${v.base}`).join(', ') + `; aviso=${conAviso.sobra}, sin aviso=${sinAviso.sobra}`);
    for (const [k, v] of Object.entries(pasos))
      check(`MfaPropio ${ancho}: «${k}» no suma desborde`, v.sobra === v.base, `${v.sobra} vs ${v.base} sin #mfa`);
    check(`aviso ${ancho}: no suma desborde`, conAviso.sobra === sinAviso.sobra, `${conAviso.sobra} vs ${sinAviso.sobra}`);
    await ctx.close();
  }

  // 7. Accesos de clientes: rol y MFA, cambio de rol, restablecer MFA, crear con rol
  {
    const { ctx, page, cuerpos, errores } = await nuevaPagina({ ancho: 1440, alto: 900 });
    await page.goto(`${BASE}/usuarios-acceso?qa=sesion`);
    const fila = (correo) => page.locator('tr', { hasText: correo });
    await fila('admin@cliente-uno.test').waitFor();
    check('tabla: columnas Rol y MFA', (await page.locator('th', { hasText: /^Rol$/ }).count()) === 1 && (await page.locator('th', { hasText: /^MFA$/ }).count()) === 1);
    check('tabla: Admin + MFA Activo', (await fila('admin@cliente-uno.test').innerText()).match(/ADMIN[\s\S]*ACTIVO/i));
    check('tabla: Lectura + Sin activar', (await fila('lectura@cliente-uno.test').innerText()).match(/LECTURA[\s\S]*SIN ACTIVAR/i));
    check('tabla: rol null → Admin (sin asignar), MFA null → Sin dato', (await fila('antiguo-con-correo-largo').innerText()).match(/ADMIN \(SIN ASIGNAR\)[\s\S]*SIN DATO/i));
    check('tabla: «Admin (sin asignar)» con pill de aviso', (await fila('antiguo-con-correo-largo').locator('.pill.scheduled', { hasText: /sin asignar/i }).count()) === 1);
    check('tabla: sin «Restablecer MFA» si no tiene MFA', (await fila('lectura@cliente-uno.test').getByRole('button', { name: 'Restablecer MFA' }).count()) === 0);
    check('crear: rol por defecto Admin', (await page.locator('#nuevo-rol').inputValue()) === 'cliente-admin');

    await fila('lectura@cliente-uno.test').getByRole('button', { name: 'Cambiar rol' }).click();
    check('cambiar rol: modal parte en el rol actual', (await page.locator('#rol-elegido').inputValue()) === 'cliente-lectura');
    await page.selectOption('#rol-elegido', 'cliente-editor');
    for (const [clave, esperado, nombre] of [
      ['pide-clave', 'Escribe tu contraseña para confirmar.', '401 reauth_requerida → pide la clave, no «incorrecta»'],
      ['clave-bloqueada', 'Hubo demasiados intentos. Espera unos minutos e intenta de nuevo.', '429 bloqueado'],
    ]) {
      await page.fill('#reauth-password', clave);
      await page.getByRole('button', { name: 'Confirmar' }).click();
      await page.waitForTimeout(300);
      const ok = (await page.locator('[role=alert]', { hasText: esperado }).count()) === 1;
      const confunde = (await page.locator('[role=alert]', { hasText: 'contraseña no es correcta' }).count()) > 0;
      check(`modal: ${nombre}`, ok && !confunde && (await page.locator('#rol-elegido').isVisible()));
    }
    await page.fill('#reauth-password', 'mala');
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await page.waitForTimeout(300);
    check('cambiar rol: clave mala → alerta y el modal sigue', (await page.locator('[role=alert]', { hasText: 'La contraseña no es correcta.' }).isVisible()) && (await page.locator('#rol-elegido').isVisible()));
    await page.fill('#reauth-password', 'clave-staff');
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await page.locator('.manual-invoke-msg', { hasText: 'ahora tiene el rol Editor' }).waitFor({ timeout: 3000 }).catch(() => {});
    check('cambiar rol: mensaje de éxito', await page.locator('.manual-invoke-msg', { hasText: 'ahora tiene el rol Editor' }).isVisible());
    check('cambiar rol: la tabla muestra Editor', (await fila('lectura@cliente-uno.test').innerText()).match(/EDITOR/i));
    const cr = cuerpos.find((c) => c.__action === 'set_client_user_role' && c.reauth_password === 'clave-staff');
    check('cambiar rol: manda client_id, username, rol y reauth_password', cr && cr.client_id === 'cliente-uno' && cr.username === 'u2' && cr.rol === 'cliente-editor');

    await fila('admin@cliente-uno.test').getByRole('button', { name: 'Restablecer MFA' }).click();
    await page.fill('#reauth-password', 'clave-staff');
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await page.locator('.manual-invoke-msg', { hasText: 'Se restableció el código' }).waitFor({ timeout: 3000 }).catch(() => {});
    check('restablecer MFA: texto «entra solo con su clave…»', await page.locator('.manual-invoke-msg', { hasText: 'Desde ahora entra solo con su clave, hasta que vuelva a activar el código desde la Configuración de su panel.' }).isVisible());
    check('restablecer MFA: mensaje y fila en «Sin activar»', (await fila('admin@cliente-uno.test').innerText()).match(/SIN ACTIVAR/i));
    const rm = cuerpos.find((c) => c.__action === 'reset_client_user_mfa');
    check('restablecer MFA: manda client_id, username y reauth_password', rm && rm.username === 'u1' && rm.reauth_password === 'clave-staff');

    await page.fill('input[placeholder="contacto@sucliente.cl"]', 'nuevo@cliente-uno.test');
    await page.getByRole('button', { name: 'Crear acceso' }).click();
    await page.fill('#reauth-password', 'clave-staff');
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await page.waitForTimeout(300);
    // Cierra el modal de la credencial que dejó «Crear acceso».
    await page.getByRole('button', { name: 'Ya la guardé' }).click();
    await fila('antiguo-con-correo-largo').getByRole('button', { name: 'Cambiar rol' }).click();
    check('modal: rol null se describe «Admin (sin asignar)»', await page.getByText('tiene hoy el rol Admin (sin asignar)').isVisible());
    await page.selectOption('#rol-elegido', 'cliente-lectura');
    await page.fill('#reauth-password', 'clave-staff');
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await page.waitForTimeout(300);
    check('modal: 500 muestra el mensaje del servidor', await page.locator('[role=alert]', { hasText: 'No se pudo cambiar el rol. Intenta de nuevo.' }).isVisible());
    check('modal: 500 no se confunde con «contraseña incorrecta»', (await page.locator('[role=alert]', { hasText: 'contraseña no es correcta' }).count()) === 0);
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await sinSecretos(page, 'accesos de clientes');
    const cc = cuerpos.find((c) => c.__action === 'create_client_user');
    check('crear: manda rol cliente-admin por defecto', cc && cc.rol === 'cliente-admin');
    check('sin errores ni red externa (7)', errores.length === 0, errores.join(' | '));
    await ctx.close();
  }
} catch (e) {
  check('el recorrido terminó sin excepción', false, String(e));
} finally {
  await navegador.close();
  vite.kill();
}

const fallas = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length - fallas}/${resultados.length} verificaciones OK`);
process.exit(fallas ? 1 : 0);
