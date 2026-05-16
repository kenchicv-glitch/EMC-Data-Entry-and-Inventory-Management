import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';

// === QUICK EPOXY cipher ===
const CIPHER = { Q:1,U:2,I:3,C:4,K:5,E:6,P:7,O:8,X:9,Y:0 };

function decodeWSP(coded) {
  if (!coded || typeof coded !== 'string') return 0;
  coded = coded.trim().replace(/,/g, '').replace(/\s/g, '').replace(/\/FT/gi, '');
  if (!coded) return 0;
  let result = '', lastDigit = '';
  for (const ch of coded.toUpperCase()) {
    if (ch === '.') { result += '.'; continue; }
    if (ch === 'S') { result += lastDigit; continue; }
    if (CIPHER[ch] !== undefined) { lastDigit = String(CIPHER[ch]); result += lastDigit; }
  }
  return parseFloat(result) || 0;
}

function parseSRP(val) {
  if (!val) return 0;
  return parseFloat(String(val).replace(/,/g,'').replace(/\s/g,'').replace(/\/FT/gi,'')) || 0;
}

function cleanName(s) { return s.replace(/\s+/g,' ').trim(); }

const skuCounters = {};
function genSKU(prefix) {
  const p = prefix.toUpperCase().replace(/[^A-Z0-9]/g,'').substring(0,6) || 'GEN';
  skuCounters[p] = (skuCounters[p] || 0) + 1;
  return `${p}-${String(skuCounters[p]).padStart(3,'0')}`;
}

function parseCSV(text) {
  return text.split(/\r?\n/).map(line => {
    const cells = []; let inQ = false, cell = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { cells.push(cell.trim()); cell = ''; continue; }
      cell += ch;
    }
    cells.push(cell.trim());
    return cells;
  });
}

// Helper: add product with WSP>SRP safety check
function addProduct(arr, p) {
  // FIX 1: If WSP > SRP, zero both out
  if (p.buying_price > p.selling_price && p.selling_price > 0) {
    p.buying_price = 0;
    p.selling_price = 0;
  }
  arr.push(p);
}

// === ELECTRICAL ===
function parseElectrical(rows) {
  const products = [];
  let section = '', brandL = '', brandR = '', unitL = 'pc', unitR = 'pc';

  for (const r of rows) {
    const c = [0,1,2,3,4,5].map(j => (r[j]||'').trim());
    if (!c[0] && !c[1] && !c[2] && !c[3]) continue;
    const norm = c[0].replace(/\s+/g,' ').trim();
    if (norm.match(/E\s*L\s*E\s*C\s*T\s*R\s*I\s*C\s*A\s*L/i) || norm.match(/^Jan/i)) continue;

    const secPat = [
      [/P\s*H\s*E\s*L\s*P\s*S\s*D\s*O\s*D\s*G\s*E/i,'Phelps Dodge'],
      [/^R\s*O\s*Y\s*U\s*PDX$/i,'Royu PDX'], [/^R\s*O\s*Y\s*U\s*$/i,'Royu'],
      [/^POWERFLEX$/i,'Powerflex'], [/^PANEL BOX$/i,'Panel Box'],
      [/^NEMA\s*$/i,'NEMA'], [/^FUSE BOX$/i,'Fuse Box'],
      [/^SAFETY BREAKER$/i,'Safety Breaker'],
      [/^CIRCUIT BREAKER.*PLUG.?IN$/i,'Circuit Breaker Plug-In'],
      [/^CIRCUIT BREAKER.*BOLT.?ON$/i,'Circuit Breaker Bolt-On'],
      [/^FLOURESCENT LAMP only$/i,'Fluorescent Lamp'],
      [/^FLOURESCENT HOUSING only$/i,'Fluorescent Housing'],
      [/^FLOURESCENT LAMP with HOUSING$/i,'Fluorescent Lamp w/ Housing'],
      [/^CIRCULAR LAMP$/i,'Circular Lamp'],
    ];
    let matched = false;
    for (const [p,s] of secPat) { if (p.test(norm)) { section = s; matched = true; break; } }
    if (matched) continue;

    if (c[1] === 'WSP' && c[2] === 'SRP') {
      const lbl = c[0].toLowerCase();
      if (lbl.includes('per box')) unitL = 'box';
      else if (lbl.includes('per mtr')) unitL = 'mtr';
      else if (['amp','branches'].includes(lbl)) unitL = 'pc';
      else brandL = c[0];
      if (c[3]) { const rl = c[3].toLowerCase(); if (rl.includes('per mtr')) unitR='mtr'; else if (rl.includes('per box')) unitR='box'; else { brandR=c[3]; unitR=unitL; } }
      else { unitR=unitL; brandR=''; }
      if (c[4]==='WSP'&&c[3]) brandR=c[3];
      continue;
    }

    const wireBrands = ['Phelps Dodge','Royu','Royu PDX','Powerflex'];
    
    function mkProduct(spec, wsp, srp, brand, unit) {
      let name, cat, size='';
      if (wireBrands.includes(section)) {
        name = `Wire ${spec} - ${section}`; cat = `Electricals > Wires > ${section}`; brand = section;
      } else if (section === 'Panel Box') { name = `Panel Box ${spec}`; cat = 'Electricals > Panel Box'; }
      else if (section === 'NEMA') { name = `NEMA ${spec}`; cat = 'Electricals > NEMA'; }
      else if (section === 'Fuse Box') { name = `Fuse Box ${spec}`; cat = 'Electricals > Fuse Box'; size = spec; }
      else if (section === 'Safety Breaker') { name = `Safety Breaker ${spec}`; cat = 'Electricals > Safety Breaker'; size = spec; }
      else if (section.startsWith('Circuit Breaker')) {
        const t = section.replace('Circuit Breaker ','');
        name = `Circuit Breaker ${t} ${spec}${brand?' - '+brand:''}`; cat = `Electricals > Circuit Breakers > ${t}`; size = spec;
      } else if (['Fluorescent Lamp','Fluorescent Housing','Fluorescent Lamp w/ Housing','Circular Lamp'].includes(section)) {
        name = `${section} ${spec}${brand?' - '+brand:''}`; cat = `Electricals > Lighting > ${section}`; size = spec;
      } else { name = `${section} ${spec}`; cat = 'Electricals'; }
      return { name: cleanName(name), buying_price: wsp, selling_price: srp, category_path: cat, brand: brand||'', unit, size };
    }

    const wspL = decodeWSP(c[1]), srpL = parseSRP(c[2]);
    if ((wspL>0||srpL>0) && c[0]) {
      const b = wireBrands.includes(section)?section:brandL;
      addProduct(products, mkProduct(c[0], wspL, srpL, b, unitL));
    }
    const wspR = decodeWSP(c[4]), srpR = parseSRP(c[5]);
    if ((wspR>0||srpR>0) && c[3]) {
      const b = wireBrands.includes(section)?section:brandR;
      addProduct(products, mkProduct(c[3], wspR, srpR, b, unitR));
    }
  }
  return products;
}

