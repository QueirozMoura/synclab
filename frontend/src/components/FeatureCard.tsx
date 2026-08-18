import React from "react";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  variant?: "default" | "large-left" | "large-right";
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
      className={`bg-[#111113] border border-[#27272A] rounded-xl p-8 transition-colors duration-300 hover:bg-[#151517] ${
        variant === "large-left" || variant === "large-right"
          ? "md:col-span-2"
          : ""
      }`}
    >
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-shrink-0 text-[#C0C1FF]">{icon}</div>
        <div className="flex-1">
          <h3 className="text-h3 text-[#E4E1ED] mb-2">{title}</h3>
          <p className="text-body-md text-[#C7C4D7]">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
};
