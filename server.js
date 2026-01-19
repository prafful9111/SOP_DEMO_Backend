import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Validate required environment variables
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_KEY', 'TABLE_NAME', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'AWS_BUCKET_NAME'];
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

// Initialize S3 Client
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

// Helper function to generate presigned URL
async function getPresignedUrl(originalUrl) {
    if (!originalUrl) return null;

    try {
        // Extract key from URL or use as is if it's just a key or relative path
        // Assuming originalUrl might be a full URL, we try to parse it
        let key = originalUrl;

        // Handle full URLs if stored that way
        if (originalUrl.startsWith('http')) {
            try {
                const urlObj = new URL(originalUrl);
                // Extract path after bucket name or domain
                // This logic might need adjustment based on exact format of audio_url in DB
                // implementation assumes audio_url might be the object key or a full path
                key = decodeURIComponent(urlObj.pathname.substring(1)); // remove leading slash
            } catch (e) {
                console.warn('Could not parse URL, using as key:', originalUrl);
            }
        }

        const command = new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key
        });

        // Generate signed URL valid for 24 hours (86400 seconds)
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 86400 });
        return signedUrl;
    } catch (error) {
        console.error('Error generating presigned URL:', error);
        return originalUrl; // Fallback to original
    }
}

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

        // Generate presigned URL if audio_url exists
        let signedAudioUrl = null;
        if (data && data.audio_url) {
            signedAudioUrl = await getPresignedUrl(data.audio_url);
        }

        console.log(`✅ Successfully fetched data for ID: ${id}`);
        res.json({
            success: true,
            data: {
                ...data,
                signed_audio_url: signedAudioUrl
            }
        });

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

        // Add presigned URLs to all records
        const dataWithSignedUrls = await Promise.all(
            (data || []).map(async (record) => {
                if (record.audio_url) {
                    const signedUrl = await getPresignedUrl(record.audio_url);
                    return { ...record, signed_audio_url: signedUrl };
                }
                return { ...record, signed_audio_url: null };
            })
        );

        console.log(`✅ Successfully fetched ${data?.length || 0} records`);

        res.json({
            success: true,
            data: dataWithSignedUrls,
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
