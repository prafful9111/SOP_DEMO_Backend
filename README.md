# SOP Dashboard Backend Integration

This guide explains how to set up and use the backend API with the SOP Dashboard.

## Backend Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the `backend` directory:

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key-here
TABLE_NAME=your_table_name
PORT=3000
NODE_ENV=development
```

### 3. Start the Backend Server
```bash
npm start
```

The server will run at `http://localhost:3000`

## Frontend Setup (retool-sop-lib)

### 1. Configure API URL
Create a `.env` file in the `retool-sop-lib` directory:

```bash
cd retool-sop-lib
cp .env.example .env
```

Set the API URL (defaults to `http://localhost:3000` if not set):
```env
VITE_API_URL=http://localhost:3000
```

### 2. Run the Frontend
The frontend is already running via `npx retool-ccl dev`. It will automatically connect to the backend.

## How It Works

1. **Automatic Data Fetching**: When the dashboard loads, it automatically fetches data from the backend API
2. **URL Parameters**: Pass an ID via URL query parameter: `?id=your-record-id`
3. **Fallback**: If no ID is provided, it uses the default sample ID
4. **Error Handling**: On error, the dashboard falls back to sample data

## API Endpoints

- `GET /health` - Server health check
- `GET /api/sop/:id` - Fetch SOP record by ID
- `GET /api/sop?page=1&limit=10` - List SOP records with pagination

## Testing

Test the backend directly:
```bash
# Health check
curl http://localhost:3000/health

# Fetch by ID
curl http://localhost:3000/api/sop/6b3bbd3a-edce-4034-b14a-b8afa4c59f62
```

## Production Deployment

For production:
1. Set `NODE_ENV=production` in backend `.env`
2. Configure `ALLOWED_ORIGINS` for CORS in backend `.env`
3. Update `VITE_API_URL` in frontend to your production API URL
