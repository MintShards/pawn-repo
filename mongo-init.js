// MongoDB initialization script for Pawn Repo

// Switch to the pawnrepo database
db = db.getSiblingDB('pawnrepo');

// Create a user for the application
db.createUser({
  user: 'pawnrepo_user',
  pwd: 'pawnrepo_password',
  roles: [
    {
      role: 'readWrite',
      db: 'pawnrepo'
    }
  ]
});

// Create collections with initial indexes
db.createCollection('users');
db.createCollection('customers');
db.createCollection('transactions');
db.createCollection('items');
db.createCollection('audit_logs');

// Create indexes for better performance
db.users.createIndex({ "user_number": 1 }, { unique: true });
db.users.createIndex({ "role": 1 });
db.users.createIndex({ "is_active": 1 });

db.customers.createIndex({ "phone": 1 }, { unique: true });
db.customers.createIndex({ "status": 1 });
db.customers.createIndex({ "last_name": 1, "first_name": 1 });

db.transactions.createIndex({ "customer_id": 1 });
db.transactions.createIndex({ "status": 1 });
db.transactions.createIndex({ "maturity_date": 1 });
db.transactions.createIndex({ "transaction_number": 1 }, { unique: true });
db.transactions.createIndex({ "pawn_date": -1 });

db.items.createIndex({ "transaction_id": 1 });
db.items.createIndex({ "status": 1 });
db.items.createIndex({ "serial_number": 1 }, { sparse: true });

db.audit_logs.createIndex({ "user_id": 1 });
db.audit_logs.createIndex({ "entity_type": 1 });
db.audit_logs.createIndex({ "timestamp": -1 });
db.audit_logs.createIndex({ "action": 1 });

print('Pawn Repo database initialized successfully!');