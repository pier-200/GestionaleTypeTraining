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

Il Training Manager crea i corsi e vi assegna i frequentatori. Ogni corso ha **nome, codice, MDS e categoria**: i
programmi seguono da soli.

| MDS | Categorie | Programmi |
|---|---|---|
| CH-47F | B1.3, B2, C | le categorie B hanno teorico + pratico, la C solo il teorico |
| UC-228 | B1.1, B2, C | idem |
| VC-180A | B1.1, B2, C | idem |

Caricati oggi: **CH-47F B1.3** (teorico e pratico). Per gli altri bastano i due Excel (vedi «Programmi di corso»):
finché mancano, il corso si crea lo stesso e le pagine lo segnalano.

Dalla pagina **Account** si creano solo **frequentatori** e **istruttori** (il Training Manager nasce con la
configurazione iniziale). Il **direttore del corso** non è un tipo di account: si indica nei dati del corso, scegliendo
uno degli istruttori oppure scrivendo una persona fuori elenco. Se è un istruttore, i permessi in più valgono solo
dentro quel corso; negli altri resta un istruttore.

- **Frequentatori**: si assegnano al corso nella pagina «Corso e iscritti»; in **Account** il filtro ha una voce per
  ogni corso con i suoi frequentatori.
- **Istruttori**: non si iscrivono ai corsi. Un istruttore segue un corso se ne è il direttore, se è fra gli
  **istruttori della fase pratica** nominati nei dati del corso, oppure se ha lezioni nel suo programma.
- **Esclusione**: da «Corso e iscritti» un frequentatore si esclude con una data. Da quel giorno non compare più nel
  programma né nelle viste attive, non rientra nelle presenze e la sua situazione pratica resta ferma a quel giorno; i
  dati storici restano consultabili e ogni loro modifica chiede conferma. Si può riammettere.
- **Date e chiusura**: la data di inizio è fissa, quella di fine è «stimata» finché il corso è aperto. Segnando il
  corso come completato si indica la **data effettiva di chiusura**, che sostituisce ovunque quella stimata (anche nel
  Registro). Un corso completato resta consultabile; ogni modifica chiede prima «Il corso è completato. Confermi la
  modifica?».

| | Frequentatore | Istruttore | Istruttore direttore di quel corso | Training Manager |
|---|---|---|---|---|
| Corsi visibili | i propri | quelli che segue | quelli che segue | tutti |
| Logbook (PTT) | solo il proprio, in scrittura | lettura di tutto il corso | lettura | correzioni su tutti |
| Programma settimanale (MTT) | lettura, solo se validato | lettura | **prepara, valida e assegna gli istruttori** | idem |
| Rapportino presenze | **compila per tutti**, finché non è validato | compila | valida e riapre | valida e riapre |
| Assenze e idoneità | le proprie | tutto il corso | tutto il corso | tutto il corso |
| Personal & Training Data | lettura | lettura | **modifica** | **modifica** |
| Ore degli istruttori, Practical Instructors | – | – | sì | sì |
| Frequentatori e dati del corso | – | – | modifica | modifica, **assegna il direttore** |
| Materie e istruttori (abilitazioni) | – | – | – | sì |
| Registro corsi e corsisti, Registro certificati | – | – | – | sì |
| Account | – | – | – | crea, disattiva, reimposta password |

Le pagine riservate non compaiono nel menu e non si aprono nemmeno scrivendone l'indirizzo. Nel menu «Corsi» e
«Materie e istruttori» stanno in alto, fuori dal singolo corso; «Generality and Purpose» sta nella parte pratica.

## Parte teorica (MTT)

- Programma dal file ufficiale: per il CH-47F B1.3 **51 materie in 8 moduli, 219 ore**. Ogni materia è **un chapter**
  e dura i «Tuition Min.» del programma.
- **Solo i chapter del syllabus**: del programma entrano nell'applicazione solo i chapter **con ore**. Quelli che il
  file elenca senza ore non esistono in nessuna pagina: per il CH-47F B1.3 «Servicing» è il solo chapter 12 (non il
  14), «Vibration and Noise Analysis» il solo 18, «Rotors» il solo 62, «Rotor Drives» il solo 63 (niente 63A, 64, 64A).
- **Programma settimanale**: «Genera» riempie i periodi ancora vuoti seguendo l'ordine del programma; una materia
  lunga si spezza su più periodi e l'istruttore si sceglie fra quelli **abilitati** a quel chapter.
