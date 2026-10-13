"""Ricava dal PDF ufficiale del Compliance Report le posizioni in cui scrivere i valori.

    py -3.11 scripts/layout_compliance.py [modelli/Compliance Report.pdf]

Genera:
- src/dati/layout-compliance.json         per ogni riga delle tabelle 4.1 / 4.2 / 4.3 il centro delle celle
                                          "effectively performed" e "percentage", la linea di base e il carattere,
                                          più i campi dell'intestazione (Grade, First name, Surname, MAML, Organization)
                                          e Place / Date.
Coordinate in punti PDF con origine in alto a sinistra (come PyMuPDF). Rieseguire solo se cambia il modulo.
"""

import json
import re
import sys
from pathlib import Path

import pymupdf

RADICE = Path(__file__).resolve().parent.parent
SORGENTE = Path(sys.argv[1]) if len(sys.argv) > 1 else RADICE / "modelli/Compliance Report.pdf"


def spans(pagina):
    for b in pagina.get_text("rawdict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                testo = "".join(c["c"] for c in s["chars"])
                if testo.strip():
                    yield {**s, "testo": testo}


def verticali(pagina):
    """Segmenti verticali (x, y0, y1) disegnati come linee o rettangoli sottili."""
    out = []
    for d in pagina.get_drawings():
        for it in d["items"]:
            if it[0] == "re" and it[1].width < 2.5 and it[1].height > 4:
                r = it[1]
                out.append(((r.x0 + r.x1) / 2, r.y0, r.y1))
            elif it[0] == "l" and abs(it[1].x - it[2].x) < 0.5:
                out.append((it[1].x, min(it[1].y, it[2].y), max(it[1].y, it[2].y)))
    return out


def celle(linee, y, x_valore):
    """Confini delle celle della riga alla quota y: restituisce (cella del valore, le due successive)."""
    xs = sorted({round(x, 1) for x, y0, y1 in linee if y0 - 0.5 <= y <= y1 + 0.5})
    unite = []
    for x in xs:  # linee doppie ravvicinate = un solo confine
        if unite and x - unite[-1] < 3:
            unite[-1] = (unite[-1] + x) / 2
        else:
            unite.append(x)
    for i in range(len(unite) - 3):
        if unite[i] <= x_valore <= unite[i + 1]:
            return unite[i : i + 4]
    raise ValueError(f"celle non trovate a y={y:.1f} x={x_valore:.1f}")


def main():
    doc = pymupdf.open(SORGENTE)
    layout = {"pagine": []}
    for pagina in doc:
        info = {"indice": pagina.number, "larghezza": pagina.rect.width, "altezza": pagina.rect.height, "righe": []}
        elenco = list(spans(pagina))
        linee = verticali(pagina)

        # intestazione: segnaposto da coprire e campi da compilare
        logo = next((s for s in elenco if s["testo"].strip() == "Logo"), None)
        if logo:
            segnaposto = [s["bbox"] for s in elenco if s["color"] == 0x00AFEF]
            campi = {}
            for s in elenco:
                for etichetta, chiave in (("Grade", "grade"), ("First name", "nome"), ("Surname", "cognome"), ("MAML", "maml")):
                    if s["testo"].startswith(etichetta):
                        riga = [x for x in elenco if abs(x["origin"][1] - s["origin"][1]) < 1 and "_" in x["testo"]]
                        primo = next(c for x in riga for c in x["chars"] if c["c"] == "_")
                        campi[chiave] = {"x": primo["bbox"][0], "base": s["origin"][1], "fine": max(x["bbox"][2] for x in riga)}
            x_cella = [x for x, y0, y1 in linee if y0 < logo["origin"][1] < y1]
            sx = max(x for x in x_cella if x < logo["bbox"][0])
            dx = min(x for x in x_cella if x > logo["bbox"][2] + 20)
            alto = min(y0 for x, y0, y1 in linee if abs(x - sx) < 1)
            basso = max(y1 for x, y0, y1 in linee if abs(x - sx) < 1)
            info["intestazione"] = {"cella": [sx, alto, dx, basso], "segnaposto": segnaposto, "campi": campi}

        # righe delle tabelle: il valore "applicable" (colonna 2) fa da ancora per ogni riga
        titolo = " ".join(s["testo"] for s in elenco)
        tabella = "tipo" if "4.1" in titolo else "modulo" if "4.3" in titolo else "chapter"
        numeri = [s for s in elenco if re.fullmatch(r"\s*\d+\s*", s["testo"])]
        for s in numeri:
            y = s["origin"][1]
            cx = (s["bbox"][0] + s["bbox"][2]) / 2
            try:
                confini = celle(linee, y - 3, cx)
            except ValueError:
                continue
            # etichetta nella prima colonna della stessa riga; le righe TOTAL hanno l'etichetta su più righe di testo
            vicine = [e for e in elenco if e["bbox"][2] <= confini[0] + 1 and abs(e["origin"][1] - y) < 14]
            if int(s["testo"]) in (183, 190) and any(e["testo"].strip().upper().startswith("TOTAL") for e in vicine):
                chiave = "totale" if int(s["testo"]) == 190 else "totaleP66"
            else:
                stessa = [e for e in vicine if abs(e["origin"][1] - y) < 4]
                if not stessa:
                    continue  # nella 4.3 anche i numeri di modulo (prima colonna) sono numeri: si saltano
                chiave = f"{tabella}:{re.sub(chr(92) + 's+', '', stessa[-1]['testo']).upper()}"
            info["righe"].append(
                {
                    "chiave": chiave,
                    "base": y,
                    "corpo": s["size"],
                    "grassetto": "Bold" in s["font"],
                    "eseguiti": (confini[1] + confini[2]) / 2,
                    "percentuale": (confini[2] + confini[3]) / 2,
                }
            )

        # linea di firma (4.3): Place e Date
        for s in elenco:
            if s["testo"].strip() in ("Place", "Date"):
                punti = next(x for x in elenco if "……" in x["testo"] and x["bbox"][0] <= (s["bbox"][0] + s["bbox"][2]) / 2 <= x["bbox"][2])
                info.setdefault("firma", {})[s["testo"].strip().lower()] = {"centro": (punti["bbox"][0] + punti["bbox"][2]) / 2, "base": punti["bbox"][1] + 1, "corpo": 10}
        layout["pagine"].append(info)

    (RADICE / "src/dati/layout-compliance.json").write_text(json.dumps(layout, indent=1), encoding="utf-8")
    for p in layout["pagine"]:
        print(f"pagina {p['indice'] + 1}: {len(p['righe'])} righe, intestazione {'sì' if 'intestazione' in p else 'no'}, firma {list(p.get('firma', {}))}")


if __name__ == "__main__":
    main()
