import React from "react";
import { Link, useParams } from "react-router-dom";
import { AppNavigation } from "../components/app/AppNavigation";

type Article = {
  title: string;
  description: string;
  category: string;
  sections: Array<{
    heading: string;
    paragraphs: string[];
    bullets?: string[];
  }>;
};

const articles: Record<string, Article> = {
  "getting-started": {
    category: "Primeiros passos",
    title: "Guia de início rápido",
    description: "Aprenda o básico do Synclab em 5 minutos.",
    sections: [
      {
        heading: "O que é o SyncLab",
        paragraphs: [
          "O SyncLab é um editor de documentos offline-first: você trabalha localmente, recebe feedback imediato e sincroniza as operações quando a conexão está disponível.",
        ],
      },
      {
        heading: "Seu primeiro documento",
        paragraphs: [
          "Depois de entrar, use Novo documento na Sidebar ou a ação correspondente em Documentos. O SyncLab abre o editor, onde o título e o conteúdo podem ser editados diretamente.",
        ],
      },
      {
        heading: "Favoritos e navegação",
        paragraphs: [
          "Na lista de Documentos, use a estrela do cartão para marcar ou desmarcar um documento como favorito. Favoritos fica disponível na navegação global e reúne apenas os documentos marcados; Recentes leva ao painel e Documentos mostra a coleção completa.",
        ],
      },
      {
        heading: "Trabalho local e sincronização",
        paragraphs: [
          "Cada alteração é persistida no IndexedDB antes de qualquer tentativa de rede. Sem internet, continue editando normalmente; as operações pendentes ficam na fila e são enviadas quando a conexão volta. A área Sincronização mostra o estado e permite tentar novamente após uma falha.",
        ],
      },
      {
        heading: "Navegação diária",
        paragraphs: [
          "Configurações concentra preferências. No mobile, abra a navegação pelo botão Synclab no topo; a Sidebar aparece como um único menu sobre a página.",
        ],
      },
    ],
  },
  "creating-documents": {
    category: "Primeiros passos",
    title: "Criar documentos",
    description: "Como criar e organizar seus documentos.",
    sections: [
      {
        heading: "Criar",
        paragraphs: [
          "Use Novo documento na Sidebar ou a ação Criar novo documento em Documentos. O SyncLab cria o documento localmente e abre o editor.",
        ],
      },
      {
        heading: "Editar",
        paragraphs: [
          "Altere o título no campo superior e escreva no editor. Mudanças de título e conteúdo são convertidas em operações locais e persistidas no IndexedDB.",
        ],
      },
      {
        heading: "Organizar e excluir",
        paragraphs: [
          "A lista da área de trabalho e a página Documentos oferecem acesso aos documentos; Favoritos é a forma disponível de separar itens para acesso rápido. O SyncLab não possui pastas ou tags nesta interface. Em Documentos, use Excluir; há uma confirmação antes de remover o item e registrar a operação de exclusão.",
        ],
      },
      {
        heading: "Sem internet",
        paragraphs: [
          "A criação e a edição continuam disponíveis offline. A sincronização pendente é preservada para processamento posterior.",
        ],
      },
    ],
  },
  collaboration: {
    category: "Primeiros passos",
    title: "Colaboração em tempo real",
    description:
      "O que está disponível hoje para trabalhar entre dispositivos.",
    sections: [
      {
        heading: "Sincronização entre dispositivos",
        paragraphs: [
          "O projeto implementa sincronização de operações de documentos entre clientes autenticados. Cada operação carrega seu deviceId, timestamp e Vector Clock para permitir ordenação causal.",
        ],
      },
      {
        heading: "Operações e conflitos",
        paragraphs: [
          "As alterações são representadas por operações de criação, atualização de título, atualização de conteúdo e exclusão. Cada operação carrega um Vector Clock, que identifica relações causais e concorrência; o log, os snapshots e o reducer local permitem reconstruir o estado de forma determinística.",
        ],
      },
      {
        heading: "O que ainda não existe",
        paragraphs: [
          "A interface de colaboração em tempo real com presença, cursores e seleções compartilhadas ainda não está implementada. Portanto, esta versão não oferece edição simultânea visual ou chat.",
        ],
      },
    ],
  },
  "offline-first": {
    category: "Recursos",
    title: "Edição offline-first",
    description: "Como o SyncLab funciona sem internet.",
    sections: [
      {
        heading: "Persistência local primeiro",
        paragraphs: [
          "O estado dos documentos é armazenado no IndexedDB do navegador. A interface atualiza de forma otimista, sem esperar pela rede para confirmar uma edição.",
        ],
      },
      {
        heading: "Fila de operações",
        paragraphs: [
          "Criar, alterar título, alterar conteúdo e excluir documentos geram operações. Elas permanecem disponíveis localmente até serem reconhecidas pelo servidor.",
        ],
      },
      {
        heading: "Quando a conexão volta",
        paragraphs: [
          "O coordenador acompanha o estado online/offline e tenta sincronizar as operações pendentes. Falhas preservam as alterações locais e podem ser reprocessadas pela área Sincronização.",
        ],
      },
    ],
  },
  crdt: {
    category: "Recursos",
    title: "Tecnologia CRDT",
    description: "Entenda a base distribuída usada pelo SyncLab.",
    sections: [
      {
        heading: "O conceito",
        paragraphs: [
          "CRDT significa Conflict-free Replicated Data Type: estruturas replicadas que podem receber mudanças em diferentes clientes e convergir para um estado consistente sem depender de bloqueios centrais.",
        ],
      },
      {
        heading: "Relação com o SyncLab",
        paragraphs: [
          "No código atual, o SyncLab usa operações imutáveis, snapshots e Vector Clocks por dispositivo como base do mecanismo distribuído. O Vector Clock é uma primitiva de causalidade — não um CRDT sozinho — e permite transportar e comparar mudanças sem perder sua origem causal.",
        ],
      },
      {
        heading: "Limite importante",
        paragraphs: [
          "O código atual expõe o mecanismo de operações, snapshots e clocks; a UI não oferece indicadores de presença ou cursores colaborativos. A documentação não trata esses recursos como disponíveis.",
        ],
      },
    ],
  },
  sync: {
    category: "Recursos",
    title: "Sincronização",
    description: "Como os dados permanecem sincronizados entre dispositivos.",
    sections: [
      {
        heading: "Fluxo do cliente",
        paragraphs: [
          "O cliente reúne operações pendentes e snapshots e envia um POST para /sync, usando credentials include e o deviceId no corpo e no cabeçalho x-device-id. O servidor devolve operações aceitas, operações ausentes e snapshots.",
        ],
      },
      {
        heading: "Identidade e causalidade",
        paragraphs: [
          "Cada instalação mantém um deviceId no localStorage. As operações carregam esse identificador e um Vector Clock, que registra contadores lógicos por dispositivo e identifica eventos concorrentes.",
        ],
      },
      {
        heading: "Confirmação e idempotência",
        paragraphs: [
          "A resposta bem-sucedida reconhece os IDs enviados no lote por acknowledgedOperationIds, mesmo quando uma operação já existia no servidor. Isso permite retirar pendências sem duplicar operações.",
        ],
      },
      {
        heading: "Falhas",
        paragraphs: [
          "Erros HTTP ou respostas inválidas são tratados como falha de sincronização. As alterações locais permanecem preservadas; o estado pode ser acompanhado na Central de Sincronização e uma nova tentativa pode ser feita quando apropriado.",
        ],
      },
    ],
  },
  "keyboard-shortcuts": {
    category: "Referência",
    title: "Atalhos de teclado",
    description: "Lista dos atalhos implementados no SyncLab.",
    sections: [
      {
        heading: "Paleta de comandos",
        paragraphs: [
          "macOS: ⌘K. Windows/Linux: Ctrl+K. O atalho abre a Paleta de comandos global, inclusive a partir das páginas da área autenticada.",
        ],
      },
      {
        heading: "Navegação na paleta",
        paragraphs: [
          "Com a paleta aberta, use ↑ e ↓ para mudar a seleção, Enter para executar e Escape para fechar.",
        ],
      },
      {
        heading: "Editor",
        paragraphs: [
          "O título aceita Enter para mover o foco para o conteúdo. Não há outros atalhos globais de formatação implementados além das ações disponíveis na barra do editor.",
        ],
      },
    ],
  },
  "command-palette": {
    category: "Referência",
    title: "Paleta de comandos",
    description: "Domine ⌘K / Ctrl+K e as ações disponíveis.",
    sections: [
      {
        heading: "Abrir e fechar",
        paragraphs: [
          "Pressione ⌘K no macOS ou Ctrl+K no Windows/Linux. Escape fecha a paleta sem executar uma ação.",
        ],
      },
      {
        heading: "Comandos disponíveis",
        bullets: [
          "Novo documento — cria e abre um documento quando você está autenticado.",
          "Pesquisar documentos — abre Documentos.",
          "Abrir recentes — abre o painel inicial.",
          "Sincronizar agora — dispara a ação visual de sincronização disponível na paleta.",
          "Ver histórico — navega para a rota de histórico prevista pelo comando.",
          "Configurações — abre Configurações.",
        ],
        paragraphs: [
          "Digite parte do nome ou ID para filtrar os comandos. Use as setas para mudar a seleção, clique em um resultado ou pressione Enter para executá-lo.",
        ],
      },
    ],
  },
  markdown: {
    category: "Referência",
    title: "Suporte a Markdown",
    description: "Sintaxe compatível com a pré-visualização do editor.",
    sections: [
      {
        heading: "Blocos",
        bullets: [
          "# Título, ## Seção e ### Subseção",
          "Parágrafos separados por linhas em branco",
          "Blocos de código cercados por três crases, com linguagem opcional",
        ],
        paragraphs: [
          "A pré-visualização interpreta os blocos diretamente no frontend.",
        ],
      },
      {
        heading: "Formatação inline",
        bullets: [
          "**negrito**",
          "*itálico*",
          "`código inline`",
          "[link](https://exemplo.com)",
        ],
        paragraphs: [
          "Links são abertos em uma nova aba. A implementação atual não inclui listas, tabelas, imagens ou outras extensões além das sintaxes listadas.",
        ],
      },
    ],
  },
};

