import type { Comando } from './motore';
import type { Dati, ID } from './tipi';
import { formatoData, nomeUtente } from './viste';

/**
 * Avvisi da confermare prima di eseguire un comando: il corso è completato, oppure il frequentatore
 * è fuori dal corso. I dati restano consultabili; la modifica si salva solo dopo il sì.
 */
export function conferme(dati: Dati, comando: Comando): string[] {
  const registrazione = comando.tipo === 'registrazione.elimina' ? dati.registrazioni.find((r) => r.id === comando.id) : undefined;
  const certificato = comando.tipo === 'certificato.elimina' ? dati.certificati.find((c) => c.id === comando.id) : undefined;
  const iscrizione = comando.tipo === 'corso.disiscrivi' || comando.tipo === 'corso.escludi' ? dati.iscrizioni.find((i) => i.id === comando.id) : undefined;

  /** Corso toccato dal comando. */
  const corsoId = ((): ID | undefined => {
    switch (comando.tipo) {
      case 'corso.salva':
        return comando.corso.id;
      case 'corso.iscrivi':
        return comando.iscrizione.corso_id;
      case 'training.salva':
      case 'lezioni.sostituisci':
      case 'settimana.valida':
      case 'rapportino.salva':
      case 'rapportino.valida':
        return comando.corso_id;
      case 'registrazione.salva':
        return comando.registrazione.corso_id;
      case 'lezione.modifica':
        return dati.lezioni.find((l) => l.id === comando.lezione.id)?.corso_id;
      case 'certificato.salva':
        return comando.certificato.corso_id;
      default:
        return registrazione?.corso_id ?? certificato?.corso_id ?? iscrizione?.corso_id;
    }
  })();

  /** Frequentatori di cui il comando modifica i dati. */
  const utenti = ((): ID[] => {
    switch (comando.tipo) {
      case 'registrazione.salva':
        return [comando.registrazione.user_id];
      case 'training.salva':
        return comando.user_ids;
      case 'anagrafica.salva':
        return [comando.anagrafica.user_id];
      case 'certificato.salva':
        return [comando.certificato.user_id];
      default:
        return [registrazione?.user_id, certificato?.user_id].filter((x): x is ID => x != null);
    }
  })();

  const avvisi: string[] = [];
  const corso = dati.corsi.find((c) => c.id === corsoId);
  if (corso && !corso.attivo) avvisi.push(`Il corso ${corso.codice} è completato. Confermi la modifica?`);
  for (const userId of utenti) {
    // i Personal Data non hanno un corso: valgono le esclusioni da qualunque corso
    for (const i of dati.iscrizioni.filter((x) => x.user_id === userId && x.ruolo === 'trainee' && x.escluso_il && (comando.tipo === 'anagrafica.salva' || x.corso_id === corsoId))) {
      const codice = dati.corsi.find((c) => c.id === i.corso_id)?.codice ?? '';
      avvisi.push(`${nomeUtente(dati, userId)} è fuori dal corso ${codice} dal ${formatoData(i.escluso_il)}. Confermi la modifica dei suoi dati?`);
    }
  }
  return avvisi;
}
