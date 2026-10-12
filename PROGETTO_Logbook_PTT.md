# Gestionale Practical Type Training
## Documento di progetto – Logbook digitale

**Nome dell'applicazione:** Gestionale Practical Type Training  
**Nome dell'app installata su cellulare:** PTT

> **File sorgente di riferimento** (presenti nella **stessa cartella** di questo documento):
> - `PTR B13 H47F` (Excel) – struttura e catalogo task del logbook
> - `Generality and Purpose` (PDF) – istruzioni, obiettivi, note e criteri di completamento
> - `Personal Data` (PDF) – dati anagrafici richiesti al frequentatore
> - `Compliance Report` (PDF) – formato dei report di conformità
>
> Chi sviluppa l'applicativo deve leggere questi quattro file **prima** di iniziare: il catalogo dei task, le colonne del logbook, i testi di Generality and Purpose e i layout dei report vanno ricavati da lì, non inventati.
>
> ⚠️ Il nome del file Excel è stato trascritto da dettatura: verificare la dicitura esatta nella cartella.

---

## 1. Obiettivo

Realizzare un applicativo web multiutente, sviluppato e versionato in una **repository GitHub condivisa**, che sostituisca la compilazione su Excel del logbook di Practical Type Training.

- Ogni **frequentatore** (trainee) compila il proprio logbook direttamente nell'applicazione.
- Il **Training Manager** (admin) gestisce i dati del corso, crea gli account, monitora l'avanzamento di tutti i frequentatori ed esporta i dati.
- Gli **istruttori** consultano la situazione in sola lettura.
- Il logbook vive nell'applicazione (non è un Excel), ma deve essere **esportabile** (Excel/CSV, eventualmente PDF) per analisi e archiviazione.

### 1.1 Nome e installazione su cellulare

- Nome ufficiale, mostrato nel titolo del browser, nella schermata di accesso e nell'intestazione: **Gestionale Practical Type Training**.
- L'applicazione è una **PWA** (Progressive Web App): dal cellulare (Android e iPhone) ogni utente può aggiungerla alla schermata Home e usarla come un'app, a schermo intero, senza passare da store.
- Una volta installata sul cellulare, sotto l'icona compare il nome **PTT** (tutto maiuscolo).
- Nel file `manifest.json`: `"name": "Gestionale Practical Type Training"`, `"short_name": "PTT"`; su iPhone anche `<meta name="apple-mobile-web-app-title" content="PTT">`.
- Serve un'icona dedicata (almeno 192×192 e 512×512 px) con la sigla PTT.
- L'app installata usa lo stesso database centrale: ciò che si salva da cellulare è visibile subito anche da PC, e viceversa.
- Le pagine devono essere pensate prima di tutto per lo schermo del telefono (form del logbook compilabile con una mano, tabelle dei report scorrevoli, grafici leggibili).

### 1.2 Lavoro condiviso e centralizzato (requisito fondamentale)

Tutti lavorano sugli **stessi dati centralizzati**, non su copie locali:

1. Il frequentatore apre l'applicazione (link pubblicato dalla repository GitHub) ed effettua l'accesso.
2. Compila o modifica le registrazioni del proprio logbook e preme **Salva**.
3. Il salvataggio aggiorna **immediatamente** il database centrale.
4. Il Training Manager (e gli istruttori) vedono subito l'aggiornamento: logbook, compliance report e grafici si ricalcolano senza passaggi manuali (niente invio di file, niente merge).

Aggiornamento in tempo reale: le pagine di monitoraggio si aggiornano da sole quando un frequentatore salva (sottoscrizione realtime del database), oppure al più con un pulsante "Aggiorna". Ogni registrazione conserva data/ora di ultima modifica e autore, così il Training Manager vede cosa è cambiato e quando.

---

## 2. Ruoli e permessi

Tre tipi di account:

- **Training Manager (admin / master)** – account unico con pieni poteri. È l'unico che **crea, modifica e disattiva** gli account di istruttori e frequentatori.
- **Istruttore** – account di **sola visualizzazione**: consulta logbook, compliance report e dashboard di **tutti** i frequentatori e può **esportare** i dati, senza poter modificare nulla.
- **Frequentatore** – può modificare **unicamente il proprio** practical training logbook (con i propri Personal Data); non vede i dati degli altri.