- **Griglia dei periodi**: la giornata ha sempre **6 periodi dal lunedì al giovedì e 3 il venerdì**, a **orari fissi**
  uguali per tutti i corsi: 08:20–09:20, 09:30–10:30, 10:50–11:50, 12:00–13:00, pausa pranzo, 14:00–15:00, 15:10–16:10.
  Una lezione dura **al massimo un'ora**, poi c'è la pausa; si accorcia a quarti d'ora. I periodi si compilano
  toccandoli e scegliendo **«Cosa si svolge»** (vedi la tabella sotto). L'**aula** è quella del corso, salvo
  sceglierne un'altra sul singolo periodo.
- **Più lezioni nella stessa ora**: accorciando una lezione, nel tempo rimasto libero se ne mette un'altra («Altra
  lezione nel periodo»): due mezz'ore, 15 + 45, 15 + 15 + 30 e così via, ciascuna con il suo chapter, istruttore e
  aula. Si susseguono senza pausa (08:20–08:50, 08:50–09:20) e insieme non superano l'ora; griglia, assenze e conto
  a scalare le trattano come lezioni distinte. Anche «Genera» riempie l'ora quando una materia finisce a metà.
- **A schermo**: sul PC la settimana intera sta in una schermata (periodo, modulo · chapter, materia, istruttore);
  sul cellulare ogni giornata mostra solo orario, materia e istruttore.
- **Validazione**: la settimana salvata resta privata finché il direttore o il TM premono «Valida»; solo allora i
  frequentatori la vedono. Ogni modifica successiva ritira la validazione.
- **Conto a scalare**: le ore che restano compaiono sotto ogni lezione mentre si compone la settimana, nella barra in
  alto e nella pagina «Situazione della teoria» (per modulo, per materia, ore già svolte e settimane stimate).
- **Situazione della teoria**: per ogni materia le colonne «A calendario» e «Svolte» sono vuote se non c'è nulla,
  **ambra** se le ore sono inserite solo in parte, **verdi** quando ci sono tutte.
- **Materie e istruttori** (solo Training Manager): per ogni mezzo (MDS), i chapter che ciascun istruttore può
  erogare; valgono per tutti i corsi di quel mezzo. Nel programma settimanale la lezione di un chapter si assegna
  solo a chi è abilitato. Si inseriscono a mano oppure dall'Excel delle abilitazioni (vedi «Cartella modelli»).
- **Ore degli istruttori**: pagina «Docenti» con le ore a calendario ed erogate da ciascun istruttore (Training
  Manager e direttore del corso).
- **Le mie lezioni**: l'istruttore, appena entra, trova in testa alla pagina i suoi impegni **da oggi in poi** (giorno,
  orario, chapter, aula, corso, totale delle ore), presi dai soli programmi settimanali **validati** di tutti i suoi
  corsi; nella griglia della settimana le sue lezioni sono evidenziate.
- **Programma settimanale in Excel**: dal menu «Altre azioni» si scarica il **modulo ufficiale compilato**, pronto da
  stampare in PDF su una pagina A4 (vedi «Modulo del programma settimanale»).

| Cosa si svolge | Codice | Campi |
|---|---|---|
| Lezione | numero del chapter | chapter del syllabus, istruttore abilitato, aula |
| Lezione di recupero | numero del chapter | come la lezione, più i **frequentatori a cui è destinata**: solo a loro le ore scalano le assenze della stessa materia, senza superare le ore della materia |
| Mantenimento efficienza operativa | MEO | istruttore di riferimento: si propone il direttore del corso, modificabile |
| Sospensione | //// | cella sbarrata: nessun istruttore, nessun altro dato |
| Esame teorico | EX | presidente di commissione |
| Esame pratico | EX | presidente di commissione |
| Practical training | PT | istruttore |
| Valutazione in itinere | VI | un'ora, istruttore |
| Pratiche amministrative | PA | persona di riferimento: un istruttore, **RSPP** (voce di testo, senza account) o un nome scritto a mano |

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
- **Recuperi**: una lezione di recupero sana l'assenza della stessa materia ai soli frequentatori a cui è destinata
  (se presenti) e non produce assenze per chi manca.
- **Idoneità**: al raggiungimento del **10%** di assenze sulle 219 ore del programma (21,9 h) il frequentatore risulta
  **«Non idoneo»** all'esame teorico.

