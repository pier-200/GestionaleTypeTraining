// Edge Function "gestione-utenti" del Gestionale Type Training (runtime Deno di Supabase).
//
// Operazioni riservate al Training Manager che richiedono la chiave di servizio:
// - crea:     nuovo account (Supabase Auth + profilo) con password provvisoria;
// - modifica: grado, nome e cognome, collegamento all'elenco istruttori, attivazione/disattivazione, nuova password provvisoria.
// Da pubblicare con "Verify JWT" disattivato: il chiamante è verificato qui dentro.

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const RE_USERNAME = /^[a-z0-9][a-z0-9._-]{2,39}$/;
const RUOLI = ['admin', 'instructor', 'trainee'];

const risposta = (stato: number, corpo: Record<string, unknown>) =>
  new Response(JSON.stringify(corpo), { status: stato, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });
const errore = (stato: number, messaggio: string) => risposta(stato, { errore: messaggio });

function problemaPassword(p: unknown): string | null {
  if (typeof p !== 'string' || p.length < 10) return 'La password deve contenere almeno 10 caratteri';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'La password deve contenere almeno una lettera e una cifra';
  if (p.length > 128) return 'La password è troppo lunga';
  return null;
}

function chiaveServizio(): string | null {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  try {
    const chiavi = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
    return chiavi.default ?? Object.values(chiavi)[0] ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return errore(405, 'Metodo non consentito');
  const url = Deno.env.get('SUPABASE_URL');
  const chiave = chiaveServizio();
  if (!url || !chiave) return errore(500, 'Funzione non configurata (URL o chiave di servizio mancanti)');
  const admin = createClient(url, chiave, { auth: { persistSession: false, autoRefreshToken: false } });

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const { data: chi } = await admin.auth.getUser(jwt);
  if (!chi?.user) return errore(401, 'Sessione non valida: accedere di nuovo');
  const { data: tm } = await admin.from('profili').select('id, ruolo, attivo').eq('id', chi.user.id).maybeSingle();
  if (!tm?.attivo || tm.ruolo !== 'admin') return errore(403, 'Operazione riservata al Training Manager');

  let c: Record<string, unknown>;
  try {
    c = await req.json();
  } catch {
    return errore(400, 'Richiesta non valida');
  }
  const istruttore = typeof c.istruttore_id === 'string' && c.istruttore_id ? c.istruttore_id : null;

  if (c.azione === 'crea') {
    const username = String(c.username ?? '').trim().toLowerCase();
    const ruolo = String(c.ruolo ?? '');
    const nome = String(c.nome ?? '').trim();
    const dominio = String(c.dominioEmail ?? 'ptt.local').trim().toLowerCase();
    if (!RE_USERNAME.test(username)) return errore(400, 'Username: 3-40 caratteri tra lettere minuscole, cifre, punto e trattini');
    if (!RUOLI.includes(ruolo)) return errore(400, 'Ruolo non valido');
    const problema = problemaPassword(c.password);
    if (problema) return errore(400, problema);
    const { data: doppio } = await admin.from('profili').select('id').eq('username', username).maybeSingle();
    if (doppio) return errore(409, `Lo username "${username}" è già in uso`);
    const { data: creato, error } = await admin.auth.admin.createUser({
      email: `${username}@${dominio}`,
      password: c.password as string,
      email_confirm: true,
      user_metadata: { username },
    });
    if (error || !creato?.user) return errore(400, `Creazione dell'account non riuscita: ${error?.message ?? 'errore sconosciuto'}`);
    const { error: e2 } = await admin.from('profili').insert({
      id: creato.user.id,
      username,
      ruolo,
      grado: String(c.grado ?? '').trim(),
      nome,
      cognome: String(c.cognome ?? '').trim(),
      istruttore_id: ruolo === 'instructor' ? istruttore : null,
      deve_cambiare_password: true,
    });
    if (e2) {
      await admin.auth.admin.deleteUser(creato.user.id);
      return errore(400, `Creazione del profilo non riuscita: ${e2.message}`);
    }
    return risposta(200, { id: creato.user.id });
  }

  if (c.azione === 'modifica') {
    const id = String(c.id ?? '');
    const { data: p } = await admin.from('profili').select('*').eq('id', id).maybeSingle();
    if (!p) return errore(404, 'Account non trovato');
    const attivo = c.attivo !== false;
    if (id === tm.id && !attivo) return errore(400, 'Non puoi disattivare il tuo stesso account');
    const password = typeof c.password === 'string' && c.password ? c.password : null;
    if (password) {
      const problema = problemaPassword(password);
      if (problema) return errore(400, problema);
    } else if (attivo && !p.attivo) {
      return errore(400, 'Per riattivare l’account indicare una nuova password provvisoria');
    }
    // la disattivazione blocca anche l'accesso (ban), non solo i dati
    const { error } = await admin.auth.admin.updateUserById(id, {
      ban_duration: attivo ? 'none' : '876000h',
      ...(password ? { password } : {}),
    });
    if (error) return errore(400, `Aggiornamento non riuscito: ${error.message}`);
    const { error: e2 } = await admin
      .from('profili')
      .update({
        grado: String(c.grado ?? p.grado).trim(),
        nome: String(c.nome ?? p.nome).trim(),
        cognome: String(c.cognome ?? p.cognome).trim(),
        attivo,
        istruttore_id: p.ruolo === 'instructor' ? istruttore : null,
        deve_cambiare_password: password ? true : p.deve_cambiare_password,
      })
      .eq('id', id);
    if (e2) return errore(400, `Aggiornamento del profilo non riuscito: ${e2.message}`);
    return risposta(200, { id });
  }

  return errore(400, 'Azione non riconosciuta');
});