| Funzione | Frequentatore | Istruttore | Training Manager |
|---|---|---|---|
| Leggere Generality and Purpose | ✅ | ✅ | ✅ |
| Inserire/modificare Personal Data | ✅ (solo i propri) | ❌ (solo lettura) | ✅ (tutti) |
| Compilare il logbook | ✅ (solo il proprio) | ❌ | ✅ (correzioni su tutti) |
| Vedere i logbook dei frequentatori | solo il proprio | ✅ tutti (lettura) | ✅ tutti |
| Practical Type Training Data | lettura | lettura | ✅ inserimento |
| Vedere Practical Instructors | solo i propri | ✅ | ✅ |
| Vedere Compliance Report | solo il proprio | ✅ tutti | ✅ tutti |
| Dashboard con grafici | personale | per allievo + complessiva | per allievo + complessiva |
| Esportazione | proprio logbook (opzionale) | ✅ singolo e complessiva | ✅ singolo e complessiva |
| Creare/disattivare account | ❌ | ❌ | ✅ |

**Gestione account (pagina Admin)**
- Il Training Manager crea l'account indicando ruolo (istruttore / frequentatore), email o username e dati anagrafici di base; il sistema invia l'invito o genera una password provvisoria da cambiare al primo accesso.
- Può disattivare un account (es. fine corso) senza cancellarne i dati, che restano consultabili ed esportabili.
- Non è prevista la registrazione autonoma: senza un account creato dal Training Manager non si accede.
- L'account istruttore può essere collegato alla voce corrispondente nell'elenco istruttori del logbook (vedi 3.4), così da mostrare in evidenza i task da lui supervisionati.

---

## 3. Sezioni dell'applicativo

L'app è organizzata in pagine separate, accessibili da un menu laterale.

### 3.1 Generality and Purpose
- Pagina di sola lettura, visibile a frequentatori e admin.
- Riporta **integralmente** istruzioni, obiettivi, note e ogni altra indicazione contenuta nel PDF *Generality and Purpose*.
- Presentazione curata e ben impaginata (sezioni comprimibili, titoli, evidenziazione dei criteri di completamento), senza alterare i contenuti.

### 3.2 Personal Data
Non riproduce il PDF: lo usa come riferimento per un **form** che il frequentatore compila al primo accesso (modificabile in seguito).

Campi:
- Grado (Rank)
- Nome
- Cognome
- Data di nascita
- Città di nascita

*(Verificare sul PDF se sono richiesti altri campi.)*

### 3.3 Logbook (compilazione task)
Il frequentatore vede l'elenco dei task così come strutturato nell'Excel (moduli → chapter → task, con relativo task type) e, per ciascun task eseguito, inserisce una o più registrazioni con i seguenti campi:

| Campo | Tipo | Note |
|---|---|---|
| Maintenance Location | testo / elenco | luogo in cui è stato svolto il task |
| Data | data | data di esecuzione del task |
| Aeromobile | testo | matricola e numero identificativo dell'aeromobile; **in alternativa** `SIM` (eseguito su simulatore) oppure `CLA` (eseguito in classroom) |
| ET (min) | numero intero | Estimated Time: minuti circa impiegati per eseguire il task |
| Instructor | selezione | istruttore che ha supervisionato l'attività ed effettuato il task training |

Regole:
- Il campo aeromobile accetta un valore libero **oppure** una delle due sigle `SIM` / `CLA` (meglio un selettore "Aeromobile / SIM / CLA" + campo matricola che compare solo per "Aeromobile").
- L'istruttore si sceglie da un elenco (vedi 3.4); se non presente, il frequentatore può inserirlo con Grado, Nome, Cognome e diventa disponibile nell'elenco.
- Un task si considera **eseguito** quando ha almeno una registrazione valida.
- Validazioni: data non futura, ET > 0, campi obbligatori compilati.
- Opzionale ma consigliato: stato di **convalida** da parte dell'admin (task registrato → task convalidato).

### 3.4 Practical Instructors (scheda separata)
Si compila **automaticamente** man mano che il frequentatore registra i task: raccoglie tutti gli istruttori che hanno effettuato attività pratica su quello studente.

Per ogni istruttore:
- Grado (Rank)
- Nome
- Cognome

Utile mostrare anche, per ciascuno, numero di task supervisionati e periodo (prima/ultima data).

### 3.5 Practical Type Training Data
Inseriti **solo dall'admin** (per singolo frequentatore o per intero corso); il frequentatore li **visualizza** soltanto.

