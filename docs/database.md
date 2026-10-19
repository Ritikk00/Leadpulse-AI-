# Database

## Connection

Set `MONGO_URI` in `server/.env` to a local database or an Atlas connection string. For Atlas, create a database user with only the required database permissions, allow network access only from your API host, and use the exact URI from the Atlas driver connection instructions. URL-encode special characters in the database username/password.

The server connects before opening its HTTP listener and exits with a useful message if MongoDB cannot be selected. Mongoose models create collections and indexes when first used; there is no seed data or migration command in this starter.

## Models

- `User`: normalized unique email, bcrypt password hash, role, single active refresh-token hash, password-reset hash/expiry, and notification preferences.
- `Lead`: contact and requirement fields, pipeline status, priority, AI output, optional assignee/creator, and timestamps.
- `LeadActivity`: lead reference, optional actor, event type, message, metadata, and timestamps.

Lead indexes support newest-first views, email history, status/priority filtering, text search, and activity timelines. Index creation can take time on an existing large collection; review index operations for your deployment process as the dataset grows.

## Backups and privacy

Enable automated backups, encryption at rest, and an appropriate retention policy with your MongoDB provider. Lead requirements and email addresses are personal/business data. Define your deletion/retention policies and access controls before using real customer data. Deleting a lead removes its activity history.

## Integration tests

Set `MONGO_TEST_URI` to a separate throwaway database when running the opt-in lifecycle test. Tests delete their collections. Never use a production URI for tests.