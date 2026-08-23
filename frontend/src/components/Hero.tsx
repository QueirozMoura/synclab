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
          <div className="landing-eyebrow"><span className="landing-eyebrow-pulse" /> Offline-first document engine</div>
          <h1>Your work should<br /><em>keep moving.</em></h1>
          <p className="landing-hero-lede">Synclab keeps documents useful without a network, then brings every change together with deterministic sync.</p>
          <div className="landing-hero-actions">
            <Link to="/app" className="landing-cta landing-cta-primary">Open workspace <span>↗</span></Link>
            <a href="#architecture" className="landing-cta landing-cta-quiet">See how it works <span>↓</span></a>
          </div>
          <div className="landing-hero-note"><span>✦</span> Local persistence <i /> CRDT-powered <i /> Manual sync control</div>
        </div>
        <ProductPreview />
      </div>
      <div className="landing-hero-bottom" aria-hidden="true"><span>LOCAL-FIRST BY DESIGN</span><span>DOCUMENTS / SYNC / STATE</span></div>
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
        <span className="landing-preview-path">synclab / workspace</span>
        <span className="landing-preview-live"><i /> live local state</span>
      </div>
      <div className="landing-preview-body">
        <aside className="landing-preview-sidebar">
          <div className="landing-preview-brand"><b>S</b><span>Synclab</span></div>
          <div className="landing-preview-nav active"><span>◌</span> Recent</div>
          <div className="landing-preview-nav"><span>□</span> Documents</div>
          <div className="landing-preview-nav"><span>☆</span> Favorites</div>
          <div className="landing-preview-sidebar-line" />
          <div className="landing-preview-small-label">Engineering</div>
          <div className="landing-preview-doc active-doc">Roadmap 2024</div>
          <div className="landing-preview-doc">Architecture</div>
          <div className="landing-preview-doc">CRDT Notes</div>
        </aside>
        <div className="landing-preview-editor">
          <div className="landing-preview-editor-top"><span>Roadmap 2024</span><span className="landing-preview-status"><i /> Synced</span></div>
          <div className="landing-preview-copy">
            <div className="landing-skeleton title" />
            <div className="landing-preview-eyebrow">PROJECT NOTES</div>
            <h3>Build without waiting<br />for the network.</h3>
            <p>Every edit is captured locally, then reconciled deterministically when you choose to sync.</p>
            <div className="landing-skeleton line wide" />
            <div className="landing-skeleton line" />
            <div className="landing-code-row"><span>01</span><b>vectorClock.merge(remote)</b></div>
            <div className="landing-code-row"><span>02</span><b>operationLog.confirm()</b></div>
          </div>
        </div>
      </div>
    </div>
    <div className="landing-floating-card landing-floating-sync"><span className="landing-floating-icon">↗</span><div><b>Sync ready</b><small>2 documents in local state</small></div></div>
    <div className="landing-floating-card landing-floating-clock"><span className="landing-clock-ring" /><div><small>VECTOR CLOCK</small><b>device-A · 08</b></div></div>
  </div>
);
