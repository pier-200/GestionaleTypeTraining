import { useState } from 'react';
import { Button, SimpleGrid, Stack, TextInput } from '@mantine/core';
import { oggiISO } from '../../dominio/motore';
import type { Corso, Utente } from '../../dominio/tipi';
import { formatoData } from '../../dominio/viste';
import { IntestazionePagina, Sezione } from '../componenti/disegno';
import { ConFrequentatore } from '../componenti/Frequentatore';
import { useStato } from '../stato';

export function Dati() {
  return <ConFrequentatore>{(f, corso) => <DatiDi f={f} corso={corso} />}</ConFrequentatore>;
}

function DatiDi({ f, corso }: { f: Utente; corso: Corso }) {
  const { utente, dati } = useStato();
  if (!utente || !dati) return null;
  const guida = utente.ruolo === 'admin' || dati.iscrizioni.some((i) => i.corso_id === corso.id && i.user_id === utente.id && i.ruolo === 'direttore');
  return (
    <>
      <IntestazionePagina titolo="Personnel data" sotto="Trainee data e Practical type training data (Allegato 1, cap. 2)." />
      <div className="griglia-2">
        <Sezione titolo="Trainee data">
          <FormAnagrafica key={f.id} f={f} sola={!(utente.ruolo === 'admin' || utente.id === f.id)} />
        </Sezione>
        <Sezione titolo="Practical type training data">
          <FormTraining key={f.id} corso={corso} userIds={[f.id]} sola={!guida} />
        </Sezione>
      </div>
    </>
  );
}

export function FormAnagrafica({ f, sola, dopo }: { f: Utente; sola: boolean; dopo?: () => void }) {
  const { dati, esegui } = useStato();
  const a = dati?.anagrafiche.find((x) => x.user_id === f.id);
  const [v, setV] = useState({
    grado: a?.grado ?? '',
    nome: a?.nome ?? '',
    cognome: a?.cognome ?? '',
    data_nascita: a?.data_nascita ?? '',
    citta_nascita: a?.citta_nascita ?? '',
    maml: a?.maml ?? '',
  });
  const [attesa, setAttesa] = useState(false);
  const campo = (k: keyof typeof v, label: string, extra: Record<string, unknown> = {}) => (
    <TextInput label={label} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.currentTarget.value })} readOnly={sola} variant={sola ? 'filled' : 'default'} required={!sola && k !== 'maml'} {...extra} />
  );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setAttesa(true);
        const ok = await esegui({ tipo: 'anagrafica.salva', anagrafica: { user_id: f.id, ...v, data_nascita: v.data_nascita || null } }, 'Personal data salvati');
        setAttesa(false);
        if (ok) dopo?.();
      }}
    >
      <Stack gap="sm">
        {campo('grado', 'Rank (grado)', { placeholder: 'es. Serg. Magg.' })}
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
          {campo('nome', 'Name (nome)')}
          {campo('cognome', 'Surname (cognome)')}
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
          {campo('data_nascita', 'Date of birth', { type: 'date', max: oggiISO() })}
          {campo('citta_nascita', 'Place of birth')}
        </SimpleGrid>
        {campo('maml', 'MAML n. (se posseduta)', { description: 'Compare nell’intestazione del Compliance Report.' })}
        {!sola && (
          <Button type="submit" loading={attesa} style={{ alignSelf: 'flex-start' }}>
            Salva personal data
          </Button>
        )}
        {a && (
          <span className="debole" style={{ fontSize: 'var(--fs-s)' }}>
            Ultimo aggiornamento {formatoData(a.updated_at)}
          </span>
        )}
      </Stack>
    </form>
  );
}

/** Practical type training data: inseriti dal solo TM, per un frequentatore o per più frequentatori insieme. */
export function FormTraining({ corso, userIds, sola, dopo }: { corso: Corso; userIds: string[]; sola: boolean; dopo?: () => void }) {
  const { dati, esegui } = useStato();
  const t = dati?.training.find((x) => x.user_id === userIds[0] && x.corso_id === corso.id) ?? (userIds.length ? corso : undefined);
  const [v, setV] = useState({
    data_inizio: t?.data_inizio ?? '',
    data_fine: t?.data_fine ?? '',
    maintenance_organization: t?.maintenance_organization ?? '',
    location: t?.location ?? '',
  });
  const [attesa, setAttesa] = useState(false);
  if (sola) {
    return (
      <div className="registrazione" style={{ borderTop: 0, padding: 0, display: 'block' }}>
        <dl>
          <div>
            <dt>Start date</dt>
            <dd>{formatoData(t?.data_inizio)}</dd>
          </div>
          <div>
            <dt>End date</dt>
            <dd>{formatoData(t?.data_fine)}</dd>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <dt>Maintenance organisation (name and DAAA approval nr)</dt>
            <dd>{t?.maintenance_organization || '—'}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{t?.location || '—'}</dd>
          </div>
        </dl>
        <p className="debole" style={{ fontSize: 'var(--fs-s)', gridColumn: '1 / -1', margin: '8px 0 0' }}>
          Dati inseriti dal Training Manager.
        </p>
      </div>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setAttesa(true);
        const ok = await esegui(
          { tipo: 'training.salva', corso_id: corso.id, user_ids: userIds, training: { ...v, data_inizio: v.data_inizio || null, data_fine: v.data_fine || null } },
          userIds.length > 1 ? `Training data salvati per ${userIds.length} frequentatori` : 'Training data salvati',
        );
        setAttesa(false);
        if (ok) dopo?.();
      }}
    >
      <Stack gap="sm">
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
          <TextInput type="date" label="Start date" value={v.data_inizio} onChange={(e) => setV({ ...v, data_inizio: e.currentTarget.value })} />
          <TextInput type="date" label="End date" value={v.data_fine} onChange={(e) => setV({ ...v, data_fine: e.currentTarget.value })} />
        </SimpleGrid>
        <TextInput
          label="Maintenance organisation"
          description="Nome e numero di approvazione DAAA"
          value={v.maintenance_organization}
          onChange={(e) => setV({ ...v, maintenance_organization: e.currentTarget.value })}
        />
        <TextInput label="Location" value={v.location} onChange={(e) => setV({ ...v, location: e.currentTarget.value })} />
        <Button type="submit" loading={attesa} disabled={!userIds.length} style={{ alignSelf: 'flex-start' }}>
          {userIds.length > 1 ? `Salva per ${userIds.length} frequentatori` : 'Salva training data'}
        </Button>
      </Stack>
    </form>
  );
}
