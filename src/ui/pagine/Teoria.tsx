import { IconAlertTriangleFilled, IconCircleCheckFilled } from '@tabler/icons-react';
import { oggiISO, ruoloNelCorso } from '../../dominio/motore';
import { statoTeorico } from '../../dominio/pianificazione';
import { chapterMateria, oreDaMinuti, programmaTeorico } from '../../dominio/programmi';
import { formatoData, lezioniVisibili, nomeUtente, ore } from '../../dominio/viste';
import { IntestazionePagina, Quota, ScalaQuote, Sezione } from '../componenti/disegno';
import { useCorso } from '../navigazione';
import { useStato } from '../stato';

/** Conto a scalare della parte teorica: quanto è stato programmato, svolto e quanto resta. */
export function Teoria() {
  const { dati, utente } = useStato();
  const corso = useCorso();
  const programma = programmaTeorico(corso?.programma_teorico);
  if (!dati || !utente || !corso || !programma) return null;
  const lezioni = lezioniVisibili(dati, corso.id, ruoloNelCorso(dati, utente, corso.id));
  const stato = statoTeorico(programma, lezioni, oggiISO());
  const settimanali = corso.minuti_giorno.reduce((s, m) => s + m, 0);
  const settimane = settimanali ? Math.ceil(stato.totale.residui / settimanali) : 0;
  const ultima = lezioni.at(-1)?.data;
  const istruttoriDiMateria = (materia: string) =>
    [...new Set(lezioni.filter((l) => l.materia === materia && l.istruttore_id).map((l) => l.istruttore_id!))].map((id) => nomeUtente(dati, id)).join(', ');

  return (
    <>
      <IntestazionePagina titolo="Situazione della teoria" sotto={`${corso.nome} · ${programma.nome}`} />

      <div className="cartiglio compatto">
        <div className="c-numero">
          <div>
            <span className="etichetta">Ore ancora da programmare</span>
            <div className="numero-monumentale">
              {(stato.totale.residui / 60).toLocaleString('it-IT', { maximumFractionDigits: 1 })}
              <small>h</small>
            </div>
            <div className="cifre debole" style={{ fontWeight: 600, marginTop: 4 }}>
              su {ore(stato.totale.minuti)} del programma
            </div>
          </div>
        </div>
        <div className="c-2">
          <span className="etichetta">A calendario</span>
          <div className="valore cifre">{ore(stato.totale.pianificati)}</div>
        </div>
        <div className="c-2">
          <span className="etichetta">Già svolte</span>
          <div className="valore cifre">{ore(stato.svolti)}</div>
        </div>
        <div className="c-2">
          <span className="etichetta">Settimane stimate</span>
          <div className="valore cifre">{settimane || '—'}</div>
        </div>
        <div className="c-periodo">
          <span className="etichetta">Ultimo giorno a calendario</span>
          <div className="valore codice">{ultima ? formatoData(ultima) : '—'}</div>
        </div>
        <div className="c-2 c-luogo">
          <span className="etichetta">Prossima materia</span>
          <div className="valore">{stato.prossima?.titolo ?? 'programma completo'}</div>
        </div>
      </div>

      <Sezione titolo="Quote per modulo">
        <div className="quote mtt">
          {stato.moduli.map((m) => (
            <Quota
              key={m.numero}
              nome={`Modulo ${m.numero}`}
              sotto={oreDaMinuti(m.minuti)}
              riga={{
                codice: String(m.numero),
                titolo: m.titolo,
                previsti: Math.round(m.minuti / 60),
                eseguiti: Math.round(m.pianificati / 60),
                percentuale: (m.pianificati / m.minuti) * 100,
                conforme: null,
                mancano: 0,
              }}
            />
          ))}
          <ScalaQuote />
        </div>
      </Sezione>

      <Sezione titolo={`Materie · ${stato.materie.length}`}>
        <div className="scorre">
          <table className="tabella">
            <thead>
              <tr>
                <th>Modulo</th>
                <th>Materia</th>
                <th className="num">Ore</th>
                <th className="num">A calendario</th>
                <th className="num">Residue</th>
                <th>Istruttori</th>
              </tr>
            </thead>
            <tbody>
              {stato.materie.map((r) => (
                <tr key={r.materia.id} className={r.residui === 0 ? undefined : undefined}>
                  <td className="cifre" style={{ whiteSpace: 'nowrap' }}>
                    M{r.materia.modulo}
                  </td>
                  <td style={{ minWidth: 240 }}>
                    <strong>{r.materia.titolo}</strong>
                    <div className="debole" style={{ fontSize: 'var(--fs-s)' }}>
                      {chapterMateria(r.materia)}
                    </div>
                  </td>
                  <td className="num">{oreDaMinuti(r.materia.minuti)}</td>
                  <td className={`num ${r.pianificati ? 'si' : ''}`}>{r.pianificati ? oreDaMinuti(r.pianificati) : '—'}</td>
                  <td className={`num ${r.residui ? 'rosso' : ''}`}>
                    {r.residui ? (
                      oreDaMinuti(r.residui)
                    ) : (
                      <span className="esito-cella">
                        <IconCircleCheckFilled size={15} aria-hidden /> ok
                      </span>
                    )}
                  </td>
                  <td>{istruttoriDiMateria(r.materia.id) || <span className="rosso esito-cella"><IconAlertTriangleFilled size={14} aria-hidden /> da assegnare</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Sezione>
    </>
  );
}
