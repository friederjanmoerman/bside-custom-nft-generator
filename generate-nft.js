const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// Helper function to load an image
const loadImageAsync = (src) => new Promise((resolve, reject) => {
  loadImage(src).then(resolve).catch(reject);
});

// Load configuration
const config = require('./config.json');

// Function to parse probabilities from filenames
const parseFilenames = (dirPath) => {
  const files = fs.readdirSync(dirPath);
  const items = {};

  files.forEach(file => {
    const match = file.match(/#(\d+)/); // Match the percentage number
    if (match) {
      const percentage = parseFloat(match[1]);
      items[file] = percentage / 100; // Convert percentage to probability
    } else {
      items[file] = 1; // Default probability if not specified
    }
  });

  const totalProbability = Object.values(items).reduce((acc, curr) => acc + curr, 0);
  Object.keys(items).forEach(key => {
    items[key] /= totalProbability; // Normalize probabilities
  });

  return items;
};

// Function to get a random item based on probabilities
const getRandomItem = (items) => {
  const rand = Math.random();
  let sum = 0;
  for (const item in items) {
    sum += items[item];
    if (rand <= sum) return item;
  }
  return null;
};

// Function to draw a layer
const drawLayer = async (ctx, canvas, layerConfig, traits, gender = null) => {
    console.log(`Drawing layer: ${layerConfig.name}`);
    let layer = config.layers[layerConfig.name];
  
    if (layerConfig.name === "gender") {
      const subcategoryProbabilities = {};
      for (const subcategory in layer.subcategories) {
        subcategoryProbabilities[subcategory] = layer.subcategories[subcategory].probability;
      }
      gender = getRandomItem(subcategoryProbabilities);
      console.log(`Selected gender: ${gender}`);
  
      traits.push({ trait_type: "Gender", value: gender });
  
      const genderLayers = layer.subcategories[gender].layers;
  
      for (const genderLayer of genderLayers) {
        await drawLayer(ctx, canvas, genderLayer, traits, gender);
      }
    } else if (gender && config.layers.gender.subcategories[gender].layers.some(l => l.name === layerConfig.name)) {
      const genderLayer = config.layers.gender.subcategories[gender].layers.find(l => l.name === layerConfig.name);
      if (genderLayer && genderLayer.path) {
        const items = parseFilenames(genderLayer.path);
        const item = getRandomItem(items);
        console.log(`Drawing ${layerConfig.name} layer for ${gender} from path ${genderLayer.path}: ${item}`);
        
        // Remove the percentage part from the filename for metadata
        const cleanedItem = item.replace(/#\d+/, '');
        const image = await loadImageAsync(path.join(__dirname, genderLayer.path, item));
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  
        traits.push({ trait_type: layerConfig.name, value: cleanedItem });
      }
    } else if (layer && layer.path) {
      const items = parseFilenames(layer.path);
      const item = getRandomItem(items);
      console.log(`Drawing ${layerConfig.name} layer from path ${layer.path}: ${item}`);
  
      // Remove the percentage part from the filename for metadata
      const cleanedItem = item.replace(/#\d+/, '');
      const image = await loadImageAsync(path.join(__dirname, layer.path, item));
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  
      traits.push({ trait_type: layerConfig.name, value: cleanedItem });
    }
  };
  

// Function to generate NFT
const generateNFT = async (editionCount, layerConfig) => {
  for (let i = 0; i < editionCount; i++) {
    const canvas = createCanvas(1000, 1000); // Adjust size as needed
    const ctx = canvas.getContext('2d');
    const traits = [];

    for (const layer of layerConfig.layersOrder) {
      await drawLayer(ctx, canvas, layer, traits);
    }

    const imageName = `nft-${i}.png`;
    const out = fs.createWriteStream(path.join(__dirname, 'output', imageName));
    const stream = canvas.createPNGStream();
    stream.pipe(out);

    // Wait for the image file to finish writing
    await new Promise((resolve) => out.on('finish', resolve));
    console.log(`NFT ${i} was created.`);

    // Save metadata
    const metadata = {
      name: `${layerConfig.namePrefix} #${i}`,
      description: "Your NFT description here",
      image: imageName,
      attributes: traits
    };

    fs.writeFileSync(path.join(__dirname, 'output', `nft-${i}.json`), JSON.stringify(metadata, null, 2));
  }
};

// Create output directory if it doesn't exist
if (!fs.existsSync(path.join(__dirname, 'output'))) {
  fs.mkdirSync(path.join(__dirname, 'output'));
}

// Generate NFTs based on the configuration
for (const layerConfig of config.layerConfigurations) {
  generateNFT(layerConfig.growEditionSizeTo, layerConfig).catch(console.error);
}
