import React, { useState } from "react";
import { Link } from "react-router-dom";

interface EditorHeaderProps {
  title: string;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({ title }) => {
  const [shareOpen, setShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleShare = () => {
    setShareOpen(!shareOpen);
    setMenuOpen(false);
  };

  const handleMenu = () => {
    setMenuOpen(!menuOpen);
    setShareOpen(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setShareOpen(false);
    // Could show a toast notification here
  };

  return (
    <div className="h-16 border-b border-[#464554] bg-[#13131b] px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Left - Title and Metadata */}
      <Link to="/app" className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
        <div className="w-6 h-6 relative">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
          >
            <path
              d="M12 2L8 8L12 14L16 8Z"
              fill="#C0C1FF"
              opacity="0.8"
            />
            <path
              d="M12 10L16 16L20 10L16 14Z"
              fill="#8083FF"
              opacity="0.9"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-semibold text-[#e4e1ed]">{title}</h1>
          <p className="text-xs text-[#908fa0] mt-1">Saved locally</p>
        </div>
      </Link>

      {/* Right - Status, Share, Menu, Avatar */}
      <div className="flex items-center gap-4">
        {/* Status Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1f1f27] border border-[#464554]">
          <div
            className="w-2 h-2 rounded-full bg-[#10b981]"
            style={{
              boxShadow: "0 0 8px rgba(16,185,129,0.5)",
            }}
          />
          <span className="text-xs text-[#e4e1ed]">Saved locally</span>
        </div>

        {/* Share Button */}
        <div className="relative">
          <button
            onClick={handleShare}
            className="bg-[#c0c1ff] text-[#1000a9] px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity hidden sm:block flex items-center gap-2"
          >
            Share
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M19 12H5" />
            </svg>
          </button>
          
          {shareOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-[#1b1b23] border border-[#464554] rounded-lg shadow-lg py-2 z-50 animate-fade-in">
              <button
                onClick={copyLink}
                className="w-full px-4 py-2 text-left text-sm text-[#e4e1ed] hover:bg-[#292932] flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy link
              </button>
              <div className="border-t border-[#464554] my-2" />
              <button className="w-full px-4 py-2 text-left text-sm text-[#e4e1ed] hover:bg-[#292932] flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Invite people
              </button>
            </div>
          )}
        </div>

        {/* Menu Button */}
        <div className="relative">
          <button
            onClick={handleMenu}
            className="p-2 hover:bg-[#1f1f27] rounded transition-colors text-[#c7c4d7]"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
          
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-[#1b1b23] border border-[#464554] rounded-lg shadow-lg py-2 z-50 animate-fade-in">
              <Link
                to="/app"
                className="block px-4 py-2 text-left text-sm text-[#e4e1ed] hover:bg-[#292932]"
                onClick={() => setMenuOpen(false)}
              >
                Go to Dashboard
              </Link>
              <Link
                to="/app/documents"
                className="block px-4 py-2 text-left text-sm text-[#e4e1ed] hover:bg-[#292932]"
                onClick={() => setMenuOpen(false)}
              >
                All Documents
              </Link>
              <div className="border-t border-[#464554] my-2" />
              <Link
                to="/app/settings"
                className="block px-4 py-2 text-left text-sm text-[#e4e1ed] hover:bg-[#292932]"
                onClick={() => setMenuOpen(false)}
              >
                Settings
              </Link>
              <Link
                to="/app/help"
                className="block px-4 py-2 text-left text-sm text-[#e4e1ed] hover:bg-[#292932]"
                onClick={() => setMenuOpen(false)}
              >
                Help
              </Link>
            </div>
          )}
        </div>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#c0c1ff] to-[#8083ff] flex items-center justify-center text-white text-xs font-bold">
          U
        </div>
      </div>
    </div>
  );
};
