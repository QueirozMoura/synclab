import type { Operation } from "../operations/Operation.js";
import {
  createElementId,
  OperationType,
  type ElementId,
} from "../operations/types.js";
import { SyncEngine } from "../sync/SyncEngine.js";

/**
 * CRDT textual derivado do conjunto de operações de um único documento.
 *
 * O estado não é alterado incrementalmente conforme as operações chegam.
 * Em vez disso, ele é sempre derivado da ordem determinística fornecida pelo
 * SyncEngine. Assim, a ordem de entrega não influencia o resultado final.
 */
export class TextDocumentCrdt {
  private readonly syncEngine = new SyncEngine();

  constructor(private readonly documentId: string) {}

  /**
   * Registra uma operação do documento.
   * Retorna false quando a operação já havia sido aplicada.
   */
  apply(operation: Operation): boolean {
    if (operation.documentId !== this.documentId) {
      throw new Error(
        `Operation ${operation.id} belongs to document ${operation.documentId}, not ${this.documentId}`,
      );
    }

    return this.syncEngine.receive(operation);
  }

  /**
   * Retorna o texto visível. Tombstones continuam na sequência interna, mas
   * não aparecem no estado materializado.
   */
  getState(): string {
    const { elements, tombstones } = this.buildSequence();
    return elements
      .filter((element) => !tombstones.has(element.id))
      .map((element) => element.value)
      .join("");
  }

  /** Retorna os IDs estáveis dos elementos visíveis, na ordem do documento. */
  getVisibleElementIds(): ElementId[] {
    const { elements, tombstones } = this.buildSequence();
    return elements
      .filter((element) => !tombstones.has(element.id))
      .map((element) => element.id);
  }

  /** Verifica se uma operação já foi observada por este CRDT. */
  hasOperation(operationId: string): boolean {
    return this.syncEngine.getLog().has(operationId);
  }

  private buildSequence(): {
    elements: SequenceElement[];
    tombstones: ReadonlySet<ElementId>;
  } {
    const nodes = new Map<ElementId, SequenceElement>();
    const tombstones = new Set<ElementId>();

    this.syncEngine
      .getOrderedOperations(this.documentId)
      .forEach((operation, operationOrder) => {
        if (operation.type === OperationType.DELETE) {
          for (const elementId of operation.payload.elementIds) {
            tombstones.add(elementId);
          }
          return;
        }

        let afterId = operation.payload.afterId;
        for (const [index, value] of Array.from(operation.payload.content).entries()) {
          const id = createElementId(operation.id, index);
          nodes.set(id, { id, afterId, value, operationOrder, index });
          afterId = id;
        }
      });

    const children = new Map<ElementId | null, SequenceElement[]>();
    for (const node of nodes.values()) {
      if (node.afterId !== null && !nodes.has(node.afterId)) continue;
      const siblings = children.get(node.afterId) ?? [];
      siblings.push(node);
      children.set(node.afterId, siblings);
    }

    for (const siblings of children.values()) {
      siblings.sort(
        (a, b) => a.operationOrder - b.operationOrder || a.index - b.index,
      );
    }

    const elements: SequenceElement[] = [];
    const visited = new Set<ElementId>();
    const visit = (afterId: ElementId | null): void => {
      for (const node of children.get(afterId) ?? []) {
        if (visited.has(node.id)) continue;
        visited.add(node.id);
        elements.push(node);
        visit(node.id);
      }
    };
    visit(null);

    return { elements, tombstones };
  }
}

interface SequenceElement {
  readonly id: ElementId;
  readonly afterId: ElementId | null;
  readonly value: string;
  readonly operationOrder: number;
  readonly index: number;
}
