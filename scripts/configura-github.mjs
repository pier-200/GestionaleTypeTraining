// Configurazione iniziale dell'archivio GitHub senza passare dall'interfaccia:
// crea il portachiavi cifrato in <repoAccessi> e il Training Manager in <repoDati>.
//
//   node scripts/configura-github.mjs --token <github_pat_…> --username admin --password admin
//   gh auth token | node scripts/configura-github.mjs --stdin --username admin --password admin
//
// Il token serve solo qui: finisce cifrato nel portachiavi e non viene mai scritto in chiaro.
// Con una password corta il portachiavi è debole: per i dati veri usarne una lunga.
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

async function main() {
  const arg = (nome, pre) => {
    const i = process.argv.indexOf(`--${nome}`);
    return i > 0 ? process.argv[i + 1] : pre;
  };
  const config = JSON.parse(readFileSync(new URL('../public/config.json', import.meta.url), 'utf8')).archivio;
  if (config?.tipo !== 'github') throw new Error('public/config.json non è configurato sull\'archivio GitHub');
  const { owner, repoDati, repoAccessi, branch = 'main' } = config;
  const username = (arg('username', 'admin') ?? '').trim().toLowerCase();
  const password = arg('password', 'admin');
  const nome = arg('nome', 'Training Manager');
  const token = (arg('token') ?? (process.argv.includes('--stdin') ? readFileSync(0, 'utf8') : process.env.TT_TOKEN) ?? '').trim();
  if (!token) throw new Error('Manca il token GitHub: --token <github_pat_…>, variabile TT_TOKEN oppure --stdin');

  const api = async (metodo, percorso, corpo) => {
    const r = await fetch(`https://api.github.com/${percorso}`, {
      method: metodo,
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    if (r.status === 404 && metodo === 'GET') return null;
    if (!r.ok) throw new Error(`GitHub ${metodo} ${percorso}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    return r.json();
  };
  const scrivi = async (repo, percorso, testo, messaggio) => {
    const esistente = await api('GET', `repos/${owner}/${repo}/contents/${percorso}?ref=${branch}`);
    return api('PUT', `repos/${owner}/${repo}/contents/${percorso}`, {
      message: messaggio,
      content: Buffer.from(testo, 'utf8').toString('base64'),
      branch,
      ...(esistente?.sha ? { sha: esistente.sha } : {}),
    });
  };

  const dati = await api('GET', `repos/${owner}/${repoDati}`);
  if (!dati) throw new Error(`Repository ${owner}/${repoDati} non raggiungibile con questo token`);
  if (!dati.private) throw new Error(`${owner}/${repoDati} deve essere privato`);
  const accessi = await api('GET', `repos/${owner}/${repoAccessi}`);
  if (!accessi || accessi.private) throw new Error(`${owner}/${repoAccessi} deve esistere ed essere pubblico`);
  if (await api('GET', `repos/${owner}/${repoAccessi}/contents/keyring.json?ref=${branch}`)) {
    throw new Error('Portachiavi già presente: per rifare la configurazione eliminare prima keyring.json');
  }

  // la crittografia del portachiavi è quella dell'applicazione
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  const { creaKeyring, sbloccaKeyring } = await vite.ssrLoadModule('/src/backend/github/keyring.ts');
  const { nuovoUuid } = await vite.ssrLoadModule('/src/backend/github/crittografia.ts');
  const { errorePassword, RE_USERNAME } = await vite.ssrLoadModule('/src/dominio/motore.ts');
  await vite.close();
  if (!RE_USERNAME.test(username)) throw new Error('Username non valido');
  const problema = errorePassword(password);
  if (problema) throw new Error(problema);

  const ora = new Date().toISOString();
  const utenti = await api('GET', `repos/${owner}/${repoDati}/contents/db/utenti.json?ref=${branch}`);
  if (utenti) throw new Error('Il repository dei dati contiene già degli utenti: usare l\'applicazione');
  const admin = { id: nuovoUuid(), username, ruolo: 'admin', grado: '', nome, cognome: '', istruttore_id: null, attivo: true, deve_cambiare_password: false, created_at: ora, updated_at: ora };
  await scrivi(repoDati, 'README.md', `# Dati del Gestionale Type Training\n\nRepository **privato** gestito dall'applicazione: non modificare i file a mano.\n`, 'Inizializzazione');
  await scrivi(repoDati, 'db/utenti.json', `${JSON.stringify({ formato: 1, elementi: [admin] }, null, 1)}\n`, `${username}: configurazione iniziale`);

  const { keyring, chiavi } = await creaKeyring(token, username, password);
  // controllo: il portachiavi si riapre con le credenziali appena impostate
  const riaperto = await sbloccaKeyring(keyring, username, password);
  if (riaperto.token !== chiavi.token) throw new Error('Portachiavi non verificato');
  await scrivi(repoAccessi, 'keyring.json', `${JSON.stringify(keyring, null, 2)}\n`, 'Configurazione iniziale del portachiavi');

  console.log(`Archivio GitHub configurato: Training Manager "${username}" su ${owner}/${repoDati}.`);
  console.log('Accesso: https://pier-200.github.io/GestionaleTypeTraining/');
}

main().catch((e) => {
  console.error(`Errore: ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
});
