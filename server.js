import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Validate required environment variables
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_KEY', 'TABLE_NAME'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
    console.error('Please create a .env file based on .env.example');
    process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? process.env.ALLOWED_ORIGINS?.split(',')
        : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    });
});

// Debug endpoint
app.get('/debug', (req, res) => {
    res.json({
        message: 'Debug information',
        env: process.env.NODE_ENV,
        supabaseUrl: process.env.SUPABASE_URL ? 'Configured' : 'Not Configured',
        tableName: process.env.TABLE_NAME,
        port: PORT,
        timestamp: new Date().toISOString()
    });
});

// TEST endpoint - List all records (for debugging)
app.get('/api/test/list-all', async (req, res, next) => {
    try {
        console.log(`🔍 Testing: Fetching ALL records from ${process.env.TABLE_NAME}`);

        const { data, error, count } = await supabase
            .from(process.env.TABLE_NAME)
            .select('*', { count: 'exact' });

        if (error) {
            console.error('Supabase error:', error);
            return res.status(500).json({
                error: 'Supabase Error',
                message: error.message,
                code: error.code,
                hint: error.hint,
                details: error.details
            });
        }

        console.log(`✅ Found ${data?.length || 0} records (total in DB: ${count})`);

        res.json({
            success: true,
            count: data?.length || 0,
            totalInDatabase: count,
            data,
            // Show the first record's keys to help debug column names
            columns: data && data.length > 0 ? Object.keys(data[0]) : [],
            message: data && data.length > 0 ? 'Data fetched successfully' : 'No data found - check if RLS is disabled'
        });

    } catch (error) {
        next(error);
    }
});

// Get SOP data by ID
app.get('/api/sop/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'ID parameter is required'
            });
        }

        console.log(`📊 Fetching SOP data for ID: ${id}`);

        // Query Supabase
        const { data, error } = await supabase
            .from(process.env.TABLE_NAME)
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Supabase error:', error);

            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    error: 'Not Found',
                    message: `No record found with ID: ${id}`
                });
            }

            throw error;
        }

        console.log(`✅ Successfully fetched data for ID: ${id}`);
        res.json({ success: true, data });

    } catch (error) {
        next(error);
    }
});

// Get multiple SOP records with pagination
app.get('/api/sop', async (req, res, next) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        console.log(`📊 Fetching SOP records (page: ${page}, limit: ${limit})`);

        const { data, error, count } = await supabase
            .from(process.env.TABLE_NAME)
            .select('*', { count: 'exact' })
            .range(offset, offset + limit - 1)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }

        console.log(`✅ Successfully fetched ${data?.length || 0} records`);

        res.json({
            success: true,
            data,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count,
                totalPages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        next(error);
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('❌ Error:', error);

    const statusCode = error.statusCode || 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : error.message;

    res.status(statusCode).json({
        error: error.name || 'Error',
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️  Connected to table: ${process.env.TABLE_NAME}`);
    console.log(`\n📡 Available endpoints:`);
    console.log(`   GET  /health`);
    console.log(`   GET  /api/sop`);
    console.log(`   GET  /api/sop/:id\n`);
});
