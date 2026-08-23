import React from "react";
import { Navbar } from "../components/Navbar";
import { Hero } from "../components/Hero";
import { SyncDiagram } from "../components/SyncDiagram";
import { Features } from "../components/Features";
import { Footer } from "../components/Footer";

export const LandingPage: React.FC = () => {
  React.useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>(".landing-reveal");
    if (typeof IntersectionObserver === "undefined") {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );

    elements.forEach((element) => {
      if (element.getBoundingClientRect().top < window.innerHeight) {
        element.classList.add("is-visible");
      } else {
        observer.observe(element);
      }
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-page">
      <Navbar />
      <main>
        <Hero />
        <SyncDiagram />
        <Features />
      </main>
      <Footer />
    </div>
  );
};