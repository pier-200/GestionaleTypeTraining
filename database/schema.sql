-- Gestionale Type Training – schema Supabase (PostgreSQL). Lo script si può rieseguire.
--
-- Corsi con parte teorica (MTT) e/o pratica (PTT). I programmi (catalogo task e materie)
-- stanno nell'applicazione, non qui: il database conserva solo i dati del corso.
--
-- Sicurezza (Row Level Security), sempre limitata ai corsi a cui si è iscritti:
--   frequentatore  legge e scrive solo le proprie righe (Personal Data, logbook);
--   istruttore     non si iscrive ai corsi: legge quelli in cui è nominato per la fase pratica o ha lezioni; non scrive;
--   direttore      è uno degli istruttori (uno solo per corso, lo assegna il Training Manager): in quel corso
--                  ha in più programma teorico, iscrizioni, dati del corso e validazioni;
--   rapportino     lo compila chiunque frequenti il corso, lo valida chi guida il corso;
--   admin (TM)     tutto, su tutti i corsi; crea gli account con la Edge Function "gestione-utenti".

-- ---------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------

create table if not exists public.istruttori (
  id uuid primary key default gen_random_uuid(),
  grado text not null check (length(trim(grado)) between 1 and 60),
  nome text not null check (length(trim(nome)) between 1 and 80),
  cognome text not null check (length(trim(cognome)) between 1 and 80),
  created_at timestamptz not null default now(),
  created_by uuid
);
create unique index if not exists istruttori_unico on public.istruttori (lower(grado), lower(nome), lower(cognome));

create table if not exists public.profili (
  id uuid primary key references auth.users on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9._-]{2,39}$'),
  ruolo text not null check (ruolo in ('admin', 'instructor', 'trainee')),
  -- grado, nome e cognome di Training Manager e istruttori (i frequentatori hanno i Personal Data)
  grado text not null default '' check (length(grado) <= 60),
  nome text not null default '' check (length(nome) <= 100),
  cognome text not null default '' check (length(cognome) <= 80),
  attivo boolean not null default true,
  istruttore_id uuid references public.istruttori on delete set null,
  deve_cambiare_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- aggiornamento di installazioni precedenti: «direttore» non è più un tipo di account ma un incarico nel corso
alter table public.profili add column if not exists grado text not null default '';
alter table public.profili add column if not exists cognome text not null default '';
alter table public.profili drop constraint if exists profili_ruolo_check;
update public.profili set ruolo = 'instructor' where ruolo = 'direttore';
alter table public.profili add constraint profili_ruolo_check check (ruolo in ('admin', 'instructor', 'trainee'));

