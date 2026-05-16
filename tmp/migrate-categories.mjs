// One-time category migration script
// Parses breadcrumb product names -> creates inv_categories -> assigns category_id
import { createClient } from '@supabase/supabase-js';

const url = 'https://qeljjasvqslsutovfijc.supabase.co';
const key = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlbGpqYXN2cXNsc3V0b3ZmaWpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzOTYyMjUsImV4cCI6MjA4Njk3MjIyNX0.COFHMDlZ5WlyWgZORMRYXc7e4JjvochlCRWRzO8mXqY';
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(url, serviceKey || key);

function slugify(name) {
    return name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
}

async function getAllCategories() {
    const { data, error } = await supabase
        .from('inv_categories')
        .select('*')
        .order('depth')
        .order('display_order');
    if (error) throw error;
    return data || [];
}

async function resolveCategoryPath(path, allCategories) {
    if (!path?.trim()) return null;
    const parts = path.split('>').map(p => p.trim()).filter(Boolean);
    let parentId = null;
    let resolvedId = null;

    for (const part of parts) {
        const existing = allCategories.find(
            c => c.name.toLowerCase() === part.toLowerCase() && c.parent_id === parentId
        );

        if (existing) {
            parentId = existing.id;
            resolvedId = existing.id;
        } else {
            // Determine depth
            let depth = 0;
            if (parentId) {
                const parent = allCategories.find(c => c.id === parentId);
                depth = (parent?.depth ?? 0) + 1;
            }
            if (depth > 2) {
                console.warn(`Skipping "${part}" — would exceed max depth 2`);
                continue;
            }

            const { data: created, error } = await supabase
                .from('inv_categories')
                .insert({ name: part, slug: slugify(part), depth, parent_id: parentId, display_order: 0 })
                .select()
                .single();
            
            if (error) throw error;
            allCategories.push(created);
            parentId = created.id;
            resolvedId = created.id;
        }
    }

    return resolvedId;
}

async function main() {
    console.log('🔄 Starting category migration...\n');

    // Sign in as owner to bypass RLS
    const email = process.argv[2];
    const password = process.argv[3];

    if (email && password) {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) {
            console.error('❌ Auth failed:', authError.message);
            process.exit(1);
        }
        console.log('✅ Authenticated as', email);
    } else {
        console.log('⚠️  No credentials provided, using anon key (may fail on RLS)');
        console.log('   Usage: node migrate-categories.mjs <email> <password>\n');
    }

    // 1. Fetch products with breadcrumb names
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, sku, category_id')
        .or('name.ilike.% > %,sku.ilike.% > %');
    
    if (error) {
        console.error('❌ Failed to fetch products:', error.message);
        process.exit(1);
    }

    console.log(`📦 Found ${products.length} products with breadcrumb names\n`);

    if (products.length === 0) {
        console.log('✅ No products to migrate — all clean!');
        process.exit(0);
    }

    // 2. Load categories
    const allCategories = await getAllCategories();
    console.log(`📂 Existing categories: ${allCategories.length}\n`);

    let migrated = 0;
    let skipped = 0;
    const errors = [];
    const batchSize = 50;

    for (let i = 0; i < products.length; i++) {
        const product = products[i];
        try {
            const isSkuPath = product.sku?.includes(' > ');
            const isNamePath = product.name.includes(' > ');
            const rawPath = isSkuPath ? (product.sku || '') : product.name;
            const parts = rawPath.split(' > ').map(p => p.trim());

            if (parts.length < 2) {
                skipped++;
                continue;
            }

            const cleanName = parts[parts.length - 1];
            const categoryPath = parts.slice(0, -1).join(' > ');

            const categoryId = await resolveCategoryPath(categoryPath, allCategories);

            const shouldSetSkuToPath = isSkuPath || !product.sku || product.sku === product.name;

            const { error: updateError } = await supabase
                .from('products')
                .update({
                    name: cleanName,
                    sku: shouldSetSkuToPath ? rawPath : product.sku,
                    category_id: categoryId,
                })
                .eq('id', product.id);

            if (updateError) throw updateError;
            migrated++;

            if ((i + 1) % batchSize === 0) {
                process.stdout.write(`  Progress: ${i + 1}/${products.length} (${migrated} migrated)\r`);
            }
        } catch (err) {
            errors.push(`[${product.name}] ${err.message}`);
        }
    }

    console.log(`\n\n✅ Migration complete!`);
    console.log(`   Migrated: ${migrated}`);
    console.log(`   Skipped:  ${skipped}`);
    console.log(`   Errors:   ${errors.length}`);
    console.log(`   Categories now: ${allCategories.length}`);

    if (errors.length > 0) {
        console.log('\n⚠️  Errors:');
        errors.forEach(e => console.log(`   ${e}`));
    }
}

main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
