import React from "react";

const SyncNode: React.FC<{ label: string; detail: string; tone: "mint" | "lilac" | "coral" }> = ({ label, detail, tone }) => (
  <div className={`landing-sync-node landing-sync-node-${tone}`}>
    <div className="landing-sync-node-icon"><span /></div>
    <div><b>{label}</b><small>{detail}</small></div>
  </div>
);

const FlowLine: React.FC<{ reverse?: boolean }> = ({ reverse = false }) => (
  <div className="landing-flow-line" aria-hidden="true"><span className={reverse ? "reverse" : ""} /></div>
);

export const SyncDiagram: React.FC = () => (
  <section id="architecture" className="landing-architecture landing-reveal">
    <div className="landing-container container-main">
      <div className="landing-section-intro">
        <p className="landing-section-label">Uma colaboração mais tranquila</p>
        <h2>Um documento.<br /><em>Cada estado sincronizado.</em></h2>
        <p>O Synclab trata a rede como uma ponte, não como um requisito. Seu estado local continua útil enquanto cada dispositivo mantém um histórico determinístico.</p>
      </div>
      <div className="landing-sync-stage">
        <div className="landing-sync-stage-top"><span>TOPOLOGIA DE SYNC</span><span><i /> merge determinístico</span></div>
        <div className="landing-sync-flow">
          <SyncNode label="Dispositivo A" detail="2 alterações pendentes" tone="lilac" />
          <FlowLine />
          <SyncNode label="Motor de sync" detail="ordenação causal" tone="mint" />
          <FlowLine reverse />
          <SyncNode label="Dispositivo B" detail="estado convergente" tone="coral" />
        </div>
        <div className="landing-sync-foot"><span>Relógio vetorial</span><b>device-A : 08</b><i /><span>Log de operações</span><b>2 documentos</b></div>
      </div>
    </div>
  </section>
);
