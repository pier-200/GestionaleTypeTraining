import { useState } from 'react';
import { Button, CopyButton, Drawer, Group, SegmentedControl, Select, Stack, Switch, Tabs, Text, TextInput } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconCopy, IconPencil, IconPlus, IconRefresh } from '@tabler/icons-react';
import { nuovoUuid } from '../../backend/github/crittografia';
import { RE_USERNAME, errorePassword } from '../../dominio/motore';
import { ETICHETTA_RUOLO, type Istruttore, type Ruolo, type Utente } from '../../dominio/tipi';
import { chiaveOrdine, formatoData, nomeIstruttore, nomeUtente } from '../../dominio/viste';
import { IntestazionePagina } from '../componenti/disegno';
import { useStato } from '../stato';

/** Password provvisoria leggibile: niente caratteri ambigui (0/O, 1/l). */
function generaPassword() {
  const lettere = 'abcdefghjkmnpqrstuvwxyz';
  const cifre = '23456789';
  const r = crypto.getRandomValues(new Uint32Array(12));
  const parti = [...r].map((x, i) => (i % 4 === 3 ? cifre[x % cifre.length] : lettere[x % lettere.length]));
  return `${parti.slice(0, 4).join('')}-${parti.slice(4, 8).join('')}-${parti.slice(8).join('')}`.replace(/^./, (c) => c.toUpperCase());
}

function Credenziali({ username, password }: { username: string; password: string }) {
  return (
    <div className="tutto-ok" style={{ display: 'block' }}>
      <Text fw={600}>Credenziali da consegnare di persona</Text>
      <Text size="sm" mt={4}>
        Username <b className="cifre">{username}</b> · password provvisoria <b className="cifre">{password}</b>
      </Text>
      <Text size="xs" c="dimmed" mt={4}>
        Al primo accesso verrà chiesto di sostituire la password.
      </Text>
      <CopyButton value={`Username: ${username}\nPassword provvisoria: ${password}`}>
        {({ copied, copy }) => (
          <Button size="compact-sm" variant="default" mt={8} leftSection={<IconCopy size={15} />} onClick={copy}>
            {copied ? 'Copiato' : 'Copia'}
          </Button>
        )}
      </CopyButton>
    </div>
  );
}

