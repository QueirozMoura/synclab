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
        <p className="landing-section-label">A calmer kind of collaboration</p>
        <h2>One document.<br /><em>Every state in sync.</em></h2>
        <p>Synclab treats the network as a bridge, not a prerequisite. Your local state stays useful while each device keeps a deterministic history.</p>
      </div>
      <div className="landing-sync-stage">
        <div className="landing-sync-stage-top"><span>SYNC TOPOLOGY</span><span><i /> deterministic merge</span></div>
        <div className="landing-sync-flow">
          <SyncNode label="Device A" detail="2 pending changes" tone="lilac" />
          <FlowLine />
          <SyncNode label="Sync engine" detail="causal ordering" tone="mint" />
          <FlowLine reverse />
          <SyncNode label="Device B" detail="state converged" tone="coral" />
        </div>
        <div className="landing-sync-foot"><span>Vector clock</span><b>device-A : 08</b><i /><span>Operation log</span><b>2 documents</b></div>
      </div>
    </div>
  </section>
);
