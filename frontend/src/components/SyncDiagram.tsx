import React from "react";

interface ClientNodeProps {
  label: string;
  icon: "desktop" | "laptop";
  indicator?: "amber" | "green" | "none";
}

const ClientNode: React.FC<ClientNodeProps> = ({
  label,
  icon,
  indicator = "none",
}) => {
  const getIcon = () => {
    if (icon === "desktop") {
      return (
        <svg
          className="w-8 h-8"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" stroke="#C7C4D7" strokeWidth="1.5"/>
          <path d="M7 19h10" stroke="#C7C4D7" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M9 19v1h6v-1" stroke="#C7C4D7" strokeWidth="1.5"/>
        </svg>
      );
    }
    return (
      <svg
        className="w-8 h-8"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="3" y="3" width="18" height="12" rx="2" stroke="#C7C4D7" strokeWidth="1.5"/>
        <path d="M7 17h10" stroke="#C7C4D7" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    );
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <div className="bg-[#111113] border border-[#27272A] rounded-lg p-4 w-24 h-16 flex items-center justify-center">
          {getIcon()}
        </div>
        {indicator !== "none" && (
          <div
            className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
              indicator === "amber"
                ? "bg-[#D97721] animate-pulse-amber"
                : "bg-[#4ADE80] animate-pulse-green"
            }`}
          />
        )}
      </div>
      <p className="text-[0.75rem] font-mono text-[#C0C1FF]">{label}</p>
    </div>
  );
};

interface ConnectionPacketProps {
  direction: "ltr" | "rtl";
  delay?: string;
}

const ConnectionPacket: React.FC<ConnectionPacketProps> = ({
  direction,
  delay = "0s",
}) => {
  return (
    <div
      className={`absolute top-1/2 w-3 h-3 rounded-full transform -translate-y-1/2 ${
        direction === "ltr" ? "animate-packet-rtl" : "animate-packet-ltr"
      }`}
      style={{
        background: "#C0C1FF",
        boxShadow: "0 0 12px rgba(192, 193, 255, 0.6)",
        animation:
          direction === "ltr"
            ? `packet-move-right 2s linear infinite`
            : `packet-move-left 2s linear infinite`,
        animationDelay: delay,
      } as React.CSSProperties}
    />
  );
};

export const SyncDiagram: React.FC = () => {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  if (isMobile) {
    return (
      <section className="py-12 md:py-20 border-line">
        <div className="container-main">
          <div className="flex flex-col items-center gap-8 md:gap-12">
            <ClientNode label="Client A" icon="desktop" indicator="amber" />

            {/* Vertical divider */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-0.5 h-8 bg-gradient-to-b from-[#C0C1FF] to-transparent" />
              <svg className="w-4 h-4 text-[#C0C1FF]" fill="currentColor">
                <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
              </svg>
              <div className="w-0.5 h-8 bg-gradient-to-b from-transparent to-[#C0C1FF]" />
            </div>

            <div className="bg-[#13131B] border border-[#8083FF] rounded-lg p-4 w-32 text-center glow-lilac-subtle">
              <div className="flex items-center justify-center mb-2">
                <svg
                  className="w-6 h-6 text-[#8083FF]"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <circle cx="6" cy="12" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="18" cy="12" r="2" />
                </svg>
              </div>
              <p className="text-[0.75rem] font-mono text-[#C0C1FF]">
                Relay Server
              </p>
            </div>

            {/* Vertical divider */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-0.5 h-8 bg-gradient-to-b from-[#C0C1FF] to-transparent" />
              <svg className="w-4 h-4 text-[#C0C1FF]" fill="currentColor">
                <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z" />
              </svg>
              <div className="w-0.5 h-8 bg-gradient-to-b from-transparent to-[#C0C1FF]" />
            </div>

            <ClientNode label="Client B" icon="laptop" indicator="green" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 md:py-20 border-line">
      <div className="container-main">
        <div className="flex items-center justify-center">
          <div className="bg-[#13131B] border border-[#27272A] rounded-xl p-8 md:p-12 max-w-4xl w-full glow-lilac-subtle">
            {/* Grid layout for desktop */}
            <div className="grid grid-cols-3 gap-8 items-center">
              {/* Client A */}
              <ClientNode label="Client A" icon="desktop" indicator="amber" />

              {/* Connection 1 */}
              <div className="relative h-16">
                <div className="absolute inset-y-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C0C1FF] to-transparent -translate-y-1/2" />
                <ConnectionPacket direction="ltr" delay="0s" />
              </div>

              {/* Relay Server */}
              <div className="flex flex-col items-center gap-3">
                <div className="bg-[#111113] border border-[#8083FF] rounded-lg p-4 w-24 h-16 flex items-center justify-center glow-lilac-subtle">
                  <svg
                    className="w-8 h-8 text-[#8083FF]"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <circle cx="6" cy="12" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="18" cy="12" r="2" />
                  </svg>
                </div>
                <p className="text-[0.75rem] font-mono text-[#C0C1FF]">
                  Relay Server
                </p>
              </div>
            </div>

            {/* Second row for the other connection */}
            <div className="grid grid-cols-3 gap-8 items-center mt-12">
              {/* Empty */}
              <div />

              {/* Connection 2 */}
              <div className="relative h-16">
                <div className="absolute inset-y-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C0C1FF] to-transparent -translate-y-1/2" />
                <ConnectionPacket direction="rtl" delay="1s" />
              </div>

              {/* Client B */}
              <ClientNode label="Client B" icon="laptop" indicator="green" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
