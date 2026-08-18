import React from "react";

export const Footer: React.FC = () => {
  return (
    <footer className="border-line bg-[#09090B]">
      <div className="container-main py-12 md:py-16">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Left Side - Logo and Copyright */}
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 relative">
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
            <span className="text-sm text-[#C7C4D7]">© 2026 Synclab</span>
          </div>

          {/* Right Side - Links */}
          <div className="flex items-center gap-6 md:gap-8">
            <a
              href="#github"
              className="text-sm text-[#C7C4D7] hover:text-[#E4E1ED] transition-colors"
            >
              GitHub
            </a>
            <a
              href="#documentation"
              className="text-sm text-[#C7C4D7] hover:text-[#E4E1ED] transition-colors"
            >
              Documentation
            </a>
            <a
              href="#privacy"
              className="text-sm text-[#C7C4D7] hover:text-[#E4E1ED] transition-colors"
            >
              Privacy
            </a>
            <a
              href="#terms"
              className="text-sm text-[#C7C4D7] hover:text-[#E4E1ED] transition-colors"
            >
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
