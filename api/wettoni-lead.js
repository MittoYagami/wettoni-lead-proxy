// api/wettoni-lead.js
export const config = { runtime: 'edge' };

/** Povolené originy – doplň podle potřeby */
const ALLOWED_ORIGINS = [
  'https://wettoni.com',
  'https://www.wettoni.com',
];

/** CORS helper – vrátí hlavičky pro konkrétní origin */
function corsHeaders(origin) {
  const allow =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : 'https://wettoni.com';

  return {
    'Access-Control-Allow-Origin': allow,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';
  const baseCors = corsHeaders(origin);

  // 1) CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: baseCors });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { ...baseCors, Allow: 'POST,OPTIONS' },
    });
  }

  try {
    const ct = (req.headers.get('content-type') || '').toLowerCase();
    let fields;

    // 2) Podpora JSON i x-www-form-urlencoded z frontendu
    if (ct.includes('application/json')) {
      const json = await req.json();
      fields = new URLSearchParams(json);
    } else {
      const raw = await req.text(); // x-www-form-urlencoded (nebo prázdné)
      fields = new URLSearchParams(raw);
    }

    // 3) Přidej _next, ať Formspree zná cílovou stránku (bez jejich UI)
    const NEXT_URL = 'https://wettoni.com/thank-you-page';
    if (!fields.get('_next')) fields.set('_next', NEXT_URL);

    // 4) ID formuláře z env proměnné
    const FORMSPREE_ID = process.env.FORMSPREE_ID;
    if (!FORMSPREE_ID) {
      return new Response('FORMSPREE_ID missing', { status: 500, headers: baseCors });
    }

    // 5) Forward na Formspree
    const fsRes = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: fields.toString(),
      // nechceme automaticky následovat 302 od Formspree
      redirect: 'manual',
    });

    // 6) Při úspěchu vrať 200 – frontend už si přesměruje sám (máš goTop)
    if (fsRes.status >= 200 && fsRes.status < 400) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...baseCors, 'Content-Type': 'application/json' },
      });
    }

    // Debug text při chybě upstreamu
    const text = await fsRes.text().catch(() => '');
    return new Response(text || 'Formspree error', {
      status: 502,
      headers: { ...baseCors, 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (err) {
    return new Response('Proxy error: ' + (err?.message || 'unknown'), {
      status: 500,
      headers: baseCors,
    });
  }
}
