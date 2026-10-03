# Gestionale Type Training

Gestione completa dei corsi **Type Training** per CH-47F, UC-228 e VC-180A: parte **teorica (MTT)** con programma
settimanale e parte **pratica (PTT)** con il logbook del Practical Training Record. Più corsi in parallelo, ciascuno con
i propri frequentatori, istruttori e programmi.

**Un'unica applicazione** per tutti: ognuno vede le pagine del proprio ruolo.

| Link | Cosa mostra |
|---|---|
| https://pier-200.github.io/GestionaleTypeTraining/ | l'applicazione (si installa sul cellulare come app **TT**) |
| https://pier-200.github.io/GestionaleTypeTraining/?demo | prova con la situazione esempio, dati solo nel browser |

Aperto un corso si entra in **Avanzamento del corso**: parte teorica e parte pratica affiancate, modulo per modulo
(ore svolte sul programma MTT; task eseguiti sul PTR, con la soglia del 50%). Le due barre MTT/PTT restano sempre
visibili nel riquadro del corso. Da lì si passa alla gestione separata della teoria (settimana, rapportino, assenze)
e della pratica (logbook, tavola, Compliance Report).

**Interfaccia** in stile «app tascabile» (vedi [DESIGN.md](DESIGN.md)): schede morbide, verde per la teoria, arancio
per la pratica con la linea della soglia del 50%, tabelle con intestazione fissa, corso sempre in vista nella barra in
alto e tema scuro facoltativo (pulsante luna/sole).

Specifica iniziale: [PROGETTO_Logbook_PTT.md](PROGETTO_Logbook_PTT.md).

## Corsi, ruoli e permessi

Il Training Manager crea i corsi e vi iscrive le persone. Ogni corso ha **nome, codice, MDS e categoria**: i programmi
seguono da soli.

| MDS | Categorie | Programmi |
|---|---|---|
| CH-47F | B1.3, B2, C | le categorie B hanno teorico + pratico, la C solo il teorico |
| UC-228 | B1.1, B2, C | idem |
| VC-180A | B1.1, B2, C | idem |

Caricati oggi: **CH-47F B1.3** (teorico e pratico). Per gli altri bastano i due Excel (vedi «Programmi di corso»):
finché mancano, il corso si crea lo stesso e le pagine lo segnalano.

| | Frequentatore | Istruttore | Direttore del corso | Training Manager |
|---|---|---|---|---|
| Corsi visibili | i propri | quelli a cui è iscritto | quelli che dirige | tutti |
| Logbook (PTT) | solo il proprio, in scrittura | lettura di tutto il corso | lettura | correzioni su tutti |
| Programma settimanale (MTT) | lettura, solo se validato | lettura | **prepara, valida e assegna gli istruttori** | idem |
| Rapportino presenze | **compila per tutti**, finché non è validato | compila | valida e riapre | valida e riapre |
| Assenze e idoneità | le proprie | tutto il corso | tutto il corso | tutto il corso |
| Materie e abilitazioni | – | lettura | modifica | modifica |
| Iscrizioni e dati del corso | – | – | modifica | modifica |
| Account | – | – | – | crea, disattiva, reimposta password |

## Parte teorica (MTT)

- Programma dal file ufficiale (`MTT_B1.3_CH-47F.xlsx`): **51 materie in 8 moduli, 219 ore**. Ogni materia dura i
  «Tuition Min.» del programma e copre uno o più chapter.
- **Programma settimanale**: «Genera» riempie i periodi ancora vuoti seguendo l'ordine del programma; una materia
  lunga si spezza su più periodi e l'istruttore si sceglie fra quelli **abilitati** a quella materia.
- **Griglia dei periodi**: la giornata ha sempre **6 periodi dal lunedì al giovedì e 3 il venerdì**; si compilano
  toccando il periodo. Ogni periodo può essere una lezione, una **lezione di recupero**, **Mantenimento Efficienza
  Operativa**, una **Sospensione** o un **Esame teorico**; la durata si cambia a quarti d'ora.
- **A schermo**: sul PC la settimana intera sta in una schermata (periodo, modulo · chapter, materia, istruttore);
  sul cellulare ogni giornata mostra solo orario, materia e istruttore.
