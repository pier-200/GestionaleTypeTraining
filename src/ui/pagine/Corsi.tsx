import { useState } from 'react';
import { Autocomplete, Button, Drawer, Group, NumberInput, Select, SimpleGrid, Stack, Switch, TextInput } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconArrowRight, IconPlus } from '@tabler/icons-react';
import { nuovoUuid } from '../../backend/github/crittografia';
import { AULE, statoTeorico } from '../../dominio/pianificazione';
import { MDS, mdsDi, programmaPratico, programmaTeorico, programmiPer, soloTeorica } from '../../dominio/programmi';
import { corsiDi, ruoloNelCorso, type CampiCorso } from '../../dominio/motore';
import type { Corso } from '../../dominio/tipi';
import { chiaveOrdine, direttoreDi, formatoData, frequentatori, iscritti, lezioniVisibili, nomeUtente, ore, situazione } from '../../dominio/viste';
import { IntestazionePagina } from '../componenti/disegno';
import { MieLezioni } from '../componenti/MieLezioni';
import { link, ricordaCorso } from '../navigazione';
import { naviga } from '../router';
import { useStato } from '../stato';

/** Scelta del corso, e per il Training Manager creazione e modifica dei corsi. */
export function Corsi() {
  const { dati, utente } = useStato();
  const mobile = useMediaQuery('(max-width: 991px)');
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
                    {formatoData(c.data_inizio)} – {formatoData(c.data_fine)} · {c.location || 'sede da definire'}
                  </p>
                </header>
                <dl className="scheda-numeri">
                  <div>
                    <dt>Frequentatori</dt>
                    <dd>{allievi.length}</dd>
                  </div>
                  <div>
                    <dt>Istruttori</dt>
                    <dd>{iscritti(dati, c.id, 'instructor').length + iscritti(dati, c.id, 'direttore').length}</dd>
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
                  {!c.attivo && <span className="tag-parte chiuso">Chiuso</span>}
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

      <Drawer
        opened={modifica != null}
        onClose={() => setModifica(null)}
        position={mobile ? 'bottom' : 'right'}
        size={mobile ? '94%' : 520}
        title={<span className="titolo-sezione">{modifica === 'nuovo' ? 'Nuovo corso' : 'Modifica corso'}</span>}
      >
        {modifica != null && (
          <FormCorso
            key={modifica === 'nuovo' ? 'nuovo' : modifica.id}
            esistente={modifica === 'nuovo' ? null : modifica}
            chiudi={(creato) => {
              setModifica(null);
              if (creato) ricordaCorso(creato);
            }}
          />
        )}
      </Drawer>
    </>
  );
}

function FormCorso({ esistente, chiudi }: { esistente: Corso | null; chiudi: (id?: string) => void }) {
  const { dati, utente, esegui } = useStato();
  const admin = utente?.ruolo === 'admin';
  const [direttore, setDirettore] = useState<string | null>((esistente && dati && direttoreDi(dati, esistente.id)?.id) || null);
  const [v, setV] = useState<CampiCorso>(
    esistente ?? {
      id: nuovoUuid(),
      codice: '',
      nome: '',
      mds: MDS[0].codice,
      categoria: MDS[0].categorie[0],
      data_inizio: null,
      data_fine: null,
      durata_settimane: null,
      maintenance_organization: '',
      location: '',
      aula: AULE[0],
      gruppo_firma: '',
      attivo: true,
    },
  );
  const [attesa, setAttesa] = useState(false);
  if (!dati) return null;
  const istruttori = dati.utenti.filter((u) => u.ruolo === 'instructor' && (u.attivo || u.id === direttore)).sort((a, b) => chiaveOrdine(dati, a).localeCompare(chiaveOrdine(dati, b)));
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setAttesa(true);
        // il direttore lo assegna solo il Training Manager: gli altri lasciano l'incarico com'è
        const ok = await esegui({ tipo: 'corso.salva', corso: v, ...(admin ? { direttore_id: direttore } : {}) }, esistente ? 'Corso aggiornato' : 'Corso creato');
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
        <Select
          label="Direttore del corso"
          description={admin ? 'Uno degli istruttori: in questo corso prepara e valida il programma e i rapportini.' : 'Lo assegna il Training Manager.'}
          placeholder="da assegnare"
          searchable
          clearable
          disabled={!admin}
          value={direttore}
          onChange={setDirettore}
          data={istruttori.map((u) => ({ value: u.id, label: nomeUtente(dati, u.id) }))}
          comboboxProps={{ withinPortal: true }}
          nothingFoundMessage="Nessun account istruttore"
        />
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
        {esistente && <Switch label="Corso attivo" checked={v.attivo} onChange={(e) => setV({ ...v, attivo: e.currentTarget.checked })} />}
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