- Data di inizio del practical training
- Data di fine del practical training
- Maintenance Organization
- Location

> La **Commissione tecnica esaminatrice NON va gestita** nell'applicativo.

### 3.6 Compliance Report (pagina separata)
Generato automaticamente e aggiornato a ogni registrazione, con il layout riportato nel PDF. Tre report:

**a) Percentage by Task Type**
Per ogni task type: task totali previsti, task eseguiti, percentuale. Soglia richiesta: **≥ 50%**.

**b) Percentage by Chapter**
Per ogni chapter: task totali, task eseguiti, percentuale.
- Soglia richiesta: **≥ 50%** dei task di ciascun chapter, come per task type e moduli (regola in vigore dal
  12/10/2026; prima bastava un task per chapter).

**c) Percentage by Module**
Per ogni modulo: task totali, task eseguiti, percentuale. Soglia richiesta: **≥ 50%**.

Ogni riga mostra un indicatore di stato (✅ conforme / ❌ non conforme) e in fondo un **esito complessivo**.

### 3.7 Dashboard e grafici
**Vista frequentatore** – panoramica personale:
- grafico a torta (o a ciambella) dell'avanzamento complessivo;
- grafici per modulo e per task type con evidenziata la soglia del 50%;
- elenco dei chapter ancora senza alcun task;
- esito sintetico: "requisiti soddisfatti / mancanti".

**Vista Training Manager**:
- tabella riepilogativa di tutti i frequentatori (percentuali per modulo e task type, chapter scoperti, esito);
- grafico a torta per ogni frequentatore;
- grafico complessivo del corso (avanzamento medio, distribuzione conformi/non conformi);
- dettaglio cliccabile su ogni frequentatore con logbook completo e compliance report.

---

## 4. Regole di completamento (da Generality and Purpose)

Un frequentatore è **conforme** quando sono vere tutte e tre le condizioni:

1. **≥ 50%** dei task eseguiti per **ciascun modulo**;
2. **≥ 50%** dei task eseguiti per **ciascun task type**;
3. **≥ 50%** dei task eseguiti per **ciascun chapter** (dal 12/10/2026, come dal Compliance Report).

Calcolo: `percentuale = task distinti eseguiti / task previsti × 100`. Più registrazioni dello stesso task contano **una volta** ai fini della percentuale (verificare che il PDF non disponga diversamente).

---

## 5. Esportazione

- **Singolo frequentatore**: file Excel con fogli separati – Personal Data, Practical Type Training Data, Logbook, Practical Instructors, Compliance Report (le tre tabelle). Il foglio Logbook deve ricalcare il più possibile le colonne dell'Excel originale.
- **Complessiva (Training Manager e istruttori)**: file Excel con un foglio riepilogativo (una riga per frequentatore con percentuali, chapter scoperti ed esito) più i dati grezzi di tutte le registrazioni.
- Formato CSV per analisi; PDF del Compliance Report opzionale.

---

## 6. Modello dati

```
User            (id, email, ruolo[admin|instructor|trainee], attivo,
                 creato_da, instructor_id?)
PersonalData    (user_id, grado, nome, cognome, data_nascita, citta_nascita)
TrainingData    (user_id, data_inizio, data_fine, maintenance_organization, location)
Module          (id, codice, descrizione)
Chapter         (id, codice, descrizione, module_id)
TaskType        (id, codice, descrizione)
Task            (id, codice, descrizione, chapter_id, task_type_id)
Instructor      (id, grado, nome, cognome)
LogEntry        (id, user_id, task_id, maintenance_location, data,
                 tipo_esecuzione[AC|SIM|CLA], matricola_aeromobile,
                 et_minuti, instructor_id, stato[registrato|convalidato],
                 creato_il, modificato_il, modificato_da)
```

- Il catalogo (Module, Chapter, TaskType, Task) si **importa una sola volta dall'Excel** tramite script di importazione; così il logbook resta allineato al documento ufficiale.
- La scheda Practical Instructors è una **vista** calcolata da LogEntry + Instructor, non una tabella compilata a mano.
- Da verificare sull'Excel se i chapter appartengono a un solo modulo o se il modulo è un attributo del task.

---

## 7. Architettura proposta

**Come funziona per l'utente**: la repository GitHub pubblica l'applicazione a un indirizzo web fisso. Frequentatori, istruttori e Training Manager aprono quel link dal browser, accedono con il proprio account e lavorano tutti sullo **stesso database centrale**. Premere "Salva" scrive direttamente nel database: non si modificano file nella repo, non servono commit né merge, e il Training Manager vede l'aggiornamento subito.

