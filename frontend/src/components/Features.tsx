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
          <div><p className="landing-section-label">Built for the in-between</p><h2>Resilience is<br /><em>a feature.</em></h2></div>
          <p>Quietly powerful infrastructure for the moments when connectivity is uncertain, shared, or simply not the point.</p>
        </div>
        <div className="landing-feature-grid">
          <FeatureCard title="Local-first by default" description="Write to local persistence first. The interface stays responsive, even when the network does not." icon={<Icon type="database" />} variant="feature-wide">
            <div className="landing-terminal"><span>$</span> indexedDB.open(<b>"synclab_store"</b>)<i>✓ local state ready</i></div>
          </FeatureCard>
          <FeatureCard title="Deterministic merging" description="CRDTs and vector clocks make concurrent changes converge without a central lock." icon={<Icon type="merge" />} />
          <FeatureCard title="Works offline" description="Keep making progress through unreliable networks. Pending changes remain visible and recoverable." icon={<Icon type="offline" />} />
          <FeatureCard title="Clear sync state" description="Know what is saved, pending, syncing, offline, or in error at a glance." icon={<Icon type="history" />} variant="feature-accent">
            <div className="landing-status-stack"><span><i className="is-green" /> All devices synced</span><span><i className="is-amber" /> 3 changes pending</span><span><i className="is-muted" /> Offline safe</span></div>
          </FeatureCard>
        </div>
      </div>
    </section>
    <section id="docs" className="landing-stack landing-reveal">
      <div className="landing-container container-main landing-stack-grid">
        <div><p className="landing-section-label">A focused workspace</p><h2>Documents that stay<br /><em>close to the work.</em></h2></div>
        <div className="landing-stack-copy"><p>From a new document to a recovered edit, every state is explicit. Synclab gives you a focused place to write and a clear path to inspect what happened.</p><Link to="/app/documents" className="landing-inline-link">Explore documents <span>↗</span></Link></div>
      </div>
    </section>
  </>
);
