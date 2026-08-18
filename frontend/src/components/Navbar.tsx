import React from "react";

interface NavbarProps {
  onOpenApp?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenApp }) => {
  return (
    <nav className="fixed top-0 w-full z-50 border-line glass-effect">
      <div className="container-main h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 relative">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full"
            >
              {/* Left segment - Primary color */}
              <path
                d="M12 2L8 8L12 14L16 8Z"
                fill="#C0C1FF"
                opacity="0.8"
              />
              {/* Right segment - Primary container */}
              <path
                d="M12 10L16 16L20 10L16 14Z"
                fill="#8083FF"
                opacity="0.9"
              />
            </svg>
          </div>
          <span className="text-base font-semibold text-[#E4E1ED]">
            Synclab
          </span>
        </div>

        {/* Center Navigation - Desktop only */}
        <div className="hidden md:flex items-center gap-8">
          <a
            href="#features"
            className="text-[#C7C4D7] text-sm hover:text-[#E4E1ED] transition-colors"
          >
            Features
          </a>
          <a
            href="#architecture"
            className="text-[#C7C4D7] text-sm hover:text-[#E4E1ED] transition-colors"
          >
            Architecture
          </a>
          <a
            href="#docs"
            className="text-[#C7C4D7] text-sm hover:text-[#E4E1ED] transition-colors"
          >
            Docs
          </a>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <button className="text-[#C7C4D7] text-sm hover:text-[#E4E1ED] transition-colors hidden sm:block">
            Log in
          </button>
          <button 
            onClick={onOpenApp}
            className="btn-primary text-sm"
          >
            Open App
          </button>
        </div>
      </div>
    </nav>
  );
};
