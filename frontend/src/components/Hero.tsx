import React from "react";
import { Link } from "react-router-dom";

export const Hero: React.FC = () => {
  return (
    <section className="landing-hero relative overflow-hidden">
      <div className="landing-hero-grid" aria-hidden="true" />
      <div className="landing-hero-orbit landing-hero-orbit-one" aria-hidden="true" />
      <div className="landing-hero-orbit landing-hero-orbit-two" aria-hidden="true" />
      <div className="landing-container container-main relative z-10">
        <div className="landing-hero-copy landing-reveal">
          <div className="landing-eyebrow"><span className="landing-eyebrow-pulse" /> Motor de documentos offline-first</div>
          <h1>Seu trabalho deve<br /><em>seguir em frente.</em></h1>
          <p className="landing-hero-lede">O Synclab mantém seus documentos úteis sem rede e reúne cada alteração com sincronização determinística.</p>
          <div className="landing-hero-actions">
            <Link to="/app" className="landing-cta landing-cta-primary">Abrir ambiente <span>↗</span></Link>
            <a href="#architecture" className="landing-cta landing-cta-quiet">Veja como funciona <span>↓</span></a>
          </div>
          <div className="landing-hero-note"><span>✦</span> Persistência local <i /> Baseado em CRDT <i /> Controle manual de sync</div>
        </div>
        <ProductPreview />
      </div>
      <div className="landing-hero-bottom" aria-hidden="true"><span>LOCAL-FIRST POR DESIGN</span><span>DOCUMENTOS / SYNC / ESTADO</span></div>
    </section>
  );
};

const ProductPreview: React.FC = () => (
  <div className="landing-preview-wrap landing-reveal landing-reveal-delay-2">
    <div className="landing-preview-glow" />
    <div className="landing-preview-window">
      <div className="landing-preview-bar">
        <div className="landing-window-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <span className="landing-preview-path">synclab / ambiente</span>
        <span className="landing-preview-live"><i /> estado local ativo</span>
      </div>
      <div className="landing-preview-body">
        <aside className="landing-preview-sidebar">
          <div className="landing-preview-brand"><b>S</b><span>Synclab</span></div>
          <div className="landing-preview-nav active"><span>◌</span> Recentes</div>
          <div className="landing-preview-nav"><span>□</span> Documentos</div>
          <div className="landing-preview-nav"><span>☆</span> Favoritos</div>
          <div className="landing-preview-sidebar-line" />
          <div className="landing-preview-small-label">Engenharia</div>
          <div className="landing-preview-doc active-doc">Roadmap 2024</div>
          <div className="landing-preview-doc">Architecture</div>
          <div className="landing-preview-doc">CRDT Notes</div>
        </aside>
        <div className="landing-preview-editor">
          <div className="landing-preview-editor-top"><span>Roadmap 2024</span><span className="landing-preview-status"><i /> Sincronizado</span></div>
          <div className="landing-preview-copy">
            <div className="landing-skeleton title" />
            <div className="landing-preview-eyebrow">NOTAS DO PROJETO</div>
              <h3>Crie sem esperar<br />pela rede.</h3>
              <p>Cada edição é capturada localmente e reconciliada de forma determinística quando você decide sincronizar.</p>
            <div className="landing-skeleton line wide" />
            <div className="landing-skeleton line" />
            <div className="landing-code-row"><span>01</span><b>vectorClock.merge(remote)</b></div>
            <div className="landing-code-row"><span>02</span><b>operationLog.confirm()</b></div>
          </div>
        </div>
      </div>
    </div>
    <div className="landing-floating-card landing-floating-sync"><span className="landing-floating-icon">↗</span><div><b>Sync pronto</b><small>2 documentos no estado local</small></div></div>
    <div className="landing-floating-card landing-floating-clock"><span className="landing-clock-ring" /><div><small>RELÓGIO VETORIAL</small><b>device-A · 08</b></div></div>
  </div>
);
