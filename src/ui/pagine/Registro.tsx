import { Badge, Button, Text } from '@mantine/core';
import { IconFileSpreadsheet } from '@tabler/icons-react';
import { esportaRegistro } from '../../esporta';
import { oggiISO } from '../../dominio/motore';
import { statoTeorico } from '../../dominio/pianificazione';
import { assenzeDi } from '../../dominio/presenze';
import { programmaPratico, programmaTeorico } from '../../dominio/programmi';
import { formatoData, frequentatori, iscritti, lezioniDi, nomeUtente, ore, presenzeDi, rapportiniDi, situazione } from '../../dominio/viste';
import { IntestazionePagina, Sezione } from '../componenti/disegno';
import { link } from '../navigazione';
import { useStato } from '../stato';

/** Registro dei corsi e dei corsisti: il quadro d'insieme del Training Manager. */
export function Registro() {
  const { dati, utente } = useStato();
  if (!dati || !utente) return null;
  const corsi = [...dati.corsi].sort((a, b) => Number(b.attivo) - Number(a.attivo) || b.codice.localeCompare(a.codice));

  const righeCorso = corsi.map((c) => {
    const teorico = programmaTeorico(c.programma_teorico);
    const pratico = programmaPratico(c.programma_pratico);
    const allievi = frequentatori(dati, c.id, true);
    const lezioni = lezioniDi(dati, c.id);
    const stato = teorico ? statoTeorico(teorico, lezioni, oggiISO()) : null;
    const medie = pratico ? allievi.map((u) => situazione(dati, c, u).report.totale.percentuale) : [];
    return {
      corso: c,
      allievi,
      istruttori: iscritti(dati, c.id, 'instructor').length + iscritti(dati, c.id, 'direttore').length,
      stato,
      media: medie.length ? medie.reduce((s, x) => s + x, 0) / medie.length : null,
    };
  });

  const righeCorsista = corsi
    .flatMap((c) => {
      const teorico = programmaTeorico(c.programma_teorico);
      const pratico = programmaPratico(c.programma_pratico);
      const rapportini = rapportiniDi(dati, c.id);
      const presenze = presenzeDi(dati, c.id);
      const lezioni = lezioniDi(dati, c.id);
      return frequentatori(dati, c.id, true).map((u) => ({
        corso: c,
        utente: u,
        anagrafica: dati.anagrafiche.find((a) => a.user_id === u.id),
        assenze: teorico ? assenzeDi(teorico, c, lezioni, rapportini, presenze, u.id) : null,
        pratica: pratico ? situazione(dati, c, u).report : null,
        certificati: dati.certificati.filter((x) => x.user_id === u.id && x.corso_id === c.id),
      }));
    })
    .sort((a, b) => (a.anagrafica?.cognome ?? a.utente.username).localeCompare(b.anagrafica?.cognome ?? b.utente.username));

  const rilasciati = dati.certificati.filter((c) => c.stato === 'rilasciato').length;

  return (
    <>
      <IntestazionePagina
        titolo="Registro corsi e corsisti"
        sotto="Quadro d’insieme di tutti i corsi e di chi li frequenta"
        azioni={
          <Button variant="default" leftSection={<IconFileSpreadsheet size={17} />} onClick={() => void esportaRegistro(dati)}>
            Excel
          </Button>
        }
      />

      <div className="cartiglio compatto">
        <div className="c-numero">
          <div>
            <span className="etichetta">Corsi in registro</span>
            <div className="numero-monumentale">{corsi.length}</div>
            <div className="cifre debole" style={{ fontWeight: 600, marginTop: 4 }}>
              {corsi.filter((c) => c.attivo).length} in corso
            </div>
          </div>
        </div>
        <div className="c-2">
          <span className="etichetta">Corsisti</span>
          <div className="valore cifre">{righeCorsista.length}</div>
        </div>
        <div className="c-2">
          <span className="etichetta">Istruttori e direttori</span>
          <div className="valore cifre">{new Set(dati.iscrizioni.filter((i) => i.ruolo !== 'trainee').map((i) => i.user_id)).size}</div>
        </div>
        <div className="c-2">
          <span className="etichetta">Certificati rilasciati</span>
          <div className="valore cifre">{rilasciati}</div>
        </div>
        <div className="c-periodo">
          <span className="etichetta">Aggiornato al</span>
          <div className="valore codice">{formatoData(oggiISO())}</div>
        </div>
        <div className="c-2 c-luogo">
          <span className="etichetta">Mezzi</span>
          <div className="valore">{[...new Set(corsi.map((c) => `${c.mds} ${c.categoria}`))].join(' · ') || '—'}</div>
        </div>
      </div>

      <Sezione titolo={`Corsi · ${corsi.length}`}>
        <div className="scorre">
          <table className="tabella">
            <thead>
              <tr>
                <th>Corso</th>
                <th>MDS / Cat.</th>
                <th>Periodo</th>
                <th>Sede</th>
                <th className="num">Corsisti</th>
                <th className="num">Istruttori</th>
                <th className="num">Teoria</th>
                <th className="num">Pratica</th>
                <th>Stato</th>
              </tr>
            </thead>
            <tbody>
              {righeCorso.map((r) => (
                <tr key={r.corso.id}>
                  <td style={{ minWidth: 200 }}>
                    <a href={link('/corso', r.corso)}>
                      <strong>{r.corso.codice}</strong>
                    </a>
                    <div className="debole" style={{ fontSize: 'var(--fs-s)' }}>
                      {r.corso.nome}
                    </div>
                  </td>
                  <td className="cifre" style={{ whiteSpace: 'nowrap' }}>
                    {r.corso.mds} {r.corso.categoria}
                  </td>
                  <td className="cifre" style={{ whiteSpace: 'nowrap' }}>
                    {formatoData(r.corso.data_inizio)} – {formatoData(r.corso.data_fine)}
                  </td>
                  <td>{r.corso.location || '—'}</td>
                  <td className="num">{r.allievi.length}</td>
                  <td className="num">{r.istruttori}</td>
                  <td className="num">{r.stato ? `${ore(r.stato.svolti)} / ${ore(r.stato.totale.minuti)}` : '—'}</td>
                  <td className="num">{r.media == null ? '—' : `${r.media.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%`}</td>
                  <td>
                    <Badge size="sm" variant="light" color={r.corso.attivo ? 'inchiostro' : 'gray'}>
                      {r.corso.attivo ? 'in corso' : 'chiuso'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Sezione>

      <Sezione titolo={`Corsisti · ${righeCorsista.length}`}>
        {!righeCorsista.length && <Text className="debole">Nessun frequentatore iscritto.</Text>}
        <div className="scorre">
          <table className="tabella">
            <thead>
              <tr>
                <th>Corsista</th>
                <th>Nascita</th>
                <th>MAML</th>
                <th>Corso</th>
                <th className="num">Assenze</th>
                <th>Esame teorico</th>
                <th className="num">Pratica</th>
                <th>Certificati</th>
              </tr>
            </thead>
            <tbody>
              {righeCorsista.map((r) => (
                <tr key={`${r.corso.id}|${r.utente.id}`}>
                  <td style={{ minWidth: 190 }}>
                    <strong>{nomeUtente(dati, r.utente.id)}</strong>
                    <div className="debole" style={{ fontSize: 'var(--fs-s)' }}>
                      {r.utente.username}
                      {r.utente.attivo ? '' : ' · disattivato'}
                    </div>
                  </td>
                  <td className="cifre" style={{ whiteSpace: 'nowrap' }}>
                    {r.anagrafica ? `${formatoData(r.anagrafica.data_nascita)} · ${r.anagrafica.citta_nascita}` : '—'}
                  </td>
                  <td className="cifre">{r.anagrafica?.maml || '—'}</td>
                  <td className="cifre">{r.corso.codice}</td>
                  <td className={`num ${r.assenze?.minuti ? 'rosso' : ''}`}>
                    {r.assenze ? `${ore(r.assenze.minuti)} · ${r.assenze.percentuale.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%` : '—'}
                  </td>
                  <td>
                    {r.assenze ? (
                      <Badge size="sm" variant={r.assenze.idoneo ? 'light' : 'filled'} color={r.assenze.idoneo ? 'inchiostro' : 'rosso'}>
                        {r.assenze.idoneo ? 'Idoneo' : 'Non idoneo'}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={`num ${r.pratica?.conforme ? 'si' : ''}`}>{r.pratica ? `${r.pratica.totale.percentuale.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%` : '—'}</td>
                  <td className="cifre">
                    {r.certificati.length
                      ? r.certificati.map((c) => `${c.numero}/${c.anno}${c.stato === 'rilasciato' ? '' : ` (${c.stato})`}`).join(', ')
                      : <span className="debole">nessuno</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Sezione>
    </>
  );
}
