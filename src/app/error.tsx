"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const message = process.env.NODE_ENV === "development" ? error.message : "The request could not be completed.";
  return (
    <div className="stack">
      <p className="kicker">Desk</p>
      <h1>Something interrupted this page</h1>
      <p className="lede">{message}</p>
      <button type="button" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
