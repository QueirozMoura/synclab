# Persistência SQLite/WASM - Fase 2 do SyncLab

## Status: ✅ COMPLETO

### Sumário Executivo

Implementada uma camada de persistência local baseada em SQLite/WASM (via sql.js) que permite armazenar operações localmente e reconstruir o estado após reinicialização. A arquitetura mantém clara separação entre domínio e infraestrutura.

---

## Arquitetura Implementada

```
Application
    ↓
Persistence Repository (Interface)
    ↓
SQLiteOperationRepository (Implementação)
    ↓
SqliteFactory + Schema
    ↓
sql.js Database (WASM)
    ↓
Operations (Binary Storage)
```

**Direção de dependência**:
- ✅ Infrastructure → Domain
- ✅ Domain NOT → Infrastructure

---

## Tecnologia Escolhida: sql.js

**sql.js** é uma porta JavaScript de SQLite compilada para WebAssembly.

### Por que sql.js?

| Critério | sql.js | Alternativas |
|----------|--------|--------------|
| Browser compatibility | ✅ Nativo | ❌ better-sqlite3 (Node only) |
| Node.js support | ✅ Sim | ❌ PostgreSQL (requer server) |
| Performance | ✅ Bom | ⚠️ File-based SQLite (apenas Node) |
| Tamanho | ✅ ~500KB | ⚠️ Wasm-sqlite (~1MB) |
| Comunidade | ✅ Ativa | ✅ wa-sqlite (alternativa) |
| Maturidade | ✅ Estável | ✅ Ambas maduras |

**Decisão**: sql.js oferece melhor suporte browser-first sem sacrificar Node.js, alinhado com objetivo futuro do SyncLab rodar no browser.

---

## Arquivos Criados

### Domain Layer

#### 1. `src/domain/operations/OperationRepository.ts` (Interface)
- Define contrato para persistência
- Métodos: `save()`, `findById()`, `findByDocumentId()`, `findAll()`, `has()`
- ✅ Domain-independent

#### 2. `src/domain/operations/OperationSerializer.ts`
- Serializa/desserializa Operation para/de JSON
- Garante reversibilidade: Operation → JSON → Operation
- Responsável por VectorClock.toMap() + JSON
- Sem dependência de SQLite

### Infrastructure Layer

#### 3. `src/infrastructure/persistence/sqlite/SqliteFactory.ts`
- Factory para inicializar sql.js
- Cria/carrega bancos de dados
- Abstrai complexidade de inicialização async do WASM
- Cache interno para evitar re-inicialização

#### 4. `src/infrastructure/persistence/sqlite/schema.ts`
- Define schema SQL
- Tabela: `operations` (append-only)
- Índices: `document_id`, `device_id`
- Queries preparadas (safe against injection)

#### 5. `src/infrastructure/persistence/sqlite/SqliteOperationRepository.ts`
- Implementação concreta de OperationRepository
- Gerencia conexão com banco
- Prepared statements para segurança
- INSERT OR IGNORE para deduplicação nativa

### Tests

#### 6. `tests/persistence.test.ts`
- 18 testes novos
- Cobertura completa:
  - Inicialização de banco
  - Persistência de INSERT/DELETE
  - VectorClock multi-dispositivo
  - Deduplicação
  - Filtragem por documento
  - Round-trip (serialização)
  - Reconstrução de CRDT
  - Persistência entre instâncias ("restart")
  - Serialização (serializer unit tests)

---

## Schema SQLite

```sql
CREATE TABLE IF NOT EXISTS operations (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  vector_clock_json TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_document_id ON operations(document_id);
CREATE INDEX IF NOT EXISTS idx_device_id ON operations(device_id);
```

### Serialização em Banco

| Campo | Serialização | Reversibilidade |
|-------|--------------|-----------------|
| `payload_json` | `JSON.stringify()` | ✅ JSON.parse() |
| `vector_clock_json` | `JSON.stringify(vc.toMap())` | ✅ VectorClock.from() |
| `id`, `documentId`, etc. | String direto | ✅ String direto |

---

## Fluxos Implementados

### 1. Salvar Operação

