import React from "react";
import { GlobalSidebar } from "../components/app/GlobalSidebar";

export const SettingsPage: React.FC = () => {
  return (
    <div className="flex h-screen bg-[#09090B] overflow-hidden">
      <GlobalSidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-8 py-12">
            <h1 className="text-3xl font-bold text-[#e4e1ed] mb-8">Settings</h1>
            
            <div className="space-y-6">
              <section className="bg-[#151517] border border-[#27272A] rounded-xl p-6">
                <h2 className="text-lg font-semibold text-[#e4e1ed] mb-4">Account</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#e4e1ed]">Profile</p>
                      <p className="text-xs text-[#c7c4d7]">Manage your profile and preferences</p>
                    </div>
                    <button className="px-3 py-1.5 text-sm text-[#c7c4d7] border border-[#27272A] rounded-md hover:bg-[#1f1f27] transition-colors">
                      Edit
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#e4e1ed]">Plan</p>
                      <p className="text-xs text-[#c7c4d7]">Pro Plan - Active</p>
                    </div>
                    <span className="px-3 py-1 text-xs font-medium rounded-full bg-[#c0c1ff] text-[#1000a9]">Pro</span>
                  </div>
                </div>
              </section>
              
              <section className="bg-[#151517] border border-[#27272A] rounded-xl p-6">
                <h2 className="text-lg font-semibold text-[#e4e1ed] mb-4">Editor</h2>
                <div className="space-y-4">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="text-sm font-medium text-[#e4e1ed]">Auto-save</p>
                      <p className="text-xs text-[#c7c4d7]">Automatically save changes</p>
                    </div>
                    <input type="checkbox" defaultChecked className="w-4 h-4 accent-[#c0c1ff]" />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="text-sm font-medium text-[#e4e1ed]">Vim mode</p>
                      <p className="text-xs text-[#c7c4d7]">Enable vim keybindings</p>
                    </div>
                    <input type="checkbox" className="w-4 h-4 accent-[#c0c1ff]" />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="text-sm font-medium text-[#e4e1ed]">Line numbers</p>
                      <p className="text-xs text#[c7c4d7]">Show line numbers in editor</p>
                    </div>
                    <input type="checkbox" defaultChecked className="w-4 h-4 accent-[#c0c1ff]" />
                  </label>
                </div>
              </section>
              
              <section className="bg-[#151517] border border-[#27272A] rounded-xl p-6">
                <h2 className="text-lg font-semibold text-[#e4e1ed] mb-4">Sync</h2>
                <div className="space-y-4">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="text-sm font-medium text-[#e4e1ed]">Auto-sync</p>
                      <p className="text-xs text-[#c7c4d7]">Sync automatically when online</p>
                    </div>
                    <input type="checkbox" defaultChecked className="w-4 h-4 accent-[#c0c1ff]" />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="text-sm font-medium text-[#e4e1ed]">Conflict resolution</p>
                      <p className="text-xs text-[#c7c4d7]">Show conflict resolution dialog</p>
                    </div>
                    <input type="checkbox" defaultChecked className="w-4 h-4 accent-[#c0c1ff]" />
                  </label>
                </div>
              </section>
              
              <section className="bg-[#151517] border border-[#27272A] rounded-xl p-6">
                <h2 className="text-lg font-semibold text-[#e4e1ed] mb-4">Appearance</h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-[#e4e1ed] mb-2">Theme</p>
                    <div className="flex gap-2">
                      <button className="flex-1 py-2 px-3 text-sm border border-[#c0c1ff] rounded-md text-[#c0c1ff] hover:bg-[#c0c1ff] hover:text-[#1000a9] transition-colors">
                        Dark
                      </button>
                      <button className="flex-1 py-2 px-3 text-sm border border-[#27272A] rounded-md text-[#c7c4d7] hover:bg-[#1f1f27] transition-colors">
                        Light
                      </button>
                      <button className="flex-1 py-2 px-3 text-sm border border-[#27272A] rounded-md text-[#c7c4d7] hover:bg-[#1f1f27] transition-colors">
                        System
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};