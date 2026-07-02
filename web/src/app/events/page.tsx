import EventsList from "./EventsList";

export default function EventsPage() {
  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 pb-32">
      <h1 className="text-3xl font-bold">Upcoming Events</h1>
      <EventsList />
    </main>
  );
}
