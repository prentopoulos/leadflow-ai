// Prints the Firestore TTL and index-exemption commands for every collection
// group the runtime writes (RETAINED_COLLECTION_GROUPS, kept equal to the
// repository paths by a runtime test). Firestore needs one TTL policy per
// collection group, subcollections included. Run in Cloud Shell after
// `pnpm build`, review the list, then paste it:
//
//   node deploy/firestore-ttl.mjs
import { pathToFileURL } from 'node:url';

export function ttlCommands(groups) {
  return groups.flatMap((group) => [
    `gcloud firestore fields ttls update expiresAt --collection-group=${group} --database='(default)' --enable-ttl --async`,
    // The TTL field is never queried; exempt it from single-field indexes.
    `gcloud firestore indexes fields update expiresAt --collection-group=${group} --database='(default)' --disable-indexes --async`,
  ]);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { RETAINED_COLLECTION_GROUPS } =
    await import('../packages/runtime/dist/index.js');
  console.log(ttlCommands(RETAINED_COLLECTION_GROUPS).join('\n'));
}
