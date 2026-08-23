import React from "react";
import { Link } from "react-router-dom";
import { FeatureCard } from "./FeatureCard";

const Icon: React.FC<{ type: "database" | "merge" | "offline" | "history" }> = ({ type }) => {
  const paths = {
    database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v7c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 12v7c0 1.66 3.58 3 8 3s8-1.34 8-3v-7" /></>,
    merge: <><circle cx="6" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><path d="M8 6h6c2 0 3 1 3 3v6c0 2-1 3-3 3H8" /></>,
    offline: <><path d="M1 9l6 6 2-2-8-8M6 13l7 7M11 8c3.3 0 6.2.9 8.5 2.4M17 14l4.5 4.5" /></>,
    history: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l4 2" /></>,
  };
  return <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">{paths[type]}</svg>;
};

export const Features: React.FC = () => (
  <>
    <section id="features" className="landing-features landing-reveal">
      <div className="landing-container container-main">
        <div className="landing-section-heading-row">
          <div><p className="landing-section-label">Feito para os intervalos</p><h2>Resiliência é<br /><em>um recurso.</em></h2></div>
          <p>Infraestrutura discreta e poderosa para quando a conexão é incerta, compartilhada ou simplesmente não é o ponto principal.</p>
        </div>
        <div className="landing-feature-grid">
          <FeatureCard title="Local-first por padrão" description="Escreva primeiro na persistência local. A interface continua responsiva, mesmo quando a rede não está." icon={<Icon type="database" />} variant="feature-wide">
            <div className="landing-terminal"><span>$</span> indexedDB.open(<b>"synclab_store"</b>)<i>✓ estado local pronto</i></div>
          </FeatureCard>
          <FeatureCard title="Merge determinístico" description="CRDTs e relógios vetoriais fazem alterações concorrentes convergirem sem um bloqueio central." icon={<Icon type="merge" />} />
          <FeatureCard title="Funciona offline" description="Continue avançando em redes instáveis. Alterações pendentes permanecem visíveis e recuperáveis." icon={<Icon type="offline" />} />
          <FeatureCard title="Estado de sync claro" description="Saiba de relance o que está salvo, pendente, sincronizando, offline ou com erro." icon={<Icon type="history" />} variant="feature-accent">
            <div className="landing-status-stack"><span><i className="is-green" /> Todos os dispositivos sincronizados</span><span><i className="is-amber" /> 3 alterações pendentes</span><span><i className="is-muted" /> Seguro offline</span></div>
          </FeatureCard>
        </div>
      </div>
    </section>
    <section id="docs" className="landing-stack landing-reveal">
      <div className="landing-container container-main landing-stack-grid">
        <div><p className="landing-section-label">Um ambiente focado</p><h2>Documentos que ficam<br /><em>perto do trabalho.</em></h2></div>
        <div className="landing-stack-copy"><p>De um documento novo a uma edição recuperada, cada estado é explícito. O Synclab oferece um lugar focado para escrever e um caminho claro para entender o que aconteceu.</p><Link to="/app/documents" className="landing-inline-link">Explorar documentos <span>↗</span></Link></div>
      </div>
    </section>
  </>
);