// === ROOFING ===
function parseRoofing(rows) {
  const products = [];
  let section = 'Roofing';
  // Track right-side section independently
  let rightSection = '';

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const c = [0,1,2,3,4,5].map(j=>(r[j]||'').trim());
    if (!c[0]&&!c[3]) continue;
    if (c[0].match(/^ROOFING PRICE/i)||c[0].match(/^as of/i)) continue;

    // Section detection
    const lSec = [[/^LONG SPAN/i,'Long Span'],[/^RIB TYPE/i,'Rib Type'],[/^CORRUGATED MAKAPAL/i,'Corrugated GI'],[/^CORRUGATED MANIPIS/i,'Corrugated GI'],[/^PLASTIC SHEET/i,'Plastic Sheet'],[/^PLAIN SHEET/i,'Plain Sheet'],[/^GUTTER/i,'Gutter'],[/^FLASHING/i,'Gutter'],[/^RIDGE ROLL/i,'Gutter'],[/^INSULATION FOAM/i,'Insulation Foam'],[/^POLYCARBONATE/i,'Polycarbonate'],[/^STEEL DECK/i,'Steel Deck']];
    const rSec = [[/^CORRUGATED.*RED/i,'Corrugated Colored'],[/^PLASTIC SHEET/i,'Plastic Sheet'],[/^PLAIN SHEET/i,'Plain Sheet'],[/^COLORED GUTTER/i,'Gutter'],[/^FIBER GLASS/i,'Fiber Glass'],[/^STEEL DECK/i,'Steel Deck'],[/^POLYCARBONATE/i,'Polycarbonate']];

    let leftSec = section;
    for (const [p,s] of lSec) { if (p.test(c[0])) leftSec = s; }
    for (const [p,s] of rSec) { if (c[3]&&p.test(c[3])) rightSection = s; }

    if (c[1]==='WSP'&&c[2]==='SRP') { section = leftSec; continue; }
    if (c[0]&&!c[1]&&!c[2]&&!c[4]&&!c[5]) {
      for (const [p,s] of lSec) { if (p.test(c[0])) section = s; }
      continue;
    }

    // LEFT data
    const wspL = decodeWSP(c[1]), srpL = parseSRP(c[2]);
    if ((wspL>0||srpL>0) && c[0]) {
      let unit = 'pc', name = c[0], size = '';
      if (c[1].includes('/FT')||c[0].toLowerCase().includes('/ft')) unit='ft';
      else if (section==='Steel Deck') unit='mtr';
      else if (section==='Insulation Foam') {
        const prev = rows.slice(Math.max(0,i-5),i).map(r=>(r[0]||'').trim()).join(' ');
        unit = prev.includes('per meter')?'mtr':'roll';
      }
      
      // FIX 4: Expand short corrugated/plain sheet names
      if (section==='Corrugated GI' && /^\d+/.test(name)) {
        size = name.match(/\d+/)?.[0] || '';
        const isManipis = name.includes('apo panda') || name.includes('manipis');
        name = `Corrugated GI ${size}ft ${isManipis?'Manipis':'Makapal'}`;
      }
      if (section==='Plain Sheet' && /^\d+$/.test(name.trim())) {
        // FIX 3: These are actually Fiber Glass items from right column of source
        // But the left-side plain sheet short names are the actual GI plain sheets
        size = name; 
      }
      
      addProduct(products, { name: cleanName(name), buying_price: wspL, selling_price: srpL, category_path: `Roofing > ${leftSec!=='Roofing'?leftSec:section}`, brand:'', unit, size });
    }

    // RIGHT data
    const wspR = decodeWSP(c[4]), srpR = parseSRP(c[5]);
    if ((wspR>0||srpR>0) && c[3]) {
      let unit='pc', name=c[3], size='';
      const rSect = rightSection || section;
      if (rSect==='Steel Deck') unit='mtr';
      else if (rSect==='Insulation Foam') {
        const prev = rows.slice(Math.max(0,i-5),i).map(r=>(r[0]||'').trim()).join(' ');
        unit = prev.includes('per meter')?'mtr':'roll';
      }

      // FIX 3: Fiber Glass items - right column items 12, 10, 8 under FIBER GLASS header
      if (rSect==='Fiber Glass' && /^\d+$/.test(name.trim())) {
        size = name;
        name = `Fiber Glass ${size}ft`;
      }
      // FIX 4: Corrugated colored short names
      if (rSect==='Corrugated Colored' && /^\d+/.test(name)) {
        size = name.match(/\d+/)?.[0] || '';
        name = `Corrugated Colored ${name}`;
      }
      // FIX 2: WHITE plastic sheet was miscategorized
      if (['WHITE','GREEN','BLUE'].includes(name.toUpperCase()) && rSect==='Corrugated GI') {
        // These are actually Plastic Sheet 8" items
        addProduct(products, { name: `Plastic Sheet 8" ${name}`, buying_price: wspR, selling_price: srpR, category_path: 'Roofing > Plastic Sheet', brand:'', unit, size:'8"' });
        continue;
      }

      addProduct(products, { name: cleanName(name), buying_price: wspR, selling_price: srpR, category_path: `Roofing > ${rSect}`, brand:'', unit, size });
    }

    if (leftSec !== 'Roofing') section = leftSec;
  }
  return products;
}

