export const SITE = {
  title: "Ramón Garcia Gomez",
  description: "Personal site — writing, projects, and occasional experiments.",
  author: "Ramón Garcia Gomez",
  url: "https://ramongarciagomez.com",
  email: "garciagomezramon@gmail.com",
  github: "https://github.com/RamonGarciaGomez",
};

// "Now" data — update these manually whenever things change
export const NOW = {
  location: "San Francisco, CA",
  book: {
    title: "King: A Life",
    author: "Jonathan Eig",
    url: "https://www.goodreads.com/book/show/57693425",
  },
  // Strava will be wired up live later — set a fallback here for now
  strava: {
    weeklyKm: null as number | null,   // e.g. 42
    sport: null as string | null,       // e.g. "running"
  },
};
