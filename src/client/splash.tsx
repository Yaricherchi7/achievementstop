import './index.css';

import { context, requestExpandedMode } from '@devvit/web/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

export const Splash = () => {
  return (
    <main className="flex min-h-screen items-center bg-slate-950 px-4 py-3 text-white">
      <div className="flex w-full items-center gap-3">
        <img className="h-12 w-12 shrink-0" src="/snoo.png" alt="" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-orange-300">
            r/{context.subredditName ?? 'community'}
          </p>
          <h1 className="truncate text-lg font-bold">Community Achievements</h1>
          <p className="truncate text-xs text-slate-300">
            Badges, weekly recaps, milestones
          </p>
        </div>
        <button
          className="min-h-10 shrink-0 rounded-md bg-orange-600 px-4 text-sm font-bold text-white"
          onClick={(event) => requestExpandedMode(event.nativeEvent, 'game')}
        >
          Open
        </button>
      </div>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
