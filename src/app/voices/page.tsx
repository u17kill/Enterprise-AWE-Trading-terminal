import { LatestVoices } from "../../components/latest-voices";
import { loadCuratedVoices } from "../../lib/voices-curated-source";

export const dynamic = "force-dynamic";

export default async function Page() {
  let snapshot = null;
  try { snapshot = await loadCuratedVoices(); }
  catch { /* The page keeps a retry button if the local snapshot is unreadable. */ }
  return <LatestVoices initialSnapshot={snapshot} />;
}
