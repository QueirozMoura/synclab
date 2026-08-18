import React from "react";
import { Link } from "react-router-dom";
import { DashboardSidebar } from "../components/dashboard/DashboardSidebar";
import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import { DocumentCard } from "../components/dashboard/DocumentCard";
import { ActivityPanel } from "../components/dashboard/ActivityPanel";
import { MobileTopbar } from "../components/dashboard/MobileTopbar";

export const DashboardPage: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const handleFilterClick = () => {
    console.log("Filter clicked");
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex h-screen bg-[#09090B] overflow-hidden">
      {/* Mobile Topbar */}
      <MobileTopbar onMenuClick={toggleSidebar} />

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <DashboardSidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden lg:pl-0">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-8 md:py-12">
            {/* Dashboard Header */}
            <DashboardHeader
              onFilterClick={handleFilterClick}
            />

            {/* Main Grid: Documents (8/12) + Activity (4/12) on desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 mt-8">
              {/* Documents Section - 8/12 columns on desktop */}
              <div className="lg:col-span-8">
                {/* Continue where you left off section */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-[#e4e1ed]">
                      Continue where you left off
                    </h2>
                    <Link
                      to="/app/documents"
                      className="text-sm text-[#c0c1ff] hover:underline transition-colors"
                    >
                      View all
                    </Link>
                  </div>

                  {/* Document Grid - 2 columns on desktop, 1 on mobile */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Featured Card - Architecture Overview */}
                    <DocumentCard
                      featured
                      title="Architecture Overview"
                      description="Updated the system diagrams to reflect the new CRDT implementation for real-time collaboration."
                      badge="architecture"
                      badgeColor="#c0c1ff"
                      timeAgo="Just now"
                      href="/app/documents/architecture"
                    />

                    {/* Right column - CRDT Notes and README */}
                    <div className="space-y-4">
                      <DocumentCard
                        title="CRDT Notes"
                        icon="code"
                        iconColor="#ffb783"
                        timeAgo="Synced 2h ago"
                        href="/app/documents/crdt-notes"
                      />
                      <DocumentCard
                        title="README.md"
                        icon="markdown"
                        iconColor="#908fa0"
                        timeAgo="Synced yesterday"
                        href="/app/documents/readme"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Activity Panel - 4/12 columns on desktop, full width on mobile */}
              <div className="lg:col-span-4 lg:self-start">
                <ActivityPanel />
              </div>
            </div>

            {/* Activity Panel Mobile - below documents (hidden on desktop) */}
            <div className="lg:hidden mt-8">
              <ActivityPanel />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};