## Parte pratica (PTT)

- Catalogo dal PTR ufficiale: **190 task, 68 chapter, 8 moduli**.
- Conformità, come nel Compliance Report: **≥ 50%** dei task per ciascun task type, per ciascun **chapter** e per
  ciascun modulo (un solo task per chapter non basta); più registrazioni dello stesso task contano una volta. MEL ha
  0 task applicabili e risulta «n.a.».
- Registrazione di un task: data, aeromobile oppure SIM/CLA, ET in minuti, luogo, istruttore. L'**aeromobile** si
  sceglie da una tendina con gli identificativi inseriti nei dati del corso («Aeromobili disponibili», es. EI906);
  il **luogo di manutenzione** è testo libero, già compilato con «Viterbo» (o con l'ultimo usato). Nel logbook ogni
  riga mostra **ID del task e chapter** in evidenza.
- **Istruttori della fase pratica**: si nominano nei dati del corso; la scelta dell'istruttore nel singolo task resta
  quella dell'elenco «Practical Instructors».
- Compliance Report sempre aggiornato; «Stampa / PDF» produce il modulo ufficiale compilato (vedi sotto).
- Esportazioni: Excel del singolo (5 fogli), Excel complessivo del corso, CSV.

## Programmi di corso

I programmi stanno nell'applicazione, in `src/dati/programmi/`, e si scelgono per ogni corso:

Gli Excel ufficiali stanno in `modelli/Programmi Type Training/`, con nome `<MDS> - MTT|PTR - <categoria>.xlsx`.
Per rigenerare tutti i programmi:

```bash
npm run programmi    # prima tutti gli MTT, poi tutti i PTR
```

Del MTT diventano materie solo le righe con ore («Tuition Min.» maggiore di zero). Il PTR non riporta il modulo: lo
script lo ricava dal MTT dello stesso MDS e categoria (stesso chapter, soggetto più simile). Ogni file in `src/dati/programmi/` viene caricato da solo e i corsi di quel MDS e categoria lo usano (le
categorie C solo il teorico). Oggi ci sono tutti i 9 corsi: CH-47F B1.3/B2/C, UC-228 B1.1/B2/C, VC-180A B1.1/B2/C.

## Cartella modelli

I format ufficiali stanno in una cartella **`modelli/`** e l'applicazione usa solo quelli:

| File | A cosa serve |
|---|---|
| `Programma settimanale.xlsx` | modulo ufficiale che l'app compila («Programma settimanale in Excel») |
| `Compliance Report.pdf` | modulo ufficiale che l'app compila («Stampa / PDF») |
| `Programmi Type Training/*.xlsx` | programmi teorici e pratici da cui `npm run programmi` genera `src/dati/programmi/` |
| `Generality and Purpose.pdf`, `Personnel Data.pdf`, `MTT_…xlsx`, `PTR_…xlsx` | documenti originali di riferimento |
| Excel delle abilitazioni (quando ci sarà) | importato dalla pagina «Materie e istruttori» |
| `logo.png` (facoltativo) | logo sul Compliance Report |

**Dove stanno.** Online i modelli stanno nel **repository privato dei dati** (`pier-200/tt-dati`, cartella
`modelli/`), come i dati dei corsi: l'applicazione li legge con il token del portachiavi, quindi **solo dopo
l'accesso**. Il sito pubblicato non li contiene e GitHub, senza token, risponde «non trovato».

- **Aggiornarli**: dalla cartella locale `modelli/` del progetto (fuori da git) con `npm run modelli`, che carica in un
  solo commit i file nuovi o cambiati (token: `--token github_pat_…`, variabile `TT_TOKEN` oppure
  `gh auth token | node scripts/carica-modelli.mjs --stdin`). In alternativa da GitHub: `tt-dati` → `modelli` →
  **Add file → Upload files**. I file presenti solo online restano.
- **In locale**: la stessa cartella serve agli script (`npm run programmi`, layout del Compliance Report), ai test e
  alla modalità dimostrativa, a cui `npm run dev` e `vite preview` la espongono ([`vite.config.ts`](vite.config.ts)).
  Nella prova pubblicata (`?demo`) ci sono solo i due moduli vuoti, uguali per tutti i corsi e senza dati
  (`Programma settimanale.xlsx` e `Compliance Report.pdf`, senza metadati): la build li copia apposta.
- Lettura: `elencoModelli` e `leggiModello` dell'archivio ([`GitHubBackend.ts`](src/backend/github/GitHubBackend.ts));
  ogni file si scarica la prima volta che serve e resta in memoria fino all'uscita.

**Excel delle abilitazioni.** Una tabella sul primo foglio, con una riga di intestazione e tre informazioni, in
qualunque ordine:

| Colonna | Intestazioni riconosciute | Contenuto |
|---|---|---|
| istruttore | «Istruttore», «Nominativo», «Username», oppure «Cognome» e «Nome» separati | username dell'account, oppure cognome e nome (il grado davanti è ignorato) |
| mezzo | «MDS», «Mezzo», «Aeromobile» | CH-47F, UC-228, VC-180A |
| chapter | «Chapter», «Ch», «ATA», «Capitolo» | uno o più chapter separati da virgola (`05, 06, 12`); «tutti» per l'intero syllabus |

Dalla pagina «Materie e istruttori» si sceglie il file fra quelli di `modelli`, si preme «Leggi il file», si controlla
l'anteprima (le righe non riconosciute sono elencate) e si conferma con «Importa». Per ogni istruttore e mezzo
presenti nel file l'importazione sostituisce i chapter che aveva. Con **«Dal computer…»** si importa un file senza
caricarlo prima nell'archivio.

## Stampa del Compliance Report

«Stampa / PDF» apre le 4 pagine del modulo ufficiale (`modelli/Compliance Report.pdf`) e vi scrive soltanto i
valori: Organization, Grade, First name, Surname, MAML, task eseguiti e percentuali di ogni riga, Place e Date. Le
righe barrate nel modulo (21A, 27) restano vuote. Logo facoltativo in `modelli/logo.png`. Le posizioni si
ricavano dal PDF con `py -3.11 scripts/layout_compliance.py`.

## Modulo del programma settimanale

«Programma settimanale in Excel» apre il modulo ufficiale (`modelli/Programma settimanale.xlsx`) e vi scrive
soltanto i valori: celle, bordi, unioni e impostazione di stampa restano quelli dell'originale.

| Campo | Da dove viene |
|---|---|
| CORSO | codice del corso (l'ID, es. `06-B1.3-CH`) |
| DATA INIZIO CORSO, DURATA, DATA FINE CORSO | dati del corso: inizio, durata in settimane, fine stimata (quella effettiva a corso completato) |
| SETTIMANA | numero progressivo da 1, contato dal lunedì della data di inizio |
| EVENTUALE RITARDO | settimane oltre quella della fine stimata (vuoto se non si è in ritardo) |
| DATA, ORARIO | giorni della settimana e orari fissi dei periodi; se più lezioni si dividono un periodo, una riga per ciascuna con il suo orario |
| ADDESTRAMENTO, COD. | titolo e numero del chapter svolto nella lezione (34 → «Navigation»); le altre attività hanno la loro dicitura e il loro codice (MEO, EX, PT, VI, PA; la sospensione è sbarrata) |
| ISTRUTTORE | grado e cognome dell'istruttore della lezione; per le pratiche amministrative anche una persona senza account (RSPP) |
| AULA | aula del periodo, altrimenti quella del corso |
| DIRETTORE DEL CORSO | l'istruttore a cui è affidato il corso, «Grado COGNOME Nome», oppure il nome scritto nei dati del corso |
| FREQUENTATORI, ENTE | i frequentatori del corso in quella settimana (non gli esclusi), «Grado COGNOME Nome», con l'ente dei Personal Data (16 righe) |
| IL COMANDANTE | gruppo firma inserito nei dati del corso |

Quando un periodo è diviso la tabella prende una riga in più per ogni lezione aggiunta, il resto del modulo scende
e, oltre le tre righe, la scala di stampa si riduce quanto basta a restare in una pagina.

Il modulo è l'Excel originale così com'è in `modelli/`: l'applicazione lo prepara da sé a ogni esportazione (toglie
autori, percorsi e impostazioni della stampante). Lo scaricano il Training Manager e gli istruttori del corso.

## Archivio dei dati

Come il Gestionale PdS, l'applicazione usa **solo GitHub** (nessun database esterno). In
[`public/config.json`](public/config.json):

| `archivio.tipo` | Dove stanno i dati | Aggiornamento |
|---|---|---|
| `github` (in uso) | repository **privato** `pier-200/tt-dati` (dati e modelli) + portachiavi cifrato nel repository pubblico `pier-200/tt-accessi` | controllo ogni 30 s |
| `demo` (sempre con `?demo`) | nel browser di chi apre l'app, situazione esempio | tra schede |

- **Chi legge i dati**: solo chi accede. Il token GitHub che apre `tt-dati` sta nel portachiavi, cifrato
  (PBKDF2 600.000 + AES-GCM): ogni account lo sblocca con la propria password. Senza credenziali il repository dei
  dati non è leggibile, nemmeno conoscendone l'indirizzo.
- **Il token**: uno solo, **fine-grained**, con accesso ai soli `tt-dati` e `tt-accessi` e permesso
  **Contents: Read and write**. L'applicazione rifiuta i token classici e quello della GitHub CLI (`ghp_…`,
  `gho_…`), che aprirebbero tutti i repository dell'account.
