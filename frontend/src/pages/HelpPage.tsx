import React from "react";
import { GlobalSidebar } from "../components/app/GlobalSidebar";
import { Link } from "react-router-dom";

export const HelpPage: React.FC = () => {
  return (
    <div className="flex h-screen bg-[#09090B] overflow-hidden">
      <GlobalSidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-8 py-12">
            <h1 className="text-3xl font-bold text-[#e4e1ed] mb-8">Ajuda e documentação</h1>
            
            <div className="space-y-6">
              <section className="bg-[#151517] border border-[#27272A] rounded-xl p-6">
                <h2 className="text-lg font-semibold text-[#e4e1ed] mb-4">Primeiros passos</h2>
                <div className="space-y-3">
                  <Link
                    to="/help/getting-started"
                    className="block p-4 bg-[#1b1b23] border border-[#27272A] rounded-lg hover:border-[#464554] transition-colors"
                  >
                    <h3 className="font-medium text-[#e4e1ed] mb-1">Guia de início rápido</h3>
                    <p className="text-sm text-[#c7c4d7]">Aprenda o básico do Synclab em 5 minutos</p>
                  </Link>
                  <Link
                    to="/help/creating-documents"
                    className="block p-4 bg-[#1b1b23] border border-[#27272A] rounded-lg hover:border-[#464554] transition-colors"
                  >
                    <h3 className="font-medium text-[#e4e1ed] mb-1">Criar documentos</h3>
                    <p className="text-sm text-[#c7c4d7]">Como criar e organizar seus documentos</p>
                  </Link>
                  <Link
                    to="/help/collaboration"
                    className="block p-4 bg-[#1b1b23] border border-[#27272A] rounded-lg hover:border-[#464554] transition-colors"
                  >
                    <h3 className="font-medium text-[#e4e1ed] mb-1">Colaboração em tempo real</h3>
                    <p className="text-sm text-[#c7c4d7]">Trabalhe com outras pessoas no mesmo documento</p>
                  </Link>
                </div>
              </section>
              
              <section className="bg-[#151517] border border-[#27272A] rounded-xl p-6">
                <h2 className="text-lg font-semibold text-[#e4e1ed] mb-4">Recursos</h2>
                <div className="space-y-3">
                  <Link
                    to="/help/offline-first"
                    className="block p-4 bg-[#1b1b23] border border-[#27272A] rounded-lg hover:border-[#464554] transition-colors"
                  >
                    <h3 className="font-medium text-[#e4e1ed] mb-1">Edição offline-first</h3>
                    <p className="text-sm text-[#c7c4d7]">Como o Synclab funciona sem internet</p>
                  </Link>
                  <Link
                    to="/help/crdt"
                    className="block p-4 bg-[#1b1b23] border border-[#27272A] rounded-lg hover:border-[#464554] transition-colors"
                  >
                    <h3 className="font-medium text-[#e4e1ed] mb-1">Tecnologia CRDT</h3>
                    <p className="text-sm text-[#c7c4d7]">Entenda os tipos de dados replicados livres de conflitos</p>
                  </Link>
                  <Link
                    to="/help/sync"
                    className="block p-4 bg-[#1b1b23] border border-[#27272A] rounded-lg hover:border-[#464554] transition-colors"
                  >
                    <h3 className="font-medium text-[#e4e1ed] mb-1">Sincronização</h3>
                    <p className="text-sm text-[#c7c4d7]">Como seus dados permanecem sincronizados entre dispositivos</p>
                  </Link>
                </div>
              </section>
              
              <section className="bg-[#151517] border border-[#27272A] rounded-xl p-6">
                <h2 className="text-lg font-semibold text-[#e4e1ed] mb-4">Referência</h2>
                <div className="space-y-3">
                  <Link
                    to="/help/keyboard-shortcuts"
                    className="block p-4 bg-[#1b1b23] border border-[#27272A] rounded-lg hover:border-[#464554] transition-colors"
                  >
                    <h3 className="font-medium text-[#e4e1ed] mb-1">Atalhos de teclado</h3>
                    <p className="text-sm text-[#c7c4d7]">Lista completa de atalhos de teclado</p>
                  </Link>
                  <Link
                    to="/help/command-palette"
                    className="block p-4 bg-[#1b1b23] border border-[#27272A] rounded-lg hover:border-[#464554] transition-colors"
                  >
                    <h3 className="font-medium text-[#e4e1ed] mb-1">Paleta de comandos</h3>
                    <p className="text-sm text-[#c7c4d7]">Domine os atalhos ⌘K / Ctrl+K</p>
                  </Link>
                  <Link
                    to="/help/markdown"
                    className="block p-4 bg-[#1b1b23] border border-[#27272A] rounded-lg hover:border-[#464554] transition-colors"
                  >
                    <h3 className="font-medium text-[#e4e1ed] mb-1">Suporte a Markdown</h3>
                    <p className="text-sm text-[#c7c4d7]">Sintaxe e extensões Markdown compatíveis</p>
                  </Link>
                </div>
              </section>
              
              <section className="bg-[#151517] border border-[#27272A] rounded-xl p-6">
                <h2 className="text-lg font-semibold text-[#e4e1ed] mb-4">Suporte</h2>
                <div className="space-y-3">
                  <a
                    href="https://github.com/synclab/synclab/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 bg-[#1b1b23] border border-[#27272A] rounded-lg hover:border-[#464554] transition-colors flex items-center gap-3"
                  >
                    <svg className="w-5 h-5 text-[#c0c1ff]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.45-1.15-1.11-1.46-1.11-1.46-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12c0-5.52-4.48-10-10-10z"/>
                    </svg>
                    <div>
                      <h3 className="font-medium text-[#e4e1ed] mb-1">Relatar um problema</h3>
                      <p className="text-sm text-[#c7c4d7]">Envie um relatório de bug no GitHub</p>
                    </div>
                  </a>
                  <a
                    href="https://discord.gg/synclab"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 bg-[#1b1b23] border border-[#27272A] rounded-lg hover:border-[#464554] transition-colors flex items-center gap-3"
                  >
                    <svg className="w-5 h-5 text-[#c0c1ff]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.38-.444.873-.598 1.438-.442 1.663-.442 3.578 0 5.332-.126.514-.33 1.018-.567 1.414a.077.077 0 0 0 .032.097c.217.035 1.259.198 2.693.335.868.08 1.693.055 2.319-.194a.077.077 0 0 0 .032-.098c-.155-.397-.37-.83-.58-1.273C21.431 7.49 20.97 5.81 20.317 4.37zm-13.942 5.497c-.072.416-.137.796-.155 1.077-.06 1.131-.094 2.707-.094 3.157 0 .268.212.465.453.415.39-.08 1.541-.733 3.363-2.188.043-.036.085-.054.127-.054.275 0 .577.075.86.22.174.087.347.18.506.272a13.065 13.065 0 0 1 .737.072c1.055-.01 2.09-.055 2.772-.312.14-.05.268-.1.382-.175a.07.07 0 0 0 .014-.1c-.093-.175-.367-.78-.516-1.091-.12-.25-.23-.507-.297-.743a.064.064 0 0 0-.084-.014c-1.21.417-2.52.693-3.753.71-.08.002-.146-.046-.17-.11a.127.127 0 0 0-.005-.146c.224-.624.374-1.345.374-2.027 0-.312-.063-.626-.138-.905a.12.12 0 0 0-.142-.062c-.287.033-.572.074-.85.102-.627.068-1.272.115-1.95.09a.068.068 0 0 0-.06-.02c-.38-.003-.752-.023-1.108-.074a.09.09 0 0 0-.04-.006.09.09 0 0 0-.045.013 10.55 10.55 0 0 0-.935.305c-.26.148-.484.34-.63.536a.07.07 0 0 0-.008.117c.078.176.28.69.39 1.102.056.203.083.35.104.531a.1.1 0 0 1-.094.128zm3.993 8.907c-.168.496-.26 1.107-.215 1.609.048.53.222 1.143.508 1.583a.06.06 0 0 0 .084.017c.17-.042.4-.117.625-.218a7.9 7.9 0 0 0 .916-.431.06.06 0 0 0 .01-.103c-.188-.39-.396-.76-.433-1.14a.058.058 0 0 0-.08-.024c-.224.028-.463.037-.69.03-.086 0-.173-.006-.258-.01a16.3 16.3 0 0 1-1.038-.289.056.056 0 0 0-.079-.007.053.053 0 0 0-.024.084c.188.42.406.82.455 1.247a.057.057 0 0 1-.085.068zm9.206.005c-.202.377-.407.765-.455 1.164a.062.062 0 0 1-.084-.068c.05-.427.268-.827.455-1.247a.053.053 0 0 0-.024-.084.056.056 0 0 0-.079.007c-.217.06-.448.114-.69.164a.064.064 0 0 0-.03.11c.054.41.233.777.433 1.14a.06.06 0 0 0 .01.103c.187.118.397.22.625.218a.06.06 0 0 0 .084-.017c.286-.44.46-1.053.508-1.583.045-.502-.047-1.113-.215-1.609a.1.1 0 0 1-.094-.128z"/>
                    </svg>
                    <div>
                      <h3 className="font-medium text-[#e4e1ed] mb-1">Entrar no Discord</h3>
                      <p className="text-sm text-[#c7c4d7]">Converse com a comunidade</p>
                    </div>
                  </a>
                  <a
                    href="mailto:support@synclab.io"
                    className="block p-4 bg-[#1b1b23] border border-[#27272A] rounded-lg hover:border-[#464554] transition-colors flex items-center gap-3"
                  >
                    <svg className="w-5 h-5 text-[#c0c1ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    <div>
                      <h3 className="font-medium text-[#e4e1ed] mb-1">Suporte por e-mail</h3>
                      <p className="text-sm text-[#c7c4d7]">support@synclab.io</p>
                    </div>
                  </a>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};