function FormAccount({ esistente, chiudi }: { esistente: Utente | null; chiudi: () => void }) {
  const { dati, esegui, utente: io } = useStato();
  const [ruolo, setRuolo] = useState<Ruolo>(esistente?.ruolo ?? 'trainee');
  const [username, setUsername] = useState(esistente?.username ?? '');
  const [nome, setNome] = useState(esistente?.nome ?? '');
  const [istruttore, setIstruttore] = useState<string | null>(esistente?.istruttore_id ?? null);
  const [attivo, setAttivo] = useState(esistente?.attivo ?? true);
  const [password, setPassword] = useState(esistente ? '' : generaPassword());
  const [fatto, setFatto] = useState<{ username: string; password: string } | null>(null);
  const [attesa, setAttesa] = useState(false);
  if (!dati) return null;
  if (fatto) {
    return (
      <Stack>
        <Credenziali {...fatto} />
        <Button onClick={chiudi}>Chiudi</Button>
      </Stack>
    );
  }
  const u = username.trim().toLowerCase();
  const erroreUsername = u && !RE_USERNAME.test(u) ? 'Minuscole, cifre, punto o trattino (3-40 caratteri), es. mario.rossi' : null;
  const errorePw = password ? errorePassword(password) : null;
  const serveNuovaPassword = Boolean(esistente && attivo && !esistente.attivo);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setAttesa(true);
        const ok = esistente
          ? await esegui(
              { tipo: 'utente.modifica', utente: { id: esistente.id, nome, attivo, istruttore_id: ruolo === 'instructor' ? istruttore : null }, password: password || undefined },
              'Account aggiornato',
            )
          : await esegui({ tipo: 'utente.crea', utente: { id: nuovoUuid(), username: u, ruolo, nome, istruttore_id: ruolo === 'instructor' ? istruttore : null }, password }, 'Account creato');
        setAttesa(false);
        if (!ok) return;
        if (password && attivo) setFatto({ username: esistente?.username ?? u, password });
        else chiudi();
      }}
    >
      <Stack gap="md">
        {!esistente && (
          <div>
            <Text size="sm" fw={500} mb={4}>
              Ruolo
            </Text>
            <SegmentedControl
              fullWidth
              value={ruolo}
              onChange={(v) => setRuolo(v as Ruolo)}
              data={[
                { value: 'trainee', label: 'Frequentatore' },
                { value: 'instructor', label: 'Istruttore' },
                { value: 'direttore', label: 'Direttore' },
                { value: 'admin', label: 'Training Mgr' },
              ]}
            />
          </div>
        )}
        <TextInput label="Username" value={username} onChange={(e) => setUsername(e.currentTarget.value)} disabled={Boolean(esistente)} error={erroreUsername} placeholder="nome.cognome" required autoCapitalize="none" />
        <TextInput
          label={ruolo === 'trainee' ? 'Nome (facoltativo)' : 'Grado, nome e cognome'}
          description={ruolo === 'trainee' ? 'Il frequentatore compila i propri Personal Data al primo accesso.' : undefined}
          value={nome}
          onChange={(e) => setNome(e.currentTarget.value)}
          required={ruolo !== 'trainee'}
        />
        {ruolo === 'instructor' && (
          <Select
            label="Collegato all'elenco istruttori"
            description="Evidenzia i task supervisionati da questo istruttore."
            clearable
            searchable
            value={istruttore}
            onChange={setIstruttore}
            data={[...dati.istruttori].sort((a, b) => a.cognome.localeCompare(b.cognome)).map((i) => ({ value: i.id, label: nomeIstruttore(i) }))}
          />
        )}
        {esistente && esistente.id !== io?.id && <Switch label="Account attivo" checked={attivo} onChange={(e) => setAttivo(e.currentTarget.checked)} description="Disattivando, i dati restano consultabili ed esportabili." />}
        {attivo && (
          <TextInput
            label={esistente ? 'Nuova password provvisoria' : 'Password provvisoria'}
            description={esistente ? (serveNuovaPassword ? 'Obbligatoria per riattivare l’account.' : 'Lasciare vuoto per non cambiarla.') : 'Almeno 4 caratteri.'}
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            error={errorePw}
            required={!esistente || serveNuovaPassword}
            rightSection={
              <Button variant="subtle" size="compact-xs" onClick={() => setPassword(generaPassword())} aria-label="Genera password">
                <IconRefresh size={15} />
              </Button>
            }
          />
        )}
        <Group grow>
          <Button variant="default" onClick={chiudi}>
            Annulla
          </Button>
          <Button type="submit" loading={attesa}>
            {esistente ? 'Salva' : 'Crea account'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

function FormIstruttore({ esistente, chiudi }: { esistente: Istruttore | null; chiudi: () => void }) {
  const { esegui } = useStato();
  const [v, setV] = useState({ grado: esistente?.grado ?? '', nome: esistente?.nome ?? '', cognome: esistente?.cognome ?? '' });
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await esegui(
          esistente ? { tipo: 'istruttore.modifica', istruttore: { id: esistente.id, ...v } } : { tipo: 'istruttore.crea', istruttore: { id: nuovoUuid(), ...v } },
          esistente ? 'Istruttore aggiornato' : 'Istruttore aggiunto',
        );
        if (ok) chiudi();
      }}
    >
      <Stack>
        <TextInput label="Rank (grado)" value={v.grado} onChange={(e) => setV({ ...v, grado: e.currentTarget.value })} required />
        <TextInput label="Name" value={v.nome} onChange={(e) => setV({ ...v, nome: e.currentTarget.value })} required />
        <TextInput label="Surname" value={v.cognome} onChange={(e) => setV({ ...v, cognome: e.currentTarget.value })} required />
        <Group grow>
          <Button variant="default" onClick={chiudi}>
            Annulla
          </Button>
          <Button type="submit">Salva</Button>
        </Group>
      </Stack>
    </form>
  );
}

