import { Button, Group, Modal, Text } from '@mantine/core';
import { useStato } from '../stato';

/** Conferma esplicita prima di salvare una modifica a un corso completato o ai dati di un frequentatore escluso. */
export function Conferma() {
  const conferma = useStato((s) => s.conferma);
  return (
    <Modal opened={conferma != null} onClose={() => conferma?.rispondi(false)} title={<span className="titolo-sezione">Conferma la modifica</span>} centered zIndex={400}>
      <Text>{conferma?.messaggio}</Text>
      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={() => conferma?.rispondi(false)}>
          Annulla
        </Button>
        <Button onClick={() => conferma?.rispondi(true)}>Sì, confermo</Button>
      </Group>
    </Modal>
  );
}