- **Validazione**: la settimana salvata resta privata finché il direttore o il TM premono «Valida»; solo allora i
  frequentatori la vedono. Ogni modifica successiva ritira la validazione.
- **Conto a scalare**: le ore che restano compaiono sotto ogni lezione mentre si compone la settimana, nella barra in
  alto e nella pagina «Situazione della teoria» (per modulo, per materia, ore già svolte e settimane stimate).
- **Materie e istruttori**: il Training Manager o il direttore indicano quali materie ogni istruttore può erogare.
- **Ore degli istruttori**: pagina «Docenti» con le ore a calendario ed erogate da ciascun istruttore.
- **Excel**: «Excel» esporta il programma della settimana (formato provvisorio, da sostituire col modulo ufficiale).

## Registri del Training Manager (AER(EP).P-147)

Voci di menu riservate al Training Manager, nella sezione «Registri · AER(EP).P-147»:

- **Registro corsi e corsisti**: tutti i corsi (MDS, categoria, periodo, sede, iscritti, ore di teoria svolte, media
  della pratica, stato) e tutti i corsisti (anagrafica, MAML, corso, ore di assenza e percentuale, idoneità all'esame
  teorico, percentuale della pratica, certificati). Esportabile in Excel su due fogli.
- **Registro dei certificati**: i certificati **AER(EP).P-147** rilasciati a fine corso, con numerazione progressiva per
  anno (`003/2026`). Ogni riga porta intestatario, corso, tipo (teorico, pratico o completo), programma di riferimento,
  MDS e categoria, periodo e ore, esame teorico e valutazione pratica con i relativi esiti, luogo e data di rilascio,
  Maintenance Organisation e stato (bozza, rilasciato, annullato). Scegliendo l'intestatario i dati del corso si
  compilano da soli; «Rilascia il certificato» lo chiude e lo numera. Un certificato rilasciato non si cancella: si
  annulla. Esportazione Excel del registro.

## Presenze e assenze

- **Rapportino giornaliero**: compilazione standard 08:00–16:30 dal lunedì al giovedì e 08:00–12:00 il venerdì. Per
  ciascun frequentatore si sceglie «Presente», «Parziale» (con orario di ingresso e uscita) o «Assente», con il motivo.
  Lo compila **qualsiasi frequentatore per tutti**; il direttore o il TM lo **validano** (e possono riaprirlo).
- **Assenze per lezione**: chi perde anche un solo minuto di una lezione risulta assente a quella lezione. La pagina
  «Assenze» mostra le ore perse per ciascun frequentatore e **in quali materie**, lezione per lezione.
- **Recuperi**: una lezione segnata «Recupero» sana l'assenza della stessa materia per chi la frequenta e non produce
  assenze per chi manca.
- **Idoneità**: al raggiungimento del **10%** di assenze sulle 219 ore del programma (21,9 h) il frequentatore risulta
  **«Non idoneo»** all'esame teorico.

## Parte pratica (PTT)

- Catalogo dal PTR ufficiale: **190 task, 68 chapter, 8 moduli**.
- Conformità: **≥ 50%** dei task per ciascun modulo e task type, **≥ 1** task per ciascun chapter; più registrazioni
  dello stesso task contano una volta. MEL ha 0 task applicabili e risulta «n.a.».
- Registrazione di un task: data, aeromobile (matricola) oppure SIM/CLA, ET in minuti, luogo, istruttore. Nel logbook
  ogni riga mostra **ID del task e chapter** in evidenza.
- Compliance Report sempre aggiornato; «Stampa / PDF» produce il modulo ufficiale compilato (vedi sotto).
- Esportazioni: Excel del singolo (5 fogli), Excel complessivo del corso, CSV.

## Programmi di corso

I programmi stanno nell'applicazione, in `src/dati/programmi/`, e si scelgono per ogni corso:

Gli Excel ufficiali stanno in `docs/sorgenti/Programmi Type Training/` (fuori da git), con nome
`<MDS> - MTT|PTR - <categoria>.xlsx`. Per rigenerare tutti i programmi:

```bash
npm run programmi    # prima tutti gli MTT, poi tutti i PTR
```

