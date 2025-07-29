"use client";

import React, { useState } from 'react';
import { UserIcon, NotificationIcon, SearchIcon } from '@/components/icons';
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('recently-viewed');

  const mockProjects = [
    { id: 1, name: "PCB Design v2", lastModified: "2 hours ago", collaborators: 1 },
    { id: 2, name: "Arduino Shield", lastModified: "1 day ago", collaborators: 2 },
    { id: 3, name: "LED Controller", lastModified: "3 days ago", collaborators: 1 },
    { id: 4, name: "Power Module", lastModified: "1 week ago", collaborators: 2 },
    { id: 5, name: "Sensor Board", lastModified: "2 weeks ago", collaborators: 1 },
  ];

  return (
    <ResponsiveContainer>
      <div className="min-h-screen bg-white">
        {/* Header Box */}
        <div 
          className="absolute bg-[#f5f5f5] border border-[#a6a6a6]"
          style={{
            top: "18px",
            left: "19px",
            width: "230px",
            height: "213px",
            borderRadius: "24px",
            padding: "16px",
          }}
        >
          {/* User Icon and Name with Notification */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <UserIcon size={16} className="text-[#969696]" />
              <span className="text-sm font-medium text-gray-900">User Name</span>
            </div>
            <NotificationIcon size={16} className="text-[#969696]" />
          </div>

          {/* Search Box */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
              <SearchIcon size={16} className="text-[#e3e3e3]" />
            </div>
            <input
              type="text"
              placeholder="Search"
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{
                borderWidth: "0.3px",
                borderRadius: "12px",
              }}
            />
          </div>
        </div>

        {/* Main Content Area */}
        <div
          className="absolute"
          style={{
            top: "74px",
            left: "310px",
          }}
        >
          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab('recently-viewed')}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                activeTab === 'recently-viewed'
                  ? 'bg-[#ebebeb] border border-[#dddddd] text-[#999999]'
                  : 'text-[#c0bfbf] hover:text-[#999999]'
              }`}
              style={{
                borderWidth: activeTab === 'recently-viewed' ? '0.5px' : '0px',
              }}
            >
              Recently Viewed
            </button>
            <button
              onClick={() => setActiveTab('shared')}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                activeTab === 'shared'
                  ? 'bg-[#ebebeb] border border-[#dddddd] text-[#999999]'
                  : 'text-[#c0bfbf] hover:text-[#999999]'
              }`}
              style={{
                borderWidth: activeTab === 'shared' ? '0.5px' : '0px',
              }}
            >
              Shared
            </button>
          </div>

          {/* Project Cards */}
          <div className="grid grid-cols-2 gap-6">
            {mockProjects.map((project) => (
              <div
                key={project.id}
                className="bg-[#f5f5f5] border border-[#a6a6a6] hover:shadow-md transition-shadow cursor-pointer"
                style={{
                  borderRadius: "24px",
                  padding: "20px",
                  width: "400px",
                  height: "260px",
                }}
              >
                {/* Project Image/Thumbnail */}
                <div 
                  className="w-full bg-white border border-[#a6a6a6]"
                  style={{
                    height: "180px",
                    borderRadius: "20px",
                    borderWidth: "0.3px",
                    marginBottom: "4px",
                  }}
                >
                  {/* Placeholder for project preview */}
                </div>
                
                {/* Project Info */}
                <div className="flex items-start gap-3 mt-1">
                  {/* User Icons */}
                  <div className="flex -space-x-2">
                    <div 
                      className="w-6 h-6 bg-[#d0d0d0] border border-[#969696] rounded-full flex items-center justify-center"
                      style={{ borderWidth: "0.68px" }}
                    >
                      <UserIcon size={12} className="text-[#969696]" />
                    </div>
                    {project.collaborators === 2 && (
                      <div 
                        className="w-6 h-6 bg-[#e0e0e0] border border-[#969696] rounded-full flex items-center justify-center"
                        style={{ borderWidth: "0.68px" }}
                      >
                        <UserIcon size={12} className="text-[#969696]" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-[#666666] mb-1">
                      {project.name}
                    </h3>
                    <p className="text-xs text-[#999999]">
                      Edited {project.lastModified}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ResponsiveContainer>
  );
};

export default Dashboard;
