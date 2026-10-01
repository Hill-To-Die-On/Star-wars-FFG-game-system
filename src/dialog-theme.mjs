/** Keep Star Wars styling on native dialogs while preserving specialized layouts. */
export function starWarsDialogOptions(options = {}) {
  return { ...options, classes: [...new Set(["star-wars", ...(options.classes ?? [])])] };
}

export function themedDialogApi(DialogV2) {
  return Object.fromEntries(["prompt", "confirm", "wait"].map((method) => [
    method, (options) => DialogV2[method](starWarsDialogOptions(options)),
  ]));
}
