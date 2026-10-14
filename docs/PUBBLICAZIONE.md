# Pubblicazione e archivio su GitHub

L'app è online su **https://pier-200.github.io/GestionaleTypeTraining/** e, come il Gestionale PdS, usa **solo
GitHub**: nessun database esterno, nessun computer da tenere acceso.

| Link | A chi |
|---|---|
| `https://pier-200.github.io/GestionaleTypeTraining/` | tutti (un'unica applicazione, pagine secondo il ruolo) |
| `https://pier-200.github.io/GestionaleTypeTraining/?demo` | prova con dati finti, salvati solo nel browser |

## Come è fatto

| Repository | Visibilità | Contenuto |
|---|---|---|
| `pier-200/GestionaleTypeTraining` | pubblico | il codice; il ramo `gh-pages` è il sito (GitHub Pages) |
| `pier-200/tt-dati` | **privato** | i dati (`db/…`: account, corsi, frequentatori, logbook, programmi settimanali, presenze, certificati) e i **modelli** (`modelli/…`) |
| `pier-200/tt-accessi` | pubblico | solo `keyring.json`, il portachiavi **cifrato** |

- Il sito non contiene né dati né modelli. Per leggerli serve il token di `tt-dati`, che sta nel portachiavi cifrato
  (PBKDF2 600.000 + AES-GCM): ogni account lo sblocca con la propria password. Senza accesso GitHub risponde «non
  trovato», anche a chi conosce l'indirizzo.
- Ogni salvataggio è un commit in `tt-dati`: la cronologia conserva ogni versione.
- Limite noto, come nel PdS: i permessi per ruolo li applica l'applicazione; chi ha un account e sa usare le API di
  GitHub potrebbe leggere o modificare il repository dei dati (ogni modifica resta comunque nella cronologia).

`public/config.json` punta già ai due repository:

```json
{ "archivio": { "tipo": "github", "owner": "pier-200", "repoDati": "tt-dati", "repoAccessi": "tt-accessi", "branch": "main" } }
```

## Stato (14/10/2026)

- `tt-dati` (privato) contiene già i **modelli** (cartella `modelli/`, 21 file); nessun dato.
- `tt-accessi` (pubblico) contiene solo il README: **manca la configurazione iniziale** (portachiavi e Training Manager).

## 1. Il token GitHub (una volta sola)

1. GitHub → foto profilo → **Settings → Developer settings → Personal access tokens → Fine-grained tokens →
   Generate new token**.
2. *Token name*: `Gestionale Type Training`; *Expiration*: la durata massima (annotare la scadenza).
3. *Repository access*: **Only select repositories** → `tt-dati` e `tt-accessi`. Nessun altro.
4. *Permissions → Repository permissions → Contents*: **Read and write** (Metadata resta «Read-only»).
5. **Generate token** e copiare il valore (`github_pat_…`): serve una sola volta, al punto 2.

L'applicazione accetta solo token fine-grained (`github_pat_…`): un token classico (`ghp_…`) o quello della GitHub CLI
(`gho_…`) aprirebbe tutti i repository dell'account a chi riuscisse a decifrare il portachiavi, che è pubblico.

## 2. Configurazione iniziale

In uno dei due modi:

- aprire https://pier-200.github.io/GestionaleTypeTraining/ → **Configurazione iniziale**: token, username, grado
  nome e cognome, password del Training Manager → **Configura e accedi**;
- oppure da riga di comando, nella cartella del progetto:

  ```bash
  node scripts/configura-github.mjs --token <github_pat_…> --username admin --password <password>
  ```

Il token finisce cifrato nel portachiavi e non va dato a nessuno. La password del Training Manager protegge il
token: per i dati veri usarne una lunga.

## 3. Primo utilizzo

Da **Account** creare istruttori e frequentatori; da **Corsi** creare il corso indicando il direttore, gli istruttori
della fase pratica e gli aeromobili; da **Corso e iscritti** assegnare i frequentatori; da **Materie e istruttori**
inserire i chapter a cui ogni istruttore è abilitato (a mano o dall'Excel delle abilitazioni).

## Modelli

I format ufficiali (programma settimanale, Compliance Report, programmi, Excel delle abilitazioni, `logo.png`
facoltativo) stanno in `tt-dati/modelli/`. Per aggiornarli:

- dal progetto, dopo aver sostituito i file nella cartella locale `modelli/`:

  ```bash
  npm run modelli -- --token <github_pat_…>      # oppure TT_TOKEN=<github_pat_…> npm run modelli
  ```

  carica in un solo commit i file nuovi o cambiati; quelli presenti solo online restano;
- oppure da GitHub: `tt-dati` → cartella `modelli` → **Add file → Upload files** (per esempio l'Excel delle
  abilitazioni, che poi si importa da «Materie e istruttori»).

## Manutenzione

- **Token scaduto o revocato**: all'accesso il Training Manager vede il campo «Nuovo token di accesso GitHub»; ne crea
  uno come al punto 1 e lo incolla: l'accesso torna per tutti. Gli altri utenti non devono fare nulla.
- **Un utente lascia il corso**: disattivarlo da **Account**, poi **Account → Aggiorna token GitHub** con un token
  nuovo (chiavi rigenerate per tutti, password invariate) e infine revocare il vecchio token su GitHub: chi conservasse
  una copia delle vecchie chiavi non legge più i dati.
- **Password dell'unico Training Manager dimenticata**: in `tt-accessi` eliminare `keyring.json`, rifare la
  configurazione iniziale **con lo stesso username** (i dati restano), poi reimpostare le password degli altri.
- **Backup**: la cronologia di `tt-dati`; a fine corso conviene anche l'**Excel complessivo** dall'applicazione.

## Aggiornare il sito

```bash
git commit -am "..."   # il sito deve corrispondere al codice salvato
npm run pubblica       # compila e sostituisce il ramo gh-pages
```

La build non include la cartella `modelli`: i modelli si aggiornano a parte (vedi «Modelli»).

## Storico

- Fino al 13/10/2026 il codice poteva usare anche un archivio **Supabase** (progetto `dyragieggyvgayteotlm`, mai usato
  per dati reali). Dal 14/10/2026 è stato tolto, come nel Gestionale PdS: schema SQL, funzione e script non ci sono
  più. Il progetto Supabase si può eliminare dal pannello di Supabase.
- Il 14/10/2026, per poche ore, i modelli erano pubblicati accanto al sito (`…/GestionaleTypeTraining/modelli/`):
  ora non più.
