---
name: Gestionale Type Training
description: Gestionale dei corsi Type Training (MTT + logbook PTR) in stile "app tascabile": schede morbide, pulsanti a pillola, anelli e barre di avanzamento.
colors:
  sfondo: "#eef3f1"
  superficie: "#ffffff"
  superficie-2: "#f4f8f6"
  testo: "#18302b"
  testo-2: "#4b605a"
  bordo: "#dbe5e1"
  traccia: "#e3ebe8"
  verde: "#2f9e83"
  verde-tenue: "#dcefe8"
  arancio: "#f2a541"
  arancio-tenue: "#fde9cc"
  rosso: "#c4472f"
  rosso-tenue: "#fae3dd"
typography:
  font: "Figtree, 'Segoe UI', system-ui, sans-serif"
  scala: { xs: "0.75rem", s: "0.875rem", m: "1rem", l: "1.1875rem", xl: "1.625rem", numero: "2.75rem" }
rounded:
  scheda: "20px"
  piccolo: "12px"
  pillola: "999px"
---

# Design

Scelta dell'utente il 2026-10-03 tra cinque proposte (proposta **E · App tascabile**). Pensata prima di tutto per il
frequentatore che registra un task dal telefono accanto al mezzo; sul PC resta pulita e ordinata.

## Regole

- **Token** in `src/ui/stili.css` (`:root` chiaro, `[data-mantine-color-scheme='dark']` scuro) e in `src/ui/tema.ts`
  per i componenti Mantine. Nei componenti si usano solo i token (`var(--testo)`, `var(--fs-s)`…), mai colori fissi.
- **Colori di significato**: verde = parte teorica (MTT) e azioni principali; arancio = parte pratica (PTT);
  rosso = requisito mancante. `--fatto` è il colore di ciò che è svolto: arancio di base, verde dentro `.mtt`.
- **Soglia del 50%**: le barre della pratica (`Quota`) hanno la linea tratteggiata a metà e il tratto rosso tratteggiato
  per ciò che manca alla soglia. Le barre della teoria (`.mtt`) non hanno soglia.
- **Una sola scala tipografica**: `--fs-xs` (etichette), `--fs-s`, `--fs-m` (testo), `--fs-l` (titoli di sezione),
  `--fs-xl` (titolo pagina), `--fs-numero` (cifre grandi). Un solo carattere: Figtree, cifre tabellari ovunque.
- **Stati sempre con forma oltre al colore**: pillole con icona (`Timbro`, `Esito`), icona ✓/⚠ nelle celle numeriche
  `.num.si` / `.num.rosso` delle tabelle, celle tratteggiate per ciò che manca.
- **Tabelle** dentro una scheda (`.scorre`) con intestazione fissa e numeri allineati a destra (`.num`).
- **Corso sempre in vista**: nella barra in alto il menu dei corsi (o il codice se è uno solo); nel menu laterale le
  barre MTT/PTT dell'avanzamento.
- **Tema scuro** facoltativo dal pulsante luna/sole nella barra; di base segue il sistema. La stampa è sempre chiara.
- Niente cornici decorative attorno alle pagine; schede con raggio 20px e ombra leggera solo dove separano un oggetto.

## Icona

`public/icona.svg`: due anelli di avanzamento (verde teoria, arancio pratica) con «TT» su verde scuro.
`node scripts/icone.mjs` genera i PNG della PWA e `favicon.ico`, usato anche dal collegamento «Gestionale TT» sul desktop.
