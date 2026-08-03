/* ============================================================
   SuperCasa — lógica principal
   Recetas (fotos + links) → menú semanal → lista del súper
   ============================================================ */
'use strict';

const STORE_KEY = 'supercasa_v1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- Estado ---------- */
const defaultState = () => ({
  recipes: [],      // {id, name, emoji, servings, time, tags[], photos[], link, notes, ingredients[], fav, createdAt}
  plan: {},         // { 'YYYY-MM-DD (lunes)': [ {id, recipeId, day, people} ] }
  pantry: [],       // [ {id, name, qty, unit} ]
  extras: {},       // { weekKey: [ {id, name, qty, unit, aisle} ] }
  checked: {},      // { weekKey: { itemKey: true } }
  settings: {
    dark: true,
    people: 2,
    reminder: true,
    reminderHour: 10,
    lastReminder: null,   // 'YYYY-MM-DD' del último aviso mostrado
  },
});

let state = load();
let view = 'recetas';
let weekOffset = 0;        // 0 = esta semana, 1 = la próxima
let recipeSearch = '';
let activeTag = '';
let photoTarget = null;    // callback para el <input type=file>

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    const d = Object.assign(defaultState(), JSON.parse(raw));
    d.settings = Object.assign(defaultState().settings, d.settings || {});
    d.recipes = (d.recipes || []).map(normalizeRecipe);
    return d;
  } catch { return defaultState(); }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch { showStorageWarn(); }
}
function showStorageWarn() { const el = $('#storageWarn'); if (el) el.classList.remove('hidden'); }
function storageOK() {
  try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true; }
  catch { return false; }
}

function normalizeRecipe(r) {
  return {
    id: r.id || uid('rc'),
    name: r.name || 'Sin nombre',
    emoji: r.emoji || '🍽️',
    servings: Number(r.servings) > 0 ? Number(r.servings) : 2,
    time: r.time || '',
    tags: Array.isArray(r.tags) ? r.tags : [],
    photos: Array.isArray(r.photos) ? r.photos : [],
    link: r.link || '',
    notes: r.notes || '',
    fav: !!r.fav,
    createdAt: r.createdAt || Date.now(),
    ingredients: (r.ingredients || []).map(i => ({
      name: i.name || '',
      qty: (i.qty === null || i.qty === '' || i.qty === undefined) ? null : Number(i.qty),
      unit: i.unit || '',
      aisle: i.aisle || guessAisle(i.name || ''),
    })),
  };
}

const uid = p => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => (s == null ? '' : String(s)).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Fechas ---------- */
function localDate(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
const todayStr = () => localDate(new Date());
/* Lunes de la semana de `date`, corrido `offset` semanas */
function mondayOf(date, offset = 0) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay();              // 0 = domingo
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff + offset * 7);
  return d;
}
const weekKey = (offset = weekOffset) => localDate(mondayOf(new Date(), offset));
function weekRangeLabel(offset) {
  const mon = mondayOf(new Date(), offset);
  const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
  const f = d => d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  return `${f(mon)} – ${f(sun)}`;
}
/* Fecha real de un día (id 0..6) dentro de la semana mostrada */
function dateOfDay(dayId, offset = weekOffset) {
  const mon = mondayOf(new Date(), offset);
  const idx = dayId === 0 ? 6 : dayId - 1;   // lunes = 0 … domingo = 6
  const d = new Date(mon); d.setDate(d.getDate() + idx);
  return d;
}

/* ---------- Toast ---------- */
let toastTimer = null;
function toast(msg) {
  let el = $('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2400);
}

/* ============================================================
   Cantidades y unidades
   ============================================================ */
function toBase(qty, unitId) {
  const u = unitById(unitId);
  return { qty: qty === null ? null : qty * u.factor, base: u.base };
}
/* Devuelve texto lindo: 1500 g → "1.5 kg", 2.0 pza → "2 pza" */
function formatQty(qty, base) {
  if (qty === null || qty === undefined) return 'al gusto';
  let n = qty, unit = base;
  if (base === 'g' && n >= 1000) { n = n / 1000; unit = 'kg'; }
  else if (base === 'ml' && n >= 1000) { n = n / 1000; unit = 'l'; }
  else if (base === 'pza') { n = Math.ceil(n - 0.001); }
  const r = Math.round(n * 100) / 100;
  const txt = String(r).replace(/\.0+$/, '');
  const labels = { pza: 'pza', taza: 'taza(s)', cda: 'cda', cdta: 'cdta', manojo: 'manojo(s)', lata: 'lata(s)', paq: 'paquete(s)' };
  return unit ? `${txt} ${labels[unit] || unit}` : txt;
}
/* ¿El nombre del refri corresponde al ingrediente? (coincidencia por palabras) */
function nameMatches(a, b) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const wrap = s => ' ' + s + ' ';
  return wrap(x).includes(wrap(y)) || wrap(y).includes(wrap(x));
}

/* ============================================================
   Lista del súper
   ============================================================ */
