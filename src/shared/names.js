const ADJECTIVES = [
  'brave', 'fuzzy', 'lazy', 'swift', 'quiet', 'happy', 'bold',
  'calm', 'dark', 'eager', 'fair', 'glad', 'huge', 'icy', 'jolly',
  'kind', 'lush', 'merry', 'neat', 'odd', 'pure', 'rare', 'shy',
  'tidy', 'urban', 'vast', 'warm', 'wild', 'young', 'zany',
];

const ANIMALS = [
  'koala', 'penguin', 'otter', 'falcon', 'panda', 'lemur', 'gecko',
  'bison', 'crane', 'dingo', 'egret', 'finch', 'goose', 'heron',
  'ibis', 'jackal', 'kite', 'llama', 'moose', 'newt', 'oriole',
  'puffin', 'quail', 'raven', 'swift', 'tapir', 'urial', 'viper',
  'wombat', 'xenops', 'yak',
];

/**
 * Generate a unique "adjective-animal" name not already in existingNames.
 * @param {string[]} existingNames
 * @returns {string}
 */
export function generateName(existingNames) {
  const existing = new Set(existingNames);
  let attempts = 0;
  while (attempts < 1000) {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const name = `${adj}-${animal}`;
    if (!existing.has(name)) return name;
    attempts++;
  }
  // Fallback: append random suffix
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj}-${animal}-${Math.random().toString(36).slice(2, 6)}`;
}
