#!/bin/bash
# =============================================
# Vyra - Docker Entrypoint Script
# =============================================
# This script runs at container startup to configure the application

set -e

echo "🚀 Vyra Backend - Starting up..."

# =============================================
# Validate Required Environment Variables
# =============================================

if [ -z "$JWT_SECRET" ]; then
    echo "❌ ERROR: JWT_SECRET is not set!"
    echo "   Set it in your environment or .env file"
    echo "   Generate with: openssl rand -hex 32"
    exit 1
fi

if [ -z "$MONGO_URL" ]; then
    echo "❌ ERROR: MONGO_URL is not set!"
    echo "   Set it in your environment or .env file"
    echo "   Example: mongodb://user:pass@host:27017/dbname"
    exit 1
fi

if [ -z "$DB_NAME" ]; then
    echo "⚠️  WARNING: DB_NAME not set, using default: vyra"
    export DB_NAME=vyra
fi

# =============================================
# Wait for MongoDB to be ready
# =============================================

if [ -n "$WAIT_FOR_MONGO" ] && [ "$WAIT_FOR_MONGO" = "true" ]; then
    echo "⏳ Waiting for MongoDB to be ready..."
    
    # Extract host from MONGO_URL
    MONGO_HOST=$(echo $MONGO_URL | sed 's|mongodb[+srv]*://[^/]*/.*|\1|' | sed 's|.*@||')
    MONGO_HOST=${MONGO_HOST:-mongodb://localhost:27017}
    
    MAX_RETRIES=30
    RETRY_COUNT=0
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        # Try to connect to MongoDB
        if python3 -c "import pymongo; client = pymongo.MongoClient('$MONGO_URL', serverSelectionTimeoutMS=2000); client.server_info(); print('connected')" 2>/dev/null; then
            echo "✅ MongoDB is ready!"
            break
        fi
        
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "⏳ Waiting for MongoDB... ($RETRY_COUNT/$MAX_RETRIES)"
        sleep 2
    done
    
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo "❌ ERROR: MongoDB is not responding after $MAX_RETRIES attempts"
        exit 1
    fi
fi

# =============================================
# Initialize Database Collections and Indexes
# =============================================

echo "🔧 Initializing database..."

python3 << 'PYTHON_SCRIPT'
import os
import sys
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def init_db():
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME', 'vyra')
    
    if not mongo_url:
        print("❌ MONGO_URL not set")
        sys.exit(1)
    
    try:
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
        db = client[db_name]
        
        # Create indexes
        await db.users.create_index("email", unique=True)
        await db.users.create_index("username", unique=True)
        await db.rooms.create_index("code", unique=True)
        await db.matches.create_index("user_id")
        await db.orders.create_index("order_id", unique=True)
        await db.orders.create_index("user_id")
        await db.transactions.create_index("user_id")
        await db.transactions.create_index([("user_id", 1), ("created_at", -1)])
        await db.inventory.create_index([("user_id", 1), ("item_id", 1)], unique=True)
        
        print("✅ Database initialized successfully!")
        
        client.close()
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        sys.exit(1)

asyncio.run(init_db())
PYTHON_SCRIPT

# =============================================
# Set default log level
# =============================================

if [ -z "$LOG_LEVEL" ]; then
    export LOG_LEVEL="INFO"
    echo "ℹ️  LOG_LEVEL not set, using default: INFO"
fi

# =============================================
# Start Application
# =============================================

echo "🎮 Starting Vyra API server..."
echo "   Port: ${PORT:-10000}"
echo "   Log Level: $LOG_LEVEL"
echo ""

# Execute the main command
exec "$@"
