import { useEffect } from 'react';
import { Button, Loader, Text } from '@mantine/core';
import { corsiDi } from '../dominio/motore';
import { Guscio } from './Guscio';
import { Foglio } from './componenti/disegno';
import { Accesso, PrimoAvvio } from './pagine/Accesso';
import { Account } from './pagine/Account';
import { Assenze } from './pagine/Assenze';
import { Certificati } from './pagine/Certificati';
import { Corsi } from './pagine/Corsi';
import { Corso } from './pagine/Corso';
import { Dati, FormAnagrafica } from './pagine/Dati';
import { Distinta } from './pagine/Distinta';
import { Docenti } from './pagine/Docenti';
import { Generalita } from './pagine/Generalita';
import { Istruttori } from './pagine/Istruttori';
import { Logbook } from './pagine/Logbook';
import { Materie } from './pagine/Materie';
import { Rapportino } from './pagine/Rapportino';
import { FormPassword, Profilo } from './pagine/Profilo';
import { Quadro } from './pagine/Quadro';
import { Registro } from './pagine/Registro';
import { Report } from './pagine/Report';
import { Settimana } from './pagine/Settimana';
import { Tavola } from './pagine/Tavola';
import { Teoria } from './pagine/Teoria';
import { menuPer, useCorso, useRuoloCorso } from './navigazione';
import { usePosizione } from './router';
import { useStato } from './stato';

interface Pagina {
  titolo: string;
  pagina: () => React.ReactNode;
  soloAdmin?: boolean;
  /** Richiede un corso scelto. */
  corso?: boolean;
}

const PAGINE: Record<string, Pagina> = {
  '/corsi': { titolo: 'Corsi', pagina: Corsi },
  '/quadro': { titolo: 'Avanzamento del corso', pagina: Quadro, corso: true },
  '/corso': { titolo: 'Corso e iscritti', pagina: Corso, corso: true },
  '/settimana': { titolo: 'Programma settimanale', pagina: Settimana, corso: true },
  '/rapportino': { titolo: 'Rapportino presenze', pagina: Rapportino, corso: true },
  '/assenze': { titolo: 'Assenze e idoneità', pagina: Assenze, corso: true },
  '/teoria': { titolo: 'Situazione della teoria', pagina: Teoria, corso: true },
  '/docenti': { titolo: 'Ore degli istruttori', pagina: Docenti, corso: true },
  '/materie': { titolo: 'Materie e istruttori', pagina: Materie, corso: true },
  '/distinta': { titolo: 'Situazione pratica', pagina: Distinta, corso: true },
  '/tavola': { titolo: 'Tavola', pagina: Tavola, corso: true },
  '/logbook': { titolo: 'Logbook', pagina: Logbook, corso: true },
  '/report': { titolo: 'Compliance Report', pagina: Report, corso: true },
  '/istruttori': { titolo: 'Practical Instructors', pagina: Istruttori, corso: true },
  '/dati': { titolo: 'Personal & Training Data', pagina: Dati, corso: true },
  '/generalita': { titolo: 'Generality and Purpose', pagina: Generalita },
  '/profilo': { titolo: 'Profilo', pagina: Profilo },
  '/registro': { titolo: 'Registro corsi e corsisti', pagina: Registro, soloAdmin: true },
  '/certificati': { titolo: 'Registro dei certificati', pagina: Certificati, soloAdmin: true },
  '/account': { titolo: 'Account', pagina: Account, soloAdmin: true },
};

function Schermata({ children }: { children: React.ReactNode }) {
  return (
    <main className="accesso">
      <div className="accesso-foglio" style={{ maxWidth: 560, gridTemplateColumns: '1fr' }}>
        <section>{children}</section>
      </div>
    </main>
  );
}

export function App() {
  const { fase, messaggio, utente, dati, avvia } = useStato();
  const { percorso } = usePosizione();
  const corso = useCorso();
  const ruolo = useRuoloCorso();

  useEffect(() => {
    void avvia();
  }, [avvia]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [percorso]);

  if (fase === 'avvio') {
    return (
      <Schermata>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Loader size="sm" color="inchiostro" />
          <span>Caricamento…</span>
        </div>
      </Schermata>
    );
  }
  if (fase === 'errore') {
    return (
      <Schermata>
        <h1 className="titolo-sezione">Avvio non riuscito</h1>
        <Text mt="sm">{messaggio}</Text>
        <Button mt="md" onClick={() => window.location.reload()}>
          Riprova
        </Button>
      </Schermata>
    );
  }
  if (fase === 'primo_avvio') return <PrimoAvvio />;
  if (fase === 'accesso' || !utente || !dati) return <Accesso />;

  // primo accesso: password provvisoria da sostituire, poi Personal Data del frequentatore
  if (utente.deve_cambiare_password) {
    return (
      <Schermata>
        <h1 className="titolo-sezione">Scegli la tua password</h1>
        <Text className="debole" mt={4} mb="md">
          Stai usando la password provvisoria ricevuta dal Training Manager: sostituiscila per continuare.
        </Text>
        <FormPassword obbligatorio />
      </Schermata>
    );
  }
  if (utente.ruolo === 'trainee' && !dati.anagrafiche.some((a) => a.user_id === utente.id)) {
    return (
      <Schermata>
        <h1 className="titolo-sezione">Trainee data</h1>
        <Text className="debole" mt={4} mb="md">
          Primo accesso: compila i tuoi dati anagrafici. Potrai modificarli in seguito dalla pagina «Dati».
        </Text>
        <FormAnagrafica f={utente} sola={false} />
      </Schermata>
    );
  }

  const menu = menuPer(utente, corso, ruolo);
  const prima = menu.ordinate[0];
  const scelta = corsiDi(dati, utente).length !== 1 && !corso;
  const voce = percorso === '/' ? (scelta ? PAGINE['/corsi'] : PAGINE[prima?.a ?? '/corsi']) : PAGINE[percorso];
  const consentita = voce && !(voce.soloAdmin && utente.ruolo !== 'admin');
  const senzaCorso = consentita && voce.corso && !corso;
  const titolo = !consentita ? 'Pagina non trovata' : senzaCorso ? 'Scegli il corso' : voce.titolo;
  const Pagina = !consentita ? null : senzaCorso ? Corsi : voce.pagina;

  return (
    <Guscio titolo={titolo}>
      <Foglio>
        {Pagina ? (
          <Pagina />
        ) : (
          <div>
            <h1 className="titolo-pagina">Pagina non trovata</h1>
            <p>
              <a href="#/">Torna alla pagina iniziale</a>
            </p>
          </div>
        )}
      </Foglio>
    </Guscio>
  );
}