// === STEEL ===
function parseSteel(rows) {
  const products = [];
  let secL = 'Steel', secR = 'Steel';

  for (const r of rows) {
    const c = [0,1,2,3,4,5].map(j=>(r[j]||'').trim());
    if (!c[0]&&!c[3]) continue;
    if (c[0].match(/^STEEL PRICE/i)||c[0].match(/^Jan/i)) continue;

    const lPatterns = [[/^G\.?I\.?\s*PIPE\s*S-?20/i,'GI Pipe > S-20 (Manipis)'],[/^TUBULAR.*MANIPIS/i,'Tubular > Manipis'],[/^ANGLE BAR.*3\/16/i,'Angle Bar > Manipis'],[/^FLAT BAR.*3\/16/i,'Flat Bar > Manipis'],[/^SQUARE BAR/i,'Square Bar'],[/^CONDUIT PIPE/i,'Conduit Pipe'],[/^C-PURLINS.*MANIPIS/i,'C-Purlins > Manipis'],[/^STEEL MATTING/i,'Steel Matting'],[/^METAL FURRING/i,'Metal Framing'],[/^METAL STUD/i,'Metal Framing'],[/^METAL TRACK/i,'Metal Framing']];
    const rPatterns = [[/^G\.?I\.?\s*PIPE\s*S-?40/i,'GI Pipe > S-40 (Makapal)'],[/^TUBULAR.*MAKAPAL/i,'Tubular > Makapal'],[/^ANGLE BAR.*1\/4/i,'Angle Bar > Makapal'],[/^FLAT BAR.*1\/4/i,'Flat Bar > Makapal'],[/^ROUND BAR/i,'Round Bar'],[/^CHROME PIPE/i,'Chrome Pipe'],[/^C-PURLINS.*MAKAPAL/i,'C-Purlins > Makapal'],[/^WIRE\s*$/i,'Wire & Fencing'],[/^BARBED/i,'Wire & Fencing'],[/^CYCLONE/i,'Wire & Fencing'],[/^GROUNDING/i,'Grounding'],[/^CARRYING/i,'Metal Framing'],[/^WALL ANGLE/i,'Metal Framing'],[/^WALL CLIP/i,'Metal Framing']];

    if (c[1]==='WSP'&&c[2]==='SRP') {
      for (const [p,s] of lPatterns) { if (p.test(c[0])) secL=s; }
      if (c[4]==='WSP') for (const [p,s] of rPatterns) { if (c[3]&&p.test(c[3])) secR=s; }
      continue;
    }

    for (const [p,s] of lPatterns) { if (p.test(c[0])) secL=s; }
    for (const [p,s] of rPatterns) { if (c[3]&&p.test(c[3])) secR=s; }
    if (c[3]&&/^GI WIRE|^BARBED|^CYCLONE/i.test(c[3])) secR='Wire & Fencing';
    if (c[0]&&/^CYCLONE/i.test(c[0])) secL='Wire & Fencing';
    if (c[3]&&/^GROUNDING/i.test(c[3])) secR='Grounding';

    // FIX 5: #6 MAKAPAL is Steel Matting, not Metal Framing
    // We handle this by checking the actual item name

    const wspL=decodeWSP(c[1]), srpL=parseSRP(c[2]);
    if ((wspL>0||srpL>0)&&c[0]) {
      let skip=false;
      for (const [p] of lPatterns) { if (p.test(c[0])&&!c[0].match(/^\d|^\s*\d|^#/)) skip=true; }
      if (!skip) {
        let name = c[0], size = '';
        // FIX 5: Add S-20/S-40 prefix to GI pipe names
        if (secL.includes('GI Pipe')) {
          const variant = secL.includes('S-20') ? 'S-20' : 'S-40';
          name = `GI Pipe ${variant} ${c[0]}`;
          size = c[0];
        }
        addProduct(products, { name:cleanName(name), buying_price:wspL, selling_price:srpL, category_path:`Steel > ${secL}`, brand:'', unit:'pc', size });
      }
    }

    const wspR=decodeWSP(c[4]), srpR=parseSRP(c[5]);
    if ((wspR>0||srpR>0)&&c[3]) {
      let skip=false;
      for (const [p] of rPatterns) { if (p.test(c[3])&&!c[3].match(/^\d|^\s*\d|^#/)) skip=true; }
      if (c[3]==='QTY') skip=true;
      if (!skip) {
        let name = c[3], size = '', cat = `Steel > ${secR}`;
        // FIX 5: GI Pipe right side
        if (secR.includes('GI Pipe')) {
          const variant = secR.includes('S-20') ? 'S-20' : 'S-40';
          name = `GI Pipe ${variant} ${c[3]}`;
          size = c[3];
        }
        // FIX 6: #6 MAKAPAL → Steel Matting
        if (name.includes('#6 MAKAPAL')) cat = 'Steel > Steel Matting';
        
        addProduct(products, { name:cleanName(name), buying_price:wspR, selling_price:srpR, category_path:cat, brand:'', unit:'pc', size });
      }
    }
  }
  return products;
}

// === WOOD ===
function parseWood(rows) {
  const products = [];
  let section='Plywood', subL='Ordinary', subR='Marine';

  for (const r of rows) {
    const c = [0,1,2,3,4,5].map(j=>(r[j]||'').trim());
    if (!c[0]&&!c[3]) continue;
    if (c[0].match(/P\s*L\s*Y\s*W\s*O\s*O\s*D/i)||c[0].match(/^Jan|^Feb|^Oct/i)) continue;
    if (c[0].match(/LOCAL PLYWOOD/i)) { section='Plywood'; continue; }
    if (c[0].match(/E\s*C\s*O\s*4|C\s*O\s*C\s*O/i)||c[0].match(/E C O|C O C O/i)) { section='Eco Lumber'; subL='Eco 4'; subR='Coco Lumber'; continue; }
    if (c[1]==='WSP'&&c[2]==='SRP') { subL=c[0]||subL; subR=c[3]||subR; continue; }
    if (c[0].match(/^PHENOLIC.*SHERA/i)||c[0].match(/PHENOLIC \/ SHERA/i)) { section='Board'; continue; }

    const wspL=decodeWSP(c[1]), srpL=parseSRP(c[2]);
    if ((wspL>0||srpL>0)&&c[0]) {
      let cat, size='';
      if (section==='Plywood') cat=`Wood & Lumber > Plywood > ${subL}`;
      else if (section==='Board') {
        if (c[0].match(/SHERA/i)) cat='Wood & Lumber > Board > Shera Board';
        else if (c[0].match(/PHENOLIC/i)) cat='Wood & Lumber > Board > Phenolic';
        else if (c[0].match(/GYPSUM/i)) cat='Wood & Lumber > Board > Gypsum';
        else cat='Wood & Lumber > Board';
      } else { cat=`Wood & Lumber > Eco Lumber > ${subL==='ECO 4'?'Eco 4':subL}`; }
      // Extract size from lumber names like "2X4X12"
      const sizeMatch = c[0].match(/(\d+X\d+X?\d*)/i);
      if (sizeMatch) size = sizeMatch[1];
      addProduct(products, { name:cleanName(c[0]), buying_price:wspL, selling_price:srpL, category_path:cat, brand:'', unit:'pc', size });
    }

    const wspR=decodeWSP(c[4]), srpR=parseSRP(c[5]);
    if ((wspR>0||srpR>0)&&c[3]) {
      let cat;
      if (section==='Plywood') cat=`Wood & Lumber > Plywood > ${subR}`;
      else if (section==='Board') { cat=c[3].match(/GYPSUM/i)?'Wood & Lumber > Board > Gypsum':'Wood & Lumber > Board'; }
      else { cat=`Wood & Lumber > Eco Lumber > ${subR==='COCO'?'Coco Lumber':subR}`; }
      const sizeMatch = c[3].match(/(\d+X\d+X?\d*)/i);
      addProduct(products, { name:cleanName(c[3]), buying_price:wspR, selling_price:srpR, category_path:cat, brand:'', unit:'pc', size: sizeMatch?sizeMatch[1]:'' });
    }
  }
  return products;
}

// === MAIN ===
async function main() {
  const dir = path.join(process.cwd(), 'Excel Pricelist');
  const read = f => parseCSV(fs.readFileSync(path.join(dir, f), 'utf-8'));
  
  const allProducts = [
    ...parseElectrical(read('ELECTRICAL EMC PRICELIST 2026.csv')),
    ...parseRoofing(read('ROOFING EMC PRICELIST 2026.csv')),
    ...parseSteel(read('STEEL EMC PRICELIST 2026.csv')),
    ...parseWood(read('WOOD EMC PRICELIST 2026.csv')),
  ];

  allProducts.forEach(p => {
    const parts = p.category_path.split(' > ');
    const prefix = (parts[parts.length-1]||'GEN').replace(/[^A-Za-z0-9]/g,'').substring(0,6).toUpperCase()||'GEN';
    p.sku = genSKU(prefix);
  });

  // Check for zeroed-out products
  const zeroed = allProducts.filter(p => p.buying_price===0 && p.selling_price===0);

  const cats = {};
  allProducts.forEach(p => { cats[p.category_path] = (cats[p.category_path]||0)+1; });
  
  console.log(`\n=== PARSED ${allProducts.length} PRODUCTS ===\n`);
  console.log('Category Breakdown:');
  Object.entries(cats).sort().forEach(([c,n]) => console.log(`  ${c}: ${n}`));
  
  if (zeroed.length) {
    console.log(`\n⚠️  ${zeroed.length} products zeroed out (WSP>SRP):`);
    zeroed.forEach(p => console.log(`  - ${p.name}`));
  }

  // Write XLSX
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Products');
  ws.columns = [
    { header:'sku', key:'sku', width:15 },
    { header:'name', key:'name', width:50 },
    { header:'buying_price', key:'buying_price', width:14 },
    { header:'selling_price', key:'selling_price', width:14 },
    { header:'category_path', key:'category_path', width:45 },
    { header:'brand', key:'brand', width:15 },
    { header:'unit', key:'unit', width:8 },
    { header:'size', key:'size', width:15 },
    { header:'stock_available', key:'stock_available', width:12 },
  ];
  allProducts.forEach(p => ws.addRow({ ...p, stock_available: 0 }));

  const outPath = path.join(dir, 'EMC_MASTER_IMPORT_2026.xlsx');
  await wb.xlsx.writeFile(outPath);
  console.log(`\n✅ Output: ${outPath}`);
  console.log(`   Total: ${allProducts.length} products`);
}

main().catch(console.error);
