import { getCollection } from "astro:content";

/**
 * Catalog numbering for "The Record" — oldest entry within a collection = 001,
 * numbered sequentially as entries are added.
 *
 *   Writing  → E-001, E-002, ...
 *   Projects → P-001, P-002, ...
 *
 * Used on the homepage archive, each collection's index, and at the top of
 * individual post/project pages.
 */

const pad = (n: number) => String(n).padStart(3, "0");

export type Kind = "post" | "project";

export function prefixFor(kind: Kind): "E" | "P" {
  return kind === "post" ? "E" : "P";
}

/** Look up the catalog ID for a single entry by its content id. */
export async function getCatalogId(kind: Kind, id: string): Promise<string> {
  const collection = kind === "post" ? "blog" : "projects";
  const entries = (
    await getCollection(collection, ({ data }) => !data.draft)
  ).sort((a, b) => a.data.date.valueOf() - b.data.date.valueOf());
  const idx = entries.findIndex((e) => e.id === id);
  return `${prefixFor(kind)}-${pad(idx < 0 ? 0 : idx + 1)}`;
}

/** Get the full ordered list of catalog entries with IDs attached. */
export async function getNumberedEntries(kind: Kind) {
  const collection = kind === "post" ? "blog" : "projects";
  const entries = (
    await getCollection(collection, ({ data }) => !data.draft)
  ).sort((a, b) => a.data.date.valueOf() - b.data.date.valueOf());
  const prefix = prefixFor(kind);
  return entries.map((entry, i) => ({
    ...entry,
    kind,
    catalog: `${prefix}-${pad(i + 1)}`,
  }));
}
