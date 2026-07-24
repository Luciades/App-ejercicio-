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
  profile: null,  // {sex, age, height, weight, fat, act, goal}
  water: {},      // { 'YYYY-MM-DD': vasos }
  waterGoal: 8,
  cycle: null,    // { start, len, per }
  oura: null,     // { token, proxy, data }
  portions: {},   // { 'YYYY-MM-DD': { verduras, frutas, cereales, proteina, grasa } }
  activities: [], // [ {date, type, min} ]
  supps: [],      // ['Vitamina D', ...]
  suppLog: {},    // { 'YYYY-MM-DD': { 'Vitamina D': true } }
  settings: { dark: true, sound: true, anim: true, unit: 'lb', autoRotate: true, ouraAdapt: true, cycleAdapt: true },
});

let state = load();
let currentDay = 0;
let restTimer = null, restLeft = 0;

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    const d = Object.assign(defaultState(), JSON.parse(raw));
    d.settings = Object.assign(defaultState().settings, d.settings || {});
    return d;
  } catch { return defaultState(); }
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

const todayStr = () => new Date().toISOString().slice(0, 10);

/* ---------- Helpers de datos ---------- */
// Semana actual (cambia cada lunes aprox.)
function weekIndex() { return Math.floor((Date.now() + 3 * 86400000) / (7 * 86400000)); }

function chosenId(ex) {
  const sel = state.selected[ex.key];
  if (state.settings.autoRotate && ex.opts.length > 1) {
    // un cambio manual solo pisa la rotación durante esta semana
    if (sel && typeof sel === 'object' && sel.week === weekIndex() && ex.opts.includes(sel.id)) return sel.id;
    return ex.opts[weekIndex() % ex.opts.length];
  }
  const id = (sel && typeof sel === 'object') ? sel.id : sel;
  return (id && ex.opts.includes(id)) ? id : ex.opts[0];
}

// Ajuste según Readiness de Oura
function ouraAdjust() {
  if (!state.settings.ouraAdapt) return { d: 0, tag: '', note: '' };
  const o = state.oura && state.oura.data;
  if (!o || o.readiness == null) return { d: 0, tag: '', note: '' };
  const r = o.readiness;
  if (r < 60) return { d: -2, tag: '🔴 Día de recuperación', note: `Readiness ${r}: bajamos el volumen. Menos series, más descanso y técnica prolija.` };
  if (r < 70) return { d: -1, tag: '🟠 Día suave', note: `Readiness ${r}: 1 serie menos por ejercicio y un poco más de descanso.` };
  if (r >= 85) return { d: 0, tag: '🟢 Día a tope', note: `Readiness ${r}: gran día para empujar peso e intentar récords.` };
  return { d: 0, tag: '🟡 Día normal', note: `Readiness ${r}: entrená como siempre.` };
}
// Ajuste según la fase del ciclo (guía, cada cuerpo es distinto)
function cycleAdjust() {
  if (!state.settings.cycleAdapt) return { d: 0, tag: '', note: '' };
  const ph = currentPhase();
  if (!ph) return { d: 0, tag: '', note: '' };
  const day = ph.day, len = ph.len;
  if (ph.key === 'menstrual' && day <= 2) return { d: -1, tag: '🌑 Regla (día ' + day + ')', note: 'Primeros días: si tenés poca energía, bajá el volumen y priorizá moverte suave.' };
  if (ph.key === 'menstrual') return { d: 0, tag: '🌑 Menstrual', note: 'La energía suele volver: entrená normal si te sentís bien.' };
  if (ph.key === 'folicular') return { d: 0, tag: '🌒 Folicular', note: 'Ventana fuerte: buen momento para subir peso e ir por récords.' };
  if (ph.key === 'ovulacion') return { d: 0, tag: '🌕 Ovulación', note: 'Pico de fuerza; calentá bien (hay más laxitud articular).' };
  if (day > len - 4) return { d: -1, tag: '🌘 Premenstrual', note: 'Puede subir la fatiga: bajamos un poco el volumen y sumamos descanso.' };
  return { d: 0, tag: '🌘 Lútea', note: 'Mantené el trabajo y cuidá la recuperación.' };
}
// Combina Oura + ciclo (nunca agrega series, solo recorta cuando conviene)
function dailyAdjust() {
  let d = 0; const parts = [];
  const o = ouraAdjust(); if (o.tag) { d += o.d; parts.push(o); }
  const c = cycleAdjust(); if (c.tag) { d += c.d; parts.push(c); }
  d = Math.max(-2, Math.min(0, d));
  return { d, parts };
}
function effectiveSets(ex) { return Math.max(2, ex.sets + dailyAdjust().d); }
function adjustedRest(ex) { return dailyAdjust().d < 0 ? Math.round(ex.rest * 1.2) : ex.rest; }
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
  const totalSets = d.exercises.reduce((a, e) => a + effectiveSets(e), 0);
  $('#dayHead').innerHTML = `<h2>${d.emoji} ${d.focus}</h2>
    <p class="muted">${d.exercises.length} ejercicios · ${totalSets} series${state.settings.autoRotate ? ' · 🔁 rota cada semana' : ''}</p>`;

  // Calentamiento
  $('#warmupList').innerHTML = WARM[d.warm].map(w => `<li>${w}</li>`).join('');

  // Ejercicios
  $('#exerciseList').innerHTML = d.exercises.map(ex => cardHTML(ex)).join('');
  $$('.day-tab').forEach((b, i) => b.classList.toggle('active', i === currentDay));

  wireCards();
  renderInsight();
}

