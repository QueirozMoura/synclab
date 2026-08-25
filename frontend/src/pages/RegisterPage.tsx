import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      if (response.status === 409) {
        setError("Já existe uma conta com este e-mail.");
        return;
      }
      if (!response.ok) {
        setError("Não foi possível criar a conta. Tente novamente.");
        return;
      }
      await refreshUser();
      navigate("/app", { replace: true });
    } catch {
      setError("Não foi possível criar a conta. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--background)] px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border-[var(--border)] bg-[var(--surface)] p-8 shadow-xl"
      >
        <h1 className="text-2xl font-semibold mb-7">Criar conta</h1>
        {error && (
          <p role="alert" className="mb-4 text-[var(--error)]">
            {error}
          </p>
        )}
        {(
          [
            ["Nome", name, setName, "text"],
            ["E-mail", email, setEmail, "email"],
            ["Senha", password, setPassword, "password"],
            ["Confirmar senha", confirm, setConfirm, "password"],
          ] as const
        ).map(([label, value, setter, type]) => (
          <label key={label} className="block text-sm mb-4">
            {label}
            <input
              required={label !== "Nome"}
              type={type}
              value={value}
              onChange={(e) => setter(e.target.value)}
              className="mt-2 w-full rounded-lg border-[var(--border)] bg-[var(--surface-lowest)] p-3"
            />
          </label>
        ))}
        <button type="button" onClick={() => { window.location.href = "/auth/google"; }} className="mb-3 w-full rounded-lg border-[var(--border)] p-3 font-semibold">Continuar com Google</button>
        <button
          disabled={busy}
          className="mt-2 w-full rounded-lg bg-[var(--primary-container)] p-3 font-semibold text-white"
        >
          {busy ? "Criando..." : "Criar conta"}
        </button>
        <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
          Já possui uma conta?{" "}
          <Link className="text-[var(--primary)]" to="/login">
            Entrar
          </Link>
        </p>
      </form>
    </main>
  );
};
