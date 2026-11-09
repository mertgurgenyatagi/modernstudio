import './placeholder.css';

/** A page whose step has not been built yet: only its title. */
export function Placeholder({ title }: { title: string }) {
  return (
    <section className="placeholder">
      <h1>{title}</h1>
    </section>
  );
}
