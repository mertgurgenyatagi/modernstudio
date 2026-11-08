import { APP_NAME } from './core/constants';

/** Placeholder screen: only shows that the shell runs and the decided tokens are in effect. */
export function App() {
  return (
    <main
      style={{
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--color-paper)',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '3rem',
            color: 'var(--color-ink)',
          }}
        >
          {APP_NAME}
        </h1>
        <p style={{ margin: '0.5rem 0 0', color: 'var(--color-muted)' }}>A minimalist music app.</p>
        <p
          style={{
            margin: '1rem 0 0',
            fontFamily: 'var(--font-outlier)',
            background: 'var(--color-accent)',
            color: 'var(--color-accent-ink)',
            display: 'inline-block',
            padding: '0.25rem 0.75rem',
          }}
        >
          960 x 540
        </p>
      </div>
    </main>
  );
}
