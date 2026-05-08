import type { TripSignal } from "../types";

interface TripBannerProps {
  signals: TripSignal[];
}

export function TripBanner({ signals }: TripBannerProps) {
  const tripped = signals.filter((signal) => signal.triggered);
  if (!tripped.length) {
    return (
      <section className="trip-banner trip-banner--safe">
        <strong>No trip conditions hit.</strong> Release remains on-track.
      </section>
    );
  }

  const tripText = tripped
    .map((signal) => `${signal.label.toLowerCase()} ${signal.detail} (${signal.threshold})`)
    .join(" · ");

  return (
    <section className="trip-banner trip-banner--tripped">
      <strong>Tripped:</strong> {tripText}
      {" -> engineering pipeline re-opened for fix / rollback"}
    </section>
  );
}
