/* ============================================================
   Mi Rutina de Hipertrofia — lógica principal
   ============================================================ */
'use strict';

const STORE_KEY = 'hipertrofia_v1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- Estado ---------- */
const defaultState = () => ({
  selected: {},   // key ejercicio -> id de la variante elegida
  weights: {},    // id de ejercicio -> peso de trabajo (lb)
  done: {},       // "fecha|key|serie" -> true (series marcadas del día)
  feedback: {},   // "fecha|key" -> 'facil'|'medio'|'dificil'
  history: [],    // [{date, day, focus, volume}]
  bodyweight: [], // [{date, kg}]
  settings: { dark: true, sound: true, anim: true, unit: 'lb' },
});

let state = load();
let currentDay = 0;
let restTimer = null, restLeft = 0;

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    return Object.assign(defaultState(), JSON.parse(raw));
  } catch { return defaultState(); }
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

const todayStr = () => new Date().toISOString().slice(0, 10);

/* ---------- Helpers de datos ---------- */
function chosenId(ex) {
  const sel = state.selected[ex.key];
  return (sel && ex.opts.includes(sel)) ? sel : ex.opts[0];
}
function weightOf(ex) {
  const id = chosenId(ex);
  return (state.weights[id] != null) ? state.weights[id] : ex.lb;
}
function midReps(reps) {
  const m = reps.match(/(\d+)\D+(\d+)/);
  return m ? (parseInt(m[1]) + parseInt(m[2])) / 2 : parseInt(reps) || 10;
}
// Aclara si el peso es por mancuerna o total, según el equipo
function weightHint(equip) {
  const e = (equip || '').toLowerCase();
  if (e.includes('mancuerna')) return '💡 Peso <strong>por mancuerna</strong> (cada mano)';
  if (e.includes('barra') || e.includes('smith')) return '💡 Peso <strong>total</strong> (la barra vacía ya pesa ~45 lb)';
  return '💡 Peso <strong>total</strong> (el número de la placa/máquina)';
}

/* ============================================================
   RENDER — Vista rutina
   ============================================================ */
function renderTabs() {
  const tabs = $('#dayTabs');
  tabs.innerHTML = ROUTINE.days.map((d, i) =>
    `<button class="day-tab ${i === currentDay ? 'active' : ''}" data-i="${i}">
       <span class="dt-emoji">${d.emoji}</span>
       <span class="dt-name">${d.name}</span>
     </button>`).join('');
  $$('.day-tab', tabs).forEach(b => b.onclick = () => { currentDay = +b.dataset.i; renderDay(); });
}

function renderDay() {
  const d = ROUTINE.days[currentDay];
  $('#headerSub').textContent = `${d.name} · ${d.focus}`;
  $('#dayHead').innerHTML = `<h2>${d.emoji} ${d.focus}</h2>
    <p class="muted">${d.exercises.length} ejercicios · ${d.exercises.reduce((a, e) => a + e.sets, 0)} series</p>`;

  // Calentamiento
  $('#warmupList').innerHTML = WARM[d.warm].map(w => `<li>${w}</li>`).join('');

  // Ejercicios
  $('#exerciseList').innerHTML = d.exercises.map(ex => cardHTML(ex)).join('');
  $$('.day-tab').forEach((b, i) => b.classList.toggle('active', i === currentDay));

  wireCards();
}

