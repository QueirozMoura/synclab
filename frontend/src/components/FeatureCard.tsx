import React from "react";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  variant?: "default" | "large-left" | "large-right" | "feature-wide" | "feature-accent";
  children?: React.ReactNode;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  description,
  icon,
  variant = "default",
  children,
}) => {
  return (
    <div
      className={`landing-feature-card p-7 md:p-8 ${
        variant === "large-left" || variant === "large-right"
          ? "md:col-span-2"
          : ""
      } ${variant === "feature-wide" ? "landing-feature-wide" : ""} ${variant === "feature-accent" ? "landing-feature-accent" : ""}
      }`}
    >
      <div className="flex items-start gap-4 mb-6">
        <div className="landing-feature-icon flex-shrink-0">{icon}</div>
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-[#F4F1F8] mb-2">{title}</h3>
          <p className="text-base leading-relaxed text-[#B7B3C2]">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
};
