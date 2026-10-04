// Vercel Serverless Function: gera a cobrança Pix na NovaPay.
// Variáveis de ambiente (Vercel > Settings > Environment Variables):
//   NOVAPAY_CLIENT_ID, NOVAPAY_CLIENT_SECRET
//   AMOUNT_IN_CENTS=true  (só se a NovaPay exigir o valor em centavos)
const PRICE = 100, FRETE = 11.5, BUMP = 32.5;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const { items, bump, cep, nome } = req.body || {};

  // O valor é calculado aqui no servidor, nunca vem do navegador.
  const qty = Array.isArray(items)
    ? items.reduce((a, i) => a + Math.max(0, Math.min(50, parseInt(i && i.q) || 0)), 0)
    : 0;
  if (qty < 1 || qty > 50) return res.status(400).json({ error: 'Quantidade inválida' });
  if (!/^\d{8}$/.test(String(cep || '').replace(/\D/g, ''))) return res.status(400).json({ error: 'CEP inválido' });

  const total = qty * PRICE + FRETE + (bump ? BUMP : 0);
  const amount = process.env.AMOUNT_IN_CENTS === 'true' ? Math.round(total * 100) : Number(total.toFixed(2));
  const description = `Pedido JBL ${qty}x${bump ? ' + Garrafa Stanley' : ''}${nome ? ' - ' + String(nome).slice(0, 40) : ''}`;

  try {
    const r = await fetch('https://api.anovapay.com.br/charges', {
      method: 'POST',
      headers: {
        ci: process.env.NOVAPAY_CLIENT_ID,
        cs: process.env.NOVAPAY_CLIENT_SECRET,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount, description })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ error: 'Falha ao gerar o Pix', detail: data });
    return res.status(200).json({ total, charge: data });
  } catch (e) {
    return res.status(502).json({ error: 'NovaPay indisponível' });
  }
}
