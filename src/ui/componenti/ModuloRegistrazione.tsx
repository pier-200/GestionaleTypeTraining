import { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Button, Drawer, Group, NumberInput, SegmentedControl, Select, Stack, Text, TextInput } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import { nuovoUuid } from '../../backend/github/crittografia';
import { indice, programmaPratico } from '../../dominio/programmi';
import { ErroreApp } from '../../dominio/errori';
import { oggiISO, validaRegistrazione, type CampiRegistrazione } from '../../dominio/motore';
import type { Corso, Registrazione, TipoEsecuzione, Utente } from '../../dominio/tipi';
import { nomeIstruttore } from '../../dominio/viste';
import { useStato } from '../stato';
import { useCampoVisibile } from './tastiera';

interface Props {
  aperto: boolean;
  chiudi: () => void;
  frequentatore: Utente;
  corso: Corso;
  /** Task preselezionato (dalla riga del logbook). */
  taskId?: number | null;
  /** Registrazione da modificare. */
  modifica?: Registrazione | null;
}

const MINUTI_RAPIDI = [15, 30, 45, 60, 90, 120];

/** Form della registrazione, pensato per il pollice: campi in colonna, valori recenti già proposti. */
export function ModuloRegistrazione({ aperto, chiudi, frequentatore, corso, taskId, modifica }: Props) {
  const { dati, esegui, segnaAppena } = useStato();
  const mobile = useMediaQuery('(max-width: 991px)');
  useCampoVisibile(aperto && Boolean(mobile));
  const programma = programmaPratico(corso.programma_pratico);
  const proprie = useMemo(
    () => (dati?.registrazioni ?? []).filter((r) => r.user_id === frequentatore.id && r.corso_id === corso.id).sort((a, b) => b.modificato_il.localeCompare(a.modificato_il)),
    [dati, frequentatore.id, corso.id],
  );
  const [campi, setCampi] = useState<CampiRegistrazione | null>(null);
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [nuovoIstr, setNuovoIstr] = useState<{ grado: string; nome: string; cognome: string } | null>(null);
  const [salvataggio, setSalvataggio] = useState(false);

  useEffect(() => {
    if (!aperto) return;
    const ultima = proprie[0];
    setErrori({});
    setNuovoIstr(null);
    setCampi(
      modifica
        ? { ...modifica }
        : {
            id: nuovoUuid(),
            corso_id: corso.id,
            user_id: frequentatore.id,
            task_id: taskId ?? 0,
            // si ripropongono luogo, aeromobile e istruttore dell'ultima registrazione
            maintenance_location: ultima?.maintenance_location ?? '',
            data: oggiISO(),
            tipo_esecuzione: ultima?.tipo_esecuzione ?? 'AC',
            matricola: ultima?.matricola ?? '',
            et_minuti: 0,
            instructor_id: ultima?.instructor_id ?? '',
          },
    );
  }, [aperto]);

  if (!dati || !programma) return null;
  const luoghi = [...new Set(proprie.map((r) => r.maintenance_location))];
  const matricole = [...new Set(dati.registrazioni.filter((r) => r.tipo_esecuzione === 'AC').map((r) => r.matricola))];
  const istruttori = [...dati.istruttori].sort((a, b) => a.cognome.localeCompare(b.cognome));
  const task = campi ? indice(programma).taskPerId.get(campi.task_id) : undefined;
  const aggiorna = (x: Partial<CampiRegistrazione>) => setCampi((c) => (c ? { ...c, ...x } : c));

  async function salva() {
    if (!campi || !dati) return;
    const idNuovo = nuovoIstr ? nuovoUuid() : null;
    const pronta = { ...campi, instructor_id: idNuovo ?? campi.instructor_id };
    const elenco = idNuovo && nuovoIstr ? [...dati.istruttori, { id: idNuovo, ...nuovoIstr, created_at: '', created_by: null }] : dati.istruttori;
    try {
      validaRegistrazione(pronta, oggiISO(), elenco, corso.programma_pratico);
    } catch (e) {
      if (e instanceof ErroreApp && e.dettagli) return setErrori(e.dettagli);
      throw e;
    }
    setSalvataggio(true);
    try {
      if (idNuovo && nuovoIstr) {
        if (!(await esegui({ tipo: 'istruttore.crea', istruttore: { id: idNuovo, ...nuovoIstr } }))) return;
        setNuovoIstr(null);
        aggiorna({ instructor_id: idNuovo });
      }
      if (await esegui({ tipo: 'registrazione.salva', registrazione: pronta }, modifica ? 'Registrazione aggiornata' : `Task ${pronta.task_id} registrato`)) {
        segnaAppena(pronta.task_id);
        chiudi();
      }
    } finally {
      setSalvataggio(false);
    }
  }

  return (
    <Drawer
      opened={aperto}
      onClose={chiudi}
      position={mobile ? 'bottom' : 'right'}
      size={mobile ? '94%' : 480}
      title={<span className="titolo-sezione">{modifica ? 'Modifica registrazione' : 'Registra task'}</span>}
      styles={{ body: { paddingBottom: mobile ? '45vh' : 'calc(24px + env(safe-area-inset-bottom))' } }}
    >
      {campi && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void salva();
          }}
        >
          <Stack gap="md">
            {taskId && !modifica ? null : (
              <Select
                label="Task"
                placeholder="Cerca per numero, chapter o descrizione"
                searchable
                value={campi.task_id ? String(campi.task_id) : null}
                onChange={(v) => aggiorna({ task_id: Number(v) || 0 })}
                data={programma.task.map((t) => ({ value: String(t.id), label: `${t.id} · Ch ${t.chapter} · ${t.tipo} · ${t.descrizione}` }))}
                error={errori.task_id}
                maxDropdownHeight={260}
                comboboxProps={{ withinPortal: true, middlewares: { flip: true, shift: true } }}
                disabled={Boolean(modifica)}
                limit={60}
              />
            )}
            {task && (
              <div style={{ borderLeft: 0, background: 'var(--superficie-2)', padding: '10px 12px', border: '1px solid var(--traccia)' }}>
                <Text className="etichetta" component="div">
                  Task {task.id} · Modulo {task.modulo} · Ch {task.chapter} · {task.tipo}
                </Text>
                <Text size="sm" mt={4}>
                  {task.descrizione}
                </Text>
              </div>
            )}

            <TextInput
              type="date"
              label="Data"
              value={campi.data}
              max={oggiISO()}
              onChange={(e) => aggiorna({ data: e.currentTarget.value })}
              error={errori.data}
              required
            />

            <div>
              <Text size="sm" fw={500} mb={4}>
                Eseguito su
              </Text>
              <SegmentedControl
                fullWidth
                value={campi.tipo_esecuzione}
                onChange={(v) => aggiorna({ tipo_esecuzione: v as TipoEsecuzione })}
                data={[
                  { value: 'AC', label: 'Aeromobile' },
                  { value: 'SIM', label: 'SIM' },
                  { value: 'CLA', label: 'CLA (aula)' },
                ]}
              />
              {campi.tipo_esecuzione !== 'AC' && (
                <Text size="xs" c="dimmed" mt={4}>
                  Da limitare: il documento chiede di minimizzare i task svolti in simulatore o in aula.
                </Text>
              )}
            </div>

            {campi.tipo_esecuzione === 'AC' && (
              <Autocomplete
                label="Matricola e n. identificativo aeromobile"
                placeholder="es. MM81781 · EI-901"
                value={campi.matricola}
                onChange={(v) => aggiorna({ matricola: v })}
                data={matricole}
                error={errori.matricola}
                required
              />
            )}

            <Autocomplete
              label="Maintenance location"
              placeholder="es. Viterbo – Hangar 3"
              value={campi.maintenance_location}
              onChange={(v) => aggiorna({ maintenance_location: v })}
              data={luoghi}
              error={errori.maintenance_location}
              required
            />

            <div>
              <NumberInput
                label="ET – tempo stimato (minuti)"
                value={campi.et_minuti || ''}
                onChange={(v) => aggiorna({ et_minuti: Number(v) || 0 })}
                min={1}
                max={1440}
                allowDecimal={false}
                hideControls
                inputMode="numeric"
                error={errori.et_minuti}
                required
              />
              <div className="chips" style={{ marginTop: 8 }}>
                {MINUTI_RAPIDI.map((m) => (
                  <button key={m} type="button" className="chip" aria-pressed={campi.et_minuti === m} onClick={() => aggiorna({ et_minuti: m })}>
                    {m}′
                  </button>
                ))}
              </div>
            </div>

            {nuovoIstr ? (
              <fieldset style={{ border: '1px solid var(--testo)', padding: '10px 12px 14px', margin: 0 }}>
                <legend className="etichetta" style={{ padding: '0 6px' }}>
                  Nuovo istruttore
                </legend>
                <Stack gap="xs">
                  <TextInput label="Grado" value={nuovoIstr.grado} onChange={(e) => setNuovoIstr({ ...nuovoIstr, grado: e.currentTarget.value })} required />
                  <TextInput label="Nome" value={nuovoIstr.nome} onChange={(e) => setNuovoIstr({ ...nuovoIstr, nome: e.currentTarget.value })} required />
                  <TextInput label="Cognome" value={nuovoIstr.cognome} onChange={(e) => setNuovoIstr({ ...nuovoIstr, cognome: e.currentTarget.value })} required />
                  <Button variant="subtle" size="compact-sm" onClick={() => setNuovoIstr(null)} style={{ alignSelf: 'flex-start' }}>
                    Scegli dall'elenco
                  </Button>
                </Stack>
              </fieldset>
            ) : (
              <div>
                <Select
                  label="Instructor"
                  placeholder="Chi ha supervisionato il task"
                  searchable
                  value={campi.instructor_id || null}
                  onChange={(v) => aggiorna({ instructor_id: v ?? '' })}
                  data={istruttori.map((i) => ({ value: i.id, label: nomeIstruttore(i) }))}
                  comboboxProps={{ withinPortal: true, middlewares: { flip: true, shift: true } }}
                  error={errori.instructor_id}
                  nothingFoundMessage="Non in elenco: aggiungilo qui sotto"
                  required
                />
                <Button variant="subtle" size="compact-sm" mt={6} leftSection={<IconPlus size={15} />} onClick={() => setNuovoIstr({ grado: '', nome: '', cognome: '' })}>
                  Istruttore non in elenco
                </Button>
              </div>
            )}

            <Group grow mt="sm">
              <Button variant="default" onClick={chiudi} size="md">
                Annulla
              </Button>
              <Button type="submit" size="md" loading={salvataggio} disabled={!campi.task_id}>
                Salva
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Drawer>
  );
}
