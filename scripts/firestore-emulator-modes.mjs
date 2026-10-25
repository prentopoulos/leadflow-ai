export function retainedStateArguments({
  mode,
  retainedState,
  retainedMetadataExists,
}) {
  if (mode !== 'retain') return [];
  const args = [`--export-on-exit=${retainedState}`];
  if (retainedMetadataExists) args.push(`--import=${retainedState}`);
  return args;
}
