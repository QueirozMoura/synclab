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
      actions: [
        { id: "h1", label: "H1", icon: "H1", onClick: onH1 },
        { id: "h2", label: "H2", icon: "H2", onClick: onH2 },
      ],
    },
    {
      id: "formatting",
      actions: [
        { id: "bold", label: "Negrito", icon: "B", onClick: onBold },
        { id: "italic", label: "Itálico", icon: "I", onClick: onItalic },
        { id: "code", label: "Código", icon: "</>", onClick: onCode },
      ],
    },
    {
      id: "insert",
      actions: [{ id: "link", label: "Link", icon: "🔗", onClick: onLink }],
    },
  ];

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-30">
      <div
        className="bg-[#1f1f27] border border-[#464554] rounded-full px-2 py-2 flex items-center gap-1 backdrop-blur-md"
        style={{
          boxShadow: "0 16px 32px rgba(0,0,0,0.4)",
        }}
      >
        {toolbarGroups.map((group, groupIndex) => (
          <div key={group.id} className="flex items-center gap-1">
            {group.actions.map((action) => (
              <button
                key={action.id}
                onClick={action.onClick}
                onMouseEnter={() => setHoverAction(action.id)}
                onMouseLeave={() => setHoverAction(null)}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  hoverAction === action.id
                    ? "bg-[#292932] text-[#c0c1ff]"
                    : "text-[#c7c4d7] hover:bg-[#292932]"
                }`}
                title={action.label}
              >
                {action.icon}
              </button>
            ))}
            {groupIndex < toolbarGroups.length - 1 && (
              <div className="w-px h-6 bg-[#464554] mx-1" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
