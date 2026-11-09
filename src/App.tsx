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
  switch (state.page) {
    case 'mixer':
      return <Mixer />;
    case 'song':
      return <Song />;
    case 'drums':
      return <Drums />;
    case 'keys':
      return <Keys />;
    default:
      // Rhythm, Lead and Bass: the same page, drawn afresh for each so nothing carries over between them.
      return <Guitar key={state.page} id={state.page} />;
  }
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
      {state.notice && (
        <p className="notice" role="status">
          {state.notice}
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
