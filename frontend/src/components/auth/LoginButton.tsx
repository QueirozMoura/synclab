import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export const LoginButton: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading || isAuthenticated) return null;
  return (
    <button
      type="button"
      onClick={() => navigate("/login")}
      className="global-sidebar-link w-full text-left"
    >
      Login
    </button>
  );
};
