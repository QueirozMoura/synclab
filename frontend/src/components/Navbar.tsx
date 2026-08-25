import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const authApiBaseUrl = import.meta.env.VITE_AUTH_API_BASE_URL ?? "http://localhost:3000";

interface NavbarProps {
  onOpenApp?: () => void;
  onOpenDashboard?: () => void;
}

export const Navbar: React.FC<NavbarProps> = () => {
  const [scrolled, setScrolled] = React.useState(false);
  const { isAuthenticated, isLoading } = useAuth();

  React.useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`landing-nav fixed top-0 w-full z-50 ${scrolled ? "is-scrolled" : ""}`}>
      <div className="landing-nav-inner container-main h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="landing-logo-mark w-7 h-7 relative">
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
          <span className="text-base font-semibold text-[#F4F1F8] tracking-tight">
            Synclab
          </span>
        </Link>

        {/* Center Navigation - Desktop only */}
        <div className="hidden md:flex items-center gap-7">
          <a
            href="#features"
            className="landing-nav-link text-sm"
          >
            Recursos
          </a>
          <a
            href="#architecture"
            className="landing-nav-link text-sm"
          >
            Arquitetura
          </a>
          <Link
            to="/app/documents"
            className="landing-nav-link text-sm"
          >
            Documentação
          </Link>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {!isLoading && !isAuthenticated && (
            <button
              type="button"
              onClick={() => window.open(`${authApiBaseUrl}/auth/google`, "_self")}
              className="landing-nav-login text-sm"
            >
              Login
            </button>
          )}
          <Link
            to="/app"
            className="landing-nav-cta text-sm"
          >
            Abrir Ambiente
          </Link>
        </div>
      </div>
    </nav>
  );
};
