export default function NotFound() {
  return (
    <div className="stack">
      <p className="kicker">Desk</p>
      <h1>That record is not on the desk</h1>
      <p className="lede">It may have been mistyped. The customer book and the pipeline are still here.</p>
      <p className="cluster">
        <a className="button" href="/customers">Customer book</a>
        <a className="button secondary" href="/pipeline">Pipeline</a>
      </p>
    </div>
  );
}
