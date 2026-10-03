import { useState } from 'react';
import { Button, Checkbox, Group, Select, Text } from '@mantine/core';
import { IconAlertTriangleFilled } from '@tabler/icons-react';
import { ruoloNelCorso } from '../../dominio/motore';
import { chapterMateria, oreDaMinuti, programmaTeorico } from '../../dominio/programmi';
import { docenti, nomeUtente } from '../../dominio/viste';
import { IntestazionePagina, Sezione } from '../componenti/disegno';
import { useCorso } from '../navigazione';
import { useStato } from '../stato';

/** Materie del programma teorico e istruttori abilitati a erogarle. */
export function Materie() {
  const { dati, utente, esegui } = useStato();
  const corso = useCorso();
  const [scelto, setScelto] = useState<string | null>(null);
  const [selezione, setSelezione] = useState<string[] | null>(null);
  const [attesa, setAttesa] = useState(false);
  const programma = programmaTeorico(corso?.programma_teorico);
  if (!dati || !utente || !corso || !programma) return null;
  const ruolo = ruoloNelCorso(dati, utente, corso.id);
  const guida = ruolo === 'admin' || ruolo === 'direttore';
  const elenco = docenti(dati, corso.id);
  const abilitate = (userId: string) => dati.abilitazioni.filter((a) => a.user_id === userId && a.programma === programma.id).map((a) => a.materia);
  const correnti = selezione ?? (scelto ? abilitate(scelto) : []);
  const cambiata = scelto != null && selezione != null && JSON.stringify([...selezione].sort()) !== JSON.stringify([...abilitate(scelto)].sort());

  const salva = async () => {
    if (!scelto || !selezione) return;
    setAttesa(true);
    const ok = await esegui({ tipo: 'abilitazioni.imposta', user_id: scelto, programma: programma.id, materie: selezione }, 'Materie aggiornate');
    setAttesa(false);
    if (ok) setSelezione(null);
  };

  return (
    <>
      <IntestazionePagina titolo="Materie e istruttori" sotto={`${programma.nome} · ${programma.materie.length} materie, ${oreDaMinuti(programma.moduli.reduce((s, m) => s + m.minuti, 0))}`} />

      {guida && (
        <Sezione titolo="Chi può erogare quali materie">
          <Group align="flex-end" gap="sm" className="non-stampare">
            <Select
              label="Istruttore del corso"
              placeholder="Scegli"
              value={scelto}
              onChange={(v) => {
                setScelto(v);
                setSelezione(null);
              }}
              data={elenco.map((u) => ({ value: u.id, label: nomeUtente(dati, u.id) }))}
              comboboxProps={{ withinPortal: true }}
              style={{ flex: '1 1 260px' }}
              nothingFoundMessage="Nessun istruttore iscritto al corso"
            />
            {scelto && (
              <>
                <Button variant="default" onClick={() => setSelezione(programma.materie.map((m) => m.id))}>
                  Tutte
                </Button>
                <Button variant="default" onClick={() => setSelezione([])}>
                  Nessuna
                </Button>
                <Button onClick={() => void salva()} loading={attesa} disabled={!cambiata}>
                  Salva
                </Button>
              </>
            )}
          </Group>

          {scelto && (
            <div className="materie-scelta">
              {programma.moduli.map((m) => {
                const materie = programma.materie.filter((x) => x.modulo === m.numero);
                const tutte = materie.every((x) => correnti.includes(x.id));
                return (
                  <div key={m.numero} className="modulo-materie">
                    <Checkbox
                      label={
                        <span>
                          <b>Modulo {m.numero}</b> <span className="debole">{m.titolo}</span>
                        </span>
                      }
                      checked={tutte}
                      indeterminate={!tutte && materie.some((x) => correnti.includes(x.id))}
                      onChange={(e) =>
                        setSelezione(e.currentTarget.checked ? [...new Set([...correnti, ...materie.map((x) => x.id)])] : correnti.filter((id) => !materie.some((x) => x.id === id)))
                      }
                    />
                    <div className="materie-elenco">
                      {materie.map((x) => (
                        <Checkbox
                          key={x.id}
                          size="sm"
                          label={
                            <span>
                              {x.titolo} <span className="debole cifre">· {oreDaMinuti(x.minuti)}</span>
                            </span>
                          }
                          checked={correnti.includes(x.id)}
                          onChange={(e) => setSelezione(e.currentTarget.checked ? [...correnti, x.id] : correnti.filter((id) => id !== x.id))}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Sezione>
      )}

      <Sezione titolo="Copertura del programma">
        <div className="scorre">
          <table className="tabella">
            <thead>
              <tr>
                <th>Modulo</th>
                <th>Materia</th>
                <th className="num">Ore</th>
                <th>Istruttori abilitati</th>
              </tr>
            </thead>
            <tbody>
              {programma.materie.map((m) => {
                const chi = elenco.filter((u) => dati.abilitazioni.some((a) => a.user_id === u.id && a.programma === programma.id && a.materia === m.id));
                return (
                  <tr key={m.id}>
                    <td className="cifre">M{m.modulo}</td>
                    <td style={{ minWidth: 240 }}>
                      <strong>{m.titolo}</strong>
                      <div className="debole" style={{ fontSize: 'var(--fs-s)' }}>
                        {chapterMateria(m)}
                      </div>
                    </td>
                    <td className="num">{oreDaMinuti(m.minuti)}</td>
                    <td>
                      {chi.length ? (
                        chi.map((u) => nomeUtente(dati, u.id)).join(', ')
                      ) : (
                        <span className="rosso esito-cella">
                          <IconAlertTriangleFilled size={14} aria-hidden /> nessuno
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Text className="debole" mt="sm" size="sm">
          Senza istruttori abilitati la materia resta assegnabile a chiunque segua il corso.
        </Text>
      </Sezione>
    </>
  );
}