export function Account() {
  const { dati, backend } = useStato();
  const mobile = useMediaQuery('(max-width: 991px)');
  const [account, setAccount] = useState<Utente | 'nuovo' | null>(null);
  const [istruttore, setIstruttore] = useState<Istruttore | 'nuovo' | null>(null);
  if (!dati || !backend) return null;
  const ordine: Record<Ruolo, number> = { admin: 0, direttore: 1, instructor: 2, trainee: 3 };
  const utenti = [...dati.utenti].sort((a, b) => ordine[a.ruolo] - ordine[b.ruolo] || Number(b.attivo) - Number(a.attivo) || chiaveOrdine(dati, a).localeCompare(chiaveOrdine(dati, b)));
  const cassetto = { position: mobile ? ('bottom' as const) : ('right' as const), size: mobile ? '92%' : 460 };

  return (
    <>
      <IntestazionePagina titolo="Account" sotto={`Archivio: ${backend.nome}${backend.permessiLatoServer ? '' : ' · permessi applicati dall’app'}`} />
      <Tabs defaultValue="account" keepMounted={false}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="account">Account · {utenti.length}</Tabs.Tab>
          <Tabs.Tab value="istruttori">Elenco istruttori · {dati.istruttori.length}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="account">
          <Button leftSection={<IconPlus size={17} />} onClick={() => setAccount('nuovo')} mb="md">
            Nuovo account
          </Button>
          <div className="scorre">
            <table className="tabella">
              <thead>
                <tr>
                  <th>Nominativo</th>
                  <th>Username</th>
                  <th>Ruolo</th>
                  <th>Stato</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {utenti.map((u) => (
                  <tr key={u.id} style={u.attivo ? undefined : { color: 'var(--testo-3)' }}>
                    <td style={{ fontWeight: 600, minWidth: 180 }}>{nomeUtente(dati, u.id)}</td>
                    <td className="cifre">{u.username}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{ETICHETTA_RUOLO[u.ruolo]}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{!u.attivo ? 'Disattivato' : u.deve_cambiare_password ? 'Password provvisoria' : 'Attivo'}</td>
                    <td>
                      <Button size="compact-sm" variant="subtle" leftSection={<IconPencil size={15} />} onClick={() => setAccount(u)}>
                        Modifica
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="istruttori">
          <Text className="debole" mb="md" size="sm">
            I frequentatori possono aggiungere un istruttore mentre registrano un task; qui il Training Manager corregge grado e nominativi.
          </Text>
          <Button leftSection={<IconPlus size={17} />} onClick={() => setIstruttore('nuovo')} mb="md">
            Nuovo istruttore
          </Button>
          <div className="scorre">
            <table className="tabella">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Name</th>
                  <th>Surname</th>
                  <th className="num">Registrazioni</th>
                  <th>Inserito</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...dati.istruttori]
                  .sort((a, b) => a.cognome.localeCompare(b.cognome))
                  .map((i) => (
                    <tr key={i.id}>
                      <td>{i.grado}</td>
                      <td>{i.nome}</td>
                      <td style={{ fontWeight: 600 }}>{i.cognome}</td>
                      <td className="num">{dati.registrazioni.filter((r) => r.instructor_id === i.id).length}</td>
                      <td className="debole" style={{ fontSize: 'var(--fs-s)', whiteSpace: 'nowrap' }}>
                        {formatoData(i.created_at)} · {nomeUtente(dati, i.created_by)}
                      </td>
                      <td>
                        <Button size="compact-sm" variant="subtle" leftSection={<IconPencil size={15} />} onClick={() => setIstruttore(i)}>
                          Modifica
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Tabs.Panel>

      </Tabs>

      <Drawer opened={account != null} onClose={() => setAccount(null)} {...cassetto} title={<span className="titolo-sezione">{account === 'nuovo' ? 'Nuovo account' : 'Modifica account'}</span>}>
        {account != null && <FormAccount key={account === 'nuovo' ? 'nuovo' : account.id} esistente={account === 'nuovo' ? null : account} chiudi={() => setAccount(null)} />}
      </Drawer>
      <Drawer opened={istruttore != null} onClose={() => setIstruttore(null)} {...cassetto} title={<span className="titolo-sezione">{istruttore === 'nuovo' ? 'Nuovo istruttore' : 'Modifica istruttore'}</span>}>
        {istruttore != null && <FormIstruttore key={istruttore === 'nuovo' ? 'nuovo' : istruttore.id} esistente={istruttore === 'nuovo' ? null : istruttore} chiudi={() => setIstruttore(null)} />}
      </Drawer>
    </>
  );
}
