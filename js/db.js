/* ============================================================
   SuperCasa — fotos en IndexedDB
   Las fotos no caben en localStorage (5 MB), así que van aparte.
   ============================================================ */
'use strict';

const PhotoDB = (() => {
  const DB_NAME = 'supercasa-fotos';
  const STORE = 'fotos';
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('sin-indexeddb'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  function tx(mode, fn) {
    return open().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const store = t.objectStore(STORE);
      let out;
      try { out = fn(store); } catch (e) { return reject(e); }
      t.oncomplete = () => resolve(out instanceof IDBRequest ? out.result : out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('abort'));
    }));
  }

  /* Guarda un Blob y devuelve su id */
  async function put(blob) {
    const id = 'ph_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    await putWithId(id, blob);
    return id;
  }
  /* Guarda conservando un id concreto (se usa al restaurar un respaldo) */
  async function putWithId(id, blob) {
    await tx('readwrite', s => s.put(blob, id));
    forget(id);
    return id;
  }
  async function get(id) {
    if (!id) return null;
    try { return await tx('readonly', s => s.get(id)); } catch { return null; }
  }
  async function del(id) {
    if (!id) return;
    try { await tx('readwrite', s => s.delete(id)); } catch { /* ya no está */ }
  }
  async function keys() {
    try { return await tx('readonly', s => s.getAllKeys()); } catch { return []; }
  }

  /* Cache de object URLs para no recrearlos en cada render */
  const urls = new Map();
  async function url(id) {
    if (!id) return null;
    if (urls.has(id)) return urls.get(id);
    const blob = await get(id);
    if (!blob) return null;
    const u = URL.createObjectURL(blob);
    urls.set(id, u);
    return u;
  }
  function forget(id) {
    const u = urls.get(id);
    if (u) { URL.revokeObjectURL(u); urls.delete(id); }
  }

  return { put, putWithId, get, del, keys, url, forget };
})();

/* ------------------------------------------------------------
   Comprime una foto antes de guardarla: máximo 1400 px de lado
   y JPEG de calidad media. Una foto de receta pasa de ~4 MB a ~250 KB.
   ------------------------------------------------------------ */
function compressImage(file, maxSide = 1400, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('imagen-invalida'));
      img.onload = () => {
        let { width: w, height: h } = img;
        const scale = Math.min(1, maxSide / Math.max(w, h));
        w = Math.round(w * scale); h = Math.round(h * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          blob => blob ? resolve(blob) : reject(new Error('sin-blob')),
          'image/jpeg',
          quality
        );
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
