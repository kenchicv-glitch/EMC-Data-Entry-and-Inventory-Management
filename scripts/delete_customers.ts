import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
    const [key, ...values] = line.split('=');
    if (key && values.length > 0) {
        env[key.trim()] = values.join('=').trim();
    }
});

const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Connecting to Supabase...');
    const { data, error } = await supabase
        .from('customers')
        .delete()
        .in('name', ['JANE SMITH', 'jane smith', 'Jane Smith', 'CASH CUSTOMER', 'cash customer', 'Cash Customer', 'bro', 'Bro', 'BRO']);

    if (error) {
        console.error('Error deleting customers:', error);
    } else {
        console.log('Successfully deleted the specified customers.', data);
    }
}

run();
