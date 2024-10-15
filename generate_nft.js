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

const drawLayer = async (ctx, canvas, layerConfig, traits, gender = null) => {
  console.log(`Drawing layer: ${layerConfig.name}`);
  let layer = config.layers[layerConfig.name];

  const RED_TEXT = '\x1b[31m';  // ANSI escape code for red text
  const RESET_TEXT = '\x1b[0m'; // ANSI escape code to reset text color

  if (layerConfig.name === "gender") {
    const subcategoryProbabilities = {};
    for (const subcategory in layer.subcategories) {
      subcategoryProbabilities[subcategory] = layer.subcategories[subcategory].probability;
    }
    gender = getRandomItem(subcategoryProbabilities);
    console.log(`Selected gender: ${gender}`);

    traits.push({ trait_type: "gender", value: gender });

    const genderLayers = layer.subcategories[gender].layers;

    for (const genderLayer of genderLayers) {
      if (genderLayer.name === "eyes") continue; // Skip eyes for now
      await drawLayer(ctx, canvas, genderLayer, traits, gender);
    }

    // Now draw the eyes layer on top
    const eyesLayer = genderLayers.find(l => l.name === "eyes");
    if (eyesLayer) {
      const subcategoryProbabilities = {};
      for (const subcategory in eyesLayer.subcategories) {
        subcategoryProbabilities[subcategory] = eyesLayer.subcategories[subcategory].probability;
      }
      const selectedSubcategory = getRandomItem(subcategoryProbabilities);
      console.log(`Selected subtype subcategory: ${selectedSubcategory}`);

      traits.push({ trait_type: "subtype", value: selectedSubcategory });

      const subcategoryLayers = eyesLayer.subcategories[selectedSubcategory].layers;

      for (const subcategoryLayer of subcategoryLayers) {
        if (subcategoryLayer.name === "hatOrHair") {
          // Handle hat or hair subcategory
          const hatOrHairProbabilities = {};
          for (const item of subcategoryLayer.layers) {
            hatOrHairProbabilities[item.name] = subcategoryLayer.probability;
          }
          const selectedHatOrHair = getRandomItem(hatOrHairProbabilities);
          console.log(`Selected hatOrHair: ${selectedHatOrHair}`);

          traits.push({ trait_type: "hatOrHair", value: selectedHatOrHair });

          const hatOrHairLayer = subcategoryLayer.layers.find(l => l.name === selectedHatOrHair);

          if (hatOrHairLayer) {
            const items = parseFilenames(hatOrHairLayer.path);
            const item = getRandomItem(items);
            console.log(`Drawing ${hatOrHairLayer.name} layer from path ${hatOrHairLayer.path}: ${item}`);

            const cleanedItem = item.replace(/#\d+/, '').replace(/\.[^/.]+$/, '');
            try {
              const imagePath = path.join(__dirname, hatOrHairLayer.path, item);
              if (!fs.existsSync(imagePath)) {
                console.error(`${RED_TEXT}Path not found for ${hatOrHairLayer.name} layer: ${imagePath}${RESET_TEXT}`);
                return; // Exit function early if path not found
              }
              const image = await loadImageAsync(imagePath);
              ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            } catch (error) {
              console.error(`${RED_TEXT}Failed to load image for ${hatOrHairLayer.name} layer: ${error.message}${RESET_TEXT}`);
            }
            traits.push({ trait_type: hatOrHairLayer.name, value: cleanedItem });
          }
        } else if (subcategoryLayer.subcategories) {
          // If there are further subcategories, process them recursively
          const subcategoryProbabilities = {};
          for (const subcategory in subcategoryLayer.subcategories) {
            subcategoryProbabilities[subcategory] = subcategoryLayer.subcategories[subcategory].probability;
          }
          const selectedSubcategory = getRandomItem(subcategoryProbabilities);
          console.log(`Selected ${subcategoryLayer.name} subcategory: ${selectedSubcategory}`);

          traits.push({ trait_type: subcategoryLayer.name, value: selectedSubcategory });

          const furtherSubcategoryLayers = subcategoryLayer.subcategories[selectedSubcategory].layers;

          for (const furtherSubcategoryLayer of furtherSubcategoryLayers) {
            await drawLayer(ctx, canvas, furtherSubcategoryLayer, traits, gender);
          }
        } else {
          const items = parseFilenames(subcategoryLayer.path);
          const item = getRandomItem(items);
          console.log(`Drawing ${subcategoryLayer.name} layer from path ${subcategoryLayer.path}: ${item}`);

          const cleanedItem = item.replace(/#\d+/, '').replace(/\.[^/.]+$/, '');
          try {
            const imagePath = path.join(__dirname, subcategoryLayer.path, item);
            if (!fs.existsSync(imagePath)) {
              console.error(`${RED_TEXT}Path not found for ${subcategoryLayer.name} layer: ${imagePath}${RESET_TEXT}`);
              return; // Exit function early if path not found
            }
            const image = await loadImageAsync(imagePath);
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          } catch (error) {
            console.error(`${RED_TEXT}Failed to load image for ${subcategoryLayer.name} layer: ${error.message}${RESET_TEXT}`);
          }
          traits.push({ trait_type: subcategoryLayer.name, value: cleanedItem });
        }
      }
    }
  } else if (gender && config.layers.gender.subcategories[gender].layers.some(l => l.name === layerConfig.name)) {
    const genderLayer = config.layers.gender.subcategories[gender].layers.find(l => l.name === layerConfig.name);
    if (genderLayer.subcategories) {
      const subcategoryProbabilities = {};
      for (const subcategory in genderLayer.subcategories) {
        subcategoryProbabilities[subcategory] = genderLayer.subcategories[subcategory].probability;
      }
      const selectedSubcategory = getRandomItem(subcategoryProbabilities);
      console.log(`Selected ${layerConfig.name} subcategory: ${selectedSubcategory}`);

      traits.push({ trait_type: layerConfig.name, value: selectedSubcategory });

      const subcategoryLayers = genderLayer.subcategories[selectedSubcategory].layers;

      for (const subcategoryLayer of subcategoryLayers) {
        await drawLayer(ctx, canvas, subcategoryLayer, traits, gender);
      }
    } else {
      const items = parseFilenames(genderLayer.path);
      const item = getRandomItem(items);
      console.log(`Drawing ${layerConfig.name} layer for ${gender} from path ${genderLayer.path}: ${item}`);

      const cleanedItem = item.replace(/#\d+/, '').replace(/\.[^/.]+$/, '');
      try {
        const imagePath = path.join(__dirname, genderLayer.path, item);
        if (!fs.existsSync(imagePath)) {
          console.error(`${RED_TEXT}Path not found for ${layerConfig.name} layer: ${imagePath}${RESET_TEXT}`);
          return; // Exit function early if path not found
        }
        const image = await loadImageAsync(imagePath);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      } catch (error) {
        console.error(`${RED_TEXT}Failed to load image for ${layerConfig.name} layer: ${error.message}${RESET_TEXT}`);
      }

      traits.push({ trait_type: layerConfig.name, value: cleanedItem });
    }
  } else if (layer && layer.path) {
    const items = parseFilenames(layer.path);
    const item = getRandomItem(items);
    console.log(`Drawing ${layerConfig.name} layer from path ${layer.path}: ${item}`);

    const cleanedItem = item.replace(/#\d+/, '').replace(/\.[^/.]+$/, '');
    try {
      const imagePath = path.join(__dirname, layer.path, item);
      if (!fs.existsSync(imagePath)) {
        console.error(`${RED_TEXT}Path not found for ${layerConfig.name} layer: ${imagePath}${RESET_TEXT}`);
        return; // Exit function early if path not found
      }
      // Load the image to get its dimensions
      const image = await loadImageAsync(imagePath);

      // Get the natural dimensions of the loaded image
      const layerWidth = layerConfig.width || image.width;
      const layerHeight = layerConfig.height || image.height;

      // Calculate center position
      const layerX = (canvas.width - layerWidth) / 2; // Center X position
      const layerY = (canvas.height - layerHeight) / 2; // Center Y position

      // Draw the image at specified position and size
      ctx.drawImage(image, layerX, layerY, layerWidth, layerHeight);
    } catch (error) {
      console.error(`${RED_TEXT}Failed to load image for ${layerConfig.name} layer: ${error.message}${RESET_TEXT}`);
    }

    traits.push({ trait_type: layerConfig.name, value: cleanedItem });
  }
};

// Helper function to capitalize words and replace hyphens with spaces
const formatValue = (value) => {
  return value.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
};

// Helper function to capitalize trait_type
const formatTraitType = (traitType) => {
  return traitType.replace(/\b\w/g, char => char.toUpperCase());
};

const generateNFT = async (editionCount, layerConfig) => {
  const allNFTs = [];
  const startNumber = layerConfig.startNumber || 0;

  for (let i = 0; i < editionCount; i++) {
    const canvas = createCanvas(1772, 1772); // Adjust size as needed
    const ctx = canvas.getContext('2d');
    const traits = [];

    for (const layer of layerConfig.layersOrder) {
      await drawLayer(ctx, canvas, layer, traits);
    }

    const imageNumber = startNumber + i;
    const imageName = `${layerConfig.namePrefix}-${imageNumber}.png`;
    const out = fs.createWriteStream(path.join(__dirname, 'output', imageName));
    const stream = canvas.createPNGStream();
    stream.pipe(out);

    // Wait for the image file to finish writing
    await new Promise((resolve) => out.on('finish', resolve));
    console.log(`NFT ${imageNumber} was created.`);

    // Remove duplicates from traits
    const uniqueTraits = Array.from(new Set(traits.map(t => JSON.stringify(t)))).map(t => JSON.parse(t));

    // Format trait values and trait_type
    uniqueTraits.forEach(trait => {
      trait.trait_type = formatTraitType(trait.trait_type);
      trait.value = formatValue(trait.value);
    });

    // Create a metadata object
    const metadata = {
      filename: imageName,
      title: `${layerConfig.namePrefix}-${imageNumber}`,
      nbcopies: '1',
      nbself: '0',
      description: `${layerConfig.description}`,
      ...uniqueTraits.reduce((acc, trait) => {
        acc[trait.trait_type] = trait.value;
        return acc;
      }, {})
    };

    fs.writeFileSync(path.join(__dirname, 'output', `${layerConfig.namePrefix}-${imageNumber}.json`), JSON.stringify(metadata, null, 2));
    allNFTs.push(metadata);
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