function cardHTML(ex) {
  const id = chosenId(ex);
  const info = EX[id];
  const w = weightOf(ex);
  const fbKey = `${todayStr()}|${ex.key}`;
  const fb = state.feedback[fbKey];
  const [f0, f1] = frames(id);

  // checkboxes de series
  let setsHTML = '';
  for (let s = 1; s <= ex.sets; s++) {
    const on = state.done[`${todayStr()}|${ex.key}|${s}`];
    setsHTML += `<button class="set-chip ${on ? 'on' : ''}" data-key="${ex.key}" data-set="${s}" data-rest="${ex.rest}">${s}</button>`;
  }

  const fbHTML = `
    <div class="semaforo" data-key="${ex.key}">
      <p class="sem-q">¿Cómo se sintió? Elegí para ajustar el peso la próxima vez:</p>
      <div class="sem-btns">
        <button class="sem facil ${fb === 'facil' ? 'sel' : ''}" data-v="facil">🟢 Fácil</button>
        <button class="sem medio ${fb === 'medio' ? 'sel' : ''}" data-v="medio">🟡 Medio</button>
        <button class="sem dificil ${fb === 'dificil' ? 'sel' : ''}" data-v="dificil">🔴 Difícil</button>
      </div>
    </div>`;

  return `
  <article class="card exercise" data-key="${ex.key}">
    <div class="ex-media">
      <div class="gif ${state.settings.anim ? '' : 'no-anim'}">
        <img class="f0" src="${f0}" alt="${info.es}" loading="lazy" onerror="this.closest('.gif').classList.add('broken')">
        <img class="f1" src="${f1}" alt="" loading="lazy">
        <div class="gif-fallback">🏋️<span>${info.es}</span></div>
      </div>
    </div>
    <div class="ex-body">
      <div class="ex-top">
        <div>
          <h3 class="ex-name">${info.es}</h3>
          <p class="ex-musc">${info.musc} · ${info.equip}</p>
        </div>
        <button class="swap-btn" data-key="${ex.key}" title="Cambiar ejercicio">🔄</button>
      </div>

      <div class="ex-prescription">
        <div class="pill"><span class="pill-lbl">Series</span><span class="pill-val">${ex.sets}</span></div>
        <div class="pill"><span class="pill-lbl">Reps</span><span class="pill-val">${ex.reps}</span></div>
        <div class="pill weight">
          <span class="pill-lbl">Peso (lb)</span>
          <div class="w-ctrl">
            <button class="w-btn" data-key="${ex.key}" data-d="-1">−</button>
            <span class="pill-val w-val" data-key="${ex.key}">${w}</span>
            <button class="w-btn" data-key="${ex.key}" data-d="1">+</button>
          </div>
        </div>
      </div>
      <p class="w-hint">${weightHint(info.equip)}</p>

      <div class="ex-sets">
        <span class="sets-lbl">Marcá tus series:</span>
        <div class="sets-row">${setsHTML}</div>
      </div>

      <details class="ex-setup">
        <summary>⚙️ Cómo prepararlo / configurar la máquina</summary>
        <p><strong>Preparación:</strong> ${info.setup}</p>
        <p><strong>Técnica:</strong> ${info.tip}</p>
        <p>Descanso entre series: <strong>${fmtTime(ex.rest)}</strong></p>
        <a class="yt-link" href="${yt(info.es)}" target="_blank" rel="noopener">▶️ Ver demostración en YouTube</a>
      </details>

      ${fbHTML}
    </div>
  </article>`;
}

function wireCards() {
  // Peso +/-
  $$('.w-btn').forEach(b => b.onclick = () => {
    const ex = findEx(b.dataset.key);
    const id = chosenId(ex);
    const step = ex.inc || 5;
    let w = weightOf(ex) + (+b.dataset.d) * step;
    if (w < 0) w = 0;
    state.weights[id] = w;
    save();
    $(`.w-val[data-key="${ex.key}"]`).textContent = w;
  });

  // Series marcadas -> inicia descanso
  $$('.set-chip').forEach(b => b.onclick = () => {
    const k = `${todayStr()}|${b.dataset.key}|${b.dataset.set}`;
    const now = !state.done[k];
    if (now) { state.done[k] = true; startRest(+b.dataset.rest); }
    else { delete state.done[k]; }
    b.classList.toggle('on', now);
    save();
  });

  // Cambiar ejercicio
  $$('.swap-btn').forEach(b => b.onclick = () => openSwap(b.dataset.key));

  // Semáforo
  $$('.semaforo').forEach(box => {
    $$('.sem', box).forEach(btn => btn.onclick = () => handleFeedback(box.dataset.key, btn.dataset.v));
  });
}

function findEx(key) {
  for (const d of ROUTINE.days) for (const e of d.exercises) if (e.key === key) return e;
}

/* ============================================================
   SEMÁFORO — progresión de peso
   ============================================================ */
function handleFeedback(key, v) {
  const ex = findEx(key);
  const id = chosenId(ex);
  const step = ex.inc || 5;
  const cur = weightOf(ex);
  state.feedback[`${todayStr()}|${key}`] = v;

  let msg = '';
  if (v === 'facil') {
    state.weights[id] = cur + step;
    msg = `🟢 ¡Genial! Subimos a ${cur + step} lb para la próxima.`;
  } else if (v === 'medio') {
    msg = `🟡 Peso justo (${cur} lb). Intentá sumar 1 repetición la próxima.`;
  } else {
    msg = `🔴 Mantené ${cur} lb y enfocate en la técnica. Si te costó mucho, bajá un poco.`;
  }
  save();
  toast(msg);
  renderDay(); // refresca pesos y estado del semáforo
}

/* ============================================================
   CAMBIAR EJERCICIO (modal)
   ============================================================ */
