import { Button } from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';
import { formatoPercentuale, type RigaReport } from '../../dominio/compliance';
import { oggiISO, ruoloNelCorso } from '../../dominio/motore';
import { programmaPratico, programmaTeorico, soloTeorica, titoloBreveModulo } from '../../dominio/programmi';
import { avanzamento, formatoData, mediaPratica, ore, type Situazione } from '../../dominio/viste';
import { Ciambella, IntestazionePagina, Quota, ScalaQuote, Timbro } from '../componenti/disegno';
import { link, useCorso, useFrequentatore } from '../navigazione';
import { useStato } from '../stato';

const perc = (fatti: number, previsti: number) => (previsti ? Math.round((fatti / previsti) * 1000) / 10 : 0);

/** Pagina d'ingresso del corso: a che punto sono la parte teorica e quella pratica, modulo per modulo. */
export function Quadro() {
  const { dati, utente } = useStato();
  const corso = useCorso();
  const scelto = useFrequentatore();
  if (!dati || !utente || !corso) return null;
  const ruolo = ruoloNelCorso(dati, utente, corso.id);
  const { teoria, pratica } = avanzamento(dati, corso, utente, ruolo, oggiISO());
  const teorico = programmaTeorico(corso.programma_teorico);
  const pratico = programmaPratico(corso.programma_pratico);
  const titoloModulo = (n: number) => titoloBreveModulo(teorico?.moduli.find((m) => m.numero === n)?.titolo ?? '');
  const frequentatore = ruolo === 'trainee';
  const f = frequentatore ? utente.id : scelto?.id;

  return (
    <>
      <IntestazionePagina
        titolo={corso.nome}
        sotto={`${corso.codice} · ${corso.mds} Cat. ${corso.categoria} · ${formatoData(corso.data_inizio)} – ${formatoData(corso.data_fine)}`}
      />

      <div className="quadro-parti">
        <section className="parte">
          <header className="parte-testa">
            <span className="tag-parte mtt">MTT · parte teorica</span>
            <h2 className="titolo-sezione">{teorico?.nome ?? 'Programma teorico da caricare'}</h2>
          </header>
          {teoria && teorico ? (
            <>
              <div className="parte-cifre">
                <div>
                  <span className="etichetta">Svolto</span>
                  <div className="numero-monumentale">
                    {formatoPercentuale(perc(teoria.svolti, teoria.totale.minuti)).replace('%', '')}
                    <small>%</small>
                  </div>
                </div>
                <dl className="scheda-numeri">
                  <div>
                    <dt>Ore svolte</dt>
                    <dd>
                      {ore(teoria.svolti)} <span className="debole">/ {ore(teoria.totale.minuti)}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>A calendario</dt>
                    <dd>{ore(teoria.totale.pianificati)}</dd>
                  </div>
                  <div>
                    <dt>Da programmare</dt>
                    <dd className={teoria.totale.residui ? 'rosso' : 'si'}>{ore(teoria.totale.residui)}</dd>
                  </div>
                </dl>
              </div>
              <div className="quote">
                {teoria.moduli.map((m) => (
                  <Quota
                    key={m.numero}
                    nome={`Modulo ${m.numero}`}
                    sotto={titoloModulo(m.numero)}
                    riga={modulo(String(m.numero), Math.round(m.svolti / 60), Math.round(m.minuti / 60), perc(m.svolti, m.minuti))}
                  />
                ))}
              </div>
              <div className="parte-azioni">
                <Button component="a" href={link('/settimana', corso)} size="sm" rightSection={<IconArrowRight size={16} />}>
                  Programma settimanale
                </Button>
                <Button component="a" href={link('/teoria', corso)} size="sm" variant="default">
                  Situazione per materia
                </Button>
                <Button component="a" href={link('/assenze', corso)} size="sm" variant="default">
                  Assenze e idoneità
                </Button>
              </div>
            </>
          ) : (
            <p className="debole">Il programma teorico per {corso.mds} Cat. {corso.categoria} non è ancora caricato.</p>
          )}
        </section>

        <section className="parte">
          <header className="parte-testa">
            <span className="tag-parte ptt">PTT · parte pratica · logbook</span>
            <h2 className="titolo-sezione">{pratico?.nome ?? (soloTeorica(corso.categoria) ? 'Non prevista' : 'Programma pratico da caricare')}</h2>
          </header>
          {!pratica || !pratico ? (
            <p className="debole">
              {soloTeorica(corso.categoria)
                ? `La categoria ${corso.categoria} prevede solo la parte teorica.`
                : `Il programma pratico per ${corso.mds} Cat. ${corso.categoria} non è ancora caricato.`}
            </p>
          ) : frequentatore ? (
            praticaPersonale(pratica[0])
          ) : pratica.length === 0 ? (
            <p className="debole">Nessun frequentatore iscritto al corso.</p>
          ) : (
            <>
              <div className="parte-cifre">
                <div>
                  <span className="etichetta">Media eseguiti</span>
                  <div className="numero-monumentale">
                    {formatoPercentuale(Math.round(mediaPratica(pratica) * 10) / 10).replace('%', '')}
                    <small>%</small>
                  </div>
                </div>
                <dl className="scheda-numeri">
                  <div>
                    <dt>Conformi</dt>
                    <dd>
                      {pratica.filter((s) => s.report.conforme).length} <span className="debole">/ {pratica.length}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Task del programma</dt>
                    <dd>{pratico.task.length}</dd>
                  </div>
                </dl>
              </div>
              <div className="quote">
                {pratico.moduli.map((m) => {
                  const righe = pratica.map((s) => s.report.perModulo.find((r) => r.codice === String(m.numero))).filter((r): r is RigaReport => !!r);
                  const previsti = righe[0]?.previsti ?? 0;
                  const media = righe.reduce((t, r) => t + r.eseguiti, 0) / (righe.length || 1);
                  const conformi = righe.filter((r) => r.conforme).length;
                  return (
                    <Quota
                      key={m.numero}
                      nome={`Modulo ${m.numero}`}
                      sotto={`${titoloModulo(m.numero)} · conformi ${conformi}/${righe.length}`}
                      riga={modulo(String(m.numero), Math.round(media), previsti, perc(media, previsti))}
                    />
                  );
                })}
                <ScalaQuote />
              </div>
              <div className="parte-azioni">
                <Button component="a" href={link('/distinta', corso)} size="sm" rightSection={<IconArrowRight size={16} />}>
                  Situazione per frequentatore
                </Button>
                {f && (
                  <Button component="a" href={link('/logbook', corso, f)} size="sm" variant="default">
                    Logbook
                  </Button>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );

  function praticaPersonale(s: Situazione) {
    return (
      <>
        <div className="parte-cifre">
          <Ciambella eseguiti={s.report.totale.eseguiti} previsti={s.report.totale.previsti} dimensione={104} />
          <dl className="scheda-numeri">
            <div>
              <dt>Eseguiti</dt>
              <dd>{formatoPercentuale(s.report.totale.percentuale)}</dd>
            </div>
            <div>
              <dt>Chapter scoperti</dt>
              <dd className={s.mancanti.chapter.length ? 'rosso' : 'si'}>{s.mancanti.chapter.length}</dd>
            </div>
            <div>
              <dt>Esito</dt>
              <dd>
                <Timbro conforme={s.report.conforme} piccolo />
              </dd>
            </div>
          </dl>
        </div>
        <div className="quote">
          {s.report.perModulo.map((r) => (
            <Quota key={r.codice} nome={`Modulo ${r.codice}`} sotto={titoloModulo(Number(r.codice))} riga={r} href={link('/tavola', corso, s.utente.id)} />
          ))}
          {s.report.perTipo
            .filter((r) => r.previsti)
            .map((r) => (
              <Quota key={r.codice} nome={r.codice} sotto={r.titolo} riga={r} />
            ))}
          <ScalaQuote />
        </div>
        <div className="parte-azioni">
          <Button component="a" href={link('/logbook', corso, s.utente.id)} size="sm" rightSection={<IconArrowRight size={16} />}>
            Logbook
          </Button>
          <Button component="a" href={link('/report', corso, s.utente.id)} size="sm" variant="default">
            Compliance Report
          </Button>
        </div>
      </>
    );
  }
}

/** Riga di quota senza soglia (avanzamento puro, nessun requisito da segnalare in rosso). */
const modulo = (codice: string, eseguiti: number, previsti: number, percentuale: number): RigaReport => ({
  codice,
  titolo: '',
  previsti,
  eseguiti,
  percentuale,
  conforme: null,
  mancano: 0,
});
