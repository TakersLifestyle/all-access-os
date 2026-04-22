import EventsList from "./EventsList";

export default function EventsPage() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">
      <h1 className="text-3xl font-bold">Upcoming Events</h1>
      <EventsList />
    </main>
  );
}
