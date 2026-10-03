import { useState, type ReactNode } from 'react';
import { ActionIcon, Drawer, Select, Tooltip } from '@mantine/core';
import { IconDots, IconLogout, IconRefresh, IconSwitchHorizontal } from '@tabler/icons-react';
import { corsiDi, oggiISO } from '../dominio/motore';
import { ETICHETTA_RUOLO } from '../dominio/tipi';
import { avanzamento, mediaPratica, nomeUtente } from '../dominio/viste';
import { link, menuPer, ricordaCorso, useCorso, useFrequentatore, useRuoloCorso, type Voce } from './navigazione';
import { naviga, usePosizione } from './router';
import { useStato } from './stato';

const ora = (d: Date | null) => (d ? d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '');

export function Guscio({ titolo, children }: { titolo: string; children: ReactNode }) {
  const { utente, dati, backend, aggiornatoAlle, ricarica, esci } = useStato();
  const { percorso } = usePosizione();
  const corso = useCorso();
  const ruolo = useRuoloCorso();
  const frequentatore = useFrequentatore();
  const [altro, setAltro] = useState(false);
  if (!utente || !dati || !backend) return null;
  const menu = menuPer(utente, corso, ruolo);
  const f = frequentatore?.id;
  const href = (v: Voce) => link(v.a, corso, v.frequentatore ? f : null);
  const corrente = (v: Voce) => (percorso === v.a || (percorso === '/' && v.a === primaVoce?.a) ? ('page' as const) : undefined);
  const aggiornamento = backend.tipo === 'supabase' ? 'In tempo reale' : backend.tipo === 'github' ? 'Controllo ogni 30 s' : 'Dati in questo browser';
  const corsi = corsiDi(dati, utente);

  /** Riscontro sempre visibile: quanto è svolto della teoria e quanto è eseguito della pratica. */
  const avanza = () => {
    if (!corso) return null;
    const { teoria, pratica } = avanzamento(dati, corso, utente, ruolo, oggiISO());
    const righe: [string, number, string][] = [];
    if (teoria) righe.push(['MTT', teoria.totale.minuti ? (teoria.svolti / teoria.totale.minuti) * 100 : 0, 'ore di teoria svolte']);
    if (pratica) righe.push(['PTT', mediaPratica(pratica), ruolo === 'trainee' ? 'task eseguiti' : 'task eseguiti in media']);
    return (
      <a className="avanza" href={link('/quadro', corso)} aria-label="Avanzamento del corso">
        {righe.map(([sigla, p, cosa]) => (
          <span key={sigla} className="avanza-riga" title={`${sigla}: ${Math.round(p)}% ${cosa}`}>
            <span>{sigla}</span>
            <span className="avanza-barra">
              <span style={{ width: `${Math.min(100, p)}%` }} />
            </span>
            <span>{Math.round(p)}%</span>
          </span>
        ))}
      </a>
    );
  };

  const gruppi: [string, Voce[]][] = [
    ['Corso', menu.corso],
    ['Parte teorica · MTT', menu.teoria],
    ['Parte pratica · PTT · logbook', menu.pratica],
    ['Registri · AER(EP).P-147', menu.registri],
    ['', menu.altro],
  ];
  const primaVoce = menu.ordinate[0];
  const inBasso = menu.ordinate.slice(0, 3);
  const inAltro = gruppi.flatMap(([, v]) => v).filter((v) => !inBasso.includes(v));

  const elenco = (lista: Voce[]) =>
    lista.map((v) => (
      <a key={v.a} href={href(v)} aria-current={corrente(v)}>
        <v.icona size={19} stroke={1.6} aria-hidden />
        <span>{v.etichetta}</span>
      </a>
    ));

  const selettoreCorso =
    corsi.length > 1 ? (
      <Select
        size="xs"
        aria-label="Corso"
        value={corso?.id ?? null}
        onChange={(id) => {
          if (!id) return;
          ricordaCorso(id);
          naviga(`${percorso}?c=${id}`);
        }}
        data={corsi.map((c) => ({ value: c.id, label: c.codice }))}
        allowDeselect={false}
        comboboxProps={{ withinPortal: true }}
        styles={{ input: { fontFamily: 'var(--condensato)', fontWeight: 600 } }}
      />
    ) : null;

  return (
    <div className="guscio">
      <nav className="indice" aria-label="Indice delle pagine">
        <div className="marchio">
          <div className="marchio-sigla">
            <span>TT</span>
          </div>
          <div className="marchio-nome">Gestionale Type Training</div>
        </div>
        {corso && (
          <div className="indice-corso">
            <span className="etichetta">Corso</span>
            <div style={{ fontWeight: 600, lineHeight: 1.25 }}>{corso.codice}</div>
            <div className="debole" style={{ fontSize: '0.8125rem', lineHeight: 1.3 }}>
              {corso.nome}
            </div>
            {avanza()}
            {corsi.length > 1 && (
              <a className="etichetta" href="#/corsi" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
                <IconSwitchHorizontal size={14} /> Cambia corso
              </a>
            )}
          </div>
        )}
        {gruppi
          .filter(([, v]) => v.length)
          .map(([titoloGruppo, voci]) => (
            <div className="indice-gruppo" key={titoloGruppo || 'altro'}>
              {titoloGruppo && <span className="etichetta">{titoloGruppo}</span>}
              {elenco(voci)}
            </div>
          ))}
        <div className="indice-piede">
          <div style={{ fontWeight: 600 }}>{nomeUtente(dati, utente.id)}</div>
          <div className="debole">
            {ETICHETTA_RUOLO[utente.ruolo]} · {utente.username}
          </div>
          <button type="button" onClick={() => void esci()} style={{ all: 'unset', cursor: 'pointer', marginTop: 10, display: 'inline-flex', gap: 6, alignItems: 'center', fontWeight: 600 }}>
            <IconLogout size={16} aria-hidden /> Esci
          </button>
        </div>
      </nav>

      <div style={{ minWidth: 0 }}>
        <header className="barra">
          <a href="#/" className="marchio-sigla solo-mobile" style={{ fontSize: '1.375rem', textDecoration: 'none' }} aria-label="Pagina iniziale">
            <span>TT</span>
          </a>
          <div className="barra-titolo">
            <strong>{titolo}</strong>
            <span className="debole" style={{ fontSize: '0.8125rem' }}>
              {corso ? corso.codice : ETICHETTA_RUOLO[utente.ruolo]}
              {frequentatore && ['/tavola', '/logbook', '/report', '/istruttori', '/dati'].includes(percorso) ? ` · ${nomeUtente(dati, frequentatore.id)}` : ''}
            </span>
          </div>
          <div className="solo-mobile">{selettoreCorso}</div>
          <Tooltip label={`${aggiornamento} · aggiornato alle ${ora(aggiornatoAlle)}`}>
            <ActionIcon variant="subtle" size="lg" onClick={() => void ricarica()} aria-label="Aggiorna i dati">
              <IconRefresh size={20} stroke={1.6} />
            </ActionIcon>
          </Tooltip>
        </header>
        <main className="contenuto">{children}</main>
      </div>

      <nav className="navbasso" aria-label="Navigazione principale">
        {inBasso.map((v) => (
          <a key={v.a} href={href(v)} aria-current={corrente(v)}>
            <v.icona size={22} stroke={1.6} aria-hidden />
            {v.breve}
          </a>
        ))}
        <button type="button" onClick={() => setAltro(true)} aria-haspopup="dialog">
          <IconDots size={22} stroke={1.6} aria-hidden />
          Altro
        </button>
      </nav>

      <Drawer opened={altro} onClose={() => setAltro(false)} position="bottom" size="auto" title={<span className="titolo-sezione">Altre pagine</span>}>
        <nav className="indice-mobile" onClick={() => setAltro(false)}>
          {inAltro.map((v) => (
            <a key={v.a} href={href(v)} aria-current={corrente(v)} className="voce-altro">
              <v.icona size={20} stroke={1.6} aria-hidden />
              {v.etichetta}
            </a>
          ))}
          <button type="button" className="voce-altro" onClick={() => void esci()}>
            <IconLogout size={20} stroke={1.6} aria-hidden />
            Esci ({utente.username})
          </button>
        </nav>
      </Drawer>
    </div>
  );
}