- **Token scaduto o revocato**: all'accesso il Training Manager vede il campo «Nuovo token» e lo rinnova per tutti.
  Da **Account → Aggiorna token GitHub** lo si sostituisce in qualunque momento (per esempio dopo aver disattivato
  qualcuno): chiavi nuove per tutti, password invariate; poi si revoca il vecchio token su GitHub.
- **Permessi**: li applica l'applicazione (limite noto, come nel PdS: chi ha un account e sa usare le API di GitHub
  potrebbe leggere l'intero repository dei dati).
- Ogni salvataggio è un commit in `tt-dati`: la cronologia conserva tutte le versioni.

Configurazione e manutenzione: [docs/PUBBLICAZIONE.md](docs/PUBBLICAZIONE.md).

> La repository del codice è pubblica: mai dati reali né credenziali nei file. La situazione esempio è inventata.

## Situazione esempio

Due corsi: il 1° 2026 (teoria conclusa e validata, pratica avviata, 6 frequentatori, rapportini presenze compilati con
qualche assenza, una lezione di recupero e un «non idoneo») e il 2° 2026 (solo teoria, appena iniziato, 3 frequentatori,
seconda settimana ancora da validare). Profili pronti nella pagina di accesso in modalità demo: Training Manager, quattro
istruttori (uno dirige entrambi i corsi, due sono nominati per la fase pratica del primo; ogni chapter del CH-47F ha
almeno un abilitato) e i frequentatori. «Ripristina la situazione esempio» riporta tutto allo stato iniziale.