function buildShoppingList(offset = weekOffset) {
  const wk = weekKey(offset);
  const items = state.plan[wk] || [];
  const acc = new Map();   // key -> {name, base, qty, aisle, from:Set}

  items.forEach(it => {
    const r = state.recipes.find(x => x.id === it.recipeId);
    if (!r) return;
    const people = Number(it.people) > 0 ? Number(it.people) : state.settings.people;
    const factor = people / (r.servings || 1);
    r.ingredients.forEach(ing => {
      if (!ing.name) return;
      const { qty, base } = toBase(ing.qty, ing.unit);
      const key = norm(ing.name) + '|' + base;
      let e = acc.get(key);
      if (!e) {
        e = { name: ing.name, base, qty: qty === null ? null : 0, aisle: ing.aisle || guessAisle(ing.name), from: new Set() };
        acc.set(key, e);
      }
      if (qty !== null) e.qty = (e.qty === null ? 0 : e.qty) + qty * factor;
      e.from.add(r.name);
    });
  });

  // Restar lo que ya hay en el refri
  const have = [];
  state.pantry.forEach(p => {
    const pb = toBase(p.qty === null || p.qty === '' ? null : Number(p.qty), p.unit);
    acc.forEach((e, key) => {
      if (!nameMatches(e.name, p.name)) return;
      if (pb.qty === null || e.qty === null) {           // "ya tengo", sin cantidad
        have.push(e.name); acc.delete(key); return;
      }
      if (pb.base !== e.base) { e.haveOther = p.name; return; }  // unidades distintas: no restamos a ciegas
      e.qty -= pb.qty;
      if (e.qty <= 0.0001) { have.push(e.name); acc.delete(key); }
      else e.reduced = true;
    });
  });

  // Extras manuales
  (state.extras[wk] || []).forEach(x => {
    const { qty, base } = toBase(x.qty === null || x.qty === '' ? null : Number(x.qty), x.unit);
    const key = norm(x.name) + '|' + base;
    const e = acc.get(key);
    if (e && qty !== null && e.qty !== null) e.qty += qty;
    else if (!e) acc.set(key, { name: x.name, base, qty, aisle: x.aisle || guessAisle(x.name), from: new Set(['Extra']), extra: true });
  });

  // Agrupar por pasillo
  const groups = AISLES.map(a => ({ ...a, items: [] }));
  acc.forEach((e, key) => {
    const g = groups.find(x => x.id === e.aisle) || groups[groups.length - 1];
    g.items.push({ ...e, key, from: [...e.from] });
  });
  groups.forEach(g => g.items.sort((a, b) => a.name.localeCompare(b.name, 'es')));
  return { groups: groups.filter(g => g.items.length), have, wk, count: acc.size };
}

function listChecked(wk) { return state.checked[wk] || (state.checked[wk] = {}); }
function pendingCount() {
  const { groups, wk } = buildShoppingList(0);
  const ck = state.checked[wk] || {};
  let n = 0;
  groups.forEach(g => g.items.forEach(i => { if (!ck[i.key]) n++; }));
  return n;
}

/* ============================================================
   Router
   ============================================================ */
function setView(v) {
  view = v;
  ['recetas', 'semana', 'refri', 'lista', 'ajustes'].forEach(id => {
    const el = $('#view-' + id);
    if (el) el.classList.toggle('hidden', id !== v);
  });
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  $('#fab').classList.toggle('hidden', v !== 'recetas');
  window.scrollTo(0, 0);
  render();
}

function render() {
  if (view === 'recetas') renderRecipes();
  if (view === 'semana') renderWeek();
  if (view === 'refri') renderPantry();
  if (view === 'lista') renderList();
  if (view === 'ajustes') renderSettings();
  renderBadge();
}

function renderBadge() {
  const el = $('#listBadge');
  const n = pendingCount();
  el.textContent = n;
  el.classList.toggle('hidden', n === 0);
}

/* ============================================================
   Vista: RECETAS
   ============================================================ */
function allTags() {
  const set = new Set();
  state.recipes.forEach(r => r.tags.forEach(t => set.add(t)));
  return [...set].sort((a, b) => a.localeCompare(b, 'es'));
}

function filteredRecipes() {
  const q = norm(recipeSearch);
  return state.recipes
    .filter(r => !activeTag || r.tags.includes(activeTag))
    .filter(r => {
      if (!q) return true;
      if (norm(r.name).includes(q)) return true;
      return r.ingredients.some(i => norm(i.name).includes(q));
    })
    .sort((a, b) => (b.fav - a.fav) || (b.createdAt - a.createdAt));
}

function renderRecipes() {
  renderReminder();

  // chips de etiquetas
  const tags = allTags();
  $('#tagChips').innerHTML = tags.map(t =>
    `<button class="chip ${t === activeTag ? 'on' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`
  ).join('');

  const list = filteredRecipes();
  const grid = $('#recipeGrid');
  $('#recipeEmpty').classList.toggle('hidden', state.recipes.length > 0);

  if (!list.length) {
    grid.innerHTML = state.recipes.length
      ? '<p class="empty">No hay recetas con ese filtro.</p>'
      : '';
    return;
  }

  grid.innerHTML = list.map(r => {
    const kind = r.link ? linkKind(r.link) : null;
    const thumbId = r.photos[0] || '';
    const yt = !thumbId && r.link ? youtubeThumb(r.link) : null;
    const inner = thumbId
      ? `<img data-photo="${esc(thumbId)}" alt="">`
      : yt ? `<img src="${esc(yt)}" alt="" onerror="this.remove()">`
        : `<span>${esc(r.emoji)}</span>`;
    return `<button class="recipe-card" data-recipe="${r.id}">
      <div class="rc-thumb">${inner}
        ${r.fav ? '<span class="rc-fav">⭐</span>' : ''}
        ${kind ? `<span class="rc-badge">${kind.emoji}</span>` : ''}
      </div>
      <div class="rc-body">
        <span class="rc-name">${esc(r.name)}</span>
        <span class="rc-meta">${r.servings} porc.${r.time ? ' · ' + esc(r.time) : ''} · ${r.ingredients.length} ingr.</span>
      </div>
    </button>`;
  }).join('');

  hydratePhotos(grid);
}

