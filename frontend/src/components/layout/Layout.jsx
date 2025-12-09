import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

export default function Layout({ children, catalog, selectedDataset, onDatasetSelect }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header catalog={catalog} />

      <div className="flex flex-1">
        <Sidebar
          catalog={catalog}
          selectedDataset={selectedDataset}
          onDatasetSelect={onDatasetSelect}
        />

        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
