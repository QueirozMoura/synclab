import React from "react";
import { Link } from "react-router-dom";

export const Footer: React.FC = () => (
  <footer className="landing-footer">
    <div className="landing-container container-main">
      <div className="landing-cta-panel landing-reveal">
        <div><p className="landing-section-label">Start with the work</p><h2>Keep your momentum.<br /><em>Open Synclab.</em></h2></div>
        <Link to="/app" className="landing-cta landing-cta-primary">Enter workspace <span>↗</span></Link>
      </div>
      <div className="landing-footer-bottom">
        <div className="landing-footer-brand"><div className="landing-logo-mark"><span>S</span></div><div><b>Synclab</b><small>Offline-first document engine</small></div></div>
        <div className="landing-footer-links"><Link to="/app/documents">Documents</Link><Link to="/app/help">Documentation</Link><Link to="/app">Workspace</Link></div>
        <span className="landing-footer-copy">© 2026 Synclab</span>
      </div>
    </div>
  </footer>
);
