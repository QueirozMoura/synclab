import React from "react";

export const EditorToolbar: React.FC = () => {
  const [hoverAction, setHoverAction] = React.useState<string | null>(null);

  const toolbarGroups = [
    {
      id: "headings",
      actions: [
        { id: "h1", label: "H1", icon: "H1" },
        { id: "h2", label: "H2", icon: "H2" },
      ],
    },
    {
      id: "formatting",
      actions: [
        { id: "bold", label: "Bold", icon: "B" },
        { id: "italic", label: "Italic", icon: "I" },
        { id: "code", label: "Code", icon: "</>" },
      ],
    },
    {
      id: "insert",
      actions: [{ id: "link", label: "Link", icon: "🔗" }],
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