function cardHTML(ex) {
  const id = chosenId(ex);
  const info = EX[id];
  const w = weightOf(ex);
  const sets = effectiveSets(ex);
  const rest = adjustedRest(ex);
  const fbKey = `${todayStr()}|${ex.key}`;
  const fb = state.feedback[fbKey];
  const [f0, f1] = frames(id);
  const rot = (state.settings.autoRotate && ex.opts.length > 1)
    ? ` · 🔁 opción ${ex.opts.indexOf(id) + 1}/${ex.opts.length}` : '';
  const setsChanged = sets !== ex.sets;

  // checkboxes de series
  let setsHTML = '';
  for (let s = 1; s <= sets; s++) {
    const on = state.done[`${todayStr()}|${ex.key}|${s}`];
    setsHTML += `<button class="set-chip ${on ? 'on' : ''}" data-key="${ex.key}" data-set="${s}" data-rest="${rest}">${s}</button>`;
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
          <p class="ex-musc">${info.musc} · ${info.equip}${rot}</p>
        </div>
        <button class="swap-btn" data-key="${ex.key}" title="Cambiar ejercicio">🔄</button>
      </div>

      <div class="ex-prescription">
        <div class="pill"><span class="pill-lbl">Series</span><span class="pill-val ${setsChanged ? 'adj' : ''}">${sets}${setsChanged ? `<span class="pill-sub">de ${ex.sets}</span>` : ''}</span></div>
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
        <p>Descanso entre series: <strong>${fmtTime(rest)}</strong></p>
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
    state.selected[key] = state.settings.autoRotate ? { week: weekIndex(), id: b.dataset.id } : b.dataset.id;
    save();
    closeSwap();
    renderDay();
    toast(state.settings.autoRotate ? 'Cambiado por esta semana ✅' : 'Ejercicio cambiado ✅');
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
function allWorkoutDates() {
  return [...state.history.map(h => h.date), ...(state.activities || []).map(a => a.date)];
}
function computeStreak() {
  const dl = allWorkoutDates();
  if (!dl.length) return 0;
  const days = [...new Set(dl)].sort().reverse();
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

  // Historial combinado (gym + otras actividades)
  const combined = [
    ...state.history.map(h => ({ date: h.date, label: h.focus, detail: `${h.sets} series · ${h.volume.toLocaleString('es')} lb`, icon: '🏋️' })),
    ...(state.activities || []).map(a => ({ date: a.date, label: a.type, detail: a.min ? `${a.min} min` : 'actividad', icon: '🤸' })),
  ].sort((x, y) => y.date.localeCompare(x.date)).slice(0, 15);
  $('#historyList').innerHTML = combined.length
    ? combined.map(h =>
      `<div class="hist-row"><span class="h-date">${h.date}</span>
       <span class="h-focus">${h.icon} ${h.label}</span>
       <span class="h-vol">${h.detail}</span></div>`).join('')
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
   SALUD — perfil, calorías y proteína
   ============================================================ */
const ACT_LBL = { '1.2': 'Sedentaria', '1.375': 'Ligera', '1.55': 'Moderada', '1.725': 'Alta' };

function loadProfileForm() {
  const p = state.profile;
  if (!p) return;
  $('#pSex').value = p.sex; $('#pAge').value = p.age; $('#pHeight').value = p.height;
  $('#pWeight').value = p.weight; $('#pFat').value = p.fat || ''; $('#pAct').value = p.act;
  $('#pGoal').value = p.goal;
  computeHealth();
}

function saveProfile() {
  const p = {
    sex: $('#pSex').value,
    age: parseFloat($('#pAge').value),
    height: parseFloat($('#pHeight').value),
    weight: parseFloat($('#pWeight').value),
    fat: parseFloat($('#pFat').value) || null,
    act: $('#pAct').value,
    goal: $('#pGoal').value,
  };
  if (!p.age || !p.height || !p.weight) { toast('Completá edad, altura y peso 🙂'); return; }
  state.profile = p;
  save();
  computeHealth();
  toast('¡Objetivos calculados! ❤️');
}

function computeHealth() {
  const p = state.profile;
  if (!p || !p.weight || !p.height || !p.age) return;

  // TMB: Katch-McArdle si hay % grasa, si no Mifflin-St Jeor
  let bmr;
  if (p.fat) {
    const lbm = p.weight * (1 - p.fat / 100);
    bmr = 370 + 21.6 * lbm;
  } else {
    bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'M' ? 5 : -161);
  }
  const maint = bmr * parseFloat(p.act);

  let kcal, deficitTxt, prPerKg;
  if (p.goal === 'perder') { kcal = maint - 450; deficitTxt = 'déficit para bajar grasa'; prPerKg = 2.0; }
  else if (p.goal === 'ganar') { kcal = maint + 250; deficitTxt = 'superávit suave para ganar músculo'; prPerKg = 1.8; }
  else { kcal = maint - 250; deficitTxt = 'déficit leve para recomposición'; prPerKg = 1.9; }

  const imc = p.weight / Math.pow(p.height / 100, 2);
  const protein = Math.round(p.weight * prPerKg);
  const prLow = Math.round(p.weight * 1.6), prHigh = Math.round(p.weight * 2.2);

  $('#rProtein').textContent = protein;
  $('#rKcal').textContent = Math.round(kcal / 10) * 10;
  $('#rImc').textContent = imc.toFixed(1);

  let imcCat = imc < 18.5 ? 'bajo' : imc < 25 ? 'normal' : imc < 30 ? 'algo elevado' : 'alto';
  $('#healthDetail').innerHTML = `
    <ul class="health-list">
      <li>🔥 <strong>Mantenimiento:</strong> ~${Math.round(maint / 10) * 10} kcal/día · tu objetivo es <strong>${Math.round(kcal / 10) * 10} kcal</strong> (${deficitTxt}).</li>
      <li>🥩 <strong>Proteína:</strong> apuntá a <strong>${protein} g/día</strong> (rango ${prLow}–${prHigh} g). Repartila en tus comidas.</li>
      <li>📊 <strong>IMC:</strong> ${imc.toFixed(1)} (${imcCat}). El IMC no distingue músculo de grasa, es solo una referencia.</li>
      <li>💪 <strong>Tu rutina de hipertrofia</strong> es ideal para tu objetivo: mantené la constancia 4 días y la sobrecarga progresiva (el semáforo te ayuda).</li>
      <li>🚶‍♀️ Sumar pasos diarios y dormir bien acelera los resultados.</li>
    </ul>`;
  $('#healthResults').classList.remove('hidden');
}

/* ============================================================
   AGUA — control diario
   ============================================================ */
function renderWater() {
  const goal = state.waterGoal || 8;
  const count = state.water[todayStr()] || 0;
  $('#waterCount').textContent = count;
  $('#waterGoal').textContent = goal;
  $('#waterGoalInput').value = goal;
  let dots = '';
  for (let i = 0; i < goal; i++) dots += `<span class="wdot ${i < count ? 'on' : ''}"></span>`;
  $('#waterDots').innerHTML = dots;
}
function setWater(delta) {
  const t = todayStr();
  let c = (state.water[t] || 0) + delta;
  if (c < 0) c = 0;
  if (c > 40) c = 40;
  state.water[t] = c;
  save();
  renderWater();
}

/* ============================================================
   CICLO — cálculo de fase y consejos
   ============================================================ */
const PHASES = {
  menstrual: { emoji: '🌑', name: 'Menstrual', short: 'la energía puede estar baja, escuchá tu cuerpo',
    tips: ['Entrená suave o normal según cómo te sientas: si tenés energía, dale.',
      'Priorizá hierro y proteína (la menstruación baja el hierro).',
      'Está perfecto tomar un descanso extra si lo necesitás.'] },
  folicular: { emoji: '🌒', name: 'Folicular', short: 'fuerza y energía en alza, ¡mejor momento para subir peso!',
    tips: ['Tu mejor ventana para empujar peso e intentar récords personales.',
      'Aprovechá para marcar 🟢 fácil y que la app te suba la carga.',
      'Recuperás más rápido: podés meterle intensidad.'] },
  ovulacion: { emoji: '🌕', name: 'Ovulación', short: 'pico de fuerza; cuidá la técnica en cargas altas',
    tips: ['Pico de fuerza: buen día para cargas pesadas.',
      'Calentá bien: hay más laxitud articular, cuidá rodillas y hombros.',
      'Técnica impecable antes que ego.'] },
  lutea: { emoji: '🌘', name: 'Lútea', short: 'puede haber más fatiga o hinchazón; volumen moderado',
    tips: ['Volumen moderado y algo más de descanso entre series.',
      'Antojos e hinchazón son normales: mantené la proteína, el magnesio puede ayudar.',
      'No te frustres si baja el rendimiento, es parte del ciclo.'] },
};

function currentPhase() {
  const c = state.cycle;
  if (!c || !c.start) return null;
  const ms = 86400000;
  const start = new Date(c.start + 'T00:00:00');
  const today = new Date(todayStr() + 'T00:00:00');
  let diff = Math.floor((today - start) / ms);
  if (diff < 0) return null;
  const len = c.len || 28, per = c.per || 5;
  const day = (diff % len) + 1;
  const ovu = len - 14;
  let key;
  if (day <= per) key = 'menstrual';
  else if (day < ovu - 1) key = 'folicular';
  else if (day <= ovu + 1) key = 'ovulacion';
  else key = 'lutea';
  const next = new Date(start.getTime());
  const cyclesPassed = Math.floor(diff / len) + 1;
  next.setDate(next.getDate() + cyclesPassed * len);
  return Object.assign({ key, day, len, next: next.toISOString().slice(0, 10) }, PHASES[key]);
}

function loadCycleForm() {
  const c = state.cycle;
  if (!c) return;
  $('#cStart').value = c.start || '';
  $('#cLen').value = c.len || 28;
  $('#cPer').value = c.per || 5;
}
function saveCycle() {
  const start = $('#cStart').value;
  if (!start) { toast('Elegí la fecha de tu última regla 🙂'); return; }
  state.cycle = { start, len: parseInt($('#cLen').value) || 28, per: parseInt($('#cPer').value) || 5 };
  save();
  renderCycle();
  renderInsight();
  toast('Ciclo guardado 🌙');
}
function renderCycle() {
  const ph = currentPhase();
  if (!ph) { $('#cycleResult').classList.add('hidden'); return; }
  $('#phaseBadge').innerHTML = `${ph.emoji} Fase <strong>${ph.name}</strong> · día ${ph.day} de ${ph.len}`;
  $('#cycleDetail').innerHTML = `
    <ul class="health-list">
      ${ph.tips.map(t => `<li>• ${t}</li>`).join('')}
      <li>📅 Próxima regla estimada: <strong>${ph.next}</strong> (aproximado).</li>
    </ul>`;
  $('#cycleResult').classList.remove('hidden');
}

/* ============================================================
   OURA — readiness, sueño y pasos
   ============================================================ */
async function ouraGet(path) {
  const o = state.oura || {};
  let base = 'https://api.ouraring.com';
  if (o.proxy && o.proxy.replace(/\s+/g, '')) {
    base = o.proxy.replace(/\s+/g, '').replace(/\/$/, '');
    if (!/^https?:\/\//i.test(base)) base = 'https://' + base;
  }
  const token = (o.token || '').replace(/\s+/g, ''); // saca espacios/saltos invisibles
  const url = base + path;
  try { new URL(url); } catch { throw new Error('URL de proxy inválida'); }
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
function daysAgo(n) { const d = new Date(todayStr() + 'T00:00:00'); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

async function fetchOura() {
  if (!state.oura || !state.oura.token) return;
  $('#ouraMsg').textContent = 'Cargando…';
  try {
    const q = `?start_date=${daysAgo(6)}&end_date=${todayStr()}`;
    const [rd, sl, ac] = await Promise.all([
      ouraGet('/v2/usercollection/daily_readiness' + q),
      ouraGet('/v2/usercollection/daily_sleep' + q),
      ouraGet('/v2/usercollection/daily_activity' + q),
    ]);
    const last = a => (a && a.data && a.data.length) ? a.data[a.data.length - 1] : null;
    const r = last(rd), s = last(sl), a = last(ac);
    state.oura.data = {
      readiness: r ? r.score : null,
      sleep: s ? s.score : null,
      steps: a ? a.steps : null,
      date: (r || s || a) ? (r || s || a).day : todayStr(),
    };
    save();
    renderOura();
    renderInsight();
    toast('Oura actualizada ✅');
  } catch (e) {
    renderOura(e);
  }
}

function renderOura(err) {
  const o = state.oura;
  const connected = o && o.token;
  $('#ouraConnected').classList.toggle('hidden', !connected);
  $('#ouraSetup').classList.toggle('hidden', !!connected);
  if (!connected) return;
  const d = o.data || {};
  $('#oReady').textContent = d.readiness != null ? d.readiness : '–';
  $('#oSleep').textContent = d.sleep != null ? d.sleep : '–';
  $('#oSteps').textContent = d.steps != null ? d.steps.toLocaleString('es') : '–';
  if (err) {
    const m = (err && err.message) || 'error de red';
    if (/40[13]/.test(m)) {
      $('#ouraMsg').innerHTML = '⚠️ Token inválido o vencido. Regeneralo en Oura (cloud.ouraring.com) y volvé a pegarlo. (' + m + ')';
    } else if (/Failed to fetch|NetworkError|Load failed/i.test(m)) {
      $('#ouraMsg').innerHTML = '⚠️ No llegó al servidor. Revisá la URL del proxy en "¿Da error al conectar?" (debe empezar con https:// y terminar en .workers.dev).';
    } else if (/did not match|pattern|inválida/i.test(m)) {
      $('#ouraMsg').innerHTML = '⚠️ El token o el proxy tienen un carácter raro (un espacio o salto de línea al copiar). Borralos, volvé a pegarlos y reconectá.';
    } else {
      $('#ouraMsg').innerHTML = '⚠️ No pude conectar: ' + m + '. Revisá el token y el proxy.';
    }
  } else if (d.date) {
    $('#ouraMsg').textContent = `Datos del ${d.date}.`;
  }
}
function connectOura() {
  const token = $('#ouraToken').value.replace(/\s+/g, '');
  if (!token) { toast('Pegá tu token de Oura'); return; }
  const proxy = $('#ouraProxy') ? $('#ouraProxy').value.replace(/\s+/g, '') : '';
  state.oura = { token, proxy, data: null };
  save();
  renderOura();
  fetchOura();
}
function forgetOura() {
  state.oura = null;
  save();
  $('#ouraToken').value = '';
  renderOura();
  renderInsight();
  toast('Oura desconectada');
}

/* ============================================================
   BANNER DE INSIGHT (rutina) — ciclo + Oura
   ============================================================ */
function renderInsight() {
  const el = $('#insightBanner');
  if (!el) return;
  const parts = [];
  const adj = dailyAdjust();
  adj.parts.forEach(p => parts.push(`<strong>${p.tag}</strong>: ${p.note}`));
  if (adj.d < 0) parts.push(`📉 Hoy ajustamos: <strong>${adj.d} serie${adj.d === -1 ? '' : 's'}</strong> por ejercicio y más descanso.`);
  const o = state.oura && state.oura.data;
  if (o && o.steps != null) parts.push(`👟 ${o.steps.toLocaleString('es')} pasos hoy`);
  if (!parts.length) { el.classList.add('hidden'); return; }
  el.innerHTML = parts.map(p => `<div>${p}</div>`).join('');
  el.classList.remove('hidden');
}

function renderSalud() {
  loadProfileForm();
  loadCycleForm();
  renderCycle();
  renderOura();
  renderWater();
}

/* ============================================================
   COMIDA — porciones (sistema de tu plan) + tabla de gramajes
   ============================================================ */
// Metas de porciones por día (según tu plan: suma de desayuno+comida+cena)
const PGROUPS = [
  { k: 'verduras', label: '🥬 Verduras', goal: 5 },
  { k: 'frutas', label: '🍎 Frutas', goal: 1 },
  { k: 'cereales', label: '🌾 Cereales / tubérculos / leguminosas', goal: 8 },
  { k: 'proteina', label: '🍗 Proteína', goal: 12 },
  { k: 'grasa', label: '🥑 Grasa y/o semillas', goal: 6 },
];

// Equivalencias: 1 porción = ... (de tu tabla naranja)
const EQUIV = [
  { g: '🥬 Verduras', items: [['Verdura de hoja verde', '2 tazas'], ['Verdura de colores cruda', '1 taza (asada: la mitad)']], note: 'Papa, camote y elote NO cuentan como verdura.' },
  { g: '🍎 Frutas', items: [['Agua de coco', '1½ taza'], ['Blueberries', '1 taza'], ['Cereza', '20 piezas'], ['Dátil medjool', '2 piezas chicas'], ['Durazno', '2 piezas'], ['Frambuesa', '1 taza'], ['Fresa', '17 piezas o 1 taza'], ['Guayaba', '3 piezas'], ['Higo', '2 piezas'], ['Kiwi', '1 pieza'], ['Lima', '3 piezas'], ['Mandarina', '2 piezas'], ['Mango', '½ pieza'], ['Manzana', '1 pieza'], ['Melón', '1 taza'], ['Naranja', '2 piezas'], ['Papaya', '1 taza picada'], ['Pera', '½ pieza'], ['Piña', '1 taza picada'], ['Plátano', '½ pieza'], ['Sandía', '1 taza picada'], ['Toronja', '1 pieza'], ['Uvas', '18 uvas']] },
  { g: '🌾 Cereales / tubérculos / leguminosas', items: [['Arroz blanco cocido', '¼ taza'], ['Arroz integral cocido', '⅓ taza o 70 g'], ['Quinoa cocida', '⅓ taza o 80 g'], ['Avena cocida', '½ taza'], ['Avena en hojuelas', '½ taza'], ['Bagel integral', '½ pieza chica'], ['Bolillo', '½ pieza sin migajón'], ['Camote cocido', '½ camote chico o 70 g'], ['Elote amarillo', '1½ pieza'], ['Elote enlatado', '½ taza'], ['Galletas de arroz', '2 piezas'], ['Harina de avena', '2 cdas'], ['Galletas maría', '5 piezas'], ['Pan árabe integral', '½ pieza chica'], ['Pan integral', '1 rebanada'], ['Pan thins', '1 pieza'], ['Pan de hamburguesa chico', '½ pieza'], ['Papa cocida', '½ pieza'], ['Pasta integral cocida', '⅓ taza o 45 g'], ['Salmas', '1 paquete'], ['Tortilla de maíz', '1 tortilla'], ['Tortilla de nopal', '3 tortillas'], ['Totopos de maíz horneados', '15 totopos o 22 g']] },
  { g: '🍗 Proteína', items: [['Res / pollo / cerdo / pescado', '1 palma o 30 g'], ['Atún en lata', '⅓ de lata (1 lata = 3 porciones)'], ['Carne molida magra', '30 g'], ['Cecina de res', '50 g'], ['Pollo deshebrado', '¼ taza'], ['Proteína en polvo', '⅓ scoop (1 scoop = 3 porciones)'], ['Jamón de pavo', '2 rebanadas'], ['Salmón', '30 g o 1 palma'], ['Huevo', '1 pieza'], ['Sardinas en aceite', '3 piezas'], ['Queso mozzarella fresco', '35 g o 1 reb gruesa'], ['Queso de cabra', '35 g o 2 reb delgadas'], ['Queso feta', '40 g o 2 cdas']] },
  { g: '🥛 Lácteos', items: [['Kefir', '½ taza'], ['Jocoque', '5 cdas'], ['Yogurt griego sin azúcar', '½ taza o 100 g'], ['Queso cottage', '30 g'], ['Requesón o jocoque', '3 cdas (60 g)'], ['Queso de cabra', '2 cdas'], ['Gouda / chihuahua / manchego', '30 g'], ['Queso panela', '40 g (1 reb)']] },
  { g: '🥑 Grasas', items: [['Aceite (oliva, aguacate, coco…)', '1 cdita o 5 g'], ['Aguacate', '⅓ pieza'], ['Aceituna', '5 piezas'], ['Almendra', '10 piezas'], ['Cacahuate', '14 piezas'], ['Nuez de la india', '7 piezas'], ['Pistache', '18 piezas'], ['Crema de cacahuate', '1 cda o 10 g'], ['Harina de almendra', '2 cdas o 11 g'], ['Mantequilla o ghee', '1½ cdita'], ['Mayonesa', '1 cdita'], ['Mayonesa de aguacate', '½ cda'], ['Bebida de almendra sin azúcar', '2 tazas'], ['Bebida de coco sin azúcar', '1 taza']] },
];

function todayPortions() { const t = todayStr(); if (!state.portions[t]) state.portions[t] = {}; return state.portions[t]; }
function setPortion(k, delta) { const p = todayPortions(); p[k] = Math.max(0, (p[k] || 0) + delta); save(); renderPortions(); }

function renderPortions() {
  const p = todayPortions();
  $('#portionTracker').innerHTML = PGROUPS.map(g => {
    const n = p[g.k] || 0, pct = Math.min(100, n / g.goal * 100), done = n >= g.goal;
    return `<div class="portion">
      <div class="portion-top"><span>${g.label}</span><span class="${done ? 'done' : ''}">${n} / ${g.goal}</span></div>
      <div class="portion-row">
        <button class="w-btn" data-k="${g.k}" data-d="-1">−</button>
        <div class="macro-track"><div class="macro-fill ${done ? 'done' : ''}" style="width:${pct}%"></div></div>
        <button class="w-btn" data-k="${g.k}" data-d="1">+</button>
      </div>
    </div>`;
  }).join('');
  $$('#portionTracker .w-btn').forEach(b => b.onclick = () => setPortion(b.dataset.k, +b.dataset.d));
}

function renderEquiv() {
  const q = ($('#equivSearch').value || '').toLowerCase().trim();
  let html = '';
  EQUIV.forEach(sec => {
    const items = sec.items.filter(it => !q || it[0].toLowerCase().includes(q));
    if (!items.length) return;
    html += `<div class="equiv-sec"><h4>${sec.g}</h4>`;
    html += items.map(it => `<div class="equiv-row"><span>${it[0]}</span><span class="equiv-q">${it[1]}</span></div>`).join('');
    if (sec.note && !q) html += `<p class="muted equiv-note">💡 ${sec.note}</p>`;
    html += '</div>';
  });
  $('#equivList').innerHTML = html || '<p class="muted">Sin resultados.</p>';
}

/* ============================================================
   VITAMINAS / SUPLEMENTOS — check diario
   ============================================================ */
function addSupp() {
  const name = $('#suppInput').value.trim();
  if (!name) return;
  if (!state.supps.includes(name)) state.supps.push(name);
  $('#suppInput').value = '';
  save(); renderSupps();
}
function delSupp(name) {
  state.supps = state.supps.filter(s => s !== name);
  save(); renderSupps();
}
function toggleSupp(name) {
  const t = todayStr();
  if (!state.suppLog[t]) state.suppLog[t] = {};
  state.suppLog[t][name] = !state.suppLog[t][name];
  save(); renderSupps();
}
function renderSupps() {
  const t = state.suppLog[todayStr()] || {};
  $('#suppList').innerHTML = state.supps.length
    ? state.supps.map(s => `<div class="supp-row ${t[s] ? 'on' : ''}">
        <button class="supp-check" data-s="${s.replace(/"/g, '&quot;')}">${t[s] ? '✓' : ''}</button>
        <span class="supp-name">${s}</span>
        <button class="supp-del" data-d="${s.replace(/"/g, '&quot;')}">🗑️</button>
      </div>`).join('')
    : '<p class="muted">Agregá tus vitaminas/suplementos y marcalos cada día.</p>';
  $$('.supp-check').forEach(b => b.onclick = () => toggleSupp(b.dataset.s));
  $$('.supp-del').forEach(b => b.onclick = () => delSupp(b.dataset.d));
}

function renderComida() { renderPortions(); renderEquiv(); renderSupps(); }

/* ============================================================
   OTRAS ACTIVIDADES — pilates, flow, pádel…
   ============================================================ */
function addActivity() {
  const type = $('#actType').value;
  const min = parseInt($('#actMin').value) || 0;
  state.activities.unshift({ date: todayStr(), type, min });
  state.activities = state.activities.slice(0, 100);
  save();
  $('#actMin').value = '';
  renderProgress();
  toast('¡Actividad registrada! 🤸');
}

/* ============================================================
   AJUSTES / datos
   ============================================================ */
function applySettings() {
  document.body.classList.toggle('light', !state.settings.dark);
  $('#darkToggle').checked = state.settings.dark;
  $('#soundToggle').checked = state.settings.sound;
  $('#animToggle').checked = state.settings.anim;
  $('#rotateToggle').checked = state.settings.autoRotate;
  $('#ouraAdaptToggle').checked = state.settings.ouraAdapt;
  $('#cycleAdaptToggle').checked = state.settings.cycleAdapt;
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
  ['routine', 'comida', 'salud', 'progress', 'settings'].forEach(v =>
    $('#view-' + v).classList.toggle('hidden', v !== name));
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'progress') renderProgress();
  if (name === 'salud') renderSalud();
  if (name === 'comida') renderComida();
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

  // salud · perfil
  $('#pSave').onclick = saveProfile;

  // agua
  $('#waterPlus').onclick = () => setWater(1);
  $('#waterMinus').onclick = () => setWater(-1);
  $('#waterGoalInput').onchange = e => {
    let g = parseInt(e.target.value) || 8; g = Math.max(1, Math.min(20, g));
    state.waterGoal = g; save(); renderWater();
  };

  // ciclo
  $('#cSave').onclick = saveCycle;

  // oura
  $('#ouraConnect').onclick = connectOura;
  $('#ouraRefresh').onclick = fetchOura;
  $('#ouraForget').onclick = forgetOura;
  $('#bwSave2').onclick = () => {
    const val = parseFloat($('#bwInput2').value);
    if (!val || val <= 0) { toast('Ingresá un peso válido'); return; }
    let kg = $('#bwUnit2').value === 'lb' ? +(val / 2.20462).toFixed(1) : val;
    state.bodyweight = state.bodyweight.filter(b => b.date !== todayStr());
    state.bodyweight.push({ date: todayStr(), kg });
    state.bodyweight.sort((a, b) => a.date.localeCompare(b.date));
    save();
    $('#bwInput2').value = '';
    toast('Peso guardado ⚖️');
  };

  // ajustes
  $('#darkToggle').onchange = e => { state.settings.dark = e.target.checked; save(); applySettings(); };
  $('#soundToggle').onchange = e => { state.settings.sound = e.target.checked; save(); };
  $('#animToggle').onchange = e => { state.settings.anim = e.target.checked; save(); renderDay(); };
  $('#rotateToggle').onchange = e => { state.settings.autoRotate = e.target.checked; save(); renderDay(); };
  $('#ouraAdaptToggle').onchange = e => { state.settings.ouraAdapt = e.target.checked; save(); renderDay(); };
  $('#cycleAdaptToggle').onchange = e => { state.settings.cycleAdapt = e.target.checked; save(); renderDay(); };

  // comida
  $('#equivSearch').oninput = renderEquiv;
  $('#suppAdd').onclick = addSupp;
  $('#suppInput').onkeydown = e => { if (e.key === 'Enter') addSupp(); };

  // otras actividades
  $('#actAdd').onclick = addActivity;
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

  renderInsight();
  // Si Oura está conectada, refresca en segundo plano
  if (state.oura && state.oura.token) fetchOura();

  // Service worker (funciona offline)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