/* Reemplaza los <img data-photo> por la foto guardada en IndexedDB */
function hydratePhotos(root) {
  $$('img[data-photo]', root).forEach(async img => {
    const id = img.dataset.photo;
    img.removeAttribute('data-photo');
    const url = await PhotoDB.url(id);
    if (url) img.src = url; else img.remove();
  });
}

function renderReminder() {
  const box = $('#reminderBanner');
  const s = state.settings;
  const isThursday = new Date().getDay() === 4;
  const show = s.reminder && isThursday && new Date().getHours() >= (s.reminderHour ?? 10) && s.lastReminder !== todayStr();
  box.classList.toggle('hidden', !show);
  if (!show) return;
  box.innerHTML = `
    <p>🥬 <strong>Es jueves</strong> — día del súper orgánico.
    Armá el menú de la semana y la lista te queda lista para mañana.</p>
    <div class="btn-row">
      <button class="btn-primary" id="remGo">Armar el menú</button>
      <button class="btn-ghost" id="remDismiss">Hoy no</button>
    </div>`;
  $('#remGo').onclick = () => { s.lastReminder = todayStr(); save(); weekOffset = 1; setWeekButtons(); setView('semana'); };
  $('#remDismiss').onclick = () => { s.lastReminder = todayStr(); save(); render(); };
}

/* ---------- Editor de receta ---------- */
let draft = null;

function newRecipe() {
  draft = normalizeRecipe({ name: '', servings: state.settings.people, ingredients: [{ name: '', qty: null, unit: '' }] });
  draft.isNew = true;
  openRecipeEditor();
}
function editRecipe(id) {
  const r = state.recipes.find(x => x.id === id);
  if (!r) return;
  draft = JSON.parse(JSON.stringify(r));
  draft.isNew = false;
  openRecipeEditor();
}

function unitOptions(sel) {
  return UNITS.map(u => `<option value="${u.id}" ${u.id === (sel || '') ? 'selected' : ''}>${u.label}</option>`).join('');
}

function openRecipeEditor() {
  openModal(draft.isNew ? '➕ Nueva receta' : '✏️ Editar receta', recipeEditorHTML(), mountRecipeEditor);
}

function recipeEditorHTML() {
  return `
    <div class="btn-row" style="margin-top:0;">
      <button class="btn-ghost" id="edTakePhoto">📷 Tomar foto</button>
      <button class="btn-ghost" id="edPickPhoto">🖼️ De la galería</button>
    </div>
    <div class="photo-strip" id="edPhotos"></div>

    <div class="field" style="margin-top:12px;">
      <label for="edLink">🔗 Link (TikTok, Instagram, YouTube…)</label>
      <input type="url" id="edLink" placeholder="https://…" value="${esc(draft.link)}">
    </div>

    <div class="field-row">
      <div class="field" style="flex:2;">
        <label for="edName">Nombre</label>
        <input type="text" id="edName" placeholder="Bowl de pollo" value="${esc(draft.name)}">
      </div>
      <div class="field" style="max-width:80px;">
        <label for="edEmoji">Emoji</label>
        <input type="text" id="edEmoji" maxlength="4" value="${esc(draft.emoji)}">
      </div>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="edServings">Rinde (porciones)</label>
        <input type="number" id="edServings" min="1" max="30" step="1" value="${draft.servings}">
      </div>
      <div class="field">
        <label for="edTime">Tiempo</label>
        <input type="text" id="edTime" placeholder="30 min" value="${esc(draft.time)}">
      </div>
    </div>

    <div class="field">
      <label for="edTags">Etiquetas (separadas por coma)</label>
      <input type="text" id="edTags" placeholder="cena, rápido, sano" value="${esc(draft.tags.join(', '))}">
    </div>

    <h3 style="margin:6px 0 10px;">🥕 Ingredientes <span class="muted">(para ${draft.servings} porciones)</span></h3>
    <div id="edIngs"></div>
    <div class="btn-row">
      <button class="btn-ghost sm" id="edAddIng">+ Ingrediente</button>
      <button class="btn-ghost sm" id="edPasteIng">📋 Pegar lista</button>
    </div>

    <div class="field" style="margin-top:12px;">
      <label for="edNotes">Preparación / notas</label>
      <textarea id="edNotes" placeholder="Pasos, tips, de dónde salió…">${esc(draft.notes)}</textarea>
    </div>

    <div class="row-toggle">
      <span>⭐ Favorita</span>
      <input type="checkbox" id="edFav" ${draft.fav ? 'checked' : ''}>
    </div>

    <button class="btn-primary big" id="edSave" style="margin-top:14px;">💾 Guardar receta</button>
    ${draft.isNew ? '' : '<button class="btn-danger" id="edDelete">🗑️ Borrar receta</button>'}
  `;
}

function renderIngRows() {
  $('#edIngs').innerHTML = draft.ingredients.map((i, idx) => `
    <div class="ing-edit" data-idx="${idx}">
      <input type="text" class="ing-i-name" placeholder="Ingrediente" value="${esc(i.name)}">
      <input type="number" class="ing-i-qty" placeholder="cant." step="any" min="0" inputmode="decimal" value="${i.qty === null ? '' : i.qty}">
      <select class="ing-i-unit">${unitOptions(i.unit)}</select>
      <button class="ing-del" data-del="${idx}" aria-label="Quitar">✕</button>
    </div>`).join('');
}