```typescript
const repo = new SqliteOperationRepository(db);
const operation = createOperation({...});

// Idempotente: mesma operation 2x = 1 linhas no banco
await repo.save(operation);
```

**Mecanismo**: INSERT OR IGNORE usa PRIMARY KEY(id)

### 2. Recuperar por Documento

```typescript
const operations = await repo.findByDocumentId("doc-1");
// Retorna na ordem de criação (created_at ASC)
```

**Uso**: Recarregar todas as operações de um documento

### 3. Reconstruir CRDT

```typescript
const crdt = new TextDocumentCrdt("doc-1");
const operations = await repo.findAll();

for (const op of operations) {
  crdt.apply(op);
}

const state = crdt.getState(); // Estado reconstruído
```

**Garantia**: Mesmo conjunto de operações, mesma ordem → mesmo estado

### 4. Persistência Entre Instâncias

```typescript
// Instância A
const db1 = await SqliteFactory.createDatabase();
const repo1 = new SqliteOperationRepository(db1);
const buffer = repo1.export(); // Exporta banco

// Instância B
const db2 = await SqliteFactory.loadDatabase(buffer);
const repo2 = new SqliteOperationRepository(db2);
const ops = await repo2.findAll(); // Mesmas operações
```

---

## Garantias Implementadas

### ✅ Idempotência

Salvar mesma operação múltiplas vezes = 1 registro no banco (via PRIMARY KEY).

```typescript
await repo.save(operation);
await repo.save(operation); // Sem efeito, não cria duplicata
```

### ✅ Reversibilidade

Operation ↔ SQLite ↔ Operation com equivalência semântica total.

```typescript
const original = operation;
const serialized = serializer.serialize(original);
const restored = serializer.deserialize(serialized);
// original ≡ restored (todos os campos idênticos)
```

### ✅ Separação de Camadas

- Domain: VectorClock, Operation, CRDT, Sync
- Infrastructure: SQLite, Serialization, Repository

Domain NÃO importa Infrastructure. Inversão de controle via interface OperationRepository.

### ✅ Convergência

Múltiplas instâncias carregando mesmo conjunto de operações chegam ao mesmo estado.

```typescript
instance1.apply(operations) // Estado A
instance2.apply(operations) // Estado A (idêntico)
// Garantia: mesmo CRDT determinístico
```

---

## Testes Adicionados (18)

### SQLiteOperationRepository (11 testes)

1. ✅ Inicializa banco vazio
2. ✅ Persiste INSERT
3. ✅ Persiste DELETE
4. ✅ Persiste VectorClock multi-dispositivo
5. ✅ Deduplica operações (PRIMARY KEY)
6. ✅ Persiste múltiplas operações
7. ✅ Filtra por document_id
8. ✅ Round-trip (serialize → DB → deserialize)
9. ✅ `has()` verifica existência
10. ✅ Recupera em ordem de criação
11. ✅ INSERT com afterId preservado

### OperationSerializer (4 testes)

12. ✅ Serializa INSERT
13. ✅ Desserializa INSERT
14. ✅ Serializa DELETE
15. ✅ toJSON/fromJSON preservam dados

### Reconstrução CRDT (3 testes)

16. ✅ Reconstrói a partir de operações persistidas
17. ✅ Reconstrói com DELETE e tombstones
18. ✅ Persistência entre instâncias (simula "restart")

---

## Quantitativo de Testes

| Categoria | Antes | Novos | Total |
|-----------|-------|-------|-------|
| VectorClock | 27 | - | 27 |
| Operations | 13 | - | 13 |
| SyncEngine | 23 | - | 23 |
| TextDocumentCrdt | 25 | - | 25 |
| **Persistence** | - | 18 | 18 |
| **TOTAL** | **88** | **18** | **106** |

✅ Todos os 88 testes anteriores **continuam passando**
✅ 18 testes novos **100% passando**

---

## Validações Finais

```bash
✅ npm test                    → 106/106 passing
✅ npx tsc --noEmit            → Sem erros de tipo
✅ git diff                    → Apenas código necessário
✅ Sem breaking changes        → Todos testes anteriores passam
```