function openSwap(key) {
  const ex = findEx(key);
  const cur = chosenId(ex);
  $('#swapOptions').innerHTML = ex.opts.map(id => {
    const info = EX[id];
    const [f0] = frames(id);
    return `<button class="swap-opt ${id === cur ? 'sel' : ''}" data-id="${id}">
      <img src="${f0}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
      <div><span class="so-name">${info.es}</span><span class="so-musc">${info.musc} · ${info.equip}</span></div>
      ${id === cur ? '<span class="so-check">✓</span>' : ''}
    </button>`;
  }).join('');
  $$('.swap-opt').forEach(b => b.onclick = () => {
    state.selected[key] = b.dataset.id;
    save();
    closeSwap();
    renderDay();
    toast('Ejercicio cambiado ✅');
  });
  $('#swapModal').classList.remove('hidden');
}
function closeSwap() { $('#swapModal').classList.add('hidden'); }

/* ============================================================
   TEMPORIZADOR DE DESCANSO
   ============================================================ */
function fmtTime(s) { const m = Math.floor(s / 60), r = s % 60; return `${m}:${String(r).padStart(2, '0')}`; }
function fmtClock(s) { const m = Math.floor(s / 60), r = s % 60; return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`; }

function startRest(sec) {
  restLeft = sec;
  $('#restBar').classList.remove('hidden');
  updateRest();
  clearInterval(restTimer);
  restTimer = setInterval(() => {
    restLeft--;
    updateRest();
    if (restLeft <= 0) { stopRest(); beep(); }
  }, 1000);
}
function updateRest() { $('#restTime').textContent = fmtClock(Math.max(restLeft, 0)); }
function stopRest() { clearInterval(restTimer); restTimer = null; $('#restBar').classList.add('hidden'); }

function beep() {
  if (!state.settings.sound) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    o.start(); o.stop(ctx.currentTime + 0.6);
    if (navigator.vibrate) navigator.vibrate(200);
  } catch {}
}

/* ============================================================
   TERMINAR ENTRENAMIENTO -> guarda sesión
   ============================================================ */
function finishWorkout() {
  const d = ROUTINE.days[currentDay];
  let volume = 0, doneSets = 0;
  d.exercises.forEach(ex => {
    const w = weightOf(ex);
    for (let s = 1; s <= ex.sets; s++) {
      if (state.done[`${todayStr()}|${ex.key}|${s}`]) { volume += w * midReps(ex.reps); doneSets++; }
    }
  });
  if (doneSets === 0) { toast('Marcá al menos una serie para guardar 💡'); return; }

  state.history.unshift({ date: todayStr(), day: d.name, focus: d.focus, volume: Math.round(volume), sets: doneSets });
  state.history = state.history.slice(0, 60);
  save();
  toast(`💪 ¡Entrenamiento guardado! ${doneSets} series · ${Math.round(volume).toLocaleString('es')} lb de volumen`);
  setView('progress');
}

/* ============================================================
   VISTA PROGRESO
   ============================================================ */
function computeStreak() {
  if (!state.history.length) return 0;
  const days = [...new Set(state.history.map(h => h.date))].sort().reverse();
  let streak = 0;
  let cursor = new Date(todayStr());
  // Permite que la racha empiece hoy o ayer
  const has = ds => days.includes(ds);
  const iso = dt => dt.toISOString().slice(0, 10);
  if (!has(iso(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (has(iso(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  return streak;
}

function renderProgress() {
  const sessions = state.history.length;
  $('#statSessions').textContent = sessions;
  $('#statStreak').textContent = computeStreak();
  $('#statVolume').textContent = sessions ? state.history[0].volume.toLocaleString('es') : 0;

  // Gráfico de volumen (últimas 10 sesiones, orden cronológico)
  const vols = state.history.slice(0, 10).reverse();
  $('#volChart').innerHTML = vols.length
    ? barChart(vols.map(v => ({ label: v.date.slice(5), value: v.volume })))
    : '<p class="muted">Todavía no hay entrenamientos guardados. ¡Arrancá hoy! 💪</p>';

  // Peso corporal
  const bw = state.bodyweight.slice(-12);
  $('#bwChart').innerHTML = bw.length
    ? lineChart(bw.map(b => ({ label: b.date.slice(5), value: b.kg })), 'kg')
    : '<p class="muted">Registrá tu peso para ver la evolución.</p>';

  // Historial
  $('#historyList').innerHTML = sessions
    ? state.history.slice(0, 12).map(h =>
      `<div class="hist-row"><span class="h-date">${h.date}</span>
       <span class="h-focus">${h.focus}</span>
       <span class="h-vol">${h.sets} series · ${h.volume.toLocaleString('es')} lb</span></div>`).join('')
    : '<p class="muted">Sin historial aún.</p>';
}

function barChart(data) {
  const max = Math.max(...data.map(d => d.value), 1);
  return `<div class="bars">${data.map(d =>
    `<div class="bar-col"><div class="bar" style="height:${Math.max(6, d.value / max * 100)}%" title="${d.value} lb"></div>
     <span class="bar-lbl">${d.label}</span></div>`).join('')}</div>`;
}

function lineChart(data, unit) {
  if (data.length < 2) {
    const d = data[0];
    return `<p class="single-bw">${d.value} ${unit} <span class="muted">(${d.label})</span></p>`;
  }
  const W = 300, H = 90, pad = 8;
  const vals = data.map(d => d.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = (max - min) || 1;
  const pts = data.map((d, i) => {
    const x = pad + i * (W - 2 * pad) / (data.length - 1);
    const y = H - pad - (d.value - min) / range * (H - 2 * pad);
    return [x, y];
  });
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const dots = pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3"/>`).join('');
  return `<svg class="line-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>${dots}
    </svg>
    <div class="bw-legend"><span>${min} ${unit}</span><span>último: ${vals[vals.length - 1]} ${unit}</span><span>${max} ${unit}</span></div>`;
}

