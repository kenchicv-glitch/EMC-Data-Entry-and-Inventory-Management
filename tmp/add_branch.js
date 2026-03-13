import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addBranch() {
  console.log('Attempting to add EMC 3 branch...');
  const { data, error } = await supabase
    .from('branches')
    .insert([{ name: 'EMC 3' }])
    .select();

  if (error) {
    if (error.code === '23505') {
       console.log('EMC 3 already exists (Unique constraint).');
    } else {
       console.log('Error adding branch:', error.message);
       console.log('Details:', error.details);
       console.log('Note: If this is a permission error, you must run the SQL manually in Supabase SQL Editor.');
    }
  } else {
    console.log('Successfully added branch:', data);
  }
}

addBranch();
