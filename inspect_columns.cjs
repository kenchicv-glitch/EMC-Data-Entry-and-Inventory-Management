const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '.env');
const env = fs.readFileSync(envPath, 'utf8');
const lines = env.split('\n');
const config = {};
lines.forEach(line => {
    const parts = line.split('=');
    if (parts.length === 2) {
        config[parts[0].trim()] = parts[1].trim();
    }
});

const supabaseUrl = config['VITE_SUPABASE_URL'];
const supabaseAnonKey = config['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectColumns() {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .limit(1);

        if (error) {
            console.error('Error fetching products:', error);
            return;
        }

        if (data && data.length > 0) {
            console.log('COLUMNS_LIST_START');
            console.log(Object.keys(data[0]).join(', '));
            console.log('COLUMNS_LIST_END');
        } else {
            console.log('No products found to inspect.');
        }
    } catch (e) {
        console.error('Unexpected error:', e);
    }
}

inspectColumns();