/* Lee lo que hay escrito en el editor y lo vuelca al draft */
function readEditor() {
  if (!$('#edName')) return;
  draft.name = $('#edName').value.trim();
  draft.emoji = $('#edEmoji').value.trim() || '🍽️';
  draft.servings = Math.max(1, Number($('#edServings').value) || 1);
  draft.time = $('#edTime').value.trim();
  draft.link = $('#edLink').value.trim();
  draft.notes = $('#edNotes').value;
  draft.fav = $('#edFav').checked;
  draft.tags = $('#edTags').value.split(',').map(t => t.trim()).filter(Boolean);
  draft.ingredients = $$('.ing-edit').map(row => {
    const name = $('.ing-i-name', row).value.trim();
    const qv = $('.ing-i-qty', row).value;
    const unit = $('.ing-i-unit', row).value;
    return { name, qty: qv === '' ? null : Number(qv), unit, aisle: guessAisle(name) };
  });
}

function mountRecipeEditor() {
  renderIngRows();
  renderEditorPhotos();

  $('#edTakePhoto').onclick = () => { photoTarget = addPhotoToDraft; $('#photoInput').click(); };
  $('#edPickPhoto').onclick = () => { photoTarget = addPhotoToDraft; $('#photoLibInput').click(); };

  $('#edAddIng').onclick = () => {
    readEditor();
    draft.ingredients.push({ name: '', qty: null, unit: '', aisle: 'otros' });
    renderIngRows();
    const rows = $$('.ing-edit');
    const last = rows[rows.length - 1];
    if (last) $('.ing-i-name', last).focus();
  };

  $('#edIngs').addEventListener('click', e => {
    const btn = e.target.closest('[data-del]');
    if (!btn) return;
    readEditor();
    draft.ingredients.splice(Number(btn.dataset.del), 1);
    if (!draft.ingredients.length) draft.ingredients.push({ name: '', qty: null, unit: '', aisle: 'otros' });
    renderIngRows();
  });

  $('#edPasteIng').onclick = () => { readEditor(); openPasteIngredients(); };

  $('#edSave').onclick = () => {
    readEditor();
    if (!draft.name) { toast('Ponele un nombre a la receta'); $('#edName').focus(); return; }
    draft.ingredients = draft.ingredients.filter(i => i.name);
    const clean = normalizeRecipe(draft);
    const i = state.recipes.findIndex(x => x.id === clean.id);
    if (i >= 0) state.recipes[i] = clean; else state.recipes.push(clean);
    save();
    closeModal();
    toast('Receta guardada ✅');
    render();
  };

  const del = $('#edDelete');
  if (del) del.onclick = async () => {
    if (!confirm('¿Borrar esta receta? No se puede deshacer.')) return;
    for (const p of draft.photos) { PhotoDB.forget(p); await PhotoDB.del(p); }
    state.recipes = state.recipes.filter(x => x.id !== draft.id);
    Object.keys(state.plan).forEach(k => { state.plan[k] = state.plan[k].filter(it => it.recipeId !== draft.id); });
    save();
    closeModal();
    toast('Receta borrada');
    render();
  };
}

async function renderEditorPhotos() {
  const strip = $('#edPhotos');
  if (!strip) return;
  if (!draft.photos.length) { strip.innerHTML = '<p class="muted">Sin fotos todavía. Sacale una foto a la receta del libro, del cuaderno o del plato.</p>'; return; }
  strip.innerHTML = draft.photos.map(id =>
    `<div class="photo-wrap"><img data-photo="${esc(id)}" alt=""><button class="photo-del" data-photo-del="${esc(id)}" aria-label="Quitar foto">✕</button></div>`
  ).join('');
  hydratePhotos(strip);
  strip.onclick = async e => {
    const btn = e.target.closest('[data-photo-del]');
    if (!btn) return;
    const id = btn.dataset.photoDel;
    readEditor();
    draft.photos = draft.photos.filter(p => p !== id);
    PhotoDB.forget(id); await PhotoDB.del(id);
    renderEditorPhotos();
  };
}

async function addPhotoToDraft(files) {
  readEditor();
  for (const f of files) {
    try {
      const blob = await compressImage(f);
      const id = await PhotoDB.put(blob);
      draft.photos.push(id);
    } catch { toast('No se pudo guardar esa foto'); }
  }
  renderEditorPhotos();
  toast(files.length > 1 ? 'Fotos agregadas 📷' : 'Foto agregada 📷');
}

/* ---------- Pegar lista de ingredientes ---------- */
const UNIT_ALIASES = {
  g: 'g', gr: 'g', gramo: 'g', gramos: 'g',
  kg: 'kg', kilo: 'kg', kilos: 'kg', kgs: 'kg',
  ml: 'ml', mililitro: 'ml', mililitros: 'ml',
  l: 'l', lt: 'l', litro: 'l', litros: 'l',
  pza: 'pza', pz: 'pza', pieza: 'pza', piezas: 'pza', unidad: 'pza', unidades: 'pza',
  diente: 'pza', dientes: 'pza', rebanada: 'pza', rebanadas: 'pza',
  taza: 'taza', tazas: 'taza',
  cda: 'cda', cucharada: 'cda', cucharadas: 'cda', cdas: 'cda',
  cdta: 'cdta', cucharadita: 'cdta', cucharaditas: 'cdta', cdtas: 'cdta',
  manojo: 'manojo', manojos: 'manojo', ramo: 'manojo',
  lata: 'lata', latas: 'lata',
  paquete: 'paq', paquetes: 'paq', paq: 'paq',
};
const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };

function parseIngredientLine(raw) {
  let line = raw.replace(/^[\s\-•*·▪]+/, '').trim();
  if (!line) return null;
  let qty = null;

  // fracción unicode o número (admite "1 1/2" y "1,5")
  const mFrac = line.match(/^([½¼¾⅓⅔⅛])\s*/);
  const mNum = line.match(/^(\d+(?:[.,]\d+)?)(?:\s*\/\s*(\d+))?\s*([½¼¾⅓⅔⅛])?\s*/);
  if (mFrac) { qty = FRACTIONS[mFrac[1]]; line = line.slice(mFrac[0].length); }
  else if (mNum) {
    qty = Number(mNum[1].replace(',', '.'));
    if (mNum[2]) qty = qty / Number(mNum[2]);
    if (mNum[3]) qty += FRACTIONS[mNum[3]];
    line = line.slice(mNum[0].length);
  }

  // unidad
  let unit = '';
  const mUnit = line.match(/^([a-zA-ZáéíóúüñÁÉÍÓÚÜÑ.]+)\.?\s+/);
  if (mUnit) {
    const key = norm(mUnit[1]).replace(/\.$/, '');
    if (UNIT_ALIASES[key]) { unit = UNIT_ALIASES[key]; line = line.slice(mUnit[0].length); }
  }
  line = line.replace(/^de\s+/i, '').trim();
  // "2 cebollas" → 2 piezas; sin cantidad se queda en "al gusto"
  if (qty !== null && !unit) unit = 'pza';
  const name = line.replace(/\s{2,}/g, ' ');
  if (!name) return null;
  return { name: name.charAt(0).toUpperCase() + name.slice(1), qty, unit, aisle: guessAisle(name) };
}

function openPasteIngredients() {
  const prev = { title: draft.isNew ? '➕ Nueva receta' : '✏️ Editar receta' };
  openModal('📋 Pegar ingredientes', `
    <p class="muted">Pegá la lista tal cual la copiaste (de TikTok, de una web o de tus notas). Un ingrediente por línea.</p>
    <div class="field" style="margin-top:12px;">
      <textarea id="pasteBox" style="min-height:180px;" placeholder="2 tazas de arroz&#10;300 g de pollo&#10;1 cebolla&#10;sal y pimienta"></textarea>
    </div>
    <button class="btn-primary big" id="pasteOk">Agregar a la receta</button>
    <button class="btn-ghost" id="pasteBack" style="width:100%; margin-top:8px;">Cancelar</button>
  `, () => {
    $('#pasteBox').focus();
    $('#pasteBack').onclick = () => openModal(prev.title, recipeEditorHTML(), mountRecipeEditor);
    $('#pasteOk').onclick = () => {
      const lines = $('#pasteBox').value.split('\n');
      const parsed = lines.map(parseIngredientLine).filter(Boolean);
      if (!parsed.length) { toast('No encontré ingredientes'); return; }
      draft.ingredients = draft.ingredients.filter(i => i.name).concat(parsed);
      openModal(prev.title, recipeEditorHTML(), mountRecipeEditor);
      toast(`${parsed.length} ingredientes agregados`);
    };
  });
}

/* ============================================================
   Vista: SEMANA
   ============================================================ */
function setWeekButtons() {
  $$('.week-switch button').forEach(b => b.classList.toggle('active', Number(b.dataset.week) === weekOffset));
}

function renderWeek() {
  setWeekButtons();
  $('#weekRange').textContent = weekRangeLabel(weekOffset);
  const wk = weekKey();
  const items = state.plan[wk] || [];
  const todayS = todayStr();

  $('#weekDays').innerHTML = DAYS.map(d => {
    const dayItems = items.filter(i => i.day === d.id);
    const dStr = localDate(dateOfDay(d.id));
    const isToday = dStr === todayS;
    return `<div class="day-block ${isToday ? 'today' : ''}">
      <div class="day-block-head">
        <h4>${d.name} <span class="muted">${new Date(dStr + 'T00:00:00').getDate()}</span></h4>
        ${isToday ? '<span class="today-tag">hoy</span>' : ''}
      </div>
      ${dayItems.map(it => {
        const r = state.recipes.find(x => x.id === it.recipeId);
        if (!r) return '';
        return `<div class="plan-item">
          <span class="plan-emoji">${esc(r.emoji)}</span>
          <div class="plan-info">
            <div class="plan-name">${esc(r.name)}</div>
            <div class="plan-sub">rinde ${r.servings} · ${it.people} ${it.people === 1 ? 'persona' : 'personas'}</div>
          </div>
          <div class="people-ctrl">
            <button class="people-btn" data-people="-1" data-item="${it.id}">−</button>
            <span class="people-num">${it.people}👤</span>
            <button class="people-btn" data-people="1" data-item="${it.id}">+</button>
          </div>
          <button class="plan-del" data-plandel="${it.id}" aria-label="Quitar">✕</button>
        </div>`;
      }).join('')}
      <button class="add-to-day" data-addday="${d.id}">+ Agregar receta</button>
    </div>`;
  }).join('');

  const box = $('#weekDays');
  box.onclick = e => {
    const add = e.target.closest('[data-addday]');
    if (add) return openRecipePicker(Number(add.dataset.addday));
    const del = e.target.closest('[data-plandel]');
    if (del) {
      state.plan[wk] = (state.plan[wk] || []).filter(i => i.id !== del.dataset.plandel);
      save(); render(); return;
    }
    const pp = e.target.closest('[data-people]');
    if (pp) {
      const it = (state.plan[wk] || []).find(i => i.id === pp.dataset.item);
      if (it) { it.people = Math.max(1, it.people + Number(pp.dataset.people)); save(); render(); }
    }
  };
}