create table if not exists public.corsi (
  id uuid primary key default gen_random_uuid(),
  codice text not null unique check (length(trim(codice)) between 1 and 30),
  nome text not null check (length(trim(nome)) between 1 and 120),
  -- mezzo e categoria: da questi dipendono i programmi, che stanno nell'applicazione
  mds text not null default '' check (length(mds) <= 30),
  categoria text not null default '' check (length(categoria) <= 10),
  programma_teorico text,
  programma_pratico text,
  data_inizio date,
  -- data stimata di fine corso e durata prevista: compaiono sul programma settimanale
  data_fine date,
  durata_settimane int check (durata_settimane between 1 and 104),
  maintenance_organization text not null default '' check (length(maintenance_organization) <= 200),
  location text not null default '' check (length(location) <= 100),
  -- aula proposta per le lezioni e gruppo firma del comandante in calce al programma settimanale
  aula text not null default '' check (length(aula) <= 40),
  gruppo_firma text not null default '' check (length(gruppo_firma) <= 120),
  attivo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (data_fine is null or data_inizio is null or data_fine >= data_inizio)
);
alter table public.corsi add column if not exists mds text not null default '';
alter table public.corsi add column if not exists categoria text not null default '';
alter table public.corsi drop constraint if exists corsi_check;
alter table public.corsi add column if not exists durata_settimane int check (durata_settimane between 1 and 104);
alter table public.corsi add column if not exists aula text not null default '' check (length(aula) <= 40);
alter table public.corsi add column if not exists gruppo_firma text not null default '' check (length(gruppo_firma) <= 120);
-- gli orari dei periodi sono fissi e uguali per tutti i corsi (src/dominio/pianificazione.ts)
alter table public.corsi drop column if exists ora_inizio;
alter table public.corsi drop column if exists minuti_giorno;
-- data effettiva di chiusura (c'è quando il corso è completato), direttore fuori elenco, istruttori nominati
-- per la fase pratica e aeromobili disponibili per i task
alter table public.corsi add column if not exists data_chiusura date;
alter table public.corsi add column if not exists direttore_nome text not null default '' check (length(direttore_nome) <= 80);
alter table public.corsi add column if not exists istruttori_pratica uuid[] not null default '{}';
alter table public.corsi add column if not exists aeromobili text[] not null default '{}';

create table if not exists public.iscrizioni (
  id uuid primary key default gen_random_uuid(),
  corso_id uuid not null references public.corsi on delete cascade,
  user_id uuid not null references public.profili on delete cascade,
  -- al corso sono assegnati i frequentatori; l'unico istruttore con un'iscrizione è il direttore
  ruolo text not null check (ruolo in ('direttore', 'trainee')),
  -- dal giorno indicato il frequentatore è fuori dal corso: i suoi dati restano, fermi a quella data
  escluso_il date,
  created_at timestamptz not null default now(),
  unique (corso_id, user_id)
);
-- aggiornamento di installazioni precedenti: gli istruttori iscritti restano nominati per la fase pratica
alter table public.iscrizioni add column if not exists escluso_il date;
alter table public.iscrizioni drop constraint if exists iscrizioni_ruolo_check;
update public.corsi c set istruttori_pratica = (select array_agg(i.user_id) from public.iscrizioni i where i.corso_id = c.id and i.ruolo = 'instructor')
  where exists (select 1 from public.iscrizioni i where i.corso_id = c.id and i.ruolo = 'instructor');
delete from public.iscrizioni where ruolo = 'instructor';
alter table public.iscrizioni add constraint iscrizioni_ruolo_check check (ruolo in ('direttore', 'trainee'));
create index if not exists iscrizioni_utente on public.iscrizioni (user_id);
-- un solo direttore per corso
create unique index if not exists iscrizioni_un_direttore on public.iscrizioni (corso_id) where ruolo = 'direttore';

create table if not exists public.anagrafiche (
  user_id uuid primary key references public.profili on delete cascade,
  grado text not null check (length(trim(grado)) between 1 and 60),
  nome text not null check (length(trim(nome)) between 1 and 80),
  cognome text not null check (length(trim(cognome)) between 1 and 80),
  data_nascita date not null check (data_nascita <= current_date),
  citta_nascita text not null check (length(trim(citta_nascita)) between 1 and 80),
  maml text not null default '' check (length(maml) <= 40),
  -- ente di appartenenza: compare nell'elenco dei frequentatori del programma settimanale
  ente text not null default '' check (length(ente) <= 60),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.anagrafiche add column if not exists ente text not null default '' check (length(ente) <= 60);

create table if not exists public.training_data (
  corso_id uuid not null references public.corsi on delete cascade,
  user_id uuid not null references public.profili on delete cascade,
  data_inizio date,
  data_fine date,
  maintenance_organization text not null default '' check (length(maintenance_organization) <= 200),
  location text not null default '' check (length(location) <= 100),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (corso_id, user_id),
  check (data_fine is null or data_inizio is null or data_fine >= data_inizio)
);

create table if not exists public.registrazioni (
  id uuid primary key default gen_random_uuid(),
  corso_id uuid not null references public.corsi on delete cascade,
  user_id uuid not null references public.profili on delete cascade,
  -- il task appartiene al programma pratico del corso, che vive nell'applicazione
  task_id int not null check (task_id > 0),
  maintenance_location text not null check (length(trim(maintenance_location)) between 1 and 100),
  data date not null,
  tipo_esecuzione text not null check (tipo_esecuzione in ('AC', 'SIM', 'CLA')),
  matricola text not null default '' check (length(matricola) <= 60),
  et_minuti int not null check (et_minuti between 1 and 1440),
  instructor_id uuid not null references public.istruttori,
  creato_il timestamptz not null default now(),
  creato_da uuid,
  modificato_il timestamptz not null default now(),
  modificato_da uuid,
  check ((tipo_esecuzione = 'AC') = (length(trim(matricola)) > 0))
);
create index if not exists registrazioni_utente on public.registrazioni (corso_id, user_id);

create table if not exists public.lezioni (
  id uuid primary key default gen_random_uuid(),
  corso_id uuid not null references public.corsi on delete cascade,
  data date not null,
  -- periodo della giornata e posizione dentro il periodo: più lezioni brevi possono dividersi la stessa ora
  ordine int not null check (ordine between 0 and 40),
  parte int not null default 0 check (parte between 0 and 3),
  -- una lezione dura al massimo un'ora (poi la pausa) e si compone a quarti d'ora
  minuti int not null check (minuti between 15 and 60 and minuti % 15 = 0),
  -- id della materia nel programma teorico del corso: un chapter previsto dal syllabus
  materia text not null,
  istruttore_id uuid references public.profili on delete set null,
  -- persona di riferimento senza account (pratiche amministrative) e frequentatori a cui è destinato un recupero
  persona text not null default '' check (length(persona) <= 80),
  frequentatori uuid[] not null default '{}',
  -- aula del periodo; vuota = aula del corso
  aula text not null default '' check (length(aula) <= 40),
  -- lezione, recupero oppure periodo non didattico
  tipo text not null default 'lezione' check (tipo in ('lezione', 'recupero', 'meo', 'sospensione', 'esame', 'esame_pratico', 'pratica', 'valutazione', 'pa')),
  -- il programma è visibile ai frequentatori solo dopo la validazione
  validata boolean not null default false,
  validata_da uuid,
  validata_il timestamptz,
  note text not null default '' check (length(note) <= 300),
  creato_il timestamptz not null default now(),
  modificato_il timestamptz not null default now(),
  modificato_da uuid
);
create index if not exists lezioni_corso on public.lezioni (corso_id, data);
-- aggiornamento di installazioni precedenti
alter table public.lezioni add column if not exists tipo text not null default 'lezione';
update public.lezioni set tipo = 'recupero' where tipo = 'lezione' and coalesce((to_jsonb(lezioni) ->> 'recupero')::boolean, false);
alter table public.lezioni drop column if exists recupero;
alter table public.lezioni drop constraint if exists lezioni_tipo_check;
alter table public.lezioni add constraint lezioni_tipo_check check (tipo in ('lezione', 'recupero', 'meo', 'sospensione', 'esame', 'esame_pratico', 'pratica', 'valutazione', 'pa'));
alter table public.lezioni add column if not exists validata boolean not null default false;
alter table public.lezioni add column if not exists validata_da uuid;
alter table public.lezioni add column if not exists validata_il timestamptz;
alter table public.lezioni drop constraint if exists lezioni_ordine_check;
alter table public.lezioni add constraint lezioni_ordine_check check (ordine between 0 and 40);
alter table public.lezioni drop constraint if exists lezioni_minuti_check;
-- "not valid": le lezioni più lunghe di installazioni precedenti restano, le nuove rispettano l'ora
alter table public.lezioni add constraint lezioni_minuti_check check (minuti between 15 and 60 and minuti % 15 = 0) not valid;
alter table public.lezioni add column if not exists aula text not null default '' check (length(aula) <= 40);
alter table public.lezioni drop column if exists chapter;
alter table public.lezioni add column if not exists persona text not null default '' check (length(persona) <= 80);
alter table public.lezioni add column if not exists frequentatori uuid[] not null default '{}';
alter table public.lezioni add column if not exists parte int not null default 0 check (parte between 0 and 3);
-- prima c'era una sola lezione per periodo
alter table public.lezioni drop constraint if exists lezioni_corso_id_data_ordine_key;
create unique index if not exists lezioni_periodo_parte on public.lezioni (corso_id, data, ordine, parte);

-- rapportino presenze: una riga per giornata di corso, compilata dai frequentatori e validata da chi guida
create table if not exists public.rapportini (
  id uuid primary key default gen_random_uuid(),
  corso_id uuid not null references public.corsi on delete cascade,
  data date not null,
  note text not null default '' check (length(note) <= 300),
  compilato_da uuid,
  compilato_il timestamptz not null default now(),
  validato_da uuid,
  validato_il timestamptz,
  unique (corso_id, data)
);

create table if not exists public.presenze (
  id uuid primary key default gen_random_uuid(),
  corso_id uuid not null references public.corsi on delete cascade,
  data date not null,
  user_id uuid not null references public.profili on delete cascade,
  stato text not null default 'presente' check (stato in ('presente', 'parziale', 'assente')),
  -- orario effettivo, solo per la presenza parziale (standard: 08:00-16:30, il venerdì 08:00-12:00)
  dalle text check (dalle ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  alle text check (alle ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  motivo text not null default '' check (length(motivo) <= 200),
  unique (corso_id, data, user_id),
  check ((stato = 'parziale') = (dalle is not null and alle is not null)),
  check (alle is null or dalle is null or alle > dalle)
);
create index if not exists presenze_corso on public.presenze (corso_id, data);

create table if not exists public.abilitazioni (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profili on delete cascade,
  -- chapter che l'istruttore può erogare a lezione, per mezzo: vale per tutte le categorie
  mds text not null,
  chapter text not null,
  unique (user_id, mds, chapter)
);
-- aggiornamento di installazioni precedenti: le abilitazioni erano per programma e materia (vanno reinserite)
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'abilitazioni' and column_name = 'programma') then
    delete from public.abilitazioni;
    alter table public.abilitazioni drop column programma, drop column materia;
    alter table public.abilitazioni add column mds text not null, add column chapter text not null;
    alter table public.abilitazioni add constraint abilitazioni_user_id_mds_chapter_key unique (user_id, mds, chapter);
  end if;
end $$;

-- registro dei certificati AER(EP).P-147
create table if not exists public.certificati (
  id uuid primary key default gen_random_uuid(),
  corso_id uuid not null references public.corsi on delete cascade,
  user_id uuid not null references public.profili on delete cascade,
  numero int not null check (numero between 1 and 9999),
  anno int not null check (anno between 2000 and 2100),
  tipo text not null check (tipo in ('teorico', 'pratico', 'completo')),
  stato text not null default 'bozza' check (stato in ('bozza', 'rilasciato', 'annullato')),
  -- copia dei dati del corso al rilascio: il certificato non cambia se il corso cambia
  mds text not null default '' check (length(mds) <= 30),
  categoria text not null default '' check (length(categoria) <= 10),
  programma text not null default '' check (length(programma) <= 300),
  data_inizio date,
  data_fine date,
  ore int not null default 0 check (ore between 0 and 2000),
  esame_data date,
  esame_esito text not null default '' check (esame_esito in ('', 'superato', 'non superato')),
  pratica_data date,
  pratica_esito text not null default '' check (pratica_esito in ('', 'superato', 'non superato')),
  data_rilascio date,
  luogo_rilascio text not null default '' check (length(luogo_rilascio) <= 100),
  organizzazione text not null default '' check (length(organizzazione) <= 200),
  note text not null default '' check (length(note) <= 300),
  creato_il timestamptz not null default now(),
  creato_da uuid,
  modificato_il timestamptz not null default now(),
  modificato_da uuid,
  unique (anno, numero),
  check (data_fine is null or data_inizio is null or data_fine >= data_inizio),
  check (stato <> 'rilasciato' or data_rilascio is not null)
);
create index if not exists certificati_utente on public.certificati (user_id);

-- ---------------------------------------------------------------------------
-- Funzioni di supporto
-- ---------------------------------------------------------------------------

-- ruolo dell'utente collegato, solo se l'account è attivo
create or replace function public.ptt_ruolo() returns text
language sql stable security definer set search_path = public as $$
  select ruolo from public.profili where id = auth.uid() and attivo
$$;

create or replace function public.ptt_e_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.ptt_ruolo() = 'admin', false)
$$;

-- istruttore che segue il corso senza esservi iscritto: nominato per la fase pratica o con lezioni a calendario
create or replace function public.ptt_segue(c uuid, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.corsi k where k.id = c and u = any (k.istruttori_pratica))
    or exists (select 1 from public.lezioni l where l.corso_id = c and l.istruttore_id = u)
$$;

-- fa parte del corso (o è Training Manager): può leggerne i dati
create or replace function public.ptt_membro(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.ptt_e_admin() or (public.ptt_ruolo() is not null and (
    exists (select 1 from public.iscrizioni i where i.corso_id = c and i.user_id = auth.uid()) or public.ptt_segue(c, auth.uid())))
$$;

-- frequentatore assegnato al corso e non escluso
create or replace function public.ptt_nel_corso(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.iscrizioni i where i.corso_id = c and i.user_id = auth.uid() and i.ruolo = 'trainee' and i.escluso_il is null)
$$;

-- guida il corso: Training Manager o l'istruttore che ne è direttore
create or replace function public.ptt_guida(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.ptt_e_admin() or exists (
    select 1 from public.iscrizioni i where i.corso_id = c and i.user_id = auth.uid() and i.ruolo = 'direttore')
$$;

-- dirige almeno un corso (o è Training Manager): cura l'elenco degli istruttori pratici e le materie assegnate
create or replace function public.ptt_dirige() returns boolean
language sql stable security definer set search_path = public as $$
  select public.ptt_e_admin() or (public.ptt_ruolo() is not null and exists (
    select 1 from public.iscrizioni i where i.user_id = auth.uid() and i.ruolo = 'direttore'))
$$;

-- fa parte dello staff (direttore o istruttore) di un corso frequentato dall'utente indicato
create or replace function public.ptt_staff_di(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.ptt_e_admin() or (public.ptt_ruolo() = 'instructor' and exists (
    select 1 from public.iscrizioni sua
    where sua.user_id = u and (public.ptt_guida(sua.corso_id) or public.ptt_segue(sua.corso_id, auth.uid()))))
$$;

-- traccia autore e istante di ogni modifica; la data non può essere futura.
-- Senza utente collegato (SQL Editor, chiave di servizio, importazioni) si conservano i valori forniti.
create or replace function public.ptt_traccia_registrazione() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.data > current_date then
    raise exception 'La data del task non può essere futura' using errcode = 'P0001';
  end if;
  if new.tipo_esecuzione <> 'AC' then new.matricola := ''; end if;
  if not exists (select 1 from public.iscrizioni i where i.corso_id = new.corso_id and i.user_id = new.user_id and i.ruolo = 'trainee') then
    raise exception 'Il frequentatore non è iscritto a questo corso' using errcode = 'P0001';
  end if;
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.creato_il := now();
    new.creato_da := auth.uid();
  else
    new.creato_il := old.creato_il;
    new.creato_da := old.creato_da;
    if new.user_id <> old.user_id or new.corso_id <> old.corso_id then
      raise exception 'Non è possibile spostare una registrazione su un altro frequentatore o corso' using errcode = 'P0001';
    end if;
  end if;
  new.modificato_il := now();
  new.modificato_da := auth.uid();
  return new;
end $$;

drop trigger if exists traccia on public.registrazioni;
create trigger traccia before insert or update on public.registrazioni
for each row execute function public.ptt_traccia_registrazione();

create or replace function public.ptt_traccia_aggiornamento() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists traccia on public.anagrafiche;
create trigger traccia before insert or update on public.anagrafiche
for each row execute function public.ptt_traccia_aggiornamento();
drop trigger if exists traccia on public.training_data;
create trigger traccia before insert or update on public.training_data
for each row execute function public.ptt_traccia_aggiornamento();

create or replace function public.ptt_traccia_istruttore() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and auth.uid() is not null then
    new.created_at := now();
    new.created_by := auth.uid();
  end if;
  return new;
end $$;
drop trigger if exists traccia on public.istruttori;
create trigger traccia before insert on public.istruttori
for each row execute function public.ptt_traccia_istruttore();

create or replace function public.ptt_traccia_lezione() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then new.creato_il := now(); else new.creato_il := old.creato_il; end if;
  new.modificato_il := now();
  new.modificato_da := auth.uid();
  return new;
end $$;
drop trigger if exists traccia on public.lezioni;
create trigger traccia before insert or update on public.lezioni
for each row execute function public.ptt_traccia_lezione();

-- rapportino della giornata ancora aperto (non validato): finché lo è, lo modifica chiunque frequenti il corso
create or replace function public.ptt_rapportino_aperto(c uuid, d date) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.rapportini r where r.corso_id = c and r.data = d and r.validato_il is not null)
$$;

create or replace function public.ptt_traccia_rapportino() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.data > current_date then
    raise exception 'Il rapportino non si compila per una data futura' using errcode = 'P0001';
  end if;
  if auth.uid() is null then return new; end if;
  -- la validazione non cambia chi ha compilato il rapportino
  if tg_op = 'UPDATE' and new.validato_il is distinct from old.validato_il then
    new.compilato_il := old.compilato_il;
    new.compilato_da := old.compilato_da;
  else
    new.compilato_il := now();
    new.compilato_da := auth.uid();
  end if;
  if not public.ptt_guida(new.corso_id) then
    -- solo il Training Manager o il direttore validano (e riaprono) il rapportino
    if tg_op = 'UPDATE' and old.validato_il is not null then
      raise exception 'Rapportino già validato: chiederne la riapertura al direttore del corso' using errcode = 'P0001';
    end if;
    new.validato_da := case when tg_op = 'UPDATE' then old.validato_da else null end;
    new.validato_il := case when tg_op = 'UPDATE' then old.validato_il else null end;
  elsif new.validato_il is not null and new.validato_da is null then
    new.validato_da := auth.uid();
  end if;
  return new;
end $$;
drop trigger if exists traccia on public.rapportini;
create trigger traccia before insert or update on public.rapportini
for each row execute function public.ptt_traccia_rapportino();

create or replace function public.ptt_controlla_presenza() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.iscrizioni i where i.corso_id = new.corso_id and i.user_id = new.user_id and i.ruolo = 'trainee') then
    raise exception 'Il frequentatore non è iscritto a questo corso' using errcode = 'P0001';
  end if;
  if new.stato <> 'parziale' then
    new.dalle := null;
    new.alle := null;
  end if;
  if new.stato = 'presente' then new.motivo := ''; end if;
  return new;
end $$;
drop trigger if exists controlla on public.presenze;
create trigger controlla before insert or update on public.presenze
for each row execute function public.ptt_controlla_presenza();

create or replace function public.ptt_traccia_certificato() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.iscrizioni i where i.corso_id = new.corso_id and i.user_id = new.user_id and i.ruolo = 'trainee') then
    raise exception 'Il frequentatore non è iscritto a questo corso' using errcode = 'P0001';
  end if;
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.creato_il := now();
    new.creato_da := auth.uid();
  else
    new.creato_il := old.creato_il;
    new.creato_da := old.creato_da;
  end if;
  new.modificato_il := now();
  new.modificato_da := auth.uid();
  return new;
end $$;
drop trigger if exists traccia on public.certificati;
create trigger traccia before insert or update on public.certificati
for each row execute function public.ptt_traccia_certificato();

create or replace function public.ptt_aggiornato() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists aggiornato on public.profili;
create trigger aggiornato before update on public.profili
for each row execute function public.ptt_aggiornato();
drop trigger if exists aggiornato on public.corsi;
create trigger aggiornato before update on public.corsi
for each row execute function public.ptt_aggiornato();

-- stato dell'installazione, leggibile prima dell'accesso
create or replace function public.ptt_stato() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('admin', exists (select 1 from public.profili where ruolo = 'admin' and attivo))
$$;

-- primo accesso: l'utente creato a mano nel pannello Supabase diventa Training Manager se non ne esiste uno
create or replace function public.ptt_primo_admin(p_username text, p_nome text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Accesso richiesto'; end if;
  if exists (select 1 from public.profili where ruolo = 'admin') then
    raise exception 'Il Training Manager è già configurato' using errcode = 'P0001';
  end if;
  insert into public.profili (id, username, ruolo, nome, deve_cambiare_password)
  values (auth.uid(), lower(trim(p_username)), 'admin', trim(p_nome), false);
end $$;

-- dopo il cambio della password provvisoria
create or replace function public.ptt_password_cambiata() returns void
language sql security definer set search_path = public as $$
  update public.profili set deve_cambiare_password = false where id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profili enable row level security;
alter table public.corsi enable row level security;
alter table public.iscrizioni enable row level security;
alter table public.anagrafiche enable row level security;
alter table public.training_data enable row level security;
alter table public.istruttori enable row level security;
alter table public.registrazioni enable row level security;
alter table public.lezioni enable row level security;
alter table public.abilitazioni enable row level security;
alter table public.rapportini enable row level security;
alter table public.presenze enable row level security;
alter table public.certificati enable row level security;

drop policy if exists lettura on public.profili;
-- i nomi degli account servono per gli elenchi (istruttore della lezione, autore di una modifica)
create policy lettura on public.profili for select to authenticated using (public.ptt_ruolo() is not null);
drop policy if exists admin on public.profili;
create policy admin on public.profili for update to authenticated
  using (public.ptt_e_admin()) with check (public.ptt_e_admin());

drop policy if exists lettura on public.corsi;
create policy lettura on public.corsi for select to authenticated using (public.ptt_membro(id));
drop policy if exists creazione on public.corsi;
create policy creazione on public.corsi for insert to authenticated with check (public.ptt_e_admin());
drop policy if exists modifica on public.corsi;
create policy modifica on public.corsi for update to authenticated using (public.ptt_guida(id)) with check (public.ptt_guida(id));
drop policy if exists eliminazione on public.corsi;
create policy eliminazione on public.corsi for delete to authenticated using (public.ptt_e_admin());

drop policy if exists lettura on public.iscrizioni;
create policy lettura on public.iscrizioni for select to authenticated using (public.ptt_membro(corso_id));
drop policy if exists scrittura on public.iscrizioni;
-- chi guida il corso iscrive frequentatori e istruttori; il direttore lo assegna solo il Training Manager
create policy scrittura on public.iscrizioni for all to authenticated
  using (public.ptt_guida(corso_id) and (ruolo <> 'direttore' or public.ptt_e_admin()))
  with check (public.ptt_guida(corso_id) and (ruolo <> 'direttore' or public.ptt_e_admin()));

drop policy if exists lettura on public.anagrafiche;
create policy lettura on public.anagrafiche for select to authenticated
  using (user_id = auth.uid() or public.ptt_staff_di(user_id));
drop policy if exists scrittura on public.anagrafiche;
-- i Personal Data li vedono tutti, li modificano il Training Manager e il direttore del corso del frequentatore
create policy scrittura on public.anagrafiche for all to authenticated
  using (public.ptt_e_admin() or exists (select 1 from public.iscrizioni i where i.user_id = anagrafiche.user_id and i.ruolo = 'trainee' and public.ptt_guida(i.corso_id)))
  with check (public.ptt_e_admin() or exists (select 1 from public.iscrizioni i where i.user_id = anagrafiche.user_id and i.ruolo = 'trainee' and public.ptt_guida(i.corso_id)));

drop policy if exists lettura on public.training_data;
create policy lettura on public.training_data for select to authenticated
  using ((user_id = auth.uid() and public.ptt_membro(corso_id)) or (public.ptt_membro(corso_id) and public.ptt_staff_di(user_id)));
drop policy if exists scrittura on public.training_data;
create policy scrittura on public.training_data for all to authenticated
  using (public.ptt_guida(corso_id)) with check (public.ptt_guida(corso_id));

drop policy if exists lettura on public.istruttori;
create policy lettura on public.istruttori for select to authenticated using (public.ptt_ruolo() is not null);
drop policy if exists inserimento on public.istruttori;
create policy inserimento on public.istruttori for insert to authenticated with check (public.ptt_dirige() or public.ptt_ruolo() = 'trainee');
drop policy if exists modifica on public.istruttori;
create policy modifica on public.istruttori for update to authenticated
  using (public.ptt_dirige()) with check (public.ptt_dirige());

drop policy if exists lettura on public.registrazioni;
create policy lettura on public.registrazioni for select to authenticated
  using ((user_id = auth.uid() and public.ptt_membro(corso_id)) or (public.ptt_membro(corso_id) and public.ptt_staff_di(user_id)));
drop policy if exists scrittura on public.registrazioni;
-- il frequentatore scrive il proprio logbook finché fa parte del corso: dopo l'esclusione resta com'era
create policy scrittura on public.registrazioni for all to authenticated
  using (public.ptt_e_admin() or (user_id = auth.uid() and public.ptt_ruolo() = 'trainee' and public.ptt_nel_corso(corso_id)))
  with check (public.ptt_e_admin() or (user_id = auth.uid() and public.ptt_ruolo() = 'trainee' and public.ptt_nel_corso(corso_id)));

drop policy if exists lettura on public.lezioni;
-- il frequentatore vede il programma solo dopo la validazione del direttore o del Training Manager
create policy lettura on public.lezioni for select to authenticated
  using (public.ptt_membro(corso_id) and (validata or public.ptt_ruolo() <> 'trainee'));
drop policy if exists scrittura on public.lezioni;
create policy scrittura on public.lezioni for all to authenticated
  using (public.ptt_guida(corso_id)) with check (public.ptt_guida(corso_id));

drop policy if exists lettura on public.rapportini;
create policy lettura on public.rapportini for select to authenticated using (public.ptt_membro(corso_id));
drop policy if exists scrittura on public.rapportini;
-- il rapportino lo compila chiunque frequenti il corso, finché non è validato
create policy scrittura on public.rapportini for all to authenticated
  using (public.ptt_guida(corso_id) or (public.ptt_membro(corso_id) and validato_il is null))
  with check (public.ptt_guida(corso_id) or public.ptt_membro(corso_id));

drop policy if exists lettura on public.presenze;
create policy lettura on public.presenze for select to authenticated using (public.ptt_membro(corso_id));
drop policy if exists scrittura on public.presenze;
create policy scrittura on public.presenze for all to authenticated
  using (public.ptt_guida(corso_id) or (public.ptt_membro(corso_id) and public.ptt_rapportino_aperto(corso_id, data)))
  with check (public.ptt_guida(corso_id) or (public.ptt_membro(corso_id) and public.ptt_rapportino_aperto(corso_id, data)));

drop policy if exists lettura on public.certificati;
-- il proprio certificato lo vede il frequentatore, tutti gli altri solo il Training Manager e lo staff del corso
create policy lettura on public.certificati for select to authenticated
  using (user_id = auth.uid() or public.ptt_staff_di(user_id));
drop policy if exists scrittura on public.certificati;
create policy scrittura on public.certificati for all to authenticated
  using (public.ptt_e_admin()) with check (public.ptt_e_admin());

drop policy if exists lettura on public.abilitazioni;
create policy lettura on public.abilitazioni for select to authenticated using (public.ptt_ruolo() is not null);
drop policy if exists scrittura on public.abilitazioni;
-- le abilitazioni valgono per tutti i corsi del mezzo: le assegna solo il Training Manager
create policy scrittura on public.abilitazioni for all to authenticated
  using (public.ptt_e_admin()) with check (public.ptt_e_admin());

-- ---------------------------------------------------------------------------
-- Permessi e tempo reale
-- ---------------------------------------------------------------------------

revoke all on public.profili, public.corsi, public.iscrizioni, public.anagrafiche, public.training_data,
  public.istruttori, public.registrazioni, public.lezioni, public.abilitazioni, public.rapportini, public.presenze,
  public.certificati from anon;
grant select, update on public.profili to authenticated;
grant select, insert, update, delete on public.corsi, public.iscrizioni, public.anagrafiche, public.training_data,
  public.registrazioni, public.lezioni, public.abilitazioni, public.rapportini, public.presenze, public.certificati to authenticated;
grant select, insert, update on public.istruttori to authenticated;
-- chiave di servizio (Edge Function gestione-utenti e script di amministrazione): scavalca RLS ma servono i privilegi
grant select, insert, update, delete on public.profili, public.corsi, public.iscrizioni, public.anagrafiche,
  public.training_data, public.istruttori, public.registrazioni, public.lezioni, public.abilitazioni,
  public.rapportini, public.presenze, public.certificati to service_role;
grant execute on function public.ptt_stato() to anon, authenticated;
grant execute on function public.ptt_primo_admin(text, text), public.ptt_password_cambiata() to authenticated;
grant execute on function public.ptt_rapportino_aperto(uuid, date) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['profili', 'corsi', 'iscrizioni', 'anagrafiche', 'training_data', 'istruttori', 'registrazioni', 'lezioni', 'abilitazioni', 'rapportini', 'presenze', 'certificati'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
