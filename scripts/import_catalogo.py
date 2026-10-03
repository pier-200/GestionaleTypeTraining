"""Importa i programmi pratici (PTR) dagli Excel ufficiali.

    py -3.11 scripts/import_catalogo.py ["docs/sorgenti/Programmi Type Training/CH-47F - PTR - B1.3.xlsx" ...]

Senza argomenti importa tutti i file "<MDS> - PTR - <categoria>.xlsx" della cartella
`docs/sorgenti/Programmi Type Training` (colonne ID, CH, SUBJECT, Task Type, Description Task).
Il file non riporta il modulo: lo si ricava dal programma teorico (MTT) dello stesso MDS e
categoria, cercando la voce con lo stesso chapter e il soggetto più simile (un chapter può
comparire in più moduli, es. 06 "Dimensions/Areas" nel modulo 1 e "Zonal identification" nel 3).
Genera `src/dati/programmi/<id>.json`, il catalogo dei task usato dall'applicazione.
"""

import json
import sys
from collections import Counter, OrderedDict
from difflib import SequenceMatcher
from pathlib import Path

import openpyxl

from import_programma_mtt import CARTELLA, RADICE, codice_chapter, descrivi, leggi_mtt, pulisci

# ordine e codici del Compliance Report (4.1)
TASK_TYPE = OrderedDict(
    [
        ("LOC", "Location Identification of system components"),
        ("FOT", "Functional / Operational Test"),
        ("SGH", "Servicing / Ground Handling"),
        ("R/I", "Removal / Installation"),
        ("MEL", "Minimum Equipment List items requiring maintenance procedure"),
        ("TS", "Troubleshooting"),
    ]
)
ALIAS_TIPO = {"RI": "R/I"}
# motore del mezzo per il Compliance Report (non è negli Excel): aggiungere UC-228 e VC-180A
MOTORE = {"CH-47F": "55-L714A"}
# moduli della norma AER(EP).P-66 (i successivi sono specifici AVES)
MODULI_P66 = {1, 2, 3, 4, 5, 6}


def modulo_del_task(ch, subject, voci, precedente):
    """Modulo dal MTT: stesso chapter e soggetto più simile; poi chapter "padre" (AVES 1a → AVES 1); poi il task precedente."""
    simile = lambda v: SequenceMatcher(None, v["subject"].lower(), subject.lower()).ratio()
    candidati = [v for v in voci if v["chapter"] == ch] or [v for v in voci if ch.startswith(v["chapter"]) or v["chapter"].startswith(ch)]
    if candidati:
        return max(candidati, key=simile)["modulo"]
    assert precedente, f"Chapter {ch} assente dal programma teorico"
    print(f"  chapter {ch} assente dal MTT: modulo {precedente} come il task precedente")
    return precedente


def importa(percorso):
    d = descrivi(percorso)
    mtt = Path(percorso).with_name(Path(percorso).name.replace(" - PTR - ", " - MTT - "))
    _, _, voci = leggi_mtt(mtt)
    righe = list(openpyxl.load_workbook(percorso, read_only=True).active.iter_rows(values_only=True))
    intestazione = [pulisci(c).upper() for c in righe[0][:5]]
    assert intestazione == ["ID", "CH", "SUBJECT", "TASK TYPE", "DESCRIPTION TASK"], f"Intestazione inattesa: {intestazione}"

    # l'Excel nuovo non ha più la colonna dei riferimenti AMM: si conservano quelli già importati
    uscita = RADICE / f"src/dati/programmi/{d['id']}.json"
    precedente = json.loads(uscita.read_text(encoding="utf-8")) if uscita.exists() else {}
    vecchi = {t["id"]: t for t in precedente.get("task", [])}

    task, soggetti, chapter = [], {}, OrderedDict()
    for r in righe[1:]:
        if r[0] is None:
            continue
        tipo = ALIAS_TIPO.get(pulisci(r[3]).upper(), pulisci(r[3]).upper())
        assert tipo in TASK_TYPE, f"Task type sconosciuto: {tipo}"
        ch, subject = codice_chapter(r[1]), pulisci(r[2])
        modulo = modulo_del_task(ch, subject, voci, task[-1]["modulo"] if task else None)
        chapter.setdefault(ch, modulo)  # un chapter diviso tra due moduli resta sotto il primo
        soggetti.setdefault(ch, Counter())[subject] += 1
        id_ = int(r[0])
        vecchio = vecchi.get(id_)
        task.append(
            {
                "id": id_,
                "modulo": modulo,
                "chapter": ch,
                "subject": subject,
                "tipo": tipo,
                "descrizione": pulisci(r[4]),
                "riferimenti": vecchio["riferimenti"] if vecchio and vecchio["chapter"] == ch else "",
            }
        )

    ids = [t["id"] for t in task]
    assert len(ids) == len(set(ids)), "ID duplicati"

    def titolo(ch):
        # alcune righe riportano il titolo con piccole varianti: si usa il più frequente
        return max(soggetti[ch].items(), key=lambda kv: (kv[1], len(kv[0])))[0]

    catalogo = {
        "id": d["id"],
        "tipo": "pratico",
        "nome": f"PTR {d['mds']} Cat. {d['categoria']}",
        "documento": precedente.get("documento") or f"T1 Military Type Training {d['mds']} Cat. {d['categoria']} – Practical Training Record (PTR)",
        "aeromobile": d["mds"],
        "motore": MOTORE.get(d["mds"]) or precedente.get("motore", ""),
        "categoria": d["categoria"],
        "taskType": [{"codice": c, "descrizione": t} for c, t in TASK_TYPE.items()],
        "moduli": [{"numero": m, "p66": m in MODULI_P66} for m in sorted({t["modulo"] for t in task})],
        "chapter": [{"codice": ch, "titolo": titolo(ch), "modulo": m} for ch, m in chapter.items()],
        "task": task,
    }
    uscita.parent.mkdir(parents=True, exist_ok=True)
    uscita.write_text(json.dumps(catalogo, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{d['id']}: {len(task)} task, {len(chapter)} chapter, per modulo {dict(sorted(Counter(t['modulo'] for t in task).items()))}, per tipo {dict(Counter(t['tipo'] for t in task))}")


if __name__ == "__main__":
    for f in sys.argv[1:] or sorted(CARTELLA.glob("* - PTR - *.xlsx")):
        importa(f)