function openRecipePicker(dayId) {
  if (!state.recipes.length) { toast('Primero agregá alguna receta'); return; }
  const html = `
    <input type="search" id="pickSearch" class="full-input" placeholder="Buscar…" style="margin-bottom:12px;">
    <div class="pick-list" id="pickList"></div>`;
  openModal(`🗓️ ${DAYS.find(d => d.id === dayId).name}`, html, () => {
    const paint = (q = '') => {
      const nq = norm(q);
      const rs = state.recipes.filter(r => !nq || norm(r.name).includes(nq));
      $('#pickList').innerHTML = rs.length ? rs.map(r => `
        <button class="pick-opt" data-pick="${r.id}">
          ${r.photos[0] ? `<img data-photo="${esc(r.photos[0])}" alt="">` : `<span class="pick-emoji">${esc(r.emoji)}</span>`}
          <div>
            <div class="pick-name">${esc(r.name)}</div>
            <div class="pick-sub">rinde ${r.servings} · ${r.ingredients.length} ingredientes</div>
          </div>
        </button>`).join('') : '<p class="empty">Nada con ese nombre.</p>';
      hydratePhotos($('#pickList'));
    };
    paint();
    $('#pickSearch').oninput = e => paint(e.target.value);
    $('#pickList').onclick = e => {
      const b = e.target.closest('[data-pick]');
      if (!b) return;
      const wk = weekKey();
      (state.plan[wk] || (state.plan[wk] = [])).push({
        id: uid('pl'), recipeId: b.dataset.pick, day: dayId, people: state.settings.people,
      });
      save(); closeModal(); render(); toast('Agregado al menú 🗓️');
    };
  });
}

/* ============================================================
   Vista: REFRI
   ============================================================ */
function renderPantry() {
  $('#pantryQuick').innerHTML = PANTRY_QUICK.map(n => {
    const on = state.pantry.some(p => nameMatches(p.name, n));
    return `<button class="chip ${on ? 'on' : ''}" data-quick="${esc(n)}">${esc(n)}</button>`;
  }).join('');

  const list = $('#pantryList');
  list.innerHTML = state.pantry.length ? state.pantry.map(p => `
    <div class="pantry-row">
      <span class="pantry-name">${esc(p.name)}</span>
      <span class="pantry-qty">${p.qty === null || p.qty === '' ? 'tengo' : formatQty(toBase(Number(p.qty), p.unit).qty, unitById(p.unit).base)}</span>
      <button class="ing-del" data-pdel="${p.id}" aria-label="Quitar">✕</button>
    </div>`).join('') : '<p class="empty">Vacío. Agregá lo que ya tenés para no comprarlo de nuevo.</p>';

  list.onclick = e => {
    const b = e.target.closest('[data-pdel]');
    if (!b) return;
    state.pantry = state.pantry.filter(p => p.id !== b.dataset.pdel);
    save(); render();
  };

  $('#pantryQuick').onclick = e => {
    const b = e.target.closest('[data-quick]');
    if (!b) return;
    const name = b.dataset.quick;
    const ex = state.pantry.find(p => nameMatches(p.name, name));
    if (ex) state.pantry = state.pantry.filter(p => p.id !== ex.id);
    else state.pantry.push({ id: uid('pt'), name, qty: null, unit: '' });
    save(); render();
  };
}

function addPantryItem() {
  const name = $('#pantryName').value.trim();
  if (!name) { toast('Escribí el ingrediente'); return; }
  const qv = $('#pantryQty').value;
  state.pantry.push({ id: uid('pt'), name, qty: qv === '' ? null : Number(qv), unit: $('#pantryUnit').value });
  $('#pantryName').value = ''; $('#pantryQty').value = '';
  save(); render();
  $('#pantryName').focus();
}

/* ============================================================
   Vista: LISTA
   ============================================================ */
