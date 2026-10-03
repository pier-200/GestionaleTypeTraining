import { useState } from 'react';
import { Button, Checkbox, Group, Select, Stack, Text } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { nuovoUuid } from '../../backend/github/crittografia';
import { ruoloNelCorso } from '../../dominio/motore';
import { programmaPratico, programmaTeorico } from '../../dominio/programmi';
import { ETICHETTA_RUOLO_CORSO, type RuoloCorso } from '../../dominio/tipi';
import { chiaveOrdine, formatoData, frequentatori, iscritti, nomeUtente } from '../../dominio/viste';
import { IntestazionePagina, Sezione } from '../componenti/disegno';
import { FormTraining } from './Dati';
import { useCorso } from '../navigazione';
import { useStato } from '../stato';

/** Dati del corso, iscritti e Practical Type Training Data dell'intero corso. */
export function Corso() {
  const { dati, utente, esegui } = useStato();
  const corso = useCorso();
  const [nuovo, setNuovo] = useState<{ user_id: string | null; ruolo: RuoloCorso }>({ user_id: null, ruolo: 'trainee' });
  const [scelti, setScelti] = useState<string[]>([]);
  if (!dati || !utente || !corso) return null;
  const mio = ruoloNelCorso(dati, utente, corso.id);
  const guida = mio === 'admin' || mio === 'direttore';
  const gruppi: [RuoloCorso, string][] = [
    ['trainee', 'Frequentatori'],
    ['instructor', 'Istruttori'],
    ['direttore', 'Direzione del corso'],
  ];
  const iscrivibili = dati.utenti
    .filter((u) => u.attivo && u.ruolo !== 'admin' && !dati.iscrizioni.some((i) => i.corso_id === corso.id && i.user_id === u.id))
    .sort((a, b) => chiaveOrdine(dati, a).localeCompare(chiaveOrdine(dati, b)));
  const allievi = frequentatori(dati, corso.id);

  return (
    <>
      <IntestazionePagina titolo={corso.nome} sotto={`${corso.codice} · ${formatoData(corso.data_inizio)} – ${formatoData(corso.data_fine)} · ${corso.location || 'sede da definire'}`} />

      <div className="cartiglio riepilogo-corso">
        <div>
          <span className="etichetta">Parte teorica</span>
          <div className="valore">{programmaTeorico(corso.programma_teorico)?.nome ?? '—'}</div>
        </div>
        <div>
          <span className="etichetta">Parte pratica</span>
          <div className="valore">{programmaPratico(corso.programma_pratico)?.nome ?? '—'}</div>
        </div>
        <div>
          <span className="etichetta">Lezioni al giorno</span>
          <div className="valore cifre">
            {corso.minuti_giorno.map((m) => m / 60).join(' · ')} h · dalle {corso.ora_inizio}
          </div>
        </div>
      </div>

      <Sezione titolo="Iscritti">
        {guida && (
          <Group align="flex-end" gap="sm" mb="md" className="non-stampare">
            <Select
              label="Aggiungi al corso"
              placeholder="Scegli un account"
              searchable
              value={nuovo.user_id}
              onChange={(v) => setNuovo({ ...nuovo, user_id: v })}
              data={iscrivibili.map((u) => ({ value: u.id, label: `${nomeUtente(dati, u.id)} · ${u.username}` }))}
              comboboxProps={{ withinPortal: true }}
              style={{ flex: '1 1 260px' }}
              nothingFoundMessage="Nessun account disponibile"
            />
            <Select
              label="Come"
              value={nuovo.ruolo}
              onChange={(v) => setNuovo({ ...nuovo, ruolo: (v as RuoloCorso) ?? 'trainee' })}
              data={gruppi.map(([value, label]) => ({ value, label: ETICHETTA_RUOLO_CORSO[value as RuoloCorso] || label }))}
              comboboxProps={{ withinPortal: true }}
              style={{ width: 170 }}
            />
            <Button
              leftSection={<IconPlus size={17} />}
              disabled={!nuovo.user_id}
              onClick={async () => {
                if (!nuovo.user_id) return;
                if (await esegui({ tipo: 'corso.iscrivi', iscrizione: { id: nuovoUuid(), corso_id: corso.id, user_id: nuovo.user_id, ruolo: nuovo.ruolo } }, 'Iscritto al corso')) {
                  setNuovo({ user_id: null, ruolo: nuovo.ruolo });
                }
              }}
            >
              Iscrivi
            </Button>
          </Group>
        )}
        <div className="griglia-2">
          {gruppi.map(([ruolo, titolo]) => {
            const elenco = iscritti(dati, corso.id, ruolo, true);
            return (
              <div key={ruolo}>
                <Text className="etichetta" mb={6}>
                  {titolo} · {elenco.length}
                </Text>
                {elenco.length === 0 ? (
                  <p className="debole" style={{ margin: 0 }}>
                    Nessuno.
                  </p>
                ) : (
                  <ul className="elenco-iscritti">
                    {elenco.map((u) => {
                      const iscrizione = dati.iscrizioni.find((i) => i.corso_id === corso.id && i.user_id === u.id)!;
                      return (
                        <li key={u.id}>
                          <span>
                            <strong>{nomeUtente(dati, u.id)}</strong>
                            <span className="debole" style={{ display: 'block', fontSize: 'var(--fs-s)' }}>
                              {u.username}
                              {u.attivo ? '' : ' · account disattivato'}
                            </span>
                          </span>
                          {guida && (
                            <Button
                              size="compact-sm"
                              variant="subtle"
                              color="rosso"
                              aria-label={`Togli ${u.username} dal corso`}
                              onClick={() => void esegui({ tipo: 'corso.disiscrivi', id: iscrizione.id }, 'Rimosso dal corso')}
                            >
                              <IconTrash size={16} />
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </Sezione>

      {guida && corso.programma_pratico && (
        <Sezione titolo="Practical type training data del corso">
          <div className="griglia-2">
            <div>
              <Text className="etichetta" mb={6}>
                Frequentatori
              </Text>
              <Checkbox
                label="Tutto il corso"
                checked={scelti.length === allievi.length && allievi.length > 0}
                indeterminate={scelti.length > 0 && scelti.length < allievi.length}
                onChange={(e) => setScelti(e.currentTarget.checked ? allievi.map((u) => u.id) : [])}
                mb="sm"
              />
              <Stack gap={8}>
                {allievi.map((u) => (
                  <Checkbox key={u.id} label={nomeUtente(dati, u.id)} checked={scelti.includes(u.id)} onChange={(e) => setScelti(e.currentTarget.checked ? [...scelti, u.id] : scelti.filter((x) => x !== u.id))} />
                ))}
              </Stack>
            </div>
            <div>
              <Text className="etichetta" mb={6}>
                Dati da salvare
              </Text>
              <FormTraining key={scelti.join()} corso={corso} userIds={scelti} sola={false} dopo={() => setScelti([])} />
              <Text size="xs" c="dimmed" mt="sm">
                I campi proposti sono quelli del primo frequentatore selezionato, altrimenti quelli del corso.
              </Text>
            </div>
          </div>
        </Sezione>
      )}
    </>
  );
}
