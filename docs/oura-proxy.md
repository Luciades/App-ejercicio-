# Conectar Oura (paso a paso)

Oura por seguridad no deja que un navegador le pida datos directo (CORS). Por eso, si al tocar **"Conectar Oura"** te da error, hay que poner un **proxy** en el medio. Es gratis y se hace una sola vez (5 minutos).

## 1) Generar tu token de Oura

1. Entrá a **https://cloud.ouraring.com/personal-access-tokens**
2. Iniciá sesión con tu cuenta de Oura.
3. Tocá **"Create New Personal Access Token"**.
4. Copiá el token (una tira larga de letras y números).

Con eso solo, probá primero en la app: **Salud → Oura → pegá el token → Conectar**.
Si trae tus datos, ¡listo! Si da error, seguí con el proxy 👇

## 2) Crear el proxy gratis (Cloudflare Workers)

1. Creá una cuenta gratis en **https://dash.cloudflare.com** (o iniciá sesión).
2. Menú lateral → **Workers & Pages** → **Create** → **Create Worker**.
3. Ponele un nombre (ej: `oura-proxy`) → **Deploy**.
4. Tocá **"Edit code"** y **borrá todo**, pegá esto:

```js
export default {
  async fetch(request) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(request.url);
    const target = 'https://api.ouraring.com' + url.pathname + url.search;
    const res = await fetch(target, {
      headers: { Authorization: request.headers.get('Authorization') || '' },
    });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  },
};
```

5. **Deploy**. Cloudflare te va a dar una URL tipo:
   `https://oura-proxy.tu-usuario.workers.dev`

## 3) Pegar el proxy en la app

1. En la app: **Salud → Oura → "¿Da error al conectar?"**
2. Pegá la URL del worker en el campo de proxy.
3. Pegá tu token arriba y tocá **Conectar Oura**.

¡Y listo! La app va a mostrar tu **Readiness, Sueño y Pasos**, y va a adaptar la recomendación del día según cómo dormiste/te recuperaste.

> 🔒 El token queda guardado solo en tu celular, y el proxy es tuyo (nadie más lo usa).
