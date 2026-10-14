import { ErroreApp } from './dominio/errori';

/**
 * Configurazione letta a runtime da `config.json` (accanto a index.html): l'archivio
 * dati si sceglie modificando il file nel repository, senza ricompilare.
 */
export type Config =
  | { tipo: 'demo' }
  | { tipo: 'github'; owner: string; repoDati: string; repoAccessi: string; branch: string };

const stringa = (v: unknown, nome: string) => {
  if (typeof v !== 'string' || !v.trim()) throw new ErroreApp('CONFIGURAZIONE', `config.json: il campo "${nome}" è obbligatorio.`);
  return v.trim();
};

export function interpretaConfig(grezza: unknown): Config {
  const b = ((grezza as { archivio?: unknown } | null)?.archivio ?? { tipo: 'demo' }) as Record<string, unknown>;
  switch (b.tipo ?? 'demo') {
    case 'demo':
      return { tipo: 'demo' };
    case 'github':
      return {
        tipo: 'github',
        owner: stringa(b.owner, 'archivio.owner'),
        repoDati: stringa(b.repoDati, 'archivio.repoDati'),
        repoAccessi: stringa(b.repoAccessi, 'archivio.repoAccessi'),
        branch: typeof b.branch === 'string' && b.branch.trim() ? b.branch.trim() : 'main',
      };
    default:
      throw new ErroreApp('CONFIGURAZIONE', `config.json: archivio "${String(b.tipo)}" non riconosciuto (valori ammessi: demo, github).`);
  }
}

export async function caricaConfig(): Promise<Config> {
  let r: Response;
  try {
    r = await fetch('./config.json', { cache: 'no-store' });
  } catch {
    return { tipo: 'demo' };
  }
  if (r.status === 404) return { tipo: 'demo' };
  if (!r.ok) throw new ErroreApp('CONFIGURAZIONE', `Impossibile leggere config.json (HTTP ${r.status}).`);
  try {
    return interpretaConfig(await r.json());
  } catch (e) {
    if (e instanceof ErroreApp) throw e;
    throw new ErroreApp('CONFIGURAZIONE', 'config.json non è un JSON valido.');
  }
}
