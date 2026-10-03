import { useState } from 'react';
import { Alert, Button, Checkbox, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';
import type { DemoBackend } from '../../backend/demo';
import { formatoPercentuale } from '../../dominio/compliance';
import { messaggioErrore } from '../../dominio/errori';
import { ETICHETTA_RUOLO } from '../../dominio/tipi';
import { nomeUtente, situazione } from '../../dominio/viste';
import { corsiDi } from '../../dominio/motore';
import { chiaveOrdine } from '../../dominio/viste';
import { useStato } from '../stato';

function Testata() {
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="marchio-sigla grande" aria-hidden>
        TT
      </div>
      <h1 className="titolo-pagina" style={{ marginTop: 10 }}>
        Gestionale Type Training
      </h1>
      <Text className="debole" mt={4}>
        Corsi CH-47F, UC-228 e VC-180A: parte teorica (MTT) e parte pratica (logbook PTR)
      </Text>
    </div>
  );
}

export function Accesso() {
  const { backend, entra } = useStato();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [ricordami, setRicordami] = useState(true);
  const [errore, setErrore] = useState('');
  const [attesa, setAttesa] = useState<string | null>(null);
  const [, setGiro] = useState(0);
  if (!backend) return null;
  const demo = backend.tipo === 'demo' ? (backend as DemoBackend) : null;

  const prova = async (chi: string, fn: () => Promise<Parameters<typeof entra>[0]>) => {
    setAttesa(chi);
    setErrore('');
    try {
      await entra(await fn());
    } catch (e) {
      setErrore(messaggioErrore(e));
    } finally {
      setAttesa(null);
    }
  };

  const esempio = demo ? demo.datiCorrenti() : null;
  const profili = esempio
    ? [
        ...esempio.utenti.filter((u) => u.ruolo !== 'trainee' && u.attivo),
        ...esempio.utenti.filter((u) => u.ruolo === 'trainee' && u.attivo).sort((a, b) => chiaveOrdine(esempio, a).localeCompare(chiaveOrdine(esempio, b))),
      ]
    : [];

  return (
    <main className="accesso">
      <div className="accesso-foglio">
        <section>
          <Testata />
          <form onSubmit={(e) => (e.preventDefault(), void prova('form', () => backend.accedi(username, password, ricordami)))}>
            <Stack gap="md">
              <TextInput label="Username" value={username} onChange={(e) => setUsername(e.currentTarget.value)} autoComplete="username" autoCapitalize="none" required />
              <PasswordInput label="Password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} autoComplete="current-password" required />
              <Checkbox label="Resta connesso su questo dispositivo" checked={ricordami} onChange={(e) => setRicordami(e.currentTarget.checked)} />
              {errore && (
                <Alert color="rosso" variant="light" title="Accesso non riuscito">
                  {errore}
                </Alert>
              )}
              <Button type="submit" size="md" loading={attesa === 'form'} rightSection={<IconArrowRight size={18} />}>
                Accedi
              </Button>
              <Text size="sm" className="debole">
                Gli account sono creati dal Training Manager: senza account non si accede.
              </Text>
            </Stack>
          </form>
        </section>

        {demo && esempio ? (
          <section>
            <h2 className="titolo-sezione">Situazione esempio</h2>
            <Text size="sm" className="debole" mt={4} mb="md">
              Modalità dimostrativa: dati inventati, salvati solo in questo browser. Scegli un profilo per entrare.
            </Text>
            <ul className="profili">
              {profili.map((u) => {
                const suoCorso = corsiDi(esempio, u).find((c) => c.programma_pratico);
                const s = u.ruolo === 'trainee' && suoCorso ? situazione(esempio, suoCorso, u) : null;
                return (
                  <li key={u.id}>
                    <button type="button" onClick={() => void prova(u.id, () => demo.accediCome(u.username))} disabled={attesa != null}>
                      <span>
                        <strong>{u.ruolo === 'trainee' && !s?.registrazioni.length && !esempio.anagrafiche.some((a) => a.user_id === u.id) ? `${u.username} (nuovo account)` : nomeUtente(esempio, u.id)}</strong>
                        <span className="debole" style={{ display: 'block', fontSize: 'var(--fs-s)' }}>
                          {ETICHETTA_RUOLO[u.ruolo]}
                          {u.ruolo === 'instructor' ? ' · sola lettura' : u.ruolo === 'admin' ? ' · pieni poteri' : ''}
                        </span>
                      </span>
                      {s ? (
                        <span className="cifre" style={{ fontWeight: 600, textAlign: 'right' }}>
                          {formatoPercentuale(s.report.totale.percentuale)}
                          <span className={s.report.conforme ? 'debole' : 'rosso'} style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>
                            {s.report.conforme ? 'conforme' : 'non conforme'}
                          </span>
                        </span>
                      ) : (
                        <IconArrowRight size={18} aria-hidden />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            <Button
              variant="subtle"
              size="compact-sm"
              mt="md"
              onClick={() => {
                demo.ripristinaEsempio();
                setErrore('');
                setGiro((g) => g + 1);
              }}
            >
              Ripristina la situazione esempio
            </Button>
          </section>
        ) : (
          <section>
            <h2 className="titolo-sezione">Come funziona</h2>
            <ol style={{ paddingLeft: 20, lineHeight: 1.6 }}>
              <li>Accedi con l'account ricevuto dal Training Manager.</li>
              <li>Al primo accesso sostituisci la password provvisoria e compila i Personal Data.</li>
              <li>Parte teorica: programma settimanale, rapportino presenze e quadro delle assenze.</li>
              <li>Parte pratica: dopo ogni task eseguito premi «Registra task» e il Compliance Report si aggiorna subito.</li>
            </ol>
            <Text size="sm" className="debole">
              Sul cellulare: menu del browser → «Aggiungi a schermata Home» per usare l'app come TT.
            </Text>
          </section>
        )}
      </div>
    </main>
  );
}

export function PrimoAvvio() {
  const { backend, messaggio, entra } = useStato();
  const [v, setV] = useState({ username: '', nome: '', password: '', token: '' });
  const [errore, setErrore] = useState('');
  const [attesa, setAttesa] = useState(false);
  if (!backend) return null;
  const github = backend.tipo === 'github';
  return (
    <main className="accesso">
      <div className="accesso-foglio" style={{ maxWidth: 560, gridTemplateColumns: '1fr' }}>
        <section>
          <Testata />
          <h2 className="titolo-sezione">Configurazione iniziale</h2>
          <Text size="sm" className="debole" mt={4} mb="md">
            {messaggio}
          </Text>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setAttesa(true);
              setErrore('');
              try {
                await entra(await backend.primoAvvio(v));
              } catch (x) {
                setErrore(messaggioErrore(x));
              } finally {
                setAttesa(false);
              }
            }}
          >
            <Stack gap="md">
              {github && <PasswordInput label="Token GitHub (fine-grained, Contents: read and write)" value={v.token} onChange={(e) => setV({ ...v, token: e.currentTarget.value })} required />}
              <TextInput label="Username del Training Manager" value={v.username} onChange={(e) => setV({ ...v, username: e.currentTarget.value })} autoCapitalize="none" required />
              <TextInput label="Grado, nome e cognome" value={v.nome} onChange={(e) => setV({ ...v, nome: e.currentTarget.value })} required />
              <PasswordInput
                label="Password"
                description={github ? 'Almeno 4 caratteri: protegge il token, per i dati veri usarne una lunga.' : 'La password dell’utente creato nel pannello Supabase.'}
                value={v.password}
                onChange={(e) => setV({ ...v, password: e.currentTarget.value })}
                required
              />
              {errore && (
                <Alert color="rosso" variant="light">
                  {errore}
                </Alert>
              )}
              <Button type="submit" loading={attesa}>
                Configura e accedi
              </Button>
            </Stack>
          </form>
        </section>
      </div>
    </main>
  );
}
