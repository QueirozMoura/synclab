import React from "react";
import { ActivityItem } from "./ActivityItem";
import { useDocuments } from "../../hooks/useDocuments";
import { Link } from "react-router-dom";

export const ActivityPanel: React.FC = () => {
  const { activity } = useDocuments();
  const [visibleCount, setVisibleCount] = React.useState(5);

  const activities = React.useMemo(() => {
    const grouped: Array<{ event: typeof activity[number]; count: number; operationIds: string[] }> = [];
    for (const event of activity) {
      const previous = grouped[grouped.length - 1];
      if (event.type === "DOCUMENT_UPDATED" && previous?.event.type === event.type && previous.event.documentId === event.documentId) {
        previous.count += 1;
        if (event.operationId) previous.operationIds.push(event.operationId);
      } else {
        grouped.push({ event, count: 1, operationIds: event.operationId ? [event.operationId] : [] });
      }
    }
    return grouped.map(({ event, count, operationIds }) => ({
      event,
      operationIds,
      key: `${event.id}-${count}`,
      title: event.type === "DOCUMENT_CREATED" ? `Você criou ${event.documentTitle ?? "um documento"}` : event.type === "DOCUMENT_UPDATED" ? `${count > 1 ? "Você atualizou" : "Você editou"} ${event.documentTitle ?? "um documento"}` : event.type === "SYNC_COMPLETED" ? "Sincronização concluída" : event.type === "SYNC_FAILED" ? "Sincronização falhou" : "Sincronização iniciada",
      timeAgo: count > 1 ? `${count} alterações · ${new Date(event.timestamp).toLocaleString("pt-BR")}` : new Date(event.timestamp).toLocaleString("pt-BR"),
      dotColor: event.type === "SYNC_COMPLETED" ? "#10b981" : event.type === "SYNC_FAILED" ? "#ffb4ab" : "#c0c1ff",
      icon: event.type === "DOCUMENT_UPDATED" ? "✎" : event.type === "SYNC_COMPLETED" ? "✓" : event.type === "SYNC_FAILED" ? "!" : event.type === "DOCUMENT_CREATED" ? "+" : "↻",
    }));
  }, [activity]);
  const visibleActivities = activities.slice(0, visibleCount);
  const hasMore = visibleCount < activities.length;

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
        {visibleActivities.length === 0 ? (
          <ActivityItem title="Nenhuma atividade recente" timeAgo="" dotColor="#34343d" icon="·" isLast />
        ) : visibleActivities.map((item, index) => (
          <ActivityItem
            key={item.key}
            title={item.title}
            timeAgo={item.timeAgo}
            dotColor={item.dotColor}
            icon={item.icon}
            action={item.event.type === "DOCUMENT_UPDATED" && typeof item.event.operationId === "string" && item.event.operationId.length > 0 ? <Link to={`/app/activity/${item.event.id}`} state={{ operationIds: item.operationIds }} className="mt-2 inline-block text-xs font-medium text-[var(--primary)] transition-opacity hover:opacity-75">Ver alterações →</Link> : undefined}
            isLast={index === visibleActivities.length - 1}
          />
        ))}
      </div>

      {hasMore && (
        <div className="dashboard-panel-footer p-5 pt-0">
          <button type="button" className="dashboard-text-button w-full text-center text-sm py-2 rounded-lg transition-all duration-200 hover:bg-white/5 active:scale-[0.98]" onClick={() => setVisibleCount((count) => count + 5)}>
            Carregar mais <span className="text-xs opacity-60">({activities.length - visibleCount})</span>
          </button>
        </div>
      )}
    </div>
  );
};