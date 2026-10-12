---
version: 1
slug: "src-ui-app-tsx"
primary_target: "src/ui/App.tsx"
related_targets: []
---

# Surface brief: app Gestionale Type Training (tutte le pagine autenticate)

Mode: Operate. Audience: frequentatori (telefono, hangar/linea volo), istruttori (sola lettura), Training Manager (PC d'ufficio). Task: registrare task eseguiti in pochi tocchi, capire subito conformità e mancanze, monitorare il corso. Constraints: catalogo e testi dal documento ufficiale; dati esempio sintetici e dichiarati tali.

## Direction contract

THESIS: Ogni logbook è una tavola tecnica sotto verifica: i task eseguiti vengono evidenziati in giallo come fa il verificatore sul check print, ciò che manca è segnato a matita rossa. Rifiuta la dashboard SaaS a schede e riquadri.

OWN-WORLD: foglio da disegno bianco freddo #F6F7F4 con cornice e riferimenti di griglia a margine; inchiostro #16202B; filetti #8E99A4 a 1px; giallo evidenziatore #F2D22E unico colore del "fatto"; rosso matita #D2352B solo per requisiti non soddisfatti. Barlow e Barlow Condensed (lettering tecnico), cifre tabellari. Angoli vivi, tabelle rigate stile distinta base, palloncini tondi per i codici chapter, linee di quota con riferimento al 50% come barre di avanzamento, cartiglio come intestazione, timbro rettangolare CONFORME / NON CONFORME, blocco revisioni per le ultime modifiche.

STORY: il frequentatore apre la sua tavola, vede nel cartiglio grado, nome, MAML e la percentuale in cifre monumentali con il timbro di esito; sotto, le mancanze in rosso (chapter scoperti, moduli e task type sotto il 50%). Tocca "Registra task", cerca il task, compila, salva: la riga si evidenzia in giallo e i contatori scattano. Il TM vede la distinta di tutti i frequentatori con quote e timbri, e apre la tavola di ciascuno.

FIRST VIEWPORT: mobile 390px: barra superiore con nome tavola e utente; cartiglio a tutta larghezza con percentuale complessiva a ~64px condensato e timbro; subito sotto le linee di quota dei moduli con datum al 50%; pulsante primario "Registra task" fisso in basso nel raggio del pollice sopra la barra di navigazione a 4 voci. Desktop: indice delle tavole a sinistra, foglio con cornice a riferimenti di griglia, cartiglio in alto a destra del foglio.

FORM: candidato 7 della lista ordinata (tavola tecnica / convenzione del check print); seed a5137253. Signature interaction: tratto di evidenziatore giallo che attraversa la riga del task al salvataggio (sweep 300ms ease-out); unica altra motion: barrato rosso dei requisiti mancanti. Raises: cifre monumentali nel cartiglio (da Sala crisi); colore solo nei segni del verificatore (da Nube); unica griglia di etichetta per ogni riga task ID·CH·TYPE·descrizione·registrazioni (da Parete di scatole); il task selezionato si apre sul posto e il resto arretra (da Console); gerarchia per sola scala (da Specimen).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Recorded deviations

- Donut progress ring kept in the cartiglio and in each row of the course overview: pinned by the brief (PROGETTO_Logbook_PTT.md §3.7 asks for "grafico a torta (o a ciambella)" per trainee and "grafico a torta per ogni frequentatore"). Drawn in the world's grammar (yellow arc between two ink hairlines, datum tick at 0).
- Desktop cartiglio spans the full sheet width with the percentage/stamp block at the top right (the drawing's sheet-number position): identity and progress are the first read on every sheet, and the full width keeps MAML, A/C, engine and period on one line.
