import { Accordion, Badge, Text } from '@mantine/core';
import { IconAlertTriangleFilled, IconCircleCheckFilled } from '@tabler/icons-react';
import { oggiISO, ruoloNelCorso } from '../../dominio/motore';
import { SOGLIA_ASSENZE, assenzeDi, limiteAssenze } from '../../dominio/presenze';
import { chapterMateria, oreDaMinuti, programmaTeorico } from '../../dominio/programmi';
import { formatoData, formatoMinuti, frequentatori, lezioniVisibili, nomeUtente, ore, presenzeDi, rapportiniDi } from '../../dominio/viste';
import { IntestazionePagina, Sezione } from '../componenti/disegno';
import { useCorso } from '../navigazione';
import { useStato } from '../stato';

/** Assenze della parte teorica: quante ore, in quali materie, e idoneità all'esame (limite 10%). */
export function Assenze() {
  const { dati, utente } = useStato();
  const corso = useCorso();
  const programma = programmaTeorico(corso?.programma_teorico);
  if (!dati || !utente || !corso || !programma) return null;
  const ruolo = ruoloNelCorso(dati, utente, corso.id);
  const lezioni = lezioniVisibili(dati, corso.id, ruolo);
  const rapportini = rapportiniDi(dati, corso.id);
  const presenze = presenzeDi(dati, corso.id);
  const elenco = ruolo === 'trainee' ? frequentatori(dati, corso.id).filter((u) => u.id === utente.id) : frequentatori(dati, corso.id);
  const righe = elenco.map((u) => ({ utente: u, s: assenzeDi(programma, corso, lezioni, rapportini, presenze, u.id) }));
  const limite = limiteAssenze(programma);
  const nonIdonei = righe.filter((r) => !r.s.idoneo).length;
  const daValidare = rapportini.filter((r) => !r.validato_il).length;
  const svolte = lezioni.filter((l) => l.data <= oggiISO()).reduce((s, l) => s + l.minuti, 0);

  return (
    <>
      <IntestazionePagina titolo="Assenze e idoneità" sotto={`${corso.nome} · ${programma.nome}`} />

      <div className="cartiglio compatto">
        <div className="c-numero">
          <div>
            <span className="etichetta">Limite di assenza</span>
            <div className="numero-monumentale">
              {(limite / 60).toLocaleString('it-IT', { maximumFractionDigits: 1 })}
              <small>h</small>
            </div>
            <div className="cifre debole" style={{ fontWeight: 600, marginTop: 4 }}>
              {SOGLIA_ASSENZE * 100}% di {ore(programma.moduli.reduce((s, m) => s + m.minuti, 0))}
            </div>
          </div>
        </div>
        <div className="c-2">
          <span className="etichetta">Lezioni già svolte</span>
          <div className="valore cifre">{ore(svolte)}</div>
        </div>
        <div className="c-2">
          <span className="etichetta">Non idonei</span>
          <div className={`valore cifre ${nonIdonei ? 'rosso' : ''}`}>{nonIdonei}</div>
        </div>
        <div className="c-2">
          <span className="etichetta">Rapportini da validare</span>
          <div className={`valore cifre ${daValidare ? 'rosso' : ''}`}>{daValidare}</div>
        </div>
        <div className="c-periodo">
          <span className="etichetta">Giornate rilevate</span>
          <div className="valore codice">{rapportini.length}</div>
        </div>
        <div className="c-2 c-luogo">
          <span className="etichetta">Regola</span>
          <div className="valore">Non idoneo all’esame teorico al raggiungimento del 10% di assenze</div>
        </div>
      </div>

      <Sezione titolo={`Situazione · ${righe.length} frequentatori`}>
        {!rapportini.length && <Text className="debole">Nessun rapportino presenze compilato: finché non si compila, tutti risultano presenti.</Text>}
        <Accordion variant="separated" chevronPosition="left">
          {righe.map(({ utente: u, s }) => (
            <Accordion.Item key={u.id} value={u.id}>
              <Accordion.Control>
                <div className="riga-assenze">
                  <strong>{nomeUtente(dati, u.id)}</strong>
                  <span className={`cifre ${s.minuti ? 'rosso' : 'debole'}`}>{formatoMinuti(s.minuti)}</span>
                  <span className="cifre debole">{s.percentuale.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%</span>
                  {s.recuperati > 0 && (
                    <Badge size="sm" color="inchiostro" variant="light">
                      recuperate {formatoMinuti(s.recuperati)}
                    </Badge>
                  )}
                  <Badge size="sm" color={s.idoneo ? 'inchiostro' : 'rosso'} variant={s.idoneo ? 'light' : 'filled'}>
                    {s.idoneo ? 'Idoneo' : 'Non idoneo'}
                  </Badge>
                </div>
              </Accordion.Control>
              <Accordion.Panel>
                {!s.assenze.length ? (
                  <Text className="debole">Nessuna assenza rilevata.</Text>
                ) : (
                  <>
                    <div className="scorre">
                      <table className="tabella">
                        <thead>
                          <tr>
                            <th>Materia</th>
                            <th className="num">Assenza</th>
                            <th className="num">Recuperata</th>
                            <th className="num">Residua</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.materie.map((m) => (
                            <tr key={m.materia.id}>
                              <td style={{ minWidth: 220 }}>
                                <strong>{m.materia.titolo}</strong>
                                <div className="debole" style={{ fontSize: 'var(--fs-s)' }}>
                                  M{m.materia.modulo} · {chapterMateria(m.materia)}
                                </div>
                              </td>
                              <td className="num">{oreDaMinuti(m.minuti)}</td>
                              <td className={`num ${m.recuperati ? 'si' : ''}`}>{m.recuperati ? oreDaMinuti(m.recuperati) : '—'}</td>
                              <td className={`num ${m.residui ? 'rosso' : ''}`}>
                                {m.residui ? (
                                  oreDaMinuti(m.residui)
                                ) : (
                                  <span className="esito-cella">
                                    <IconCircleCheckFilled size={15} aria-hidden /> ok
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="scorre" style={{ marginTop: 16 }}>
                      <table className="tabella">
                        <thead>
                          <tr>
                            <th>Data</th>
                            <th>Orario</th>
                            <th>Materia</th>
                            <th className="num">Durata</th>
                            <th>Motivo</th>
                            <th>Stato</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.assenze.map((a) => (
                            <tr key={a.lezione.id}>
                              <td className="cifre" style={{ whiteSpace: 'nowrap' }}>
                                {formatoData(a.lezione.data)}
                              </td>
                              <td className="cifre" style={{ whiteSpace: 'nowrap' }}>
                                {a.orario.inizio}–{a.orario.fine}
                              </td>
                              <td>{a.materia?.titolo ?? a.lezione.materia}</td>
                              <td className="num">{formatoMinuti(a.lezione.minuti)}</td>
                              <td className="debole">{a.motivo || '—'}</td>
                              <td>
                                {a.recuperata ? (
                                  <span className="esito-cella si">
                                    <IconCircleCheckFilled size={15} aria-hidden /> recuperata
                                  </span>
                                ) : a.validata ? (
                                  <span className="rosso">assenza</span>
                                ) : (
                                  <span className="esito-cella rosso">
                                    <IconAlertTriangleFilled size={14} aria-hidden /> da validare
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      </Sezione>
    </>
  );
}
