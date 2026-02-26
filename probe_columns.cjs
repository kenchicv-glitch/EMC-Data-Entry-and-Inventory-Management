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

async function probe() {
    console.log('Verifying low_stock_threshold column...');
    const { data, error } = await supabase
        .from('products')
        .select('name, low_stock_threshold')
        .limit(1);

    if (error) {
        console.error('Column check FAILED:', error.message);
    } else {
        console.log('SUCCESS! Column is now available in the database.');
        if (data && data.length > 0) {
            console.log('Sample data:', data[0]);
        }
    }
}

probe();