La repository GitHub contiene quindi **il codice** dell'applicazione; i **dati** stanno nel database centrale. Salvare i dati come file nella repo non è adatto: scritture contemporanee di più studenti creerebbero conflitti, ogni studente avrebbe bisogno di permessi di scrittura sull'intera repo (quindi anche sui logbook altrui) e i dati personali resterebbero nello storico Git.

```
 Frequentatori ──┐
 Istruttori ─────┼──► App web (pubblicata da GitHub) ──► Database centrale
 Training Mgr ───┘         login + permessi per ruolo      (unica fonte dei dati)
```

| Componente | Scelta proposta | Alternativa |
|---|---|---|
| Codice e collaborazione | Repository GitHub (branch, pull request, issue) | – |
| Frontend | React + Vite, pubblicato su GitHub Pages | Vue |
| Autenticazione | Supabase Auth (email/password) | Firebase Auth |
| Database | Supabase (PostgreSQL) con Row Level Security: il trainee legge/scrive solo le proprie righe, l'istruttore legge tutto senza scrivere, l'admin legge e scrive tutto | Firebase Firestore |
| Aggiornamento live | Supabase Realtime: dashboard admin/istruttori aggiornate al salvataggio | polling periodico |
| Creazione account | Funzione server (Supabase Edge Function) richiamabile solo dall'admin | – |
| Grafici | Chart.js o Recharts | – |
| Export Excel | SheetJS (xlsx) | ExcelJS |
| Installazione su cellulare | PWA (manifest + service worker), nome breve "PTT" | vite-plugin-pwa per generarla |

**Nota di sicurezza**: considerato il contesto (dati personali di personale militare), valutare con l'ente se è ammesso un servizio cloud esterno. In caso contrario, la stessa applicazione può girare con backend e database **ospitati sulla rete interna** (es. Node.js + PostgreSQL o SQLite), mantenendo GitHub (o un Git interno) solo per il codice. La repo, se pubblica, non deve mai contenere dati reali né credenziali.

---

## 8. Struttura della repository

```
/
├── README.md
├── PROGETTO_Logbook_PTT.md        ← questo documento
├── docs/sorgenti/                 ← Excel e 3 PDF di riferimento (se ammesso)
├── scripts/import_catalogo.*      ← importazione task dall'Excel
├── src/
│   ├── pages/  (GeneralityPurpose, PersonalData, Logbook,
│   │           PracticalInstructors, TrainingData,
│   │           ComplianceReport, Dashboard, Admin)
│   ├── components/
│   ├── lib/    (calcolo compliance, export)
│   └── ...
└── database/schema.sql            ← tabelle + policy di sicurezza
```

---

## 9. Fasi di sviluppo

1. **Analisi sorgenti** – estrarre dall'Excel catalogo task, colonne e codici; dai PDF testi e layout.
2. **Base** – setup repo, database centrale, autenticazione, tre ruoli con relativi permessi, pagina di creazione account per il Training Manager.
3. **Contenuti statici** – pagina Generality and Purpose; configurazione PWA (nome, icona PTT, installazione su cellulare).
4. **Anagrafica** – Personal Data e Practical Type Training Data.
5. **Logbook** – inserimento/modifica registrazioni, gestione istruttori, scheda Practical Instructors.
6. **Compliance** – calcolo e tre report, esito complessivo.
7. **Dashboard** – grafici trainee e admin.
8. **Export** – Excel singolo e complessivo.
9. **Test condivisione** – due frequentatori salvano in contemporanea; verificare che admin e istruttori vedano subito entrambi gli aggiornamenti e che nessun trainee veda o modifichi dati altrui.
10. **Test calcoli** – verifica dei calcoli confrontandoli con l'Excel originale compilato a mano su un caso di prova.

---

## 10. Punti da chiarire

- Nome esatto del file Excel e significato dei codici di task type/moduli.
- Contenuto preciso del campo aeromobile (matricola + quale altro identificativo).
- Se un task va ripetuto più volte o basta una registrazione.
- Se serve la convalida dell'admin sulle singole registrazioni (gli istruttori, essendo in sola lettura, non convalidano).
- Dove possono risiedere i dati (cloud esterno o rete interna).
- Se il frequentatore può modificare/cancellare registrazioni già inserite o solo prima della convalida.