---

## Limitações Conhecidas & Fora de Escopo

### ❌ Não Implementado Nesta Fase

- [ ] HTTP/WebSocket
- [ ] Sincronização com servidor
- [ ] Autenticação/Login
- [ ] Garbage collection de tombstones
- [ ] Cache de estado (sempre reconstrói)
- [ ] Backup/Export automático
- [ ] Replicação entre dispositivos
- [ ] Otimizações de performance

### ✅ Deixado para Fases Futuras

Essas funcionalidades serão implementadas posteriormen com separação clara:

- **Fase 3**: Transporte (HTTP/WebSocket)
- **Fase 4**: Sincronização entre réplicas
- **Fase 5**: Otimizações

---

## Problemas Arquiteturais Encontrados & Resolvidos

### ❌ Problema 1: Transações em sql.js

**Symptoma**: "cannot commit - no transaction is active"

**Causa**: sql.js não inicializa transações como esperado

**Solução**: Remover BEGIN/COMMIT explícito, usar INSERT OR IGNORE que é idempotente naturalmente

### ✅ Problema 2: Type Casting com ParamsObject

**Symptoma**: TypeScript não reconhecia tipo retornado por `getAsObject()`

**Causa**: sql.js retorna tipo genérico `ParamsObject`

**Solução**: Usar cast para `unknown` como intermediário: `as unknown as OperationRow`

---

## Verificação de Independência de Camadas

```
✅ domain/ NÃO importa infrastructure/
✅ infrastructure/ depende de domain/ (tipos)
✅ OperationRepository é interface no domain/
✅ SqliteOperationRepository é implementação em infrastructure/
✅ Serializer está no domain/ (generic)
✅ Sem código SQLite no domínio
```

---

## Estrutura Final de Pastas

```
backend/src/
  domain/
    crdt/
    operations/
      ├─ Operation.ts
      ├─ OperationLog.ts
      ├─ OperationRepository.ts ← Interface
      ├─ OperationSerializer.ts
      ├─ types.ts
      └─ index.ts (atualizado)
    sync/
    vector-clock/
  infrastructure/
    persistence/
      sqlite/
        ├─ SqliteFactory.ts
        ├─ SqliteOperationRepository.ts
        └─ schema.ts
    └─ index.ts (novo)

backend/tests/
  ├─ vector-clock.test.ts
  ├─ operations.test.ts
  ├─ sync-engine.test.ts
  ├─ text-document-crdt.test.ts
  └─ persistence.test.ts ← Novo
```

---

## Como Usar a Persistência

### Exemplo: Criar e Carregar Documento

```typescript
import { SqliteFactory, SqliteOperationRepository } from "./src/infrastructure/index.js";
import { TextDocumentCrdt } from "./src/domain/crdt/index.js";
import { createOperation } from "./src/domain/operations/index.js";

// 1. Inicializar banco
const db = await SqliteFactory.createDatabase();
const repository = new SqliteOperationRepository(db);

// 2. Criar documento
const crdt = new TextDocumentCrdt("doc-1");

// 3. Aplicar operação
const operation = createOperation({
  documentId: "doc-1",
  deviceId: "device-1",
  type: OperationType.INSERT,
  payload: { afterId: null, content: "Hello" },
  vectorClock: VectorClock.create().increment("device-1"),
});
crdt.apply(operation);

// 4. Persistir
await repository.save(operation);

// 5. Recarregar (após "restart")
const stored = await repository.findByDocumentId("doc-1");
const crdt2 = new TextDocumentCrdt("doc-1");
stored.forEach(op => crdt2.apply(op));

console.log(crdt2.getState()); // Mesmo estado
```

---

## Conclusão

A Fase 2 implementou com sucesso:

✅ Camada de persistência independente do domínio  
✅ SQLite/WASM via sql.js (browser-first)  
✅ Serialização reversível de Operation + VectorClock  
✅ Idempotência de operações no banco  
✅ Reconstrução completa de CRDT  
✅ 18 novos testes, todos passando  
✅ Nenhum breaking change  

**Próximo passo**: Fase 3 - Transporte e Sincronização
