// MongoDB initialization script
// This runs when the MongoDB container starts (only on first initialization)
// It creates the database and sets up any initial data if needed

db = db.getSiblingDB(process.env.MONGO_INITDB_DATABASE || 'vyra');

// Create collections with validation if needed
// Note: MongoDB creates collections implicitly, so we only need to set up indexes here

// Print success message
print("\n========================================");
print("MongoDB initialized for Vyra");
print("Database: " + (process.env.MONGO_INITDB_DATABASE || 'vyra'));
print("========================================\n");