const slugs = Object.keys(articles);

export const HelpArticlePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const article = slug ? articles[slug] : undefined;
  const index = slug ? slugs.indexOf(slug) : -1;
  const previous = index > 0 ? slugs[index - 1] : undefined;
  const next =
    index >= 0 && index < slugs.length - 1 ? slugs[index + 1] : undefined;

  if (!article)
    return (
      <div className="min-h-screen bg-[var(--background)] p-8 text-[var(--text-primary)]">
        Artigo não encontrado.
      </div>
    );

  return (
    <div className="help-article-page flex min-h-screen overflow-hidden bg-[var(--background)]">
      <AppNavigation />
      <main className="help-article-main flex-1 overflow-y-auto">
        <article className="help-article-content mx-auto max-w-4xl px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
          <Link to="/app/help" className="help-article-back">
            ← Voltar para Ajuda e documentação
          </Link>
          <p className="help-article-category">{article.category}</p>
          <h1>{article.title}</h1>
          <p className="help-article-description">{article.description}</p>
          <div className="help-article-sections">
            {article.sections.map((section) => (
              <section key={section.heading} className="help-article-section">
                <h2>{section.heading}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.bullets && (
                  <ul>
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
          <nav
            className="help-article-pagination"
            aria-label="Navegação entre artigos"
          >
            {previous ? (
              <Link to={`/app/help/${previous}`}>← Anterior</Link>
            ) : (
              <span />
            )}
            {next ? <Link to={`/app/help/${next}`}>Próximo →</Link> : <span />}
          </nav>
        </article>
      </main>
    </div>
  );
};
