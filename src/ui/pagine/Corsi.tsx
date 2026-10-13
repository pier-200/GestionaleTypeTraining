import { useState } from 'react';
import { Autocomplete, Button, Drawer, Group, MultiSelect, NumberInput, Select, SimpleGrid, Stack, Switch, TagsInput, TextInput } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconArrowRight, IconPlus } from '@tabler/icons-react';
import { nuovoUuid } from '../../backend/github/crittografia';
import { AULE, statoTeorico } from '../../dominio/pianificazione';
import { MDS, mdsDi, programmaPratico, programmaTeorico, programmiPer, soloTeorica } from '../../dominio/programmi';
import { corsiDi, oggiISO, ruoloNelCorso, type CampiCorso } from '../../dominio/motore';
import type { Corso } from '../../dominio/tipi';
import { formatoData, formatoFine, frequentatori, istruttoriAttivi, lezioniVisibili, nomeDirettore, nomeUtente, ore, situazione, staffDi } from '../../dominio/viste';
import { IntestazionePagina } from '../componenti/disegno';
import { MieLezioni } from '../componenti/MieLezioni';
import { link, ricordaCorso } from '../navigazione';
import { naviga } from '../router';
import { useStato } from '../stato';

/** Scelta del corso, e per il Training Manager creazione e modifica dei corsi. */
export function Corsi() {
  const { dati, utente } = useStato();
  const [modifica, setModifica] = useState<Corso | 'nuovo' | null>(null);
  if (!dati || !utente) return null;
  const elenco = corsiDi(dati, utente);
  const admin = utente.ruolo === 'admin';

  const apri = (c: Corso) => {
    ricordaCorso(c.id);
    naviga(link('/quadro', c).slice(1));
  };

  return (
    <>
      <IntestazionePagina
        titolo={admin ? 'Corsi' : 'I miei corsi'}
        sotto={elenco.length === 1 ? '1 corso' : `${elenco.length} corsi`}
        azioni={admin ? <Button leftSection={<IconPlus size={17} />} onClick={() => setModifica('nuovo')}>Nuovo corso</Button> : undefined}
      />
      <MieLezioni />
      {elenco.length === 0 ? (
        <p className="debole">Nessun corso: {admin ? 'creane uno con «Nuovo corso».' : 'il Training Manager deve iscriverti a un corso.'}</p>
      ) : (
        <div className="schede-corso">
          {elenco.map((c) => {
            const teorico = programmaTeorico(c.programma_teorico);
            const pratico = programmaPratico(c.programma_pratico);
            const stato = teorico ? statoTeorico(teorico, lezioniVisibili(dati, c.id, utente.ruolo === 'trainee' ? 'trainee' : null)) : null;
            const allievi = frequentatori(dati, c.id);
            const medie = pratico ? allievi.map((u) => situazione(dati, c, u).report.totale.percentuale) : [];
            const media = medie.length ? medie.reduce((s, x) => s + x, 0) / medie.length : 0;
            return (
              <article key={c.id} className={`scheda-corso ${c.attivo ? '' : 'chiuso'}`}>
                <header>
                  <span className="etichetta">
                    {c.codice} · {c.mds} {c.categoria}
                  </span>
                  <h2>{c.nome}</h2>
                  <p className="debole">
                    {formatoData(c.data_inizio)} – {formatoFine(c)} · {c.location || 'sede da definire'}
                  </p>
                </header>
                <dl className="scheda-numeri">
                  <div>
                    <dt>Frequentatori</dt>
                    <dd>{allievi.length}</dd>
                  </div>
                  <div>
                    <dt>Istruttori</dt>
                    <dd>{staffDi(dati, c).length}</dd>
                  </div>
                  {stato && (
                    <div>
                      <dt>Teoria a calendario</dt>
                      <dd>
                        {ore(stato.totale.pianificati)} <span className="debole">/ {ore(stato.totale.minuti)}</span>
                      </dd>
                    </div>
                  )}
                  {pratico && (
                    <div>
                      <dt>Pratica media</dt>
                      <dd>{media.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%</dd>
                    </div>
                  )}
                </dl>
                <div className="scheda-parti">
                  {teorico && <span className="tag-parte mtt">{teorico.nome}</span>}
                  {pratico && <span className="tag-parte ptt">{pratico.nome}</span>}
                  {!c.attivo && <span className="tag-parte chiuso">Completato</span>}
                </div>
                <Group gap="xs" mt="auto">
                  <Button size="sm" rightSection={<IconArrowRight size={16} />} onClick={() => apri(c)}>
                    Apri
                  </Button>
                  {(admin || ruoloNelCorso(dati, utente, c.id) === 'direttore') && (
                    <Button size="sm" variant="default" onClick={() => setModifica(c)}>
                      Modifica
                    </Button>
                  )}
                </Group>
              </article>
            );
          })}
        </div>
      )}

      <CassettoCorso corso={modifica} chiudi={() => setModifica(null)} />
    </>
  );
}

/** Pannello dei dati del corso: creazione dalla pagina «Corsi», modifica anche dalla pagina del corso. */
export function CassettoCorso({ corso, chiudi }: { corso: Corso | 'nuovo' | null; chiudi: () => void }) {
  const mobile = useMediaQuery('(max-width: 991px)');
  return (
    <Drawer
      opened={corso != null}
      onClose={chiudi}
      position={mobile ? 'bottom' : 'right'}
      size={mobile ? '94%' : 520}
      title={<span className="titolo-sezione">{corso === 'nuovo' ? 'Nuovo corso' : 'Modifica corso'}</span>}
    >
      {corso != null && (
        <FormCorso
          key={corso === 'nuovo' ? 'nuovo' : corso.id}
          esistente={corso === 'nuovo' ? null : corso}
          chiudi={(creato) => {
            chiudi();
            if (creato) ricordaCorso(creato);
          }}
        />
      )}
    </Drawer>
  );
}

function FormCorso({ esistente, chiudi }: { esistente: Corso | null; chiudi: (id?: string) => void }) {
  const { dati, utente, esegui } = useStato();
  const admin = utente?.ruolo === 'admin';
  // il direttore è uno degli istruttori oppure una persona fuori elenco, scritta a mano
  const [direttore, setDirettore] = useState(esistente && dati ? nomeDirettore(dati, esistente) : '');
  const [pratica, setPratica] = useState<string[]>(esistente?.istruttori_pratica ?? []);
  const [v, setV] = useState<CampiCorso>(
    esistente ?? {
      id: nuovoUuid(),
      codice: '',
      nome: '',
      mds: MDS[0].codice,
      categoria: MDS[0].categorie[0],
      data_inizio: null,
      data_fine: null,
      data_chiusura: null,
      durata_settimane: null,
      maintenance_organization: '',
      location: '',
      aula: AULE[0],
      gruppo_firma: '',
      direttore_nome: '',
      aeromobili: [],
      attivo: true,
    },
  );
  const [attesa, setAttesa] = useState(false);
  if (!dati) return null;
  const istruttori = istruttoriAttivi(dati).map((u) => ({ value: u.id, label: nomeUtente(dati, u.id) }));
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setAttesa(true);
        // il direttore lo assegna solo il Training Manager: gli altri lo lasciano com'è
        const account = istruttori.find((i) => i.label === direttore.trim());
        const ok = await esegui(
          { tipo: 'corso.salva', corso: admin ? { ...v, direttore_nome: account ? '' : direttore.trim() } : v, ...(admin ? { direttore_id: account?.value ?? null } : {}), istruttori_pratica: pratica },
          esistente ? 'Corso aggiornato' : 'Corso creato',
        );
        setAttesa(false);
        if (ok) chiudi(esistente ? undefined : v.id);
      }}
    >
      <Stack gap="md">
        <TextInput label="Codice" description="L’ID del corso, come sul programma settimanale: es. 06-B1.3-CH" value={v.codice} onChange={(e) => setV({ ...v, codice: e.currentTarget.value })} required />
        <TextInput label="Nome del corso" value={v.nome} onChange={(e) => setV({ ...v, nome: e.currentTarget.value })} required />
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
          <Select
            label="MDS"
            description="Il mezzo del corso"
            value={v.mds}
            onChange={(x) => {
              const mezzo = mdsDi(x) ?? MDS[0];
              setV({ ...v, mds: mezzo.codice, categoria: mezzo.categorie.includes(v.categoria) ? v.categoria : mezzo.categorie[0] });
            }}
            data={MDS.map((m) => ({ value: m.codice, label: m.nome }))}
            comboboxProps={{ withinPortal: true }}
            allowDeselect={false}
          />
          <Select
            label="Categoria"
            description={soloTeorica(v.categoria) ? 'Solo parte teorica' : 'Teorica e pratica'}
            value={v.categoria}
            onChange={(x) => x && setV({ ...v, categoria: x })}
            data={(mdsDi(v.mds)?.categorie ?? []).map((c) => ({ value: c, label: c }))}
            comboboxProps={{ withinPortal: true }}
            allowDeselect={false}
          />
        </SimpleGrid>
        <div className="programmi-corso">
          <span className="etichetta">Programmi previsti</span>
          {(() => {
            const p = programmiPer(v.mds, v.categoria);
            const riga = (titolo: string, nome: string | undefined, previsto: boolean) => (
              <div key={titolo} className={nome ? 'si' : previsto ? 'rosso' : 'debole'}>
                {titolo}: {nome ?? (previsto ? 'da caricare' : 'non previsto')}
              </div>
            );
            return (
              <>
                {riga('Teorico (MTT)', p.teorico?.nome, true)}
                {riga('Pratico (PTT)', p.pratico?.nome, !soloTeorica(v.categoria))}
              </>
            );
          })()}
        </div>
        <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="sm">
          <TextInput type="date" label="Data di inizio" value={v.data_inizio ?? ''} onChange={(e) => setV({ ...v, data_inizio: e.currentTarget.value || null })} />
          <NumberInput label="Durata (settimane)" min={1} max={104} allowDecimal={false} value={v.durata_settimane ?? ''} onChange={(x) => setV({ ...v, durata_settimane: x === '' ? null : Number(x) })} />
          <TextInput type="date" label="Data di fine stimata" value={v.data_fine ?? ''} onChange={(e) => setV({ ...v, data_fine: e.currentTarget.value || null })} />
        </SimpleGrid>
        <Autocomplete
          label="Direttore del corso"
          description={admin ? 'Scegli uno degli istruttori (in questo corso prepara e valida programma e rapportini) oppure scrivi una persona fuori elenco.' : 'Lo assegna il Training Manager.'}
          placeholder="da assegnare"
          disabled={!admin}
          value={direttore}
          onChange={setDirettore}
          data={istruttori.map((i) => i.label)}
          maxLength={80}
          comboboxProps={{ withinPortal: true }}
        />
        {!soloTeorica(v.categoria) && (
          <>
            <MultiSelect
              label="Istruttori della fase pratica"
              description="Nominati per questo corso: vedono il corso e i logbook dei frequentatori."
              placeholder={pratica.length ? undefined : 'nessuno'}
              searchable
              value={pratica}
              onChange={setPratica}
              data={istruttori}
              comboboxProps={{ withinPortal: true }}
              nothingFoundMessage="Nessun account istruttore"
            />
            <TagsInput
              label="Aeromobili disponibili"
              description="Identificativi fra cui scegliere nei task pratici: scrivi e premi Invio (es. EI906)."
              placeholder={v.aeromobili.length ? undefined : 'EI906, EI910…'}
              value={v.aeromobili}
              onChange={(aeromobili) => setV({ ...v, aeromobili })}
              splitChars={[',', ';']}
              maxTags={40}
            />
          </>
        )}
        <Autocomplete label="Aula" description="Proposta per ogni lezione: sul singolo periodo si può cambiare." value={v.aula} onChange={(aula) => setV({ ...v, aula })} data={AULE} maxLength={40} comboboxProps={{ withinPortal: true }} />
        <TextInput
          label="Gruppo firma del comandante"
          description="In calce al programma settimanale, sotto «IL COMANDANTE»."
          placeholder="es. Ten. Col. Mario ROSSI"
          value={v.gruppo_firma}
          onChange={(e) => setV({ ...v, gruppo_firma: e.currentTarget.value })}
          maxLength={120}
        />
        <TextInput label="Maintenance organisation" description="Nome e numero di approvazione DAAA" value={v.maintenance_organization} onChange={(e) => setV({ ...v, maintenance_organization: e.currentTarget.value })} />
        <TextInput label="Location" value={v.location} onChange={(e) => setV({ ...v, location: e.currentTarget.value })} />
        {esistente && (
          <>
            <Switch
              label="Corso completato"
              description="Resta consultabile in ogni sua parte; ogni modifica chiederà conferma."
              checked={!v.attivo}
              onChange={(e) => setV({ ...v, attivo: !e.currentTarget.checked, data_chiusura: e.currentTarget.checked ? (v.data_chiusura ?? oggiISO()) : null })}
            />
            {!v.attivo && (
              <TextInput
                type="date"
                label="Data effettiva di chiusura"
                description="Sostituisce ovunque la data di fine stimata, anche nel Registro corsi e corsisti."
                value={v.data_chiusura ?? ''}
                max={oggiISO()}
                onChange={(e) => setV({ ...v, data_chiusura: e.currentTarget.value || null })}
                required
              />
            )}
          </>
        )}
        <Group grow>
          <Button variant="default" onClick={() => chiudi()}>
            Annulla
          </Button>
          <Button type="submit" loading={attesa}>
            {esistente ? 'Salva' : 'Crea corso'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
