
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qeljjasvqslsutovfijc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlbGpqYXN2cXNsc3V0b3ZmaWpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzOTYyMjUsImV4cCI6MjA4Njk3MjIyNX0.COFHMDlZ5WlyWgZORMRYXc7e4JjvochlCRWRzO8mXqY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProducts() {
    console.log('--- Product Analysis ---');
    
    // 1. Total Count
    const { count, error } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });
    
    if (error) {
        console.error('Error fetching count:', error);
        return;
    }
    console.log(`Total Products in DB: ${count}`);

    // 2. Uncategorized Count
    const { count: uncategorizedCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .is('category_id', null);
    console.log(`Uncategorized Products: ${uncategorizedCount}`);

    // 3. Sample of Uncategorized Products (to see name format)
    const { data: samples } = await supabase
        .from('products')
        .select('name, sku')
        .is('category_id', null)
        .limit(10);
    
    console.log('\nSample Uncategorized Products:');
    samples?.forEach(s => console.log(`- [${s.sku || 'no-sku'}] ${s.name}`));

    // 4. Check for ' > ' presence
    const { count: legacyCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .or('name.ilike.% > %,sku.ilike.% > %');
    console.log(`\nProducts matching ' > ' pattern: ${legacyCount}`);
}

checkProducts();
