import { oggiISO } from '../../dominio/motore';
import { MINUTI_PERIODO, NOMI_GIORNI, indiceGiorno, lunediDi } from '../../dominio/pianificazione';
import { programmaTeorico } from '../../dominio/programmi';
import { contenutoLezione, formatoDataBreve, formatoMinuti, impegniDi, ore, type Impegno } from '../../dominio/viste';
import { link } from '../navigazione';
import { useStato } from '../stato';
import { Sezione } from './disegno';

/**
 * Per l'istruttore, appena entra: in che ore e in quali lezioni è impegnato da oggi in poi.
 * Contano solo i programmi settimanali già validati, in tutti i corsi a cui è iscritto.
 */
export function MieLezioni() {
  const { dati, utente } = useStato();
  if (!dati || utente?.ruolo !== 'instructor') return null;
  const oggi = oggiISO();
  const impegni = impegniDi(dati, utente.id, oggi);
  const minuti = (elenco: Impegno[]) => elenco.reduce((s, i) => s + i.lezione.minuti, 0);
  const giorni = [...new Set(impegni.map((i) => i.lezione.data))].map((data) => ({ data, lezioni: impegni.filter((i) => i.lezione.data === data) }));

  return (
    <Sezione id="mie-lezioni" titolo="Le mie lezioni" azioni={<span className="etichetta">da oggi · {ore(minuti(impegni))}</span>}>
      {impegni.length === 0 ? (
        <p className="debole" style={{ margin: 0 }}>
          Nessuna lezione a tuo nome nei programmi settimanali validati da oggi in poi.
        </p>
      ) : (
        <div className="mie-lezioni">
          {giorni.map(({ data, lezioni }) => (
            <section key={data} className={data === oggi ? 'oggi' : undefined}>
              <header>
                <span>
                  {data === oggi ? 'Oggi' : NOMI_GIORNI[indiceGiorno(data)]} {formatoDataBreve(data)}
                </span>
                <span className="cifre">{ore(minuti(lezioni))}</span>
              </header>
              {lezioni.map(({ lezione: l, corso, orario }) => {
                const { chapter, titolo } = contenutoLezione(programmaTeorico(corso.programma_teorico), l);
                return (
                  <div key={l.id} className="riga">
                    <span className="cifre">
                      {orario.inizio}–{orario.fine}
                      {l.minuti !== MINUTI_PERIODO && <span className="debole"> · {formatoMinuti(l.minuti)}</span>}
                    </span>
                    <span>
                      <strong>{chapter ? `Ch ${chapter} · ${titolo}` : titolo}</strong>
                      {l.tipo === 'recupero' && <span className="debole"> · recupero</span>}
                    </span>
                    <span className="dove">
                      {l.aula || corso.aula || 'aula da definire'} · <a href={link('/settimana', corso, null, `w=${lunediDi(l.data)}`)}>{corso.codice}</a>
                    </span>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </Sezione>
  );
}
