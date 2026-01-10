## Quick Verification Script

Run this to check if your Supabase credentials are correct:

```bash
# In the backend directory, run:
node -e "
import('dotenv').then(dotenv => {
  dotenv.config();
  import('@supabase/supabase-js').then(({ createClient }) => {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    
    console.log('Testing connection to:', process.env.SUPABASE_URL);
    console.log('Table:', process.env.TABLE_NAME);
    
    supabase.from(process.env.TABLE_NAME).select('*', { count: 'exact', head: false }).limit(1).then(({ data, error, count }) => {
      if (error) {
        console.error('❌ Error:', error);
      } else {
        console.log('✅ Connection successful!');
        console.log('Total records in table:', count);
        console.log('Sample record:', data && data.length > 0 ? data[0] : 'No data');
        if (data && data.length > 0) {
          console.log('Column names:', Object.keys(data[0]));
        }
      }
    });
  });
});
"
```