function saveBodyweight() {
  const val = parseFloat($('#bwInput').value);
  if (!val || val <= 0) { toast('Ingresá un peso válido'); return; }
  let kg = val;
  if ($('#bwUnit').value === 'lb') kg = +(val / 2.20462).toFixed(1);
  // reemplaza si ya hay registro de hoy
  state.bodyweight = state.bodyweight.filter(b => b.date !== todayStr());
  state.bodyweight.push({ date: todayStr(), kg });
  state.bodyweight.sort((a, b) => a.date.localeCompare(b.date));
  save();
  $('#bwInput').value = '';
  renderProgress();
  toast('Peso guardado ⚖️');
}

/* ============================================================
   AJUSTES / datos
   ============================================================ */
function applySettings() {
  document.body.classList.toggle('light', !state.settings.dark);
  $('#darkToggle').checked = state.settings.dark;
  $('#soundToggle').checked = state.settings.sound;
  $('#animToggle').checked = state.settings.anim;
}
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mi-rutina-respaldo-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
function importData(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      state = Object.assign(defaultState(), JSON.parse(r.result));
      save(); applySettings(); renderDay(); renderProgress();
      toast('Respaldo importado ✅');
    } catch { toast('Archivo inválido'); }
  };
  r.readAsText(file);
}

/* ============================================================
   NAVEGACIÓN / UI global
   ============================================================ */
function setView(name) {
  ['routine', 'progress', 'settings'].forEach(v =>
    $('#view-' + v).classList.toggle('hidden', v !== name));
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'progress') renderProgress();
  window.scrollTo(0, 0);
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3200);
}

/* ============================================================
   INIT
   ============================================================ */
function init() {
  applySettings();
  renderTabs();
  renderDay();

  $$('.nav-btn').forEach(b => b.onclick = () => setView(b.dataset.view));
  $('#settingsBtn').onclick = () => setView('settings');
  $('#finishBtn').onclick = finishWorkout;

  // rest bar
  $('#restSkip').onclick = stopRest;
  $('#restMinus').onclick = () => { restLeft = Math.max(0, restLeft - 15); updateRest(); };
  $('#restPlus').onclick = () => { restLeft += 15; updateRest(); };

  // swap modal
  $('#swapClose').onclick = closeSwap;
  $('#swapModal').onclick = e => { if (e.target.id === 'swapModal') closeSwap(); };

  // progreso
  $('#bwSave').onclick = saveBodyweight;

  // ajustes
  $('#darkToggle').onchange = e => { state.settings.dark = e.target.checked; save(); applySettings(); };
  $('#soundToggle').onchange = e => { state.settings.sound = e.target.checked; save(); };
  $('#animToggle').onchange = e => { state.settings.anim = e.target.checked; save(); renderDay(); };
  $('#exportBtn').onclick = exportData;
  $('#importBtn').onclick = () => $('#importFile').click();
  $('#importFile').onchange = e => { if (e.target.files[0]) importData(e.target.files[0]); };
  $('#resetBtn').onclick = () => {
    if (confirm('¿Seguro que querés borrar todo tu progreso? Esta acción no se puede deshacer.')) {
      state = defaultState(); save(); applySettings(); renderDay(); toast('Todo reiniciado');
    }
  };

  // Animación tipo GIF (alterna frames en sincronía, sin recargar imágenes)
  setInterval(() => { if (state.settings.anim) document.body.classList.toggle('anim-b'); }, 750);

  // Service worker (funciona offline)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
