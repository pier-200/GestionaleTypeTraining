import { useEffect, useState } from 'react';
import { Button, Checkbox, FileButton, Group, Select, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangleFilled, IconFileImport } from '@tabler/icons-react';
import { leggiAbilitazioni, type LetturaAbilitazioni } from '../../dominio/abilitazioni';
import { messaggioErrore } from '../../dominio/errori';
import { MDS, chapterDelMds } from '../../dominio/programmi';
import { abilitatiPer, istruttoriAttivi, nomeUtente } from '../../dominio/viste';
import { IntestazionePagina, Sezione } from '../componenti/disegno';
import { useStato } from '../stato';

/** Excel della cartella `modelli` che non sono programmi né moduli da compilare: fra questi c'è quello delle abilitazioni. */
const candidato = (nome: string) => /\.xlsx$/i.test(nome) && !nome.includes('/') && !/^(programma settimanale|mtt_|ptr_)/i.test(nome);

/**
 * Abilitazioni degli istruttori alla parte teorica: per ogni mezzo (MDS), i chapter che ciascuno può erogare.
 * Valgono per tutti i corsi di quel mezzo; nel programma settimanale si sceglie solo fra gli abilitati.
 */
export function Materie() {
  const { dati, esegui, backend } = useStato();
  const [mds, setMds] = useState(MDS[0].codice);
  const [scelto, setScelto] = useState<string | null>(null);
  const [selezione, setSelezione] = useState<string[] | null>(null);
  const [attesa, setAttesa] = useState(false);
  const [file, setFile] = useState<string[]>([]);
  const [nome, setNome] = useState<string | null>(null);
  const [lettura, setLettura] = useState<LetturaAbilitazioni | null>(null);

  // i modelli stanno nel repository privato dei dati: l'elenco arriva dall'archivio, solo a chi ha fatto l'accesso
  useEffect(() => {
    backend
      ?.elencoModelli()
      .then((elenco) => {
        const excel = elenco.filter(candidato);
        setFile(excel);
        setNome((n) => n ?? excel[0] ?? null);
      })
      .catch(() => setFile([]));
  }, [backend]);

  if (!dati) return null;
  const istruttori = istruttoriAttivi(dati);
  const chapter = chapterDelMds(mds);
  const abilitati = (userId: string) => dati.abilitazioni.filter((a) => a.user_id === userId && a.mds === mds).map((a) => a.chapter);
  const correnti = selezione ?? (scelto ? abilitati(scelto) : []);
  const cambiata = scelto != null && selezione != null && JSON.stringify([...selezione].sort()) !== JSON.stringify([...abilitati(scelto)].sort());

  const salva = async () => {
    if (!scelto || !selezione) return;
    setAttesa(true);
    const ok = await esegui({ tipo: 'abilitazioni.imposta', user_id: scelto, mds, chapters: selezione }, 'Abilitazioni aggiornate');
    setAttesa(false);
    if (ok) setSelezione(null);
  };

  /** Legge il file scelto fra quelli di `modelli`, oppure uno preso dal computer (senza caricarlo nell'archivio). */
  const leggi = async (locale?: File) => {
    if (!locale && !nome) return;
    try {
      const bytes = locale ? new Uint8Array(await locale.arrayBuffer()) : await backend!.leggiModello(nome!);
      if (!bytes) throw new Error(`File «${nome}» non trovato nella cartella modelli.`);
      const { righeXlsx } = await import('../../xlsx');
      setLettura(leggiAbilitazioni(righeXlsx(bytes), dati));
    } catch (e) {
      notifications.show({ color: 'rosso', title: 'File non letto', message: messaggioErrore(e) });
    }
  };

  const importa = async () => {
    if (!lettura?.righe.length) return;
    setAttesa(true);
    const ok = await esegui({ tipo: 'abilitazioni.importa', righe: lettura.righe }, `Abilitazioni importate per ${new Set(lettura.righe.map((r) => r.user_id)).size} istruttori`);
    setAttesa(false);
    if (ok) setLettura(null);
  };

  return (
    <>
      <IntestazionePagina titolo="Materie e istruttori" sotto="Chapter che ogni istruttore può erogare a lezione, per mezzo: valgono per tutti i corsi" />

      <Sezione titolo="Importa dall’Excel delle abilitazioni">
        <Text className="debole" size="sm" mb="sm">
          Il file va messo nella cartella <code>modelli</code> del repository privato dei dati, che legge solo chi accede: una tabella con l’istruttore (username oppure cognome e
          nome), il mezzo («MDS») e i chapter («Chapter», anche più d’uno separati da virgola). Per ogni istruttore e mezzo presenti nel file, l’importazione sostituisce i
          chapter che aveva. In alternativa il file si sceglie dal computer.
        </Text>
        <Group align="flex-end" gap="sm" className="non-stampare">
          <Select
            label="File in modelli"
            placeholder={file.length ? 'Scegli' : 'Nessun Excel di abilitazioni'}
            value={nome}
            onChange={(v) => {
              setNome(v);
              setLettura(null);
            }}
            data={file}
            comboboxProps={{ withinPortal: true }}
            style={{ flex: '1 1 280px' }}
          />
          <Button variant="default" leftSection={<IconFileImport size={16} />} onClick={() => void leggi()} disabled={!nome}>
            Leggi il file
          </Button>
          <FileButton onChange={(f) => f && void leggi(f)} accept=".xlsx">
            {(props) => (
              <Button variant="subtle" {...props}>
                Dal computer…
              </Button>
            )}
          </FileButton>
          {lettura && (
            <Button onClick={() => void importa()} loading={attesa} disabled={!lettura.righe.length}>
              Importa
            </Button>
          )}
        </Group>
        {lettura && (
          <div style={{ marginTop: 12 }}>
            <Text fw={600}>
              {lettura.righe.length
                ? `${lettura.righe.reduce((s, r) => s + r.chapters.length, 0)} abilitazioni per ${new Set(lettura.righe.map((r) => r.user_id)).size} istruttori`
                : 'Nessuna abilitazione riconosciuta nel file'}
            </Text>
            {lettura.righe.map((r) => (
              <Text key={`${r.user_id}|${r.mds}`} size="sm">
                {nomeUtente(dati, r.user_id)} · {r.mds}: <span className="cifre">{r.chapters.join(', ')}</span>
              </Text>
            ))}
            {lettura.scartate.map((s) => (
              <Text key={s} size="sm" className="rosso">
                {s}
              </Text>
            ))}
          </div>
        )}
      </Sezione>

      <Sezione titolo="Chi può erogare quali chapter">
        <Group align="flex-end" gap="sm" className="non-stampare">
          <Select
            label="Mezzo (MDS)"
            value={mds}
            onChange={(v) => {
              if (!v) return;
              setMds(v);
              setSelezione(null);
            }}
            data={MDS.map((m) => ({ value: m.codice, label: m.nome }))}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
            style={{ width: 150 }}
          />
          <Select
            label="Istruttore"
            placeholder="Scegli"
            searchable
            value={scelto}
            onChange={(v) => {
              setScelto(v);
              setSelezione(null);
            }}
            data={istruttori.map((u) => ({ value: u.id, label: nomeUtente(dati, u.id) }))}
            comboboxProps={{ withinPortal: true }}
            style={{ flex: '1 1 260px' }}
            nothingFoundMessage="Nessun account istruttore"
          />
          {scelto && (
            <>
              <Button variant="default" onClick={() => setSelezione(chapter.map((c) => c.chapter))}>
                Tutti
              </Button>
              <Button variant="default" onClick={() => setSelezione([])}>
                Nessuno
              </Button>
              <Button onClick={() => void salva()} loading={attesa} disabled={!cambiata}>
                Salva
              </Button>
            </>
          )}
        </Group>

        {scelto && (
          <div className="materie-scelta">
            <div className="materie-elenco">
              {chapter.map((c) => (
                <Checkbox
                  key={c.chapter}
                  size="sm"
                  label={
                    <span>
                      <b className="cifre">{c.chapter}</b> {c.titolo}
                    </span>
                  }
                  checked={correnti.includes(c.chapter)}
                  onChange={(e) => setSelezione(e.currentTarget.checked ? [...correnti, c.chapter] : correnti.filter((x) => x !== c.chapter))}
                />
              ))}
            </div>
          </div>
        )}
      </Sezione>

      <Sezione titolo={`Copertura del syllabus · ${mds}`}>
        <div className="scorre">
          <table className="tabella">
            <thead>
              <tr>
                <th>Chapter</th>
                <th>Materia</th>
                <th>Istruttori abilitati</th>
              </tr>
            </thead>
            <tbody>
              {chapter.map((c) => {
                const chi = abilitatiPer(dati, mds, c.chapter);
                return (
                  <tr key={c.chapter}>
                    <td className="cifre" style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
                      {c.chapter}
                    </td>
                    <td style={{ minWidth: 240 }}>{c.titolo}</td>
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
          Compaiono solo i chapter previsti dal syllabus (quelli con ore). Senza un istruttore abilitato la lezione di quel chapter resta «da assegnare».
        </Text>
      </Sezione>
    </>
  );
}
