import React from "react";
import { ActivityItem } from "./ActivityItem";
import { useDocuments } from "../../hooks/useDocuments";

export const ActivityPanel: React.FC = () => {
  const { activity } = useDocuments();
  const activities = activity.map((event) => ({
    title: event.type === "DOCUMENT_CREATED" ? `Você criou ${event.documentTitle ?? "um documento"}` : event.type === "DOCUMENT_UPDATED" ? `Você editou ${event.documentTitle ?? "um documento"}` : event.type === "SYNC_COMPLETED" ? "Sincronização concluída" : event.type === "SYNC_FAILED" ? "Sincronização falhou" : "Sincronização iniciada",
    timeAgo: new Date(event.timestamp).toLocaleString("pt-BR"),
    dotColor: event.type === "SYNC_COMPLETED" ? "#10b981" : event.type === "SYNC_FAILED" ? "#ffb4ab" : "#c0c1ff",
  }));
  if (activities.length === 0) activities.push({ title: "Nenhuma atividade recente", timeAgo: "", dotColor: "#34343d" });

  return (
    <div className="dashboard-activity-panel h-full rounded-2xl flex flex-col">
      {/* Header */}
      <div className="dashboard-panel-header p-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#c7c4d7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l4 2" />
          </svg>
          <h3 className="text-base font-semibold text-[#f7f4fb]">Atividade</h3>
        </div>
        <svg className="w-5 h-5 text-[#908fa0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-5 space-y-0">
        {activities.map((activity, index) => (
          <ActivityItem
            key={index}
            title={activity.title}
            timeAgo={activity.timeAgo}
            dotColor={activity.dotColor}
            isLast={index === activities.length - 1}
          />
        ))}
      </div>

      {/* Load more */}
      <div className="dashboard-panel-footer p-5">
        <button className="dashboard-text-button w-full text-center text-sm py-2">
          Carregar mais
        </button>
      </div>
    </div>
  );
};