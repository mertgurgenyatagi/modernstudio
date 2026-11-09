import { Mixer } from './pages/Mixer';
import { Placeholder } from './pages/Placeholder';
import { Song } from './pages/Song';
import { PAGE_LABELS } from './state/appState';
import { StudioProvider, useStudio } from './state/Studio';
import { TopBar } from './ui/TopBar';
import './ui/shell.css';

function CurrentPage() {
  const { state } = useStudio();
  if (state.page === 'mixer') return <Mixer />;
  if (state.page === 'song') return <Song />;
  return <Placeholder title={PAGE_LABELS[state.page]} />;
}

function Shell() {
  const { state } = useStudio();
  return (
    <div className="shell">
      <TopBar />
      {state.soundsError && (
        <p className="notice" role="status">
          The sounds could not be loaded: {state.soundsError}
        </p>
      )}
      <main className="page">
        <CurrentPage />
      </main>
    </div>
  );
}

export function App() {
  return (
    <StudioProvider>
      <Shell />
    </StudioProvider>
  );
}
