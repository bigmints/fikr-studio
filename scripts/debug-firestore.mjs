import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const sa = require(path.join(__dirname, '../lib/fikr-apps-firebase-adminsdk-fbsvc-fa29770e55.json'));

const app = initializeApp({ credential: cert(sa) }, 'debug-app');
const db = getFirestore(app, 'prod-fikr-studio');

async function main() {
  const projectsSnap = await db.collection('studio_projects').get();
  const userIds = new Set();
  projectsSnap.docs.forEach(d => userIds.add(d.data().userId));

  for (const uid of userIds) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`USER: ${uid}`);
    console.log('='.repeat(60));

    const userProjects = await db.collection('studio_projects')
      .where('userId', '==', uid)
      .get();

    for (const p of userProjects.docs) {
      const data = p.data();
      const archived = data.archivedAt ? '🗑  ARCHIVED' : '✅ ACTIVE  ';
      const notesSnap = await db.collection('studio_notes')
        .where('projectId', '==', p.id)
        .get();
      const created = data.createdAt?.toDate?.()?.toISOString?.() ?? 'unknown';
      const updated = data.updatedAt?.toDate?.()?.toISOString?.() ?? 'unknown';
      console.log(`\n  ${archived} | "${data.name}"`);
      console.log(`    id:      ${p.id}`);
      console.log(`    notes:   ${notesSnap.size}`);
      console.log(`    created: ${created}`);
      console.log(`    updated: ${updated}`);

      for (const n of notesSnap.docs) {
        const nd = n.data();
        const preview = (nd.text || '').substring(0, 70).replace(/\n/g, ' ');
        const noteUpdated = nd.updatedAt?.toDate?.()?.toISOString?.() ?? 'unknown';
        console.log(`      [${n.id}] updated:${noteUpdated} | "${preview}"`);
      }
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
