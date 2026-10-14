import { afterEach, expect, it, vi } from 'vitest';
import { GitHubBackend } from '../src/backend/github/GitHubBackend';
import { base64DaBytes, bytesDaTesto } from '../src/backend/github/crittografia';
import { creaKeyring, impostaCredenziali, sbloccaKeyring, validaKeyring } from '../src/backend/github/keyring';

/** Archivio GitHub contro un GitHub finto: modelli letti solo con il token, rinnovo del token come nel Gestionale PdS. */

const CONFIG = { tipo: 'github' as const, owner: 'o', repoDati: 'tt-dati', repoAccessi: 'tt-accessi', branch: 'main' };
const NUOVO = 'github_pat_nuovo_token_valido_0001';
const ALTRO = 'github_pat_altro_token_valido_0002';
const MODULO = new Uint8Array([80, 75, 3, 4, 1, 2, 3]);
const utente = (id: string, username: string, ruolo: string) => ({ id, username, ruolo, grado: '', nome: username, cognome: '', istruttore_id: null, attivo: true, deve_cambiare_password: false, created_at: '', updated_at: '' });

/** Il minimo delle API di GitHub usate dall'archivio; i token validi sono quelli dell'insieme. */
function githubFinto(validi: Set<string>) {
  const stato = { keyring: '', scritture: 0, letti: new Map<string, number>() };
  const blob: Record<string, Uint8Array> = {
    b1: bytesDaTesto(JSON.stringify({ formato: 1, elementi: [utente('u1', 'admin', 'admin'), utente('u2', 'mario', 'trainee')] })),
    b2: MODULO,
    b3: new Uint8Array([9]),
  };
  const albero = [
    { path: 'db/utenti.json', type: 'blob', sha: 'b1' },
    { path: 'modelli/Programma settimanale.xlsx', type: 'blob', sha: 'b2' },
    { path: 'modelli/Programmi Type Training/CH-47F - MTT - B1.3.xlsx', type: 'blob', sha: 'b3' },
  ];
  const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });
  const fetchFinto = async (url: string, init: RequestInit = {}) => {
    const metodo = init.method ?? 'GET';
    // il portachiavi è pubblico: si legge senza token
    if (url.startsWith('https://raw.githubusercontent.com/')) return stato.keyring ? new Response(stato.keyring) : new Response('', { status: 404 });
    const percorso = url.replace('https://api.github.com', '');
    const token = (init.headers as Record<string, string> | undefined)?.Authorization?.replace('Bearer ', '') ?? '';
    if (percorso.startsWith('/repos/o/tt-accessi/contents/keyring.json')) {
      if (metodo === 'GET') return stato.keyring ? json({ sha: `k${stato.scritture}`, content: base64DaBytes(bytesDaTesto(stato.keyring)), encoding: 'base64' }) : json({}, 404);
      if (!validi.has(token)) return json({ message: 'Bad credentials' }, 401);
      stato.keyring = Buffer.from((JSON.parse(String(init.body)) as { content: string }).content, 'base64').toString('utf8');
      stato.scritture++;
      return json({ content: { sha: `k${stato.scritture}` } });
    }
    // il repository dei dati, modelli compresi, risponde solo a un token valido
    if (!validi.has(token)) return json({ message: 'Bad credentials' }, 401);
    if (percorso === '/repos/o/tt-dati/git/ref/heads/main') return json({ object: { sha: 'c1' } });
    if (percorso === '/repos/o/tt-dati/git/commits/c1') return json({ tree: { sha: 't1' } });
    if (percorso === '/repos/o/tt-dati/git/trees/t1?recursive=1') return json({ tree: albero, truncated: false });
    if (metodo === 'POST' && percorso === '/repos/o/tt-dati/git/blobs') return json({ sha: 'prova' }, 201);
    const sha = percorso.match(/^\/repos\/o\/tt-dati\/git\/blobs\/(\w+)$/)?.[1];
    if (sha && blob[sha]) {
      stato.letti.set(sha, (stato.letti.get(sha) ?? 0) + 1);
      return json({ content: base64DaBytes(blob[sha]), encoding: 'base64' });
    }
    return json({ message: 'Not Found' }, 404);
  };
  return { stato, fetchFinto };
}

