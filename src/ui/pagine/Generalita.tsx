import type { ReactNode } from 'react';
import { PROGRAMMI_PRATICI } from '../../dominio/programmi';
import { useCorso } from '../navigazione';
import { programmaPratico } from '../../dominio/programmi';
import { IntestazionePagina } from '../componenti/disegno';

/**
 * "1. Generality and Purpose": testo integrale dell'Allegato 1 (pagg. 3-5), non modificato.
 * Le evidenziature segnano i criteri di completamento.
 */

function Parte({ titolo, aperta, children }: { titolo: string; aperta?: boolean; children: ReactNode }) {
  return (
    <details className="capitolo" open={aperta}>
      <summary>{titolo}</summary>
      <div className="parte-testo">{children}</div>
    </details>
  );
}

const E = ({ children }: { children: ReactNode }) => <mark className="evidenziato">{children}</mark>;

export function Generalita() {
  const corso = useCorso();
  const programma = programmaPratico(corso?.programma_pratico) ?? PROGRAMMI_PRATICI[0];
  return (
    <>
      <IntestazionePagina titolo="1. Generality and Purpose" sotto={programma.documento} />
      <div className="testo-documento">
        <Parte titolo="Introduction" aperta>
          <p>
            This aircraft type-specific Practical Training Record (PTR) has been produced for use by Aircraft Maintenance Engineering Licence holders to show practical training evidence to obtain a MAML with Aircraft
            Type Rating.
          </p>
          <p>The PTR meets all of the requirements as detailed in AER(EP).P-66 Appendix III.</p>
          <p>This training is intended to be performed by an appropriately approved engineer or an appropriately qualified instructor during maintenance activities on the aircraft specified above.</p>
          <p>The practical maintenance training includes:</p>
          <ul>
            <li>Servicing aspects.</li>
            <li>Introduction to system's operation and indications.</li>
            <li>Location of the main systems, major assemblies and system components.</li>
            <li>Introduction to the system's operational and functional checks and tasks.</li>
            <li>Introduction to the use of special tooling.</li>
          </ul>
          <p>
            <E>Practical Training must have been started and completed within the 3 years preceding the application for a type rating endorsement.</E>
          </p>
        </Parte>

        <Parte titolo="Objectives">
          <p>
            The objective of this PTR is to enable the student to gain the required competence in performing safe maintenance, inspections and routine work according to the Aircraft Maintenance Manual (AER or CMM)
            and other relevant instructions and tasks as appropriate for the type of aircraft, for example troubleshooting, repairs, adjustments, replacements, rigging and functional checks. It includes the awareness
            of all technical literature and documentation for the aircraft, the use of specialist/special tooling and test equipment for performing removal and replacement of components and modules unique to type,
            including any on-wing activity.
          </p>
          <p>This will:</p>
          <ul>
            <li>Introduce the engineers to the tasks described in the aircraft manufacturer's official publications;</li>
            <li>Introduce the engineers to carrying out the aircraft line and base maintenance and safety procedures.</li>
          </ul>
        </Parte>

        <Parte titolo="Note">
          <ul>
            <li>Attention will be paid to lubricating and cleaning procedures.</li>
            <li>This practical training is based on procedures, demonstration or on actual performance of the task whichever is more suitable.</li>
            <li>The Aircraft Technical Publications - Aircraft Maintenance Manuals (AER or CMM) - will be used as a reference.</li>
            <li>Some additional maintenance tasks may be carried out that are not listed in this schedule. These should be hand written in the space provided at the end of the Logbook.</li>
          </ul>
        </Parte>

        <Parte titolo="Duration">
          <p>
            <E>The logbook should be completed in no less than 10 Days (60 hours)</E> but it may vary depending on but it should not exceed 3 months (and subject to justification to the competent authority):
          </p>
          <ul>
            <li>The availability of the aircraft.</li>
            <li>The knowledge and experience of the participants.</li>
          </ul>
          <p>Providing always that the appropriate number of tasks as defined below are completed by all participants regardless of experience.</p>
        </Parte>

        <Parte titolo="Task codes" aperta>
          <dl className="codici">
            <dt>LOC</dt>
            <dd>Location Identification of system components</dd>
            <dt>FOT</dt>
            <dd>Functional /Operational Test</dd>
            <dt>SGH</dt>
            <dd>Servicing/ Ground Handling</dd>
            <dt>RI</dt>
            <dd>Removal / Installation</dd>
            <dt>MEL</dt>
            <dd>Minimum Equipment List items requiring maintenance procedure</dd>
            <dt>TS</dt>
            <dd>Troubleshooting</dd>
          </dl>
        </Parte>

        <Parte titolo="Tasks" aperta>
          <p>
            The following Tasks are identified as being relevant. In order to successfully complete this PTR it is a requirement that{' '}
            <E>no less than 50% of all tasks per category listed be completed with at least one task being completed per ATA Chapter.</E>
          </p>
          <p>
            Tasks to be completed shall be representative of the aircraft and systems both in complexity and in the technical input required to complete that task. While relatively simple tasks may be included,
            other more complex tasks shall also be incorporated and undertaken as appropriate to the aircraft type.
          </p>
          <p>
            If the student is unable to carry out any of the recommended tasks then a suitable alternative task must be identified that is at least equal to the original task in complexity and technical input which
            can be carried out and identified in the space provided at the end of this Practical Training Record. Additional sheets may be added as necessary.
          </p>
          <p>
            In the event that some tasks are completed either in the classroom or in a simulator, this must be identified by inserting either <E>"CLA" or "SIM"</E> into the space provided for inserting the aircraft
            registration but it should be minimized.
          </p>
          <p>
            When the candidate has completed the required tasks, he/she must undergo a Practical Assessment, conducted by an appropriately approved and qualified Assessor and commission as per paragraph 3.a.5 of "
            Norme per lo Svolgimento dei corsi". This commission will evaluate the knowledge and skills of the student.
          </p>
        </Parte>

        <Parte titolo="Practical assessment">
          <p>After the required tasks have been completed, an assessment must be performed, which must comply with the following:</p>
          <ol type="a">
            <li>The assessment shall be performed by designated assessors appropriately qualified and authorised;</li>
            <li>
              The assessment should focus on the competencies relevant to the aircraft type and its maintenance which will include, as a minimum, the following:
              <ul>
                <li>Environmental awareness (act safely, apply safety precautions and prevent dangerous situations);</li>
                <li>Systems integration (demonstrate understanding of aircraft systems interaction - identify, describe, explain, plan, execute);</li>
                <li>Knowledge and understanding of areas requiring special emphasis or novelty;</li>
                <li>Using reports and indications (the ability to read and interpret);</li>
                <li>
                  Aircraft documentation - finding and handling. The student should be able to identify the appropriate aircraft documentation, navigate, execute and obey the prescribed maintenance procedures);
                </li>
                <li>Perform maintenance actions on aircraft with tools and A.G.E;</li>
                <li>Attitude and behaviour of the student whilst working in an aircraft engineering environment.</li>
              </ul>
            </li>
          </ol>
          <p>
            The Assessment is carried out by the authorised Assessor completing the Assessment Form attached at this Record. In order to complete this form the authorised Assessor shall select a task or number of
            tasks (among 4 and not exceeding 6) which is / are sufficient to evaluate the criteria listed in paragraph (b) above. Both the number of and the nature of the specific tasks selected may be different for
            each individual student depending on their respective experience. Details of the selected tasks and the relevant ATA chapter number must be recorded in the space provided.
          </p>
          <p>Once the tasks have been selected the assessment of them may be accomplished as follows:</p>
          <p>
            <b>Locate and Identify</b> - The student will correctly locate and identify the aircraft systems, major assemblies and system components and sub-components (if applicable) to the assessor with complete
            accuracy.
          </p>
          <p>
            <b>Explain</b> - The student should be able to demonstrate sufficient knowledge to verify the aircraft system is properly configured for safe operation, and all the applicable safety precautions are
            complied with to prevent harm to personnel and equipment. The student will then identify, and correctly explain to the assessor the resulting effect of operating the specified controls in all positions
            and the actions to be performed, including any necessary test equipment and/or special tooling to complete the task required. The aircraft maintenance manual procedures must be used.
          </p>
          <p>
            <b>Troubleshoot</b>- The student will use appropriate tools and technical manuals to isolate any fault/defect, determine dispatch requirements and rectify the fault.
          </p>
          <p>
            The assessment is evaluated on a pass/fail basis. If, in the opinion of the authorised Assessor, the student meets the criteria listed in paragraph (b) above that are relevant to each selected task the
            authorised Assessor will stamp off that task with his designated Assessor Stamp.
          </p>
          <p>
            If however, in the opinion of the authorised Assessor, the student fails to meet any of the said criteria that are relevant to a selected task the Assessor will not stamp off that task and will instead
            insert the word "fail" in the space provided for the stamp. The student could then be required to undergo a reassessment after case evaluation by "Consiglio di Istruzione" and completing another task or
            tasks selected by the authorised Assessor and Assessment Commission which are equal to the original task both in complexity and technical input.
          </p>
        </Parte>

        <Parte titolo="Completion">
          <p>
            Upon completion of both the required tasks and a successful practical assessment, the student's original PTR will be returned to 1° Reggimento AVES "ANTARES" or 4° Gruppo Squadroni di Sostegno AVES
            "SCORPIONE" by either the Practical Instructor or the Practical Assessor where it will then be processed to ensure that all requirements for practical training have been met. Subject to this, the student
            will then be issued with an o AER(EP).P-147 Practical Certificate.
          </p>
        </Parte>
      </div>
    </>
  );
}
