function shortenProductName(fullName, brand) {
  let name = fullName || 'Unknown Item';
  const segments = name.split(' > ').map(s => s.trim()).filter(Boolean);
  const item = segments[segments.length - 1] || 'Unknown Item';
  const sub = segments.length > 1 ? segments[segments.length - 2] : '';
  let combined = sub && !item.toLowerCase().includes(sub.toLowerCase()) 
    ? `${sub} ${item}` 
    : item;
  if (brand && !combined.toLowerCase().includes(brand.toLowerCase())) {
    combined = `${brand} ${combined}`;
  }
  const tokens = combined.split(/\s+/);
  const seen = new Set();
  const uniqueTokens = [];
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (!seen.has(lower) || token.length <= 2) {
      uniqueTokens.push(token);
      seen.add(lower);
    }
  }
  return uniqueTokens.join(' ');
}

console.log(shortenProductName("STEEL MATTING > #6 MAKAPAL", "MAKAPAL"));
console.log(shortenProductName("PAINTS > BOYSEN > FLAT WALL", "BOYSEN"));
console.log(shortenProductName("TOOLS > HAMMER > CLAW HAMMER", "STANLEY"));
console.log(shortenProductName("MAKAPAL > #6 MAKAPAL", "MAKAPAL"));
