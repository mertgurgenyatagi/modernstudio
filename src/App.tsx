import { Drums } from './pages/Drums';
import { Guitar } from './pages/Guitar';
import { Keys } from './pages/Keys';
import { Mixer } from './pages/Mixer';
import { Song } from './pages/Song';
import { StudioProvider, useStudio } from './state/Studio';
import { TopBar } from './ui/TopBar';
import './ui/shell.css';

function CurrentPage() {
  const { state } = useStudio();
  if (state.page === 'mixer') return <Mixer />;
  if (state.page === 'song') return <Song />;
  if (state.page === 'drums') return <Drums />;
  if (state.page === 'guitar') return <Guitar />;
  return <Keys />;
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
