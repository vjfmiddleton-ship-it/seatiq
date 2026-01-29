export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-3xl text-center">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
          SeatIQ
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
          Smart seating optimization for corporate events. Maximize networking
          opportunities, ensure balanced conversations, and create meaningful
          connections.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <a
            href="/events"
            className="rounded-md bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          >
            Get Started
          </a>
          <a
            href="/about"
            className="text-sm font-semibold leading-6 text-gray-900 dark:text-white"
          >
            Learn more <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <FeatureCard
          title="New Connections"
          description="Maximize opportunities for guests to meet new people outside their usual circles."
          icon="A"
        />
        <FeatureCard
          title="Cross-Department"
          description="Encourage interaction across departments, companies, and industries."
          icon="B"
        />
        <FeatureCard
          title="Balanced Tables"
          description="Create balanced conversations with diverse seniority and expertise."
          icon="C"
        />
        <FeatureCard
          title="Business Goals"
          description="Optimize for sales opportunities and strategic partnerships."
          icon="D"
        />
      </div>
    </main>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600 text-white font-bold">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        {description}
      </p>
    </div>
  );
}