Il PTR non riporta il modulo: lo script lo ricava dal MTT dello stesso MDS e categoria (stesso chapter, soggetto più
simile). Ogni file in `src/dati/programmi/` viene caricato da solo e i corsi di quel MDS e categoria lo usano (le
categorie C solo il teorico). Oggi ci sono tutti i 9 corsi: CH-47F B1.3/B2/C, UC-228 B1.1/B2/C, VC-180A B1.1/B2/C.

## Stampa del Compliance Report

«Stampa / PDF» apre le 4 pagine del modulo ufficiale (`public/modelli/compliance-report.pdf`) e vi scrive soltanto i
valori: Organization, Grade, First name, Surname, MAML, task eseguiti e percentuali di ogni riga, Place e Date. Le
righe barrate nel modulo (21A, 27) restano vuote. Logo facoltativo in `public/modelli/logo.png`. Le posizioni si
ricavano dal PDF con `py -3.11 scripts/layout_compliance.py`.

## Archivio dei dati

Si sceglie in [`public/config.json`](public/config.json), senza ricompilare:

| `archivio.tipo` | Dove stanno i dati | Permessi | Aggiornamento |
|---|---|---|---|
| `demo` (sempre con `?demo`) | nel browser di chi apre l'app | applicati dall'app | tra schede |
| `github` (in uso) | repository privato `pier-200/tt-dati` + portachiavi cifrato in `tt-accessi` | applicati dall'app | controllo ogni 30 s |
| `supabase` (pronto) | PostgreSQL centrale | **dal database**, per corso (RLS) | in tempo reale |

Al primo accesso il Training Manager inserisce un token GitHub fine-grained (Contents: Read and write sui due
repository): viene cifrato nel portachiavi e non va condiviso. In alternativa la configurazione si fa da riga di
comando con `node scripts/configura-github.mjs --token <github_pat_…> --username admin --password admin`.

Istruzioni e migrazione: [docs/PUBBLICAZIONE.md](docs/PUBBLICAZIONE.md).

> La repository è pubblica: mai dati reali né credenziali nei file. La situazione esempio è inventata.

## Situazione esempio

Due corsi: il 1° 2026 (teoria conclusa e validata, pratica avviata, 6 frequentatori, rapportini presenze compilati con
qualche assenza, una lezione di recupero e un «non idoneo») e il 2° 2026 (solo teoria, appena iniziato, 3 frequentatori,
seconda settimana ancora da validare). Profili pronti nella pagina di accesso in modalità demo: Training Manager, direttore del corso,
tre istruttori e i frequentatori. «Ripristina la situazione esempio» riporta tutto allo stato iniziale.

## Sviluppo

```bash
npm install
npm run dev          # http://localhost:5174
npm test             # dominio, pianificazione, presenze e schema SQL (PGlite)
npm run build && npx vite preview --port 4174 && npm run e2e   # prova nel browser Edge
TT_TOKEN=<token GitHub> node tests/collaudo-github.mjs           # collaudo dell'archivio GitHub su repo di prova
npm run pubblica     # compila e aggiorna GitHub Pages (ramo gh-pages)
```

Struttura:

```
database/schema.sql            tabelle, RLS per corso, tempo reale       database/migrazione-corsi.sql  passaggio al modello a corsi
scripts/import_catalogo.py     programma pratico dall'Excel             scripts/import_programma_mtt.py  programma teorico
scripts/layout_compliance.py   posizioni dei valori nel modulo PDF      scripts/semina-supabase.mjs      TM e situazione esempio
supabase/functions/gestione-utenti   creazione e modifica account (Edge Function)
src/dominio/    programmi, compliance, pianificazione, presenze, motore dei comandi (permessi), viste
src/backend/    archivi demo, github, supabase                          src/esporta.ts  Excel e CSV
src/ui/         interfaccia: guscio, avanzamento del corso, pagine MTT e PTT, stile «app tascabile» (DESIGN.md)
tests/          dominio, pianificazione e presenze, schema SQL, end-to-end (demo e archivio GitHub)
```

Gli Excel e i PDF originali restano fuori dalla repository pubblica (tranne il modulo vuoto del Compliance Report,
necessario alla stampa): vanno copiati in `docs/sorgenti/` per rigenerare i programmi.
