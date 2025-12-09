import React from 'react';
import { format } from 'date-fns';

export default function Header({ catalog }) {
  const lastUpdated = catalog?.lastUpdated
    ? format(new Date(catalog.lastUpdated), 'MMM d, yyyy HH:mm')
    : 'Unknown';

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary-700">
              CEA-VIZ
            </h1>
            <p className="text-sm text-gray-600">
              Live Data Visualization Dashboard
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs text-gray-500">Last Updated</p>
            <p className="text-sm font-medium text-gray-700">{lastUpdated}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
