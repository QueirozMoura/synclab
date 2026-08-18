import React from "react";

interface WorkspaceSidebarProps {
  onSelectDocument: (docName: string) => void;
  activeDocument: string;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  onSelectDocument,
  activeDocument,
}) => {
  const documents = [
    "Roadmap 2024",
    "Architecture",
    "API Specs",
    "Meeting Notes",
  ];

  return (
    <div className="hidden md:flex md:w-64 flex-col bg-[#13131b] border-r border-[#464554] overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-[#464554] flex items-center justify-between sticky top-0 bg-[#13131b]">
        <p className="text-xs font-semibold text-[#908fa0] uppercase tracking-wider">
          Engineering
        </p>
        <button className="text-[#c0c1ff] hover:bg-[#1f1f27] p-1 rounded transition-colors">
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Documents List */}
      <nav className="flex-1 p-2 space-y-1">
        {documents.map((doc) => (
          <button
            key={doc}
            onClick={() => onSelectDocument(doc)}
            className={`w-full text-left px-3 py-2.5 rounded text-sm transition-colors relative ${
              activeDocument === doc
                ? "bg-[#292932] text-[#e4e1ed]"
                : "text-[#c7c4d7] hover:bg-[#1f1f27]"
            }`}
          >
            {activeDocument === doc && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#c0c1ff] rounded-r" />
            )}
            <span className={activeDocument === doc ? "pl-2" : ""}>
              {doc}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
};
