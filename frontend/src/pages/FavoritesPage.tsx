import React from "react";
import { useNavigate } from "react-router-dom";
import { AppNavigation } from "../components/app/AppNavigation";
import { WorkspaceSidebar } from "../components/app/WorkspaceSidebar";
import { useDocuments } from "../hooks/useDocuments";

const iconFor = (id: string) =>
  id === "readme"
    ? "markdown"
    : id.includes("code") || id === "crdt-notes"
      ? "code"
      : "document";

const DocumentIcon: React.FC<{ type: string }> = ({ type }) => (
  <svg
    className="favorites-card-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden="true"
  >
    {type === "code" ? (
      <>
        <path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 4l-4 16" />
      </>
    ) : (
      <>
        <path d="M6 3h8l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M14 3v5h5M8 13h8M8 17h5" />
      </>
    )}
  </svg>
);

const StarIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="m12 3 2.78 5.63 6.22.9-4.5 4.38 1.06 6.19L12 17.18l-5.56 2.92 1.06-6.19L3 9.53l6.22-.9L12 3Z" />
  </svg>
);

export const FavoritesPage: React.FC = () => {
  const { documents, isLoading, toggleFavorite } = useDocuments();
  const navigate = useNavigate();
  const favorites = documents.filter(
    (document) => document.isFavorite === true,
  );

  return (
    <div className="favorites-page flex h-screen overflow-hidden">
      <AppNavigation />
      <WorkspaceSidebar activeDocument="" onSelectDocument={() => {}} />
      <main className="favorites-main flex-1 overflow-y-auto">
        <div className="favorites-content mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
          <header className="favorites-header mb-10">
            <div className="favorites-eyebrow">
              <StarIcon /> Coleção pessoal
            </div>
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <h1>Favoritos</h1>
                <p>Seus documentos importantes, sempre por perto.</p>
              </div>
              <span className="favorites-count">
                {favorites.length}{" "}
                {favorites.length === 1 ? "favorito" : "favoritos"}
              </span>
            </div>
          </header>

          {isLoading ? (
            <div className="favorites-loading" role="status">
              Carregando seus favoritos…
            </div>
          ) : favorites.length === 0 ? (
            <section className="favorites-empty" aria-labelledby="empty-title">
              <div className="favorites-empty-orb">
                <StarIcon />
              </div>
              <h2 id="empty-title">Nenhum favorito ainda</h2>
              <p>
                Marque seus documentos mais importantes como favoritos para
                encontrá-los rapidamente.
              </p>
              <button
                type="button"
                onClick={() => navigate("/app/documents")}
                className="favorites-primary-button"
              >
                Explorar documentos <span aria-hidden="true">→</span>
              </button>
            </section>
          ) : (
            <section
              className="favorites-grid"
              aria-label="Documentos favoritos"
            >
              {favorites.map((document, index) => (
                <article
                  key={document.id}
                  className="favorites-card"
                  style={
                    {
                      "--favorite-delay": `${Math.min(index, 8) * 40}ms`,
                    } as React.CSSProperties
                  }
                >
                  <button
                    type="button"
                    className="favorites-star"
                    aria-label={`Remover ${document.title} dos favoritos`}
                    title="Remover dos favoritos"
                    onClick={() => void toggleFavorite(document.id)}
                  >
                    <StarIcon />
                  </button>
                  <button
                    type="button"
                    className="favorites-card-body"
                    aria-label={`Abrir documento ${document.title}`}
                    onClick={() => navigate(`/app/documents/${document.id}`)}
                  >
                    <div className="favorites-icon-wrap">
                      <DocumentIcon type={iconFor(document.id)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2>{document.title}</h2>
                      <p>
                        {document.content.trim()
                          ? `${document.content.trim().slice(0, 92)}${document.content.trim().length > 92 ? "…" : ""}`
                          : "Documento sem conteúdo"}
                      </p>
                    </div>
                    <span className="favorites-open">
                      Abrir <span aria-hidden="true">↗</span>
                    </span>
                  </button>
                  <div className="favorites-card-footer">
                    <span>Atualizado recentemente</span>
                    <span className="favorites-dot" aria-hidden="true" />
                  </div>
                </article>
              ))}
            </section>
          )}
        </div>
      </main>
    </div>
  );
};
