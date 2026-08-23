import React from "react";
import { Link } from "react-router-dom";

export const Footer: React.FC = () => (
  <footer className="landing-footer">
    <div className="landing-container container-main">
      <div className="landing-cta-panel landing-reveal">
        <div><p className="landing-section-label">Comece pelo trabalho</p><h2>Mantenha o ritmo.<br /><em>Abra o Synclab.</em></h2></div>
        <Link to="/app" className="landing-cta landing-cta-primary">Entrar no ambiente <span>↗</span></Link>
      </div>
      <div className="landing-footer-bottom">
        <div className="landing-footer-brand"><div className="landing-logo-mark"><span>S</span></div><div><b>Synclab</b><small>Motor de documentos offline-first</small></div></div>
        <div className="landing-footer-links"><Link to="/app/documents">Documentos</Link><Link to="/app/help">Documentação</Link><Link to="/app">Ambiente</Link></div>
        <span className="landing-footer-copy">© 2026 Synclab</span>
      </div>
    </div>
  </footer>
);
