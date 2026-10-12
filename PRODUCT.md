# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite + TypeScript, pubblicata su GitHub Pages come PWA (nome breve "TT"), come indicato in PROGETTO_Logbook_PTT.md §7.
Archivio dati intercambiabile da `config.json` (scelta dell'utente, 2026-09-22): `demo` (browser, situazione esempio), `supabase` (PostgreSQL + RLS + Realtime) oppure `github` (repository privato con portachiavi cifrato, come Gestionale PdS).

## Users

- **Frequentatore (trainee)**: tecnico militare che svolge il Practical Type Training CH-47F cat. B1.3; compila il proprio logbook soprattutto dal cellulare, spesso in hangar o sulla linea volo, subito dopo aver eseguito un task.
- **Istruttore**: consulta in sola lettura logbook, compliance report e dashboard di tutti i frequentatori; esporta i dati.
- **Training Manager (admin)**: unico account con pieni poteri; crea/disattiva gli account, inserisce i Practical Type Training Data, corregge i logbook, monitora l'avanzamento del corso ed esporta.

## Product Purpose

Sostituire la compilazione su Excel del Practical Training Record (PTR B1.3 CH-47F) con un logbook digitale condiviso: ogni registrazione salvata aggiorna subito compliance report e grafici visti dal Training Manager. Successo = ogni frequentatore sa in ogni momento se è conforme e cosa gli manca; il TM vede il corso intero senza raccogliere file.

## Positioning

Il catalogo dei 190 task e le regole di conformità sono quelli del documento ufficiale (Allegato 1, ed. 00.01, 4 dicembre 2025, Approved DAAA): l'app calcola automaticamente i tre report del capitolo 4 (task type, chapter, modulo).

## Operating Context

- Documento ufficiale: T1 Military Type Training CH-47F Cat. B1.3, Allegato 1. Sorgenti in `docs/sorgenti/` (Excel del catalogo, PDF Generality and Purpose, Personnel Data, Compliance Report).
- Regole: ≥50% task eseguiti per ciascun modulo, per ciascun task type e per ciascun chapter. Più registrazioni dello stesso task contano una volta.
- Task eseguiti su simulatore o in aula si registrano con "SIM" o "CLA" al posto della matricola (da minimizzare).
- La "Commissione tecnica esaminatrice" non è gestita.
- Nessuna convalida delle registrazioni (decisione utente 2026-09-22): il frequentatore modifica sempre le proprie registrazioni, il TM può correggere.
- Il PC d'ufficio può bloccare domini diversi da GitHub.

## Capabilities and Constraints

Pagine: Generality and Purpose, Personal Data, Logbook, Practical Instructors (vista calcolata), Practical Type Training Data, Compliance Report, Dashboard, Admin account. Export Excel (singolo e complessivo), CSV, stampa PDF del Compliance Report. Terminologia del documento in inglese (task type, chapter, module, LOC/FOT/SGH/R/I/MEL/TS), interfaccia in italiano.

## Evidence on Hand

Catalogo reale dei task in `docs/sorgenti/PTR_B1.3_CH-47F.xlsx`. Nessun dato reale di frequentatori: la situazione esempio è sintetica e va etichettata come tale. La repository è pubblica: mai dati reali né credenziali.

## Product Principles

1. Registrare un task dal telefono deve richiedere pochi tocchi, con una mano.
2. Lo stato di conformità è sempre visibile e spiegato (cosa manca, dove).
3. Il documento ufficiale è la fonte: testi e catalogo non si inventano.
4. Un solo archivio condiviso: ciò che si salva è subito visibile agli altri ruoli.

## Accessibility & Inclusion

Uso all'aperto e in hangar: contrasto alto, bersagli touch ampi, leggibile su schermi piccoli.
