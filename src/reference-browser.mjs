import { SYSTEM_ID, SYSTEM_PATH } from "./config.mjs";
import {
  bookAllowed,
  bookFilterMode,
  normalizeBookTitle,
  validateCampaign,
} from "./rules.mjs";
import {
  indexReferenceDatabase,
  findReferences,
  findReference,
  fieldLabel,
  filterLibraryByBooks,
} from "./reference-data.mjs";
import { importWithProgress } from "./library.mjs";
const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } =
  foundry.applications.api;
let indexPromise, libraryPromise;
const browsers = new Set();
const campaign = () => game.settings.get(SYSTEM_ID, "campaign");
async function loadJSON(name) {
  const response = await fetch(`${SYSTEM_PATH}/data/${name}.json`, {
    cache: "no-cache",
  });
  if (!response.ok)
    throw new Error(
      `Reference catalogue could not be loaded (${response.status}).`,
    );
  return response.json();
}
export async function referenceIndex() {
  return (indexPromise ??= loadJSON("reference-database")
    .then(indexReferenceDatabase)
    .catch((error) => {
      indexPromise = undefined;
      throw error;
    }));
}
export async function searchReferences(options = {}) {
  return findReferences(await referenceIndex(), campaign(), options);
}
export async function getReference(key) {
  return findReference(await referenceIndex(), campaign(), key);
}
export async function importPublishedLibrary() {
  if (!game.user.isGM) throw new Error("Only the GM can populate compendiums.");
  const source = await (libraryPromise ??= loadJSON("reference-library").catch(
    (error) => {
      libraryPromise = undefined;
      throw error;
    },
  ));
  const bundle = filterLibraryByBooks(source, campaign());
  if (!Object.values(bundle.documents).some((documents) => documents.length))
    throw new Error("No references match the owned-book selection.");
  return importWithProgress(bundle);
}
export function refreshReferenceBrowsers() {
  for (const browser of browsers)
    if (browser.rendered) {
      if (
        browser.filters.book &&
        !bookAllowed(browser.filters.book, campaign())
      )
        browser.filters.book = "";
      browser.filters.page = 0;
      browser.render();
    }
}
export function openReferenceBrowser() {
  const browser = new ReferenceBrowser();
  browser.render({ force: true });
  return browser;
}
export function openOwnedBooks() {
  if (!game.user.isGM) throw new Error("Only the GM can change owned books.");
  return new OwnedBooks().render({ force: true });
}
export class ReferenceBrowser extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    id: "star-wars-reference-browser",
    tag: "section",
    classes: ["star-wars", "sf-catalogue"],
    window: { title: "Star Wars FFG · Reference catalogue", resizable: true },
    position: { width: 1120, height: 800 },
    actions: {
      search: this.search,
      previous: this.previous,
      next: this.next,
      select: this.select,
      ownedBooks: this.ownedBooks,
      populate: this.populate,
    },
  };
  static PARTS = {
    body: { template: `${SYSTEM_PATH}/templates/reference-browser.hbs` },
  };
  filters = { query: "", category: "", book: "", page: 0 };
  selectedKey = "";
  constructor(...args) {
    super(...args);
    browsers.add(this);
  }
  async _prepareContext() {
    const index = await referenceIndex(),
      c = campaign();
    const result = findReferences(index, c, this.filters);
    this.filters.page = result.page;
    const detail = findReference(index, c, this.selectedKey);
    return {
      ...this.filters,
      isGM: game.user.isGM,
      total: result.total,
      databaseTotal: index.records.length,
      pageNumber: result.page + 1,
      pages: result.pages,
      previousDisabled: !result.page,
      nextDisabled: result.page + 1 >= result.pages,
      records: result.records.map((row) => ({
        ...row,
        selected: row.key === this.selectedKey,
      })),
      categories: index.categories.map((category) => ({
        ...category,
        selected: category.id === this.filters.category,
      })),
      books: index.books
        .filter((book) => bookAllowed(book, c))
        .map((book) => ({ name: book, selected: book === this.filters.book })),
      bookSummary:
        bookFilterMode(c) === "all"
          ? "All books"
          : `${c.books.length} selected books${c.includeUnreferenced ? " · unreferenced entries included" : ""}`,
      detail: detail && {
        ...detail,
        fields: Object.entries(detail.fields).map(([key, value]) => ({
          label: fieldLabel(key),
          value: value === null ? "—" : String(value),
        })),
      },
    };
  }
  _onRender(context, options) {
    super._onRender(context, options);
    this.element
      .querySelector('[name="query"]')
      .addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          ReferenceBrowser.search.call(this);
        }
      });
    for (const field of this.element.querySelectorAll("select"))
      field.addEventListener("change", () =>
        ReferenceBrowser.search.call(this),
      );
  }
  async close(options) {
    browsers.delete(this);
    return super.close(options);
  }
  static search() {
    for (const key of ["query", "category", "book"])
      this.filters[key] = this.element.querySelector(`[name="${key}"]`).value;
    this.filters.page = 0;
    this.selectedKey = "";
    this.render();
  }
  static previous() {
    this.filters.page--;
    this.render();
  }
  static next() {
    this.filters.page++;
    this.render();
  }
  static select(_event, target) {
    this.selectedKey = target.dataset.key;
    this.render();
  }
  static ownedBooks() {
    openOwnedBooks();
  }
  static async populate() {
    try {
      if (!game.user.isGM)
        throw new Error("Only the GM can populate compendiums.");
      const proceed = await DialogV2.confirm({
        window: { title: "Populate reference compendiums" },
        content:
          "<p>Add all references allowed by the world's owned-book settings to world compendiums? Search text and category filters do not limit this import. Existing entries and permissions are preserved.</p>",
      });
      if (!proceed) return;
      const report = await importPublishedLibrary();
      ui.notifications.info(
        Object.entries(report)
          .map(
            ([type, count]) =>
              `${type}: ${count.created} new, ${count.preserved} preserved`,
          )
          .join("; "),
      );
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }
}
class OwnedBooks extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "star-wars-owned-books",
    tag: "form",
    classes: ["star-wars", "sf-book-picker"],
    window: { title: "Star Wars FFG · Owned books", resizable: true },
    position: { width: 780, height: 740 },
    form: { handler: this.save, closeOnSubmit: true },
    actions: { selectAll: this.selectAll, clearAll: this.clearAll },
  };
  static PARTS = {
    body: { template: `${SYSTEM_PATH}/templates/owned-books.hbs` },
  };
  async _prepareContext() {
    if (!game.user.isGM) throw new Error("Only the GM can change owned books.");
    const { books } = await referenceIndex(),
      c = campaign();
    return {
      owned: bookFilterMode(c) === "owned",
      includeUnreferenced: c.includeUnreferenced === true,
      books: books.map((name) => ({
        name,
        selected: c.books.some(
          (book) => normalizeBookTitle(book) === normalizeBookTitle(name),
        ),
      })),
      additional: c.books
        .filter(
          (name) =>
            !books.some(
              (book) => normalizeBookTitle(book) === normalizeBookTitle(name),
            ),
        )
        .join("\n"),
    };
  }
  _onRender(context, options) {
    super._onRender(context, options);
    this.element
      .querySelector('[name="bookSearch"]')
      .addEventListener("input", (event) => {
        const query = event.target.value.toLowerCase();
        for (const row of this.element.querySelectorAll(".sf-book-choice"))
          row.hidden = !row.textContent.toLowerCase().includes(query);
      });
  }
  static selectAll() {
    for (const checkbox of this.element.querySelectorAll('[name="books"]'))
      checkbox.checked = true;
  }
  static clearAll() {
    for (const checkbox of this.element.querySelectorAll('[name="books"]'))
      checkbox.checked = false;
  }
  static async save(_event, form) {
    if (!game.user.isGM) throw new Error("Only the GM can change owned books.");
    const data = new FormData(form),
      previous = campaign();
    await game.settings.set(
      SYSTEM_ID,
      "campaign",
      validateCampaign({
        ...previous,
        bookMode: String(data.get("bookMode")),
        includeUnreferenced: data.has("includeUnreferenced"),
        books: [
          ...data.getAll("books"),
          ...String(data.get("additional") ?? "").split("\n"),
        ],
      }),
    );
  }
}
