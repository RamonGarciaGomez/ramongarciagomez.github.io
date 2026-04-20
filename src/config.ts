export const SITE = {
  title: "Ramon García-Gómez",
  description: "Personal site — writing, projects, and occasional experiments.",
  author: "Ramon García-Gómez",
  url: "https://ramongarciagomez.com",
  email: "garciagomezramon@gmail.com",
  github: "https://github.com/RamonGarciaGomez",
};

// "Now" data — update these manually whenever things change
export const NOW = {
  location: "London, UK",
  book: {
    title: "The Righteous Mind",
    author: "Jonathan Haidt",
    url: "https://www.goodreads.com/book/show/11324722",
  },
  // Strava will be wired up live later — set a fallback here for now
  strava: {
    weeklyKm: null as number | null,   // e.g. 42
    sport: null as string | null,       // e.g. "running"
  },
};
