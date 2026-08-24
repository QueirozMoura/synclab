import React from "react";

interface EditorToolbarProps {
  onH1: () => void;
  onH2: () => void;
  onBold: () => void;
  onItalic: () => void;
  onCode: () => void;
  onLink: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  onH1,
  onH2,
  onBold,
  onItalic,
  onCode,
  onLink,
}) => {
  const [hoverAction, setHoverAction] = React.useState<string | null>(null);

  const toolbarGroups = [
    {
      id: "headings",
      label: "Hierarquia",
      actions: [
        { id: "h1", label: "Título 1", icon: "H1", onClick: onH1 },
        { id: "h2", label: "Título 2", icon: "H2", onClick: onH2 },
      ],
    },
    {
      id: "formatting",
      label: "Formatação",
      actions: [
        { id: "bold", label: "Negrito", icon: "B", onClick: onBold },
        { id: "italic", label: "Itálico", icon: "I", onClick: onItalic },
        { id: "code", label: "Código", icon: "</>", onClick: onCode },
      ],
    },
    {
      id: "insert",
      label: "Inserir",
      actions: [{ id: "link", label: "Inserir link", icon: "link", onClick: onLink }],
    },
  ];

  return (
    <div className="editor-toolbar-shell fixed bottom-8 left-1/2 z-30 -translate-x-1/2">
      <div
        className="editor-toolbar-surface "

        role="toolbar"
        aria-label="Ferramentas de formatação"
      >
        {toolbarGroups.map((group, groupIndex) => (
          <div key={group.id} className="editor-toolbar-group" aria-label={group.label}>
            {group.actions.map((action) => (
              <button
                type="button"
                key={action.id}
                onClick={action.onClick}
                onMouseEnter={() => setHoverAction(action.id)}
                onMouseLeave={() => setHoverAction(null)}
                className={`editor-toolbar-button ${hoverAction === action.id ? "is-hovered" : ""}`}
                aria-label={action.label}
                title={action.label}
              >
                {action.icon === "link" ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M10 13a5 5 0 0 0 7.07.07l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15" />
                    <path d="M14 11a5 5 0 0 0-7.07-.07l-2 2A5 5 0 0 0 7 20l1.15-1.15" />
                  </svg>
                ) : action.icon}
              </button>
            ))}
            {groupIndex < toolbarGroups.length - 1 && <span className="editor-toolbar-divider" aria-hidden="true" />}
          </div>
        ))}
      </div>
    </div>
  );
};
