from fastapi import FastAPI, UploadFile, Form, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
import pandas as pd
import asyncio
import io
from pymongo import MongoClient
import os
import json

app = FastAPI()

# MongoDB setup (default localhost, ensure it's a replica set)
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/?replicaSet=rs0')
client = MongoClient(MONGO_URI)
db = client['tata_motors']
collection = db['complaints']

# Connection manager to handle WebSocket clients
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

async def watch_complaints():
    """Watch the 'complaints' collection and broadcast changes."""
    try:
        # The pipeline can be used to filter which changes you want to watch
        pipeline = [{'$match': {'operationType': 'insert'}}]
        with collection.watch(pipeline) as stream:
            print("Watching for new complaints in MongoDB...")
            for change in stream:
                # The 'fullDocument' contains the newly inserted complaint
                document = change['fullDocument']
                # The _id is an ObjectId, which is not directly JSON serializable
                document['_id'] = str(document['_id'])
                await manager.broadcast(json.dumps(document))
    except Exception as e:
        print(f"Error watching MongoDB: {e}. Is it running as a replica set?")
        # In a production app, you might want to retry connecting here.

@app.on_event("startup")
async def startup_event():
    """On app startup, start the MongoDB watcher in the background."""
    asyncio.create_task(watch_complaints())

@app.websocket("/ws/live_updates")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await asyncio.sleep(1)  # Just keep the connection open
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.post('/upload_csv/')
async def upload_csv(file: UploadFile):
    """Uploads a CSV and inserts its content into MongoDB, triggering the change stream."""
    content = await file.read()
    df = pd.read_csv(io.StringIO(content.decode('utf-8')))
    
    # Insert data. The change stream will pick this up.
    # Note: For a true real-time feel, you might insert rows one-by-one
    # For this example, we do a bulk insert.
    collection.insert_many(df.to_dict('records'))
    
    return JSONResponse({'message': 'CSV data is being inserted.', 'count': len(df)})

@app.get('/history/')
def get_history(skip: int = 0, limit: int = 100):
    # Paginated historical complaints from MongoDB
    cursor = collection.find(projection={'_id': False}).skip(skip).limit(limit)
    return list(cursor) 