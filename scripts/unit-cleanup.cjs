const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function cleanupUnits() {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, unit');

  if (error) {
    console.error('Error fetching products:', error);
    return;
  }

  const updates = [];
  const patterns = [
    { regex: / - 1 ELF$| - 1\/2 ELF$| - 1\/4 ELF$/, unit: 'ELF' },
    { regex: / - BAG$/, unit: 'BAG' },
    { regex: / - CAN$/, unit: 'CAN' },
    { regex: / - TIN$/, unit: 'TIN' },
    { regex: / - ROLL$/, unit: 'ROLL' },
    { regex: / - SET$/, unit: 'SET' },
    { regex: / - UNIT$/, unit: 'UNIT' },
    { regex: / - KG$/, unit: 'KG' },
    { regex: / - MTR$| - METER$/, unit: 'MTR' },
    { regex: / - PC$| - PCS$/, unit: 'PC' },
  ];

  for (const product of products) {
    let newUnit = product.unit;
    for (const pattern of patterns) {
      if (pattern.regex.test(product.name)) {
        newUnit = pattern.unit;
        break;
      }
    }

    if (newUnit !== product.unit) {
      updates.push({ id: product.id, unit: newUnit });
      console.log(`Updating ${product.name}: ${product.unit} -> ${newUnit}`);
    }
  }

  if (updates.length > 0) {
    console.log(`Total updates found: ${updates.length}`);
    const { error: updateError } = await supabase
      .from('products')
      .upsert(updates);

    if (updateError) {
      console.error('Error updating products:', updateError);
    } else {
      console.log('Successfully updated product units.');
    }
  } else {
    console.log('No unit updates needed.');
  }
}

cleanupUnits();
