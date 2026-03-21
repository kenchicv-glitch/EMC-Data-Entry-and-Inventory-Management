import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qeljjasvqslsutovfijc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlbGpqYXN2cXNsc3V0b3ZmaWpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzOTYyMjUsImV4cCI6MjA4Njk3MjIyNX0.COFHMDlZ5WlyWgZORMRYXc7e4JjvochlCRWRzO8mXqY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function cleanupUnits() {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, unit');

  if (error) {
    console.error('Error fetching products:', error);
    return;
  }

  console.log(`Fetched ${products.length} products.`);

  const { count, error: countError } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true });
  console.log(`Total product count: ${count}`);

  const { data: branches } = await supabase.from('branches').select('*');
  console.log('Branches:', branches);

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
    const nameUpper = product.name.toUpperCase();
    for (const pattern of patterns) {
      if (pattern.regex.test(nameUpper)) {
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
