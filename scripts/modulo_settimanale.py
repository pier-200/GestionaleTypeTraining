"""Prepara il modulo ufficiale «Programma settimanale» perché l'applicazione lo compili.

    py -3.11 scripts/modulo_settimanale.py [docs/sorgenti/Programma settimanale.xlsx]

Genera public/modelli/programma-settimanale.xlsx: stesso foglio, stessi stili e stessa impostazione di stampa
dell'originale, ma
- senza metadati (autori, percorsi, impostazioni della stampante) e senza le convalide rimaste senza elenco;
- con i testi scritti dentro le celle (niente tabella delle stringhe condivise), così src/moduloSettimana.ts
  sostituisce una cella alla volta;
- con «riduci e adatta» sulle celle a riga singola: una materia o un nominativo lungo non esce dalla cella.
Rieseguire solo se cambia il modulo.
"""

import re
import sys
import zipfile
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent
SORGENTE = Path(sys.argv[1]) if len(sys.argv) > 1 else RADICE / "docs/sorgenti/Programma settimanale.xlsx"
USCITA = RADICE / "public/modelli/programma-settimanale.xlsx"
FOGLIO = "SETTIMANA"

INIZIO = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
PACCHETTO = "http://schemas.openxmlformats.org/package/2006"
DOCUMENTO = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
FOGLIO_DI_CALCOLO = "application/vnd.openxmlformats-officedocument.spreadsheetml"

sorgente = zipfile.ZipFile(SORGENTE)
leggi = lambda nome: sorgente.read(nome).decode("utf-8")

# testi delle celle: dalla tabella condivisa alla cella stessa
stringhe = ["".join(re.findall(r"<t[^>]*>(.*?)</t>", si, re.S)) for si in re.findall(r"<si>(.*?)</si>", leggi("xl/sharedStrings.xml"), re.S)]
foglio = leggi("xl/worksheets/sheet1.xml")
foglio = re.sub(r' t="s"><v>(\d+)</v>', lambda m: f' t="inlineStr"><is><t xml:space="preserve">{stringhe[int(m.group(1))]}</t></is>', foglio)
foglio = re.sub(r"<extLst>.*?</extLst>", "", foglio, flags=re.S)
foglio = re.sub(r'(<pageSetup[^>]*?) r:id="[^"]*"', r"\1", foglio)
# nell'originale l'ottava riga dei frequentatori non ha il numero
foglio, corretti = re.subn(r'<c r="A54" s="(\d+)"/>', r'<c r="A54" s="\1"><v>8</v></c>', foglio)
assert corretti == 1 and 't="s"' not in foglio

stili = re.sub(r"<alignment (?![^>]*wrapText)", '<alignment shrinkToFit="1" ', leggi("xl/styles.xml"))

parti = {
    "[Content_Types].xml": INIZIO
    + f'<Types xmlns="{PACCHETTO}/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + f'<Override PartName="/xl/workbook.xml" ContentType="{FOGLIO_DI_CALCOLO}.sheet.main+xml"/>'
    + f'<Override PartName="/xl/worksheets/sheet1.xml" ContentType="{FOGLIO_DI_CALCOLO}.worksheet+xml"/>'
    + '<Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
    + f'<Override PartName="/xl/styles.xml" ContentType="{FOGLIO_DI_CALCOLO}.styles+xml"/></Types>',
    "_rels/.rels": INIZIO
    + f'<Relationships xmlns="{PACCHETTO}/relationships"><Relationship Id="rId1" Type="{DOCUMENTO}/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml": INIZIO
    + f'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="{DOCUMENTO}">'
    + f'<sheets><sheet name="{FOGLIO}" sheetId="1" r:id="rId1"/></sheets>'
    + f"<definedNames><definedName name=\"_xlnm.Print_Area\" localSheetId=\"0\">'{FOGLIO}'!$A$1:$I$63</definedName></definedNames></workbook>",
    "xl/_rels/workbook.xml.rels": INIZIO
    + f'<Relationships xmlns="{PACCHETTO}/relationships"><Relationship Id="rId1" Type="{DOCUMENTO}/worksheet" Target="worksheets/sheet1.xml"/>'
    + f'<Relationship Id="rId2" Type="{DOCUMENTO}/theme" Target="theme/theme1.xml"/>'
    + f'<Relationship Id="rId3" Type="{DOCUMENTO}/styles" Target="styles.xml"/></Relationships>',
    "xl/theme/theme1.xml": leggi("xl/theme/theme1.xml"),
    "xl/styles.xml": stili,
    "xl/worksheets/sheet1.xml": foglio,
}

USCITA.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(USCITA, "w", zipfile.ZIP_DEFLATED) as uscita:
    for nome, testo in parti.items():
        # data fissa: rigenerando lo stesso modulo il file non cambia
        uscita.writestr(zipfile.ZipInfo(nome, (2026, 1, 1, 0, 0, 0)), testo.encode("utf-8"), zipfile.ZIP_DEFLATED)
print(f"{USCITA.relative_to(RADICE)}: {USCITA.stat().st_size} byte")