## Sviluppo

```bash
npm install
npm run dev          # http://localhost:5174
npm test             # dominio, pianificazione, presenze, moduli, archivio GitHub (con un GitHub finto)
npm run build && npx vite preview --port 4174 && npm run e2e   # prova nel browser Edge
TT_TOKEN=<token GitHub> node tests/collaudo-github.mjs           # collaudo dell'archivio GitHub su repo di prova
npm run modelli -- --token <github_pat_…>                        # carica la cartella modelli nel repository dei dati
npm run pubblica     # compila e aggiorna GitHub Pages (ramo gh-pages)
```

Struttura:

```
scripts/import_catalogo.py     programma pratico dall'Excel             scripts/import_programma_mtt.py  programma teorico
scripts/layout_compliance.py   posizioni dei valori nel modulo PDF      scripts/configura-github.mjs     configurazione iniziale
modelli/                       copia locale dei format ufficiali        scripts/carica-modelli.mjs       modelli nel repository dei dati
src/moduloSettimana.ts         compilazione del modulo settimanale
src/xlsx.ts                    lettura degli Excel, pulizia dei metadati src/dominio/abilitazioni.ts     lettura dell'Excel delle abilitazioni
src/dominio/    programmi, compliance, pianificazione, presenze, motore dei comandi (permessi), conferme, viste
src/backend/    archivi demo e github (portachiavi, API)                 src/esporta.ts  Excel e CSV
src/ui/         interfaccia: guscio, avanzamento del corso, pagine MTT e PTT, stile «app tascabile» (DESIGN.md)
tests/          dominio, pianificazione e presenze, moduli, archivio GitHub, end-to-end
```

Gli Excel e i PDF originali restano fuori dalla repository pubblica del codice: online stanno in `tt-dati/modelli`,
in locale nella cartella `modelli/` (per i test dei moduli e per rigenerare i programmi). Su un altro computer la
cartella si ricrea scaricandola da `tt-dati` (GitHub → `modelli` → Download, oppure `git clone` con le proprie
credenziali).
