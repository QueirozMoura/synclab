# SyncLab — Backend

Sistema Offline-First de sincronização de documentos com resolução de conflitos.

## Estado atual

Esta é a **fundação do domínio**. Apenas as primitivas core foram implementadas:

- **VectorClock** — relógio vetorial para ordenação causal
- **Operation** — modelo tipado de alteração em documento
- **OperationLog** — log append-only em memória

Nada de persistência, servidor HTTP, autenticação ou sincronização cliente-servidor ainda.

## Estrutura

```
backend/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   └── domain/
│       ├── index.ts                    # barrel export do domínio
│       ├── vector-clock/
│       │   ├── index.ts
│       │   ├── types.ts                # ClockOrdering enum, ClockMap type
│       │   └── VectorClock.ts          # implementação imutável
│       └── operations/
│           ├── index.ts
│           ├── types.ts                # OperationType enum, payloads
│           ├── Operation.ts            # interface + factory (createOperation)
│           └── OperationLog.ts         # log append-only in-memory
└── tests/
    ├── vector-clock.test.ts            # 26 testes
    └── operations.test.ts             # 11 testes
```

## Decisões técnicas

| Decisão | Escolha | Justificativa |
|---|---|---|
| Runtime | Node.js + TypeScript | Alinhado com o frontend |
| Módulos | ESM (`"type": "module"`) | Consistência com o frontend |
| Test framework | Vitest 3.x | Leve, rápido, ecossistema Vite |
| Target | ES2023 | Suporte a `randomUUID`, compatível com Node 18+ |
| Persistência | Nenhuma (in-memory) | Definir o modelo antes de persistir |
| PostgreSQL | Não nesta etapa | Sem necessidade para a fundação |
| Imutabilidade | `Object.freeze()` + `readonly` | Garantia em compile-time e runtime |

## VectorClock

Implementação imutável. Todas as operações (`increment`, `merge`) retornam novas instâncias.

### API

```ts
VectorClock.create()                    // clock vazio
VectorClock.from(map)                   // a partir de um mapa
vc.increment(deviceId)                  // → novo VectorClock
vc.merge(other)                        // pointwise max → novo VectorClock
vc.compare(other)                      // → ClockOrdering
vc.isBefore(other)                     // → boolean
vc.isConcurrentWith(other)             // → boolean
vc.equals(other)                       // → boolean
vc.get(deviceId)                       // → number
vc.toMap()                             // → ClockMap (cópia)
```

### ClockOrdering

```
BEFORE     — A aconteceu antes de B (A → B)
AFTER      — A aconteceu depois de B (B → A)
EQUAL      — A e B são causalmente equivalentes
CONCURRENT — A e B são concorrentes (sem relação causal)
```

## Operation

```ts
interface Operation {
  readonly id: string;           // UUID
  readonly documentId: string;
  readonly deviceId: string;
  readonly type: OperationType;   // INSERT (extensível para DELETE, UPDATE)
  readonly payload: OperationPayload;
  readonly vectorClock: VectorClock;
}
```

Criada via `createOperation({ ... })` que gera o ID automaticamente com `crypto.randomUUID()`.

## OperationLog

Log append-only em memória. Responsabilidades:
- `append(op)` — adiciona, rejeita duplicatas por ID
- `getByDocument(docId)` — filtra por documento
- `getAll()` — retorna cópia de todas as operações
- `has(id)` — verifica existência por ID
- `size()` — contagem total

## Como rodar

```bash
cd backend
npm install
npm test          # roda os testes uma vez
npm run test:watch  # modo watch
npx tsc --noEmit  # type-check
```

## Resultado dos testes

```
Test Files  2 passed (2)
     Tests  37 passed (37)
```

## Próximo passo recomendado

1. **Adicionar operações DELETE e UPDATE** com seus respectivos payloads
2. **Implementar o Sync Engine** que ordena operações causalmente usando o VectorClock
3. **Implementar o CRDT** para resolução de conflitos em operações concorrentes
4. **Adicionar persistência** (PostgreSQL) quando o modelo estiver validado
5. **Criar o servidor HTTP** para receber/servir operações
