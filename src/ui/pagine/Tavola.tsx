import { useState } from 'react';
import { Button } from '@mantine/core';
import { IconAlertTriangleFilled, IconCircleCheckFilled, IconPlus } from '@tabler/icons-react';
import { indice, programmaPratico } from '../../dominio/programmi';
import type { Corso, Utente } from '../../dominio/tipi';
import { situazione } from '../../dominio/viste';
import { Cartiglio } from '../componenti/Cartiglio';
import { Revisioni } from '../componenti/Revisioni';
import { IntestazionePagina, Palloncino, Quota, ScalaQuote, Sezione } from '../componenti/disegno';
import { ConFrequentatore } from '../componenti/Frequentatore';
import { ModuloRegistrazione } from '../componenti/ModuloRegistrazione';
import { link as collegamento } from '../navigazione';
import { useStato } from '../stato';

export function Tavola() {
  return <ConFrequentatore>{(f, corso) => <TavolaDi f={f} corso={corso} />}</ConFrequentatore>;
}

function TavolaDi({ f, corso }: { f: Utente; corso: Corso }) {
  const { dati, utente } = useStato();
  const [registra, setRegistra] = useState(false);
  if (!dati || !utente) return null;
  const s = situazione(dati, corso, f);
  const puoScrivere = utente.ruolo === 'admin' || utente.id === f.id;
  const chapterPerCodice = programmaPratico(corso.programma_pratico) ? indice(programmaPratico(corso.programma_pratico)!).chapterPerCodice : new Map();
  const link = (percorso: string, extra = '') => collegamento(percorso, corso, f.id, extra);
  const { moduli, tipi, chapter } = s.mancanti;
  const nMancanze = moduli.length + tipi.length + chapter.length;
  const tipiApplicabili = s.report.perTipo.filter((t) => t.previsti > 0);
  const ultime = [...s.registrazioni].sort((a, b) => b.modificato_il.localeCompare(a.modificato_il)).slice(0, 6);

  return (
    <>
      {utente.ruolo !== 'trainee' && <IntestazionePagina titolo="Tavola del frequentatore" />}
      <Cartiglio dati={dati} corso={corso} utente={f} s={s} />

      {puoScrivere && (
        <div className="azione-fissa" style={{ marginTop: 16 }}>
          <Button size="lg" fullWidth leftSection={<IconPlus size={20} />} onClick={() => setRegistra(true)} style={{ maxWidth: 420 }}>
            Registra task
          </Button>
        </div>
      )}

      <div className="tavola-griglia">
        <div className="tavola-colonna">
          <div className="t-req">
            <Sezione
              titolo="Requisiti"
              azioni={
                <a className="etichetta" href={link('/report')}>
                  Report
                </a>
              }
            >
              <div className="requisiti">
                {[
                  { nome: 'Moduli al 50%', fatti: s.report.perModulo.length - moduli.length, tot: s.report.perModulo.length },
                  { nome: 'Task type al 50%', fatti: tipiApplicabili.length - tipi.length, tot: tipiApplicabili.length },
                  { nome: 'Chapter con almeno 1 task', fatti: s.report.perChapter.length - chapter.length, tot: s.report.perChapter.length },
                ].map((r) => (
                  <div key={r.nome} className={`requisito ${r.fatti === r.tot ? 'si' : ''}`}>
                    {r.fatti === r.tot ? <IconCircleCheckFilled size={20} aria-label="soddisfatto" /> : <IconAlertTriangleFilled size={20} color="var(--rosso)" aria-label="non soddisfatto" />}
                    <span>{r.nome}</span>
                    <strong className="cifre">
                      {r.fatti}/{r.tot}
                    </strong>
                  </div>
                ))}
              </div>
              {nMancanze === 0 && (
                <div className="tutto-ok" style={{ marginTop: 16 }}>
                  <IconCircleCheckFilled size={22} aria-hidden />
                  <span>Tutti i requisiti del PTR sono soddisfatti: il frequentatore può essere proposto per il Practical Assessment.</span>
                </div>
              )}
            </Sezione>
          </div>
          {chapter.length > 0 && (
            <div className="t-ch">
              <Sezione titolo={`Chapter senza task · ${chapter.length}`}>
                <p className="debole" style={{ margin: '0 0 10px', fontSize: 'var(--fs-m)' }}>
                  Serve almeno un task eseguito per ciascun chapter. Tocca un codice per vederne i task.
                </p>
                <div className="palloncini">
                  {chapter.map((c) => (
                    <a key={c.codice} href={link('/logbook', `ch=${encodeURIComponent(c.codice)}`)} title={chapterPerCodice.get(c.codice)?.titolo} aria-label={`Chapter ${c.codice}, ${chapterPerCodice.get(c.codice)?.titolo}: nessun task`}>
                      <Palloncino codice={c.codice} stato="manca" />
                    </a>
                  ))}
                </div>
              </Sezione>
            </div>
          )}
        </div>
        <div className="tavola-colonna">
          <div className="t-qm">
            <Sezione titolo="Quote per modulo">
              <div className="quote">
                {s.report.perModulo.map((m) => (
                  <Quota key={m.codice} nome={`Modulo ${m.codice}`} sotto={Number(m.codice) > 6 ? 'AVES' : 'P-66'} riga={m} href={link('/logbook', `mod=${m.codice}${m.conforme ? '' : '&stato=da-fare'}`)} />
                ))}
                <ScalaQuote />
              </div>
            </Sezione>
          </div>
          <div className="t-qt">
            <Sezione titolo="Quote per task type">
              <div className="quote">
                {tipiApplicabili.map((t) => (
                  <Quota key={t.codice} nome={t.codice} riga={t} href={link('/logbook', `tipo=${encodeURIComponent(t.codice)}${t.conforme ? '' : '&stato=da-fare'}`)} />
                ))}
                <ScalaQuote />
              </div>
            </Sezione>
          </div>
        </div>
      </div>

      <Sezione
        titolo="Revisioni · ultime registrazioni"
        azioni={
          <a className="etichetta" href={link('/logbook')}>
            Logbook completo
          </a>
        }
      >
        {ultime.length === 0 ? (
          <p className="debole" style={{ margin: 0 }}>
            Nessuna registrazione. Quando un task è stato eseguito, premi «Registra task»: comparirà qui e nel Compliance Report.
          </p>
        ) : (
          <Revisioni dati={dati} registrazioni={ultime} />
        )}
      </Sezione>

      {puoScrivere && <ModuloRegistrazione aperto={registra} chiudi={() => setRegistra(false)} frequentatore={f} corso={corso} />}
    </>
  );
}