afterEach(() => vi.unstubAllGlobals());

it('token scaduto: lo rinnova solo il Training Manager, con un token che legge e scrive i dati; le password restano', async () => {
  const validi = new Set([NUOVO]);
  const { stato, fetchFinto } = githubFinto(validi);
  const { keyring, chiavi } = await creaKeyring('github_pat_vecchio_token_scaduto_00', 'admin', 'password1', 1000);
  stato.keyring = JSON.stringify(await impostaCredenziali(keyring, chiavi, 'mario', 'password2', false));
  vi.stubGlobal('fetch', fetchFinto);
  const b = new GitHubBackend(CONFIG);

  await expect(b.accedi('admin', 'password1', false)).rejects.toMatchObject({ codice: 'TOKEN_SCADUTO' });
  await expect(b.accedi('mario', 'password2', false)).rejects.toMatchObject({ codice: 'AUTENTICAZIONE' });
  await expect(b.rinnovaTokenEAccedi('mario', 'password2', NUOVO, false)).rejects.toMatchObject({ codice: 'PERMESSO_NEGATO' });
  await expect(b.rinnovaTokenEAccedi('admin', 'password1', 'github_pat_senza_accesso_ai_dati', false)).rejects.toMatchObject({ codice: 'CONFIGURAZIONE' });
  await expect(b.rinnovaTokenEAccedi('admin', 'password1', 'corto', false)).rejects.toMatchObject({ codice: 'VALIDAZIONE' });
  // un token classico (o quello della GitHub CLI) apre tutti i repository dell'account: non entra nel portachiavi
  await expect(b.rinnovaTokenEAccedi('admin', 'password1', 'ghp_tokenClassicoConAccessoATuttoIlProfilo', false)).rejects.toMatchObject({ codice: 'VALIDAZIONE' });
  expect(stato.scritture).toBe(0); // nessun tentativo andato a vuoto tocca il portachiavi

  expect((await b.rinnovaTokenEAccedi('admin', 'password1', NUOVO, false)).utente.username).toBe('admin');
  expect((await sbloccaKeyring(validaKeyring(JSON.parse(stato.keyring)), 'mario', 'password2')).token).toBe(NUOVO);

  // da Account: sostituzione con un token ancora valido (per esempio dopo aver disattivato qualcuno)
  validi.add(ALTRO);
  await b.ruotaToken(ALTRO);
  expect((await sbloccaKeyring(validaKeyring(JSON.parse(stato.keyring)), 'mario', 'password2')).token).toBe(ALTRO);
  validi.delete(NUOVO); // il vecchio token si revoca: la sessione del TM continua con il nuovo
  expect((await b.caricaDati()).utenti).toHaveLength(2);
});

it('i modelli stanno nel repository privato: elenco e contenuto solo dopo l’accesso, scaricati una volta', async () => {
  const { stato, fetchFinto } = githubFinto(new Set([NUOVO]));
  const { keyring } = await creaKeyring(NUOVO, 'admin', 'password1', 1000);
  stato.keyring = JSON.stringify(keyring);
  vi.stubGlobal('fetch', fetchFinto);
  const b = new GitHubBackend(CONFIG);
  await expect(b.leggiModello('Programma settimanale.xlsx')).rejects.toMatchObject({ codice: 'AUTENTICAZIONE' });

  await b.accedi('admin', 'password1', false);
  expect(await b.elencoModelli()).toEqual(['Programma settimanale.xlsx', 'Programmi Type Training/CH-47F - MTT - B1.3.xlsx']);
  expect(stato.letti.get('b2')).toBeUndefined(); // l'elenco non scarica i file
  expect(await b.leggiModello('Programma settimanale.xlsx')).toEqual(MODULO);
  await b.leggiModello('Programma settimanale.xlsx');
  expect(stato.letti.get('b2')).toBe(1);
  expect(await b.leggiModello('logo.png')).toBeNull();

  await b.esci();
  await expect(b.elencoModelli()).rejects.toMatchObject({ codice: 'AUTENTICAZIONE' });
});
