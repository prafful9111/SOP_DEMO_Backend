import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

console.log('\n🔍 Testing Supabase Connection...\n');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('TABLE_NAME:', process.env.TABLE_NAME);
console.log('KEY configured:', process.env.SUPABASE_KEY ? 'Yes' : 'No');
console.log('\n---\n');

const testConnection = async () => {
    try {
        // Test 1: Count records
        const { data, error, count } = await supabase
            .from(process.env.TABLE_NAME)
            .select('*', { count: 'exact', head: false })
            .limit(5);

        if (error) {
            console.error('❌ Error fetching data:', error);
            return;
        }

        console.log(`✅ Connection successful!`);
        console.log(`📊 Total records in database: ${count}`);
        console.log(`📦 Fetched ${data?.length || 0} sample records\n`);

        if (data && data.length > 0) {
            console.log('📋 Column names:', Object.keys(data[0]).join(', '));
            console.log('\n🔍 First record sample:');
            console.log(JSON.stringify(data[0], null, 2).substring(0, 500) + '...');
        } else {
            console.log('\n⚠️  No data returned!');
            console.log('Possible reasons:');
            console.log('  1. RLS is still enabled (check Supabase dashboard)');
            console.log('  2. Wrong table name');
            console.log('  3. Wrong Supabase project URL/key');
        }
    } catch (err) {
        console.error('❌ Connection test failed:', err);
    }
};

testConnection();
