// api/wettoni-lead.js
export const config = { runtime: 'edge' };

const ORIGIN = 'https://early-tenets-728061.framer.app'; // tvoje Framer doména
const cors = {
  'Access-Control-Allow-Origin': ORIGIN,           // můžeš dát '*' během testu
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req) {
  // 1) CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { ...cors, Allow: 'POST,OPTIONS' },
    });
  }

  try {
    const ct = req.headers.get('content-type') || '';
    let fields;

    // 2) Podpora jak JSON, tak x-www-form-urlencoded z frontendu
    if (ct.includes('application/json')) {
      const json = await req.json();
      fields = new URLSearchParams(json);
    } else {
      const raw = await req.text(); // např. application/x-www-form-urlencoded
      fields = new URLSearchParams(raw);
    }

    // 3) přidej _next pro server-side redirect z Formspree (bez jejich UI)
    const NEXT_URL = 'https://early-tenets-728061.framer.app/thank-you-page';
    if (!fields.get('_next')) fields.set('_next', NEXT_URL);

    const FORMSPREE_ID = process.env.FORMSPREE_ID;
    if (!FORMSPREE_ID) {
      return new Response('FORMSPREE_ID missing', { status: 500, headers: cors });
    }

    // 4) forward na Formspree
    const fsRes = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: fields.toString(),
      redirect: 'manual', // nechceme následovat 302 z Formspree
    });

    // 5) Když Formspree OK → vrať 200 (frontend si udělá redirect sám)
    if (fsRes.status >= 200 && fsRes.status < 400) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // jinak vrať text odpovědi pro debug
    const text = await fsRes.text();
    return new Response(text || 'Formspree error', {
      status: 502,
      headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (err) {
    return new Response('Proxy error: ' + (err?.message || 'unknown'), {
      status: 500,
      headers: cors,
    });
  }
}
