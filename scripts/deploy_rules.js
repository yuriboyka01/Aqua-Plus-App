import { execSync } from 'child_process';
import { readFileSync } from 'fs';

async function deploy() {
  console.log('1. Getting gcloud auth token...');
  const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
  console.log('Token acquired (length: ' + token.length + ')');

  const rulesContent = readFileSync('firestore.rules', 'utf8');

  console.log('2. Creating new ruleset on positive-drake-n4mm2...');
  const createRes = await fetch('https://firebaserules.googleapis.com/v1/projects/positive-drake-n4mm2/rulesets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      source: {
        files: [
          {
            name: 'firestore.rules',
            content: rulesContent
          }
        ]
      }
    })
  });

  const createData = await createRes.json();
  if (!createRes.ok) {
    console.error('Failed to create ruleset:', createData);
    process.exit(1);
  }
  console.log('New ruleset created:', createData.name);

  console.log('3. Updating release for database ai-studio-4b6f33c0-20b1-4c18-b179-368ff6878ffb...');
  const releaseName = 'projects/positive-drake-n4mm2/releases/cloud.firestore/ai-studio-4b6f33c0-20b1-4c18-b179-368ff6878ffb';
  const patchRes = await fetch(`https://firebaserules.googleapis.com/v1/${releaseName}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      release: {
        name: releaseName,
        rulesetName: createData.name
      }
    })
  });

  const patchData = await patchRes.json();
  if (!patchRes.ok) {
    console.error('Failed to update release:', patchData);
    process.exit(1);
  }

  console.log('RELEASE SUCCESSFULLY UPDATED TO LIVE CLOUD FIRESTORE!');
  console.log(JSON.stringify(patchData, null, 2));
}

deploy().catch(err => {
  console.error('Deploy error:', err);
  process.exit(1);
});
