import { Text } from '@mantine/core';
import { IconAlertTriangleFilled } from '@tabler/icons-react';
import { oggiISO, ruoloNelCorso } from '../../dominio/motore';
import { oreDaMinuti, programmaTeorico } from '../../dominio/programmi';
import { formatoData, lezioniVisibili, nomeUtente, ore, oreDocenti } from '../../dominio/viste';
import { IntestazionePagina, Quota, ScalaQuote, Sezione } from '../componenti/disegno';
import { useCorso } from '../navigazione';
import { useStato } from '../stato';

/** Ore di lezione teorica erogate da ciascun istruttore durante il corso. */
export function Docenti() {
  const { dati, utente } = useStato();
  const corso = useCorso();
  const programma = programmaTeorico(corso?.programma_teorico);
  if (!dati || !utente || !corso || !programma) return null;
  const ruolo = ruoloNelCorso(dati, utente, corso.id);
  const lezioni = lezioniVisibili(dati, corso.id, ruolo);
  const righe = oreDocenti(dati, corso.id, lezioni, oggiISO());
  const totale = righe.reduce((s, r) => s + r.minuti, 0);
  const svolte = righe.reduce((s, r) => s + r.svolti, 0);
  const senza = lezioni.filter((l) => !l.istruttore_id);

  return (
    <>
      <IntestazionePagina titolo="Ore degli istruttori" sotto={`${corso.nome} · ${programma.nome}`} />

      <div className="cartiglio compatto">
        <div className="c-numero">
          <div>
            <span className="etichetta">Ore già erogate</span>
            <div className="numero-monumentale">
              {(svolte / 60).toLocaleString('it-IT', { maximumFractionDigits: 1 })}
              <small>h</small>
            </div>
            <div className="cifre debole" style={{ fontWeight: 600, marginTop: 4 }}>
              su {ore(totale)} a calendario
            </div>
          </div>
        </div>
        <div className="c-2">
          <span className="etichetta">Istruttori impiegati</span>
          <div className="valore cifre">{righe.filter((r) => r.minuti > 0).length}</div>
        </div>
        <div className="c-2">
          <span className="etichetta">Lezioni a calendario</span>
          <div className="valore cifre">{lezioni.length}</div>
        </div>
        <div className="c-2">
          <span className="etichetta">Senza istruttore</span>
          <div className={`valore cifre ${senza.length ? 'rosso' : ''}`}>{senza.length}</div>
        </div>
        <div className="c-periodo">
          <span className="etichetta">Ore di recupero</span>
          <div className="valore codice">{ore(lezioni.filter((l) => l.tipo === 'recupero').reduce((s, l) => s + l.minuti, 0))}</div>
        </div>
        <div className="c-2 c-luogo">
          <span className="etichetta">Programma</span>
          <div className="valore">{programma.nome}</div>
        </div>
      </div>

      <Sezione titolo="Carico per istruttore">
        <div className="quote mtt">
          {righe
            .filter((r) => r.minuti > 0)
            .map((r) => (
              <Quota
                key={r.utente.id}
                nome={nomeUtente(dati, r.utente.id)}
                sotto={oreDaMinuti(r.minuti)}
                riga={{
                  codice: String(r.lezioni),
                  titolo: nomeUtente(dati, r.utente.id),
                  previsti: Math.max(1, Math.round(r.minuti / 60)),
                  eseguiti: Math.round(r.svolti / 60),
                  percentuale: r.minuti ? (r.svolti / r.minuti) * 100 : 0,
                  conforme: null,
                  mancano: 0,
                }}
              />
            ))}
          <ScalaQuote />
        </div>
      </Sezione>

      <Sezione titolo={`Dettaglio · ${righe.length}`}>
        {!lezioni.length && <Text className="debole">Nessuna lezione a calendario.</Text>}
        <div className="scorre">
          <table className="tabella">
            <thead>
              <tr>
                <th>Istruttore</th>
                <th className="num">Ore a calendario</th>
                <th className="num">Ore erogate</th>
                <th className="num">Lezioni</th>
                <th className="num">Materie</th>
                <th>Prima</th>
                <th>Ultima</th>
              </tr>
            </thead>
            <tbody>
              {righe.map((r) => (
                <tr key={r.utente.id}>
                  <td>
                    <strong>{nomeUtente(dati, r.utente.id)}</strong>
                    <div className="debole" style={{ fontSize: 'var(--fs-s)' }}>
                      {r.utente.username}
                    </div>
                  </td>
                  <td className="num">{r.minuti ? oreDaMinuti(r.minuti) : '—'}</td>
                  <td className={`num ${r.svolti ? 'si' : ''}`}>{r.svolti ? oreDaMinuti(r.svolti) : '—'}</td>
                  <td className="num">{r.lezioni || '—'}</td>
                  <td className="num">{r.materie || '—'}</td>
                  <td className="cifre">{r.prima ? formatoData(r.prima) : '—'}</td>
                  <td className="cifre">{r.ultima ? formatoData(r.ultima) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {senza.length > 0 && (
          <Text className="rosso esito-cella" mt="sm">
            <IconAlertTriangleFilled size={14} aria-hidden /> {senza.length} lezioni ancora senza istruttore assegnato.
          </Text>
        )}
      </Sezione>
    </>
  );
}
