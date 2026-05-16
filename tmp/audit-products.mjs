import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://qeljjasvqslsutovfijc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlbGpqYXN2cXNsc3V0b3ZmaWpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzOTYyMjUsImV4cCI6MjA4Njk3MjIyNX0.COFHMDlZ5WlyWgZORMRYXc7e4JjvochlCRWRzO8mXqY'
);

async function audit() {
    // Count totals
    const { count: total } = await supabase.from('products').select('*', { count: 'exact', head: true });
    const { count: withCat } = await supabase.from('products').select('*', { count: 'exact', head: true }).not('category_id', 'is', null);
    const { count: noCat } = await supabase.from('products').select('*', { count: 'exact', head: true }).is('category_id', null);
    const { count: breadcrumbName } = await supabase.from('products').select('*', { count: 'exact', head: true }).ilike('name', '% > %');
    const { count: breadcrumbSku } = await supabase.from('products').select('*', { count: 'exact', head: true }).ilike('sku', '% > %');

    console.log('=== PRODUCT AUDIT ===');
    console.log(`Total products: ${total}`);
    console.log(`With category_id: ${withCat}`);
    console.log(`Without category_id: ${noCat}`);
    console.log(`Name still has breadcrumb: ${breadcrumbName}`);
    console.log(`SKU has breadcrumb: ${breadcrumbSku}`);
    
    // Sample 10 products without category
    const { data: noCatProducts } = await supabase.from('products').select('id, name, sku, category_id').is('category_id', null).limit(10);
    console.log('\n=== SAMPLE: Products WITHOUT category_id ===');
    noCatProducts?.forEach(p => console.log(`  [${p.id.substring(0,8)}] name="${p.name}" sku="${p.sku || '(null)'}" cat=${p.category_id}`));

    // Sample 10 products WITH category
    const { data: withCatProducts } = await supabase.from('products').select('id, name, sku, category_id').not('category_id', 'is', null).limit(10);
    console.log('\n=== SAMPLE: Products WITH category_id ===');
    withCatProducts?.forEach(p => console.log(`  [${p.id.substring(0,8)}] name="${p.name}" sku="${p.sku || '(null)'}" cat=${p.category_id}`));

    // Check categories
    const { data: cats } = await supabase.from('inv_categories').select('id, name, depth, parent_id, slug').order('depth').order('name');
    console.log(`\n=== CATEGORIES (${cats?.length || 0} total) ===`);
    cats?.forEach(c => {
        const indent = '  '.repeat(c.depth);
        console.log(`  ${indent}[d${c.depth}] ${c.name} (slug: ${c.slug}, parent: ${c.parent_id ? c.parent_id.substring(0,8) : 'ROOT'})`);
    });

    // Check how many products per category (top 15)
    const { data: allProds } = await supabase.from('products').select('category_id').not('category_id', 'is', null);
    const catCounts = {};
    allProds?.forEach(p => { catCounts[p.category_id] = (catCounts[p.category_id] || 0) + 1; });
    console.log('\n=== PRODUCTS PER CATEGORY ===');
    const catMap = new Map(cats?.map(c => [c.id, c.name]) || []);
    Object.entries(catCounts).sort(([,a],[,b]) => b - a).slice(0, 15).forEach(([id, count]) => {
        console.log(`  ${catMap.get(id) || id}: ${count} products`);
    });
}

audit().catch(console.error);