function renderList() {
  setWeekButtons();
  const { groups, have, wk, count } = buildShoppingList();
  const nRecipes = (state.plan[wk] || []).length;
  $('#listSub').textContent = weekOffset === 0
    ? `Esta semana (${weekRangeLabel(0)}) · ${nRecipes} ${nRecipes === 1 ? 'comida' : 'comidas'} planeadas`
    : `Próxima semana (${weekRangeLabel(1)}) · ${nRecipes} ${nRecipes === 1 ? 'comida' : 'comidas'} planeadas`;

  const ck = listChecked(wk);
  const done = groups.reduce((n, g) => n + g.items.filter(i => ck[i.key]).length, 0);
  $('#listProgress').style.width = count ? `${Math.round(done / count * 100)}%` : '0%';
  $('#listProgressTxt').textContent = `${done} / ${count}`;

  const box = $('#listContent');
  if (!count) {
    box.innerHTML = `<div class="empty"><span class="big-emoji">🧺</span>
      No hay nada que comprar todavía.<br>Elegí recetas en <strong>🗓️ Semana</strong> y la lista se arma sola.</div>`;
    return;
  }

  box.innerHTML = groups.map(g => `
    <section class="aisle">
      <h4>${g.emoji} ${g.name} <span class="aisle-count">(${g.items.length})</span></h4>
      ${g.items.map(i => `
        <div class="buy-row ${ck[i.key] ? 'on' : ''}">
          <button class="buy-check" data-check="${esc(i.key)}">${ck[i.key] ? '✓' : ''}</button>
          <div class="buy-info">
            <div class="buy-name">${esc(i.name)}</div>
            <div class="buy-why">${i.extra ? 'agregado a mano' : esc(i.from.join(' · '))}${i.reduced ? ' · ya tenías algo' : ''}${i.haveOther ? ` · ojo: en casa tenés ${esc(i.haveOther)}` : ''}</div>
          </div>
          <span class="buy-qty">${esc(i.qty === null && i.extra ? '' : formatQty(i.qty, i.base))}</span>
        </div>`).join('')}
    </section>`).join('')
    + (have.length ? `<p class="have-note">🧊 <strong>Ya lo tenés en casa:</strong> ${esc([...new Set(have)].join(', '))}</p>` : '');

  box.onclick = e => {
    const b = e.target.closest('[data-check]');
    if (!b) return;
    const key = b.dataset.check;
    if (ck[key]) delete ck[key]; else ck[key] = true;
    save(); render();
  };
}

function addExtraItem() {
  const name = $('#extraName').value.trim();
  if (!name) { toast('Escribí qué querés agregar'); return; }
  const wk = weekKey();
  const qv = $('#extraQty').value;
  (state.extras[wk] || (state.extras[wk] = [])).push({
    id: uid('ex'), name, qty: qv === '' ? null : Number(qv), unit: $('#extraUnit').value, aisle: guessAisle(name),
  });
  $('#extraName').value = ''; $('#extraQty').value = '';
  save(); render(); toast('Agregado a la lista');
}

function listAsText() {
  const { groups, wk } = buildShoppingList();
  const ck = state.checked[wk] || {};
  let out = `🛒 Lista del súper — ${weekRangeLabel(weekOffset)}\n`;
  groups.forEach(g => {
    out += `\n${g.emoji} ${g.name}\n`;
    g.items.forEach(i => { out += `${ck[i.key] ? '☑' : '☐'} ${i.name} — ${formatQty(i.qty, i.base)}\n`; });
  });
  return out;
}

function menuAsText() {
  const wk = weekKey();
  const items = state.plan[wk] || [];
  let out = `🗓️ Menú ${weekRangeLabel(weekOffset)}\n`;
  DAYS.forEach(d => {
    const its = items.filter(i => i.day === d.id);
    if (!its.length) return;
    out += `\n${d.name}:\n`;
    its.forEach(it => {
      const r = state.recipes.find(x => x.id === it.recipeId);
      if (r) out += `  · ${r.emoji} ${r.name} (${it.people} pers.)\n`;
    });
  });
  return out;
}

async function shareText(text, title) {
  try {
    if (navigator.share) { await navigator.share({ title, text }); return; }
    await navigator.clipboard.writeText(text);
    toast('Copiado 📋');
  } catch { /* el usuario canceló */ }
}

/* ============================================================
   Vista: AJUSTES
   ============================================================ */
function renderSettings() {
  const s = state.settings;
  $('#setDark').checked = s.dark;
  $('#setPeople').value = s.people;
  $('#setReminder').checked = s.reminder;
  $('#setReminderHour').value = s.reminderHour;

  const info = $('#storageInfo');
  const nPhotos = state.recipes.reduce((n, r) => n + r.photos.length, 0);
  info.textContent = `${state.recipes.length} recetas · ${nPhotos} fotos guardadas.`;
  if (navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then(e => {
      if (!e.usage) return;
      info.textContent += ` Espacio usado: ${(e.usage / 1048576).toFixed(1)} MB.`;
    }).catch(() => {});
  }
}

function applyTheme() { document.body.classList.toggle('light', !state.settings.dark); }

