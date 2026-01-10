# Quick Test Commands

After updating TABLE_NAME=transcription_analysis in your .env file and restarting the server, test with:

## List all records
```bash
curl http://localhost:3000/api/sop
```

## Get specific record
```bash
curl http://localhost:3000/api/sop/6b3bbd3a-edce-4034-b14a-b8afa4c59f62
```

This will fetch the highlighted record from your screenshot.
