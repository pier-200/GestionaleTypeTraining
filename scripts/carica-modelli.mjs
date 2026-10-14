// Carica la cartella locale `modelli/` nel repository privato dei dati (<repoDati>/modelli/), in un solo commit.
// Online i modelli stanno solo lì: l'applicazione li legge con il token, quindi solo chi ha fatto l'accesso.
//
//   npm run modelli -- --token <github_pat_…>
//   TT_TOKEN=<github_pat_…> npm run modelli
//   gh auth token | node scripts/carica-modelli.mjs --stdin
//
// Si caricano solo i file nuovi o cambiati; quelli presenti online e non in locale (per esempio un Excel delle
// abilitazioni caricato da GitHub) restano dove sono.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const RADICE = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const LOCALE = join(RADICE, 'modelli');

const arg = (nome) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const { owner, repoDati, branch = 'main', tipo } = JSON.parse(readFileSync(join(RADICE, 'public/config.json'), 'utf8')).archivio ?? {};
if (tipo !== 'github') throw new Error('public/config.json non è configurato sull’archivio GitHub');
const token = (arg('token') ?? (process.argv.includes('--stdin') ? readFileSync(0, 'utf8') : process.env.TT_TOKEN) ?? '').trim();
if (!token) throw new Error('Manca il token GitHub: --token <github_pat_…>, variabile TT_TOKEN oppure --stdin');
if (!existsSync(LOCALE)) throw new Error(`Cartella ${LOCALE} non trovata`);

const elenca = (cartella) =>
  readdirSync(cartella, { withFileTypes: true }).flatMap((v) =>
    v.isDirectory() ? elenca(join(cartella, v.name)) : v.name.startsWith('~$') || v.name === 'indice.json' ? [] : [relative(LOCALE, join(cartella, v.name)).replaceAll('\\', '/')],
  );
/** Lo sha che git dà al contenuto: se coincide con quello online il file non è cambiato. */
const shaGit = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

const api = async (metodo, percorso, corpo) => {
  const r = await fetch(`https://api.github.com/repos/${owner}/${repoDati}/${percorso}`, {
    method: metodo,
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (metodo === 'GET' && (r.status === 404 || r.status === 409)) return null;
  if (!r.ok) throw new Error(`GitHub ${metodo} ${percorso}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
};

// un repository appena creato è vuoto: il primo file si scrive con la Contents API, che crea il ramo
let ref = await api('GET', `git/ref/heads/${branch}`);
if (!ref) {
  await api('PUT', 'contents/README.md', {
    message: 'Inizializzazione',
    branch,
    content: Buffer.from('# Dati del Gestionale Type Training\n\nRepository **privato** gestito dall’applicazione: non modificare i file a mano.\n').toString('base64'),
  });
  ref = await api('GET', `git/ref/heads/${branch}`);
}
const commit = await api('GET', `git/commits/${ref.object.sha}`);
const albero = await api('GET', `git/trees/${commit.tree.sha}?recursive=1`);
const online = new Map(albero.tree.filter((e) => e.type === 'blob' && e.path.startsWith('modelli/')).map((e) => [e.path.slice('modelli/'.length), e.sha]));

const voci = [];
for (const nome of elenca(LOCALE)) {
  const bytes = readFileSync(join(LOCALE, nome));
  if (online.get(nome) === shaGit(bytes)) continue;
  const blob = await api('POST', 'git/blobs', { content: bytes.toString('base64'), encoding: 'base64' });
  voci.push({ path: `modelli/${nome}`, mode: '100644', type: 'blob', sha: blob.sha });
  console.log(`  ${online.has(nome) ? 'aggiornato' : 'nuovo'}: ${nome}`);
}
const soloOnline = [...online.keys()].filter((nome) => !existsSync(join(LOCALE, nome)));
if (soloOnline.length) console.log(`Solo online (lasciati): ${soloOnline.join(', ')}`);
if (!voci.length) {
  console.log(`Modelli già aggiornati su ${owner}/${repoDati}.`);
} else {
  const nuovoAlbero = await api('POST', 'git/trees', { base_tree: commit.tree.sha, tree: voci });
  const nuovo = await api('POST', 'git/commits', { message: `Modelli aggiornati: ${voci.length} file`, tree: nuovoAlbero.sha, parents: [ref.object.sha] });
  await api('PATCH', `git/refs/heads/${branch}`, { sha: nuovo.sha, force: false });
  console.log(`${voci.length} file caricati in ${owner}/${repoDati}/modelli.`);
}
