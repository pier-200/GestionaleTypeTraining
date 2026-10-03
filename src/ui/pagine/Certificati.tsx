import { useState } from 'react';
import { Badge, Button, Drawer, Group, NumberInput, Select, SimpleGrid, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { IconCertificate, IconFileSpreadsheet, IconPlus, IconTrash } from '@tabler/icons-react';
import { nuovoUuid } from '../../backend/github/crittografia';
import { esportaCertificati } from '../../esporta';
import { ESITI_PROVA, STATI_CERTIFICATO, TIPI_CERTIFICATO, oggiISO, prossimoNumero, type CampiCertificato } from '../../dominio/motore';
import { programmaPratico, programmaTeorico } from '../../dominio/programmi';
import { ETICHETTA_CERTIFICATO, ETICHETTA_STATO_CERTIFICATO, type Certificato, type Corso, type EsitoProva, type TipoCertificato } from '../../dominio/tipi';
import { formatoData, frequentatori, nomeUtente } from '../../dominio/viste';
import { IntestazionePagina, Sezione } from '../componenti/disegno';
import { useCampoVisibile } from '../componenti/tastiera';
import { useStato } from '../stato';

const numeroRegistro = (c: { numero: number; anno: number }) => `${String(c.numero).padStart(3, '0')}/${c.anno}`;

/** Registro dei certificati AER(EP).P-147: numerazione, compilazione e rilascio. */
export function Certificati() {
  const { dati, utente } = useStato();
  const [modifica, setModifica] = useState<Certificato | 'nuovo' | null>(null);
  if (!dati || !utente) return null;
  const elenco = [...dati.certificati].sort((a, b) => b.anno - a.anno || b.numero - a.numero);
  const anno = new Date().getFullYear();
  const diQuestAnno = elenco.filter((c) => c.anno === anno);

  return (
    <>
      <IntestazionePagina
        titolo="Registro dei certificati"
        sotto="Certificati AER(EP).P-147 rilasciati al termine del corso"
        azioni={
          <>
            <Button variant="default" leftSection={<IconFileSpreadsheet size={17} />} onClick={() => void esportaCertificati(dati)} disabled={!elenco.length}>
              Excel
            </Button>
            <Button leftSection={<IconPlus size={17} />} onClick={() => setModifica('nuovo')}>
              Nuovo certificato
            </Button>
          </>
        }
      />

      <div className="cartiglio compatto">
        <div className="c-numero">
          <div>
            <span className="etichetta">Rilasciati nel {anno}</span>
            <div className="numero-monumentale">{diQuestAnno.filter((c) => c.stato === 'rilasciato').length}</div>
            <div className="cifre debole" style={{ fontWeight: 600, marginTop: 4 }}>
              su {elenco.filter((c) => c.stato === 'rilasciato').length} in tutto il registro
            </div>
          </div>
        </div>
        <div className="c-2">
          <span className="etichetta">In preparazione</span>
          <div className="valore cifre">{elenco.filter((c) => c.stato === 'bozza').length}</div>
        </div>
        <div className="c-2">
          <span className="etichetta">Annullati</span>
          <div className="valore cifre">{elenco.filter((c) => c.stato === 'annullato').length}</div>
        </div>
        <div className="c-2">
          <span className="etichetta">Prossimo numero</span>
          <div className="valore cifre">{numeroRegistro({ numero: prossimoNumero(dati, anno), anno })}</div>
        </div>
        <div className="c-periodo">
          <span className="etichetta">Riferimento</span>
          <div className="valore codice">AER(EP).P-147</div>
        </div>
        <div className="c-2 c-luogo">
          <span className="etichetta">Tenuto da</span>
          <div className="valore">{nomeUtente(dati, utente.id)}</div>
        </div>
      </div>

      <Sezione titolo={`Certificati · ${elenco.length}`}>
        {!elenco.length && <Text className="debole">Registro vuoto: con «Nuovo certificato» si compila il primo.</Text>}
        <div className="scorre">
          <table className="tabella">
            <thead>
              <tr>
                <th>N.</th>
                <th>Intestatario</th>
                <th>Corso</th>
                <th>Tipo</th>
                <th>Esame teorico</th>
                <th>Valutazione pratica</th>
                <th>Rilascio</th>
                <th>Stato</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {elenco.map((c) => {
                const corso = dati.corsi.find((x) => x.id === c.corso_id);
                const prova = (data: string | null, esito: EsitoProva) => (data || esito ? `${formatoData(data)}${esito ? ` · ${esito}` : ''}` : '—');
                return (
                  <tr key={c.id}>
                    <td className="cifre" style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {numeroRegistro(c)}
                    </td>
                    <td style={{ minWidth: 180 }}>
                      <strong>{nomeUtente(dati, c.user_id)}</strong>
                      <div className="debole" style={{ fontSize: 'var(--fs-s)' }}>
                        {c.mds} {c.categoria}
                      </div>
                    </td>
                    <td className="cifre">{corso?.codice ?? '—'}</td>
                    <td style={{ minWidth: 150 }}>{ETICHETTA_CERTIFICATO[c.tipo]}</td>
                    <td className={c.esame_esito === 'non superato' ? 'rosso' : ''}>{prova(c.esame_data, c.esame_esito)}</td>
                    <td className={c.pratica_esito === 'non superato' ? 'rosso' : ''}>{prova(c.pratica_data, c.pratica_esito)}</td>
                    <td className="cifre">{c.data_rilascio ? formatoData(c.data_rilascio) : '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Badge size="sm" variant={c.stato === 'rilasciato' ? 'light' : 'outline'} color={c.stato === 'annullato' ? 'rosso' : 'inchiostro'}>
                        {ETICHETTA_STATO_CERTIFICATO[c.stato]}
                      </Badge>
                    </td>
                    <td>
                      <Button size="compact-xs" variant="subtle" onClick={() => setModifica(c)}>
                        Apri
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Sezione>

      <Drawer opened={modifica != null} onClose={() => setModifica(null)} position="right" size="lg" title={modifica === 'nuovo' ? 'Nuovo certificato' : `Certificato ${modifica ? numeroRegistro(modifica) : ''}`}>
        {modifica && <FormCertificato esistente={modifica === 'nuovo' ? null : modifica} chiudi={() => setModifica(null)} />}
      </Drawer>
    </>
  );
}

function FormCertificato({ esistente, chiudi }: { esistente: Certificato | null; chiudi: () => void }) {
  const { dati, esegui } = useStato();
  const [attesa, setAttesa] = useState(false);
  useCampoVisibile(true);
  const anno = new Date().getFullYear();
  const [v, setV] = useState<CampiCertificato>(
    esistente ?? {
      id: nuovoUuid(),
      corso_id: '',
      user_id: '',
      numero: prossimoNumero(dati!, anno),
      anno,
      tipo: 'completo',
      stato: 'bozza',
      mds: '',
      categoria: '',
      programma: '',
      data_inizio: null,
      data_fine: null,
      ore: 0,
      esame_data: null,
      esame_esito: '',
      pratica_data: null,
      pratica_esito: '',
      data_rilascio: null,
      luogo_rilascio: '',
      organizzazione: '',
      note: '',
    },
  );
  if (!dati) return null;

  /** Ogni corsista con il suo corso: la scelta riempie i dati del certificato. */
  const corsisti = dati.corsi.flatMap((c) => frequentatori(dati, c.id, true).map((u) => ({ corso: c, utente: u, chiave: `${c.id}|${u.id}` })));
  const scelto = corsisti.find((x) => x.chiave === `${v.corso_id}|${v.user_id}`);

  const daCorso = (corso: Corso, tipo: TipoCertificato): Partial<CampiCertificato> => {
    const teorico = programmaTeorico(corso.programma_teorico);
    const pratico = programmaPratico(corso.programma_pratico);
    const riferimento = tipo === 'pratico' ? pratico?.documento : teorico?.documento;
    return {
      mds: corso.mds,
      categoria: corso.categoria,
      programma: riferimento ?? '',
      data_inizio: corso.data_inizio,
      data_fine: corso.data_fine,
      ore: tipo === 'pratico' ? 0 : Math.round((teorico?.moduli.reduce((s, m) => s + m.minuti, 0) ?? 0) / 60),
      organizzazione: corso.maintenance_organization,
      luogo_rilascio: corso.location,
    };
  };

  const salva = async (campi: Partial<CampiCertificato> = {}) => {
    setAttesa(true);
    const ok = await esegui({ tipo: 'certificato.salva', certificato: { ...v, ...campi } }, esistente ? 'Certificato aggiornato' : 'Certificato inserito nel registro');
    setAttesa(false);
    if (ok) chiudi();
  };
  const elimina = async () => {
    setAttesa(true);
    const ok = await esegui({ tipo: 'certificato.elimina', id: v.id }, 'Certificato eliminato');
    setAttesa(false);
    if (ok) chiudi();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void salva();
      }}
    >
      <Stack gap="sm">
        <Select
          label="Intestatario"
          description="Frequentatore e corso a cui si riferisce il certificato"
          searchable
          required
          value={scelto?.chiave ?? null}
          onChange={(x) => {
            const nuovo = corsisti.find((c) => c.chiave === x);
            if (nuovo) setV({ ...v, corso_id: nuovo.corso.id, user_id: nuovo.utente.id, ...daCorso(nuovo.corso, v.tipo) });
          }}
          data={corsisti.map((c) => ({ value: c.chiave, label: `${nomeUtente(dati, c.utente.id)} — ${c.corso.codice}` }))}
          comboboxProps={{ withinPortal: true }}
          disabled={Boolean(esistente)}
        />
        <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="sm">
          <NumberInput label="Numero" min={1} max={9999} value={v.numero} onChange={(x) => setV({ ...v, numero: Number(x || 0) })} required />
          <NumberInput label="Anno" min={2000} max={2100} value={v.anno} onChange={(x) => setV({ ...v, anno: Number(x || anno) })} required />
          <Select
            label="Tipo"
            value={v.tipo}
            onChange={(x) => {
              const tipo = (x as TipoCertificato) ?? 'completo';
              setV({ ...v, tipo, ...(scelto ? daCorso(scelto.corso, tipo) : {}) });
            }}
            data={TIPI_CERTIFICATO.map((t) => ({ value: t, label: ETICHETTA_CERTIFICATO[t] }))}
            comboboxProps={{ withinPortal: true }}
            allowDeselect={false}
          />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
          <TextInput label="MDS" value={v.mds} onChange={(e) => setV({ ...v, mds: e.currentTarget.value })} />
          <TextInput label="Categoria" value={v.categoria} onChange={(e) => setV({ ...v, categoria: e.currentTarget.value })} />
        </SimpleGrid>
        <TextInput label="Programma di riferimento" description="Documento approvato DAAA" value={v.programma} onChange={(e) => setV({ ...v, programma: e.currentTarget.value })} />
        <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="sm">
          <TextInput type="date" label="Corso dal" value={v.data_inizio ?? ''} onChange={(e) => setV({ ...v, data_inizio: e.currentTarget.value || null })} />
          <TextInput type="date" label="al" value={v.data_fine ?? ''} onChange={(e) => setV({ ...v, data_fine: e.currentTarget.value || null })} />
          <NumberInput label="Ore" min={0} max={2000} value={v.ore} onChange={(x) => setV({ ...v, ore: Number(x || 0) })} />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
          <TextInput type="date" label="Esame teorico" max={oggiISO()} value={v.esame_data ?? ''} onChange={(e) => setV({ ...v, esame_data: e.currentTarget.value || null })} />
          <Select
            label="Esito"
            value={v.esame_esito}
            onChange={(x) => setV({ ...v, esame_esito: (x as EsitoProva) ?? '' })}
            data={ESITI_PROVA.map((x) => ({ value: x, label: x || 'da sostenere' }))}
            comboboxProps={{ withinPortal: true }}
            allowDeselect={false}
          />
          <TextInput type="date" label="Valutazione pratica" max={oggiISO()} value={v.pratica_data ?? ''} onChange={(e) => setV({ ...v, pratica_data: e.currentTarget.value || null })} />
          <Select
            label="Esito"
            value={v.pratica_esito}
            onChange={(x) => setV({ ...v, pratica_esito: (x as EsitoProva) ?? '' })}
            data={ESITI_PROVA.map((x) => ({ value: x, label: x || 'da sostenere' }))}
            comboboxProps={{ withinPortal: true }}
            allowDeselect={false}
          />
        </SimpleGrid>
        <TextInput label="Maintenance Organisation" description="Nome e numero di approvazione DAAA" value={v.organizzazione} onChange={(e) => setV({ ...v, organizzazione: e.currentTarget.value })} />
        <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="sm">
          <Select
            label="Stato"
            value={v.stato}
            onChange={(x) => setV({ ...v, stato: (x as Certificato['stato']) ?? 'bozza' })}
            data={STATI_CERTIFICATO.map((s) => ({ value: s, label: ETICHETTA_STATO_CERTIFICATO[s] }))}
            comboboxProps={{ withinPortal: true }}
            allowDeselect={false}
          />
          <TextInput type="date" label="Data di rilascio" max={oggiISO()} value={v.data_rilascio ?? ''} onChange={(e) => setV({ ...v, data_rilascio: e.currentTarget.value || null })} />
          <TextInput label="Luogo" value={v.luogo_rilascio} onChange={(e) => setV({ ...v, luogo_rilascio: e.currentTarget.value })} />
        </SimpleGrid>
        <Textarea label="Note" autosize minRows={2} maxLength={300} value={v.note} onChange={(e) => setV({ ...v, note: e.currentTarget.value })} />

        {v.stato !== 'rilasciato' && (
          <Button
            variant="default"
            leftSection={<IconCertificate size={17} />}
            loading={attesa}
            onClick={() => void salva({ stato: 'rilasciato', data_rilascio: v.data_rilascio ?? oggiISO() })}
          >
            Rilascia il certificato
          </Button>
        )}
        <Group justify="space-between" mt="xs">
          {esistente && v.stato !== 'rilasciato' ? (
            <Button variant="subtle" color="rosso" leftSection={<IconTrash size={16} />} onClick={() => void elimina()} loading={attesa}>
              Elimina
            </Button>
          ) : (
            <span />
          )}
          <Group gap="sm">
            <Button variant="default" onClick={chiudi}>
              Annulla
            </Button>
            <Button type="submit" loading={attesa}>
              Salva
            </Button>
          </Group>
        </Group>
      </Stack>
    </form>
  );
}
