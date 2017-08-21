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
