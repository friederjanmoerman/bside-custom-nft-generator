const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');

// Load metadata files
const metadataDir = path.join(__dirname, 'output');
const metadataFiles = fs.readdirSync(metadataDir).filter(file => file.endsWith('.json'));

const allNFTs = metadataFiles.map(file => {
  const metadata = JSON.parse(fs.readFileSync(path.join(metadataDir, file)));
  return metadata;
});

// Extract numeric part from filename for sorting
const extractNumber = (filename) => {
  const match = filename.match(/-(\d+)\.png/);
  return match ? parseInt(match[1], 10) : 0;
};

// Sort metadata by the numeric part of the filename
allNFTs.sort((a, b) => extractNumber(a.filename) - extractNumber(b.filename));

// Define fields for CSV
const fields = ['filename', 'title', 'nbcopies', 'nbself', 'description', ...Array.from(new Set(allNFTs.flatMap(nft => Object.keys(nft)))).filter(key => !['filename', 'title', 'nbcopies', 'nbself', 'description'].includes(key))];
const opts = { fields };

// Convert to CSV
try {
  const parser = new Parser(opts);
  const csv = parser.parse(allNFTs);
  fs.writeFileSync(path.join(metadataDir, 'Bside.csv'), csv);
  console.log('CSV file created.');
} catch (err) {
  console.error(err);
}