/* ---------- Exportar / importar ---------- */
async function exportData() {
  toast('Preparando el respaldo…');
  const photos = {};
  for (const r of state.recipes) {
    for (const id of r.photos) {
      const blob = await PhotoDB.get(id);
      if (blob) photos[id] = await blobToDataURL(blob);
    }
  }
  const payload = { app: 'supercasa', version: 1, exportedAt: new Date().toISOString(), state, photos };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `supercasa-${todayStr()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function blobToDataURL(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result); r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}
async function importData(file) {
  try {
    const payload = JSON.parse(await file.text());
    if (payload.app !== 'supercasa') { toast('Ese archivo no es de SuperCasa'); return; }
    if (!confirm('Esto reemplaza tus datos actuales. ¿Seguir?')) return;
    // Restauramos cada foto con su id original para que las recetas la encuentren
    for (const [id, dataUrl] of Object.entries(payload.photos || {})) {
      const blob = await (await fetch(dataUrl)).blob();
      await PhotoDB.putWithId(id, blob);
    }
    state = Object.assign(defaultState(), payload.state);
    state.settings = Object.assign(defaultState().settings, state.settings || {});
    state.recipes = (state.recipes || []).map(normalizeRecipe);
    save(); applyTheme(); render();
    toast('Datos restaurados ✅');
  } catch { toast('No pude leer ese archivo'); }
}

/* ============================================================
   Modal
   ============================================================ */
function openModal(title, html, onMount) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = html;
  $('#modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  if (onMount) onMount();
}
function closeModal() {
  $('#modal').classList.add('hidden');
  $('#modalBody').innerHTML = '';
  document.body.style.overflow = '';
  draft = null;
}

/* ============================================================
   Notificaciones (mientras la app está abierta)
   ============================================================ */
function maybeNotifyThursday() {
  const s = state.settings;
  if (!s.reminder) return;
  if (new Date().getDay() !== 4) return;
  if (new Date().getHours() < (s.reminderHour ?? 10)) return;
  if (s.lastNotified === todayStr()) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification('🥬 Jueves de súper orgánico', {
      body: 'Armá el menú de la semana y llevate la lista lista.',
      icon: 'icon.svg',
    });
    s.lastNotified = todayStr();
    save();
  } catch { /* algunos navegadores lo bloquean */ }
}

/* ============================================================
   Arranque
   ============================================================ */
function fillUnitSelects() {
  const html = unitOptions('g');
  ['#pantryUnit', '#extraUnit'].forEach(sel => { const el = $(sel); if (el) el.innerHTML = html; });
}

function loadSamples() {
  SAMPLE_RECIPES.forEach(r => state.recipes.push(normalizeRecipe(r)));
  save(); render(); toast('Listo, 3 recetas de ejemplo 🍳');
}

function init() {
  applyTheme();
  if (!storageOK()) showStorageWarn();
  fillUnitSelects();

  // Nav
  $$('.nav-btn').forEach(b => b.onclick = () => setView(b.dataset.view));
  $('#settingsBtn').onclick = () => setView(view === 'ajustes' ? 'recetas' : 'ajustes');
  $('#fab').onclick = newRecipe;

  // Recetas
  $('#searchInput').oninput = e => { recipeSearch = e.target.value; renderRecipes(); };
  $('#tagChips').onclick = e => {
    const b = e.target.closest('[data-tag]');
    if (!b) return;
    activeTag = activeTag === b.dataset.tag ? '' : b.dataset.tag;
    renderRecipes();
  };
  $('#recipeGrid').onclick = e => {
    const b = e.target.closest('[data-recipe]');
    if (b) editRecipe(b.dataset.recipe);
  };
  $('#loadSamplesBtn').onclick = loadSamples;

  // Fotos
  $('#photoInput').onchange = e => { if (e.target.files.length && photoTarget) photoTarget([...e.target.files]); e.target.value = ''; };
  $('#photoLibInput').onchange = e => { if (e.target.files.length && photoTarget) photoTarget([...e.target.files]); e.target.value = ''; };

  // Semana
  $$('.week-switch button').forEach(b => b.onclick = () => { weekOffset = Number(b.dataset.week); render(); });
  $('#clearWeekBtn').onclick = () => {
    if (!confirm('¿Vaciar el menú de esta semana?')) return;
    state.plan[weekKey()] = []; save(); render();
  };
  $('#copyWeekBtn').onclick = () => shareText(menuAsText(), 'Menú de la semana');
  $('#goListBtn').onclick = () => setView('lista');

  // Refri
  $('#pantryAddBtn').onclick = addPantryItem;
  $('#pantryName').onkeydown = e => { if (e.key === 'Enter') addPantryItem(); };
  $('#clearPantryBtn').onclick = () => {
    if (!confirm('¿Vaciar todo el refri?')) return;
    state.pantry = []; save(); render();
  };

  // Lista
  $('#extraAddBtn').onclick = addExtraItem;
  $('#extraName').onkeydown = e => { if (e.key === 'Enter') addExtraItem(); };
  $('#shareListBtn').onclick = () => shareText(listAsText(), 'Lista del súper');
  $('#uncheckAllBtn').onclick = () => { state.checked[weekKey()] = {}; save(); render(); };

  // Ajustes
  $('#setDark').onchange = e => { state.settings.dark = e.target.checked; save(); applyTheme(); };
  $('#setPeople').onchange = e => { state.settings.people = Math.max(1, Number(e.target.value) || 1); save(); };
  $('#setReminder').onchange = e => { state.settings.reminder = e.target.checked; save(); render(); };
  $('#setReminderHour').onchange = e => {
    const h = Number(e.target.value);
    state.settings.reminderHour = (h >= 0 && h <= 23) ? h : 10;
    save(); render();
  };
  $('#notifPermBtn').onclick = async () => {
    if (!('Notification' in window)) { toast('Este navegador no tiene notificaciones'); return; }
    const p = await Notification.requestPermission();
    toast(p === 'granted' ? 'Notificaciones activadas 🔔' : 'Quedaron desactivadas');
    maybeNotifyThursday();
  };
  $('#exportBtn').onclick = exportData;
  $('#importBtn').onclick = () => $('#importFile').click();
  $('#importFile').onchange = e => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ''; };
  $('#resetBtn').onclick = async () => {
    if (!confirm('¿Borrar TODAS tus recetas, fotos y listas? No se puede deshacer.')) return;
    for (const id of await PhotoDB.keys()) await PhotoDB.del(id);
    localStorage.removeItem(STORE_KEY);
    state = defaultState();
    save(); applyTheme(); setView('recetas');
    toast('Todo borrado');
  };

  // Modal
  $('#modalClose').onclick = closeModal;
  $('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };

  setView('recetas');
  maybeNotifyThursday();

  // Revisa a cada hora por si la app queda abierta y llega el jueves
  setInterval(() => { maybeNotifyThursday(); if (view === 'recetas') renderReminder(); }, 60 * 60 * 1000);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
