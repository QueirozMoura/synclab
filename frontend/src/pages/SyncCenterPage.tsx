import React, { useState } from "react";
import { DashboardSidebar } from "../components/dashboard/DashboardSidebar";
import { MobileTopbar } from "../components/dashboard/MobileTopbar";
import { useDocuments } from "../hooks/useDocuments";
import { ActivityPanel } from "../components/dashboard/ActivityPanel";

const localizeSyncError = (message: string): string => {
  if (message === "Invalid sync response") return "Resposta de sincronização inválida";
  if (message === "SyncTransport not configured. Call setTransport() before sync().") {
    return "Transporte de sincronização não configurado.";
  }
  if (message.startsWith("HTTP error ")) return message.replace("HTTP error", "Erro HTTP");
  if (message.toLowerCase().includes("network")) return "Não foi possível conectar à rede.";
  return message;
};

export const SyncCenterPage: React.FC = () => {
  const {
    documents,
    syncDocuments,
    getLastSyncError,
    getLastSuccessfulSyncAt,
    getLastSyncResult,
    isOnline,
    getPendingOperationsForDocument,
    activity = [],
  } = useDocuments();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSyncPending, setIsSyncPending] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<"idle" | "success" | "error">("idle");
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleSyncClick = async () => {
    if (isSyncPending || !isOnline) return;

    setIsSyncPending(true);
    setSyncFeedback("idle");
    setSyncErrorMessage(null);

    try {
      await syncDocuments();
      setSyncFeedback("success");
    } catch {
      const lastError = getLastSyncError();
      setSyncFeedback("error");
      setSyncErrorMessage(lastError?.message ?? "Erro ao sincronizar");
    } finally {
      setIsSyncPending(false);
    }
  };

  const pendingCount = documents.reduce((total, doc) => total + (getPendingOperationsForDocument?.(doc.id) ?? 0), 0);
  
  let currentStatus: "offline" | "syncing" | "pending" | "error" | "synced" = "synced";
  if (!isOnline) {
    currentStatus = "offline";
  } else if (isSyncPending) {
    currentStatus = "syncing";
  } else if (syncFeedback === "error") {
    currentStatus = "error";
  } else if (pendingCount > 0) {
    currentStatus = "pending";
  }

  const statusConfig = {
    synced: {
      title: "Sincronizado",
      desc: "Todos os dados locais estão sincronizados.",
      color: "text-[#34d399]", // emerald-400
      bg: "bg-[#34d399]/10",
      border: "border-[#10b981]/20",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )
    },
    syncing: {
      title: "Sincronizando",
      desc: "Enviando alterações e atualizando dados locais...",
      color: "text-[#60a5fa]", // blue-400
      bg: "bg-[#60a5fa]/10",
      border: "border-[#3b82f6]/20",
      icon: (
        <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      )
    },
    pending: {
      title: "Pendente",
      desc: `Existem ${pendingCount} ${pendingCount === 1 ? "operação aguardando sincronização" : "operações aguardando sincronização"}.`,
      color: "text-[#fbbf24]", // amber-400
      bg: "bg-[#fbbf24]/10",
      border: "border-[#f59e0b]/20",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    error: {
      title: "Erro de Sincronização",
      desc: syncErrorMessage ? localizeSyncError(syncErrorMessage) : "Não foi possível concluir a sincronização.",
      color: "text-[#f87171]", // red-400
      bg: "bg-[#f87171]/10",
      border: "border-[#ef4444]/20",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    offline: {
      title: "Offline",
      desc: "Você está offline. As alterações estão salvas localmente e serão sincronizadas quando a conexão voltar.",
      color: "text-[#a1a1aa]", // zinc-400
      bg: "bg-[#a1a1aa]/10",
      border: "border-[#71717a]/20",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
  };

  const activeStatus = statusConfig[currentStatus];
  const lastSyncTime = getLastSuccessfulSyncAt();
  const lastResult = getLastSyncResult();
  
  const sentCount = lastResult?.sentOperationIds ? new Set(lastResult.sentOperationIds).size : 0;
  const receivedCount = lastResult?.receivedOperationIds ? new Set(lastResult.receivedOperationIds).size : 0;

  return (
    <div className="dashboard-page flex min-h-[100dvh] overflow-hidden bg-[#15151e] text-white selection:bg-[#c0c1ff] selection:text-[#15151e]">
      <MobileTopbar onMenuClick={toggleSidebar} />
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setSidebarOpen(false)} />
      )}
      <DashboardSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="dashboard-main flex-1 flex flex-col overflow-hidden lg:pl-0">
        <main className="flex-1 overflow-y-auto pb-12">
          <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8 md:py-12">
            
            <header className="mb-12 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#c0c1ff]/10 to-transparent blur-3xl -z-10 rounded-full opacity-50 pointer-events-none" />
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-[#e4e1ed] mb-2">Centro de Sincronização</h1>
                  <p className="text-[#908fa0] text-sm max-w-xl leading-relaxed">
                    Acompanhe o fluxo de sincronização offline-first do seu workspace. Suas alterações são sempre gravadas localmente primeiro.
                  </p>
                </div>
                
                <button
                  onClick={handleSyncClick}
                  disabled={isSyncPending || !isOnline}
                  className={`
                    flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 min-w-[160px]
                    ${!isOnline ? "bg-[#2a2a35] text-[#908fa0] cursor-not-allowed" : 
                      isSyncPending ? "bg-[#303040] text-[#c0c1ff] shadow-[0_0_15px_rgba(192,193,255,0.15)]" : 
                      "bg-[#c0c1ff] text-[#15151e] hover:bg-[#d6d6ff] shadow-[0_4px_14px_rgba(192,193,255,0.25)] hover:shadow-[0_6px_20px_rgba(192,193,255,0.4)] hover:-translate-y-0.5"}
                  `}
                >
                  {isSyncPending ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21v-5h5" /></svg>
                      Sincronizar agora
                    </>
                  )}
                </button>
              </div>
            </header>

            <section className={`mb-12 p-6 rounded-2xl border ${activeStatus.border} ${activeStatus.bg} transition-colors duration-500`}>
              <div className="flex items-start gap-4">
                <div className={`mt-1 ${activeStatus.color}`}>
                  {activeStatus.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className={`text-lg font-semibold ${activeStatus.color} mb-1`}>
                    {activeStatus.title}
                  </h2>
                  <p className="text-[#cbc8d6] text-sm mb-4">
                    {activeStatus.desc}
                  </p>
                  
                  {lastSyncTime && (
                    <div className="flex items-center gap-2 text-xs text-[#908fa0]">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Última sincronização: {new Date(lastSyncTime).toLocaleString("pt-BR")}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="mb-12">
              <h3 className="text-sm font-medium text-[#908fa0] uppercase tracking-wider mb-6">Fluxo de Dados</h3>
              
              <div className="bg-[#1b1b26] border border-[#2a2a35] rounded-2xl p-6 sm:p-10 relative overflow-hidden">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-2">
                  
                  <div className="flex flex-col items-center z-10 w-full md:w-32">
                    <div className="w-16 h-16 rounded-2xl bg-[#2a2a35] border border-[#464554] flex items-center justify-center shadow-lg relative">
                      <svg className="w-7 h-7 text-[#e4e1ed]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>
                      {currentStatus === "offline" && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#71717a] rounded-full border-2 border-[#1b1b26]" />}
                      {currentStatus !== "offline" && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#10b981] rounded-full border-2 border-[#1b1b26]" />}
                    </div>
                    <p className="mt-3 text-sm font-medium text-[#e4e1ed] text-center">Este Dispositivo</p>
                    <p className="text-xs text-[#908fa0] text-center mt-1">IndexedDB</p>
                  </div>

                  <div className="hidden md:flex flex-1 items-center justify-center relative h-10">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t-2 border-dashed border-[#464554]"></div>
                    </div>
                    {(isSyncPending || pendingCount > 0) && (
                      <div className={`absolute w-3 h-3 rounded-full bg-[#fbbf24] shadow-[0_0_8px_rgba(251,191,36,0.8)] motion-safe:animate-[slideRight_2s_ease-in-out_infinite] ${!isSyncPending ? "opacity-50 motion-safe:animate-none left-1/2 -translate-x-1/2" : ""}`} />
                    )}
                  </div>
                  <div className="md:hidden flex flex-col items-center justify-center py-2 h-10 w-full relative">
                      <div className="h-full border-l-2 border-dashed border-[#464554]"></div>
                  </div>

                  <div className="flex flex-col items-center z-10 w-full md:w-32">
                    <div className={`w-16 h-16 rounded-2xl bg-[#2a2a35] border ${pendingCount > 0 ? "border-[#f59e0b]/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]" : "border-[#464554]"} flex items-center justify-center relative`}>
                      <svg className={`w-7 h-7 ${pendingCount > 0 ? "text-[#fbbf24]" : "text-[#e4e1ed]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                      {pendingCount > 0 && (
                        <div className="absolute -top-2 -right-2 bg-[#fbbf24] text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-[#1b1b26]">
                          {pendingCount}
                        </div>
                      )}
                    </div>
                    <p className="mt-3 text-sm font-medium text-[#e4e1ed] text-center">Fila Local</p>
                    <p className="text-xs text-[#908fa0] text-center mt-1">{pendingCount > 0 ? "Aguardando envio" : "Fila limpa"}</p>
                  </div>

                  <div className="hidden md:flex flex-1 items-center justify-center relative h-10">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t-2 border-dashed border-[#464554]"></div>
                    </div>
                    {isSyncPending && (
                      <div className="absolute w-3 h-3 rounded-full bg-[#c0c1ff] shadow-[0_0_8px_rgba(192,193,255,0.8)] motion-safe:animate-[slideRight_2s_ease-in-out_infinite]" />
                    )}
                    {!isOnline && (
                      <div className="absolute bg-[#1b1b26] p-1 text-[#ef4444]">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </div>
                    )}
                  </div>
                  <div className="md:hidden flex flex-col items-center justify-center py-2 h-10 w-full relative">
                      <div className="h-full border-l-2 border-dashed border-[#464554]"></div>
                      {!isOnline && (
                        <div className="absolute bg-[#1b1b26] p-1 text-[#ef4444]">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </div>
                      )}
                  </div>

                  <div className="flex flex-col items-center z-10 w-full md:w-32">
                    <div className={`w-16 h-16 rounded-2xl bg-[#2a2a35] border ${isSyncPending ? "border-[#c0c1ff] shadow-[0_0_20px_rgba(192,193,255,0.2)]" : "border-[#464554]"} flex items-center justify-center relative`}>
                      <svg className={`w-7 h-7 ${isSyncPending ? "text-[#c0c1ff]" : "text-[#e4e1ed]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
                    </div>
                    <p className="mt-3 text-sm font-medium text-[#e4e1ed] text-center">Servidor</p>
                    <p className="text-xs text-[#908fa0] text-center mt-1">Sincronizado</p>
                  </div>

                </div>
              </div>
              <style>{`
                @keyframes slideRight {
                  0% { left: 10%; opacity: 0; }
                  20% { opacity: 1; transform: scale(1.2); }
                  80% { opacity: 1; transform: scale(1.2); }
                  100% { left: 90%; opacity: 0; }
                }
              `}</style>
            </section>

            <section className="mb-12">
              <h3 className="text-sm font-medium text-[#908fa0] uppercase tracking-wider mb-6">Métricas do Workspace</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#1b1b26] border border-[#2a2a35] rounded-xl p-5 hover:border-[#464554] transition-colors">
                  <div className="text-[#908fa0] text-xs font-medium mb-1 uppercase tracking-wider">Documentos</div>
                  <div className="text-3xl font-bold text-[#e4e1ed]">{documents.length}</div>
                </div>
                
                <div className="bg-[#1b1b26] border border-[#2a2a35] rounded-xl p-5 hover:border-[#464554] transition-colors">
                  <div className="text-[#908fa0] text-xs font-medium mb-1 uppercase tracking-wider">Ops Pendentes</div>
                  <div className={`text-3xl font-bold ${pendingCount > 0 ? "text-[#fbbf24]" : "text-[#e4e1ed]"}`}>{pendingCount}</div>
                </div>

                <div className="bg-[#1b1b26] border border-[#2a2a35] rounded-xl p-5 hover:border-[#464554] transition-colors">
                  <div className="text-[#908fa0] text-xs font-medium mb-1 uppercase tracking-wider">Ops Enviadas (Última)</div>
                  <div className="text-3xl font-bold text-[#e4e1ed]">{sentCount}</div>
                </div>

                <div className="bg-[#1b1b26] border border-[#2a2a35] rounded-xl p-5 hover:border-[#464554] transition-colors">
                  <div className="text-[#908fa0] text-xs font-medium mb-1 uppercase tracking-wider">Ops Recebidas (Última)</div>
                  <div className="text-3xl font-bold text-[#e4e1ed]">{receivedCount}</div>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8">
                <h3 className="text-sm font-medium text-[#908fa0] uppercase tracking-wider mb-6">Informações do Dispositivo</h3>
                <div className="bg-[#1b1b26] border border-[#2a2a35] rounded-2xl p-6">
                  <ul className="space-y-4">
                    <li className="flex items-center justify-between py-2 border-b border-[#2a2a35] last:border-0 last:pb-0">
                      <span className="text-[#908fa0] text-sm">Status da Conexão</span>
                      <span className={`text-sm font-medium flex items-center gap-2 ${isOnline ? "text-[#34d399]" : "text-[#a1a1aa]"}`}>
                        <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-[#34d399] shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-[#71717a]"}`} />
                        {isOnline ? "Conectado" : "Desconectado"}
                      </span>
                    </li>
                    <li className="flex items-center justify-between py-2 border-b border-[#2a2a35] last:border-0 last:pb-0">
                      <span className="text-[#908fa0] text-sm">Motor de Armazenamento</span>
                      <span className="text-sm font-medium text-[#e4e1ed]">IndexedDB Local</span>
                    </li>
                    <li className="flex items-center justify-between py-2 border-b border-[#2a2a35] last:border-0 last:pb-0">
                      <span className="text-[#908fa0] text-sm">Registro de Atividades</span>
                      <span className="text-sm font-medium text-[#e4e1ed]">{activity.length} eventos locais</span>
                    </li>
                    <li className="flex items-center justify-between py-2 border-b border-[#2a2a35] last:border-0 last:pb-0">
                      <span className="text-[#908fa0] text-sm">Motor CRDT</span>
                      <span className="text-sm font-medium text-[#e4e1ed]">Ativo (Resolução automática)</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="lg:col-span-4 h-[400px]">
                <ActivityPanel />
              </div>
            </section>

          </div>
        </main>
      </div>
    </div>
  );
};
