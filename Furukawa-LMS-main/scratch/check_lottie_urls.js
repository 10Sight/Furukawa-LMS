const https = require('https');
const fs = require('fs');

const urls = [
  'https://raw.githubusercontent.com/Gamote/lottie-react/master/demo/src/groovyWalk.json',
  'https://raw.githubusercontent.com/Gamote/lottie-react/master/stories/groovyWalk.json',
  'https://raw.githubusercontent.com/Gamote/lottie-react/master/example/src/groovyWalk.json',
  'https://raw.githubusercontent.com/Gamote/lottie-react/master/groovyWalk.json',
  'https://raw.githubusercontent.com/Gamote/lottie-react/master/stories/assets/groovyWalk.json',
  'https://raw.githubusercontent.com/Gamote/lottie-react/master/stories/useLottie/groovyWalk.json',
  'https://raw.githubusercontent.com/Gamote/lottie-react/master/stories/Lottie/groovyWalk.json',
  'https://raw.githubusercontent.com/Gamote/lottie-react/master/stories/components/Lottie/groovyWalk.json',
];

function checkUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json && json.v && json.layers) {
            resolve({ url, success: true, name: json.nm || 'unnamed', layersCount: json.layers.length, size: data.length });
          } else {
            resolve({ url, success: false, error: 'Not a valid Lottie JSON (missing v or layers)' });
          }
        } catch (e) {
          resolve({ url, success: false, error: e.message, bodyStart: data.substring(0, 100) });
        }
      });
    }).on('error', (err) => {
      resolve({ url, success: false, error: err.message });
    });
  });
}

async function run() {
  console.log('Checking Lottie URLs...');
  for (const url of urls) {
    const result = await checkUrl(url);
    if (result.success) {
      console.log(`URL: ${url}`);
      console.log(`Success: ${result.success}`);
      console.log(`  Name: ${result.name}`);
      console.log(`  Layers: ${result.layersCount}`);
      console.log(`  Size: ${result.size} bytes`);
      console.log('---');
    }
  }
  console.log('Done checking.');
}

run();
