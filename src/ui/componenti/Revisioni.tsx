import { PROGRAMMI_PRATICI, indice } from '../../dominio/programmi';
import type { Dati, Registrazione } from '../../dominio/tipi';
import { esecuzione, formatoData, formatoIstante, nomeIstruttore, nomeUtente } from '../../dominio/viste';

/** Blocco revisioni: ultime registrazioni salvate. Tabella su schermi larghi, voci impilate sul telefono. */
export function Revisioni({ dati, registrazioni, conNome, apri }: { dati: Dati; registrazioni: Registrazione[]; conNome?: boolean; apri?: (userId: string) => void }) {
  const istruttore = (r: Registrazione) => nomeIstruttore(dati.istruttori.find((i) => i.id === r.instructor_id));
  // il task appartiene al programma pratico del corso: negli elenchi brevi basta cercarlo tra i programmi caricati
  const task = (id: number) => PROGRAMMI_PRATICI.map((p) => indice(p).taskPerId.get(id)).find(Boolean);
  return (
    <>
      <div className="solo-largo scorre">
        <table className="tabella">
          <thead>
            <tr>
              <th>Data</th>
              {conNome && <th>Frequentatore</th>}
              <th>Task</th>
              <th>A/C</th>
              <th>Instructor</th>
              <th>Salvato</th>
            </tr>
          </thead>
          <tbody>
            {registrazioni.map((r) => {
              const t = task(r.task_id);
              return (
                <tr key={r.id} className={apri ? 'cliccabile' : undefined} onClick={apri ? () => apri(r.user_id) : undefined}>
                  <td className="cifre" style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                    {formatoData(r.data)}
                  </td>
                  {conNome && <td style={{ fontWeight: 600, minWidth: 150 }}>{nomeUtente(dati, r.user_id)}</td>}
                  <td style={{ minWidth: 220 }}>
                    <span className="cifre" style={{ fontWeight: 600 }}>
                      {t?.id ?? r.task_id} · Ch {t?.chapter} · {t?.tipo}
                    </span>
                    <div className="debole" style={{ fontSize: 'var(--fs-s)', lineHeight: 1.35 }}>
                      {t?.descrizione}
                    </div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{esecuzione(r)}</td>
                  <td style={{ minWidth: 140 }}>{istruttore(r)}</td>
                  <td className="debole" style={{ fontSize: 'var(--fs-s)', minWidth: 120 }}>
                    {formatoIstante(r.modificato_il)}
                    {(!conNome || r.modificato_da !== r.user_id) && <div>{nomeUtente(dati, r.modificato_da)}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="revisioni-voci solo-stretto">
        {registrazioni.map((r) => {
          const t = task(r.task_id);
          const contenuto = (
            <>
              <div className="rv-testa">
                <span>
                  {t?.id ?? r.task_id} · Ch {t?.chapter} · {t?.tipo}
                </span>
                <span className="cifre">{formatoData(r.data)}</span>
              </div>
              {conNome && <div style={{ fontWeight: 600 }}>{nomeUtente(dati, r.user_id)}</div>}
              <p className="rv-desc">{t?.descrizione}</p>
              <div className="rv-piede">
                {esecuzione(r)} · {istruttore(r)}
                <br />
                Salvato {formatoIstante(r.modificato_il)}
                {r.modificato_da !== r.user_id ? ` da ${nomeUtente(dati, r.modificato_da)}` : ''}
              </div>
            </>
          );
          return (
            <li key={r.id}>
              {apri ? (
                <a href={`#/tavola?f=${r.user_id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                  {contenuto}
                </a>
              ) : (
                contenuto
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
