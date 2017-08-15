import levenshtein from 'fast-levenshtein';

export function isLocalName(name) {
  switch(name.split(':')) {
    case 1: return true;
    case 2: return false;
    default: throw new Error(`Invalid name: ${name}`);
  }
}

export function sleep(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

export function closestLevensteinMatch(str, strings) {
  var distance = Number.MAX_SAFE_INTEGER;
  var bestMatch;
  strings.forEach(s=> {
    let sDistance = levenshtein.get(str, s);
    if (sDistance<distance) {
      distance = sDistance;
      bestMatch = s;
    }
  });
  return bestMatch;
}
