// Vercel Serverless Function: přijme POST z <form>, pošle na Formspree a vrátí redirect
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const params = new URLSearchParams(Buffer.concat(chunks).toString());
  const data = Object.fromEntries(params.entries());

  if (data.company && data.company.trim() !== '') {
    res.status(303).setHeader('Location', '/'); return res.end();
  }

  const FORM_ID = process.env.FORMSPREE_ID || 'xkgvjekb';
  try {
    await fetch(`https://formspree.io/f/${FORM_ID}`, {
      method:'POST',
      headers:{ 'Accept':'application/json','Content-Type':'application/json' },
      body: JSON.stringify({ ...data, timestamp: new Date().toISOString() })
    });
  } catch (e) {
    console.error('Formspree error:', e);
  }

  const next = data._next || '/thank-you-page';
  res.status(303).setHeader('Location', next).end();
}
