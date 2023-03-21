import { Collection, Document, MongoClient } from "mongodb";

const client = new MongoClient(process.env.DB_CONN_STRING);
await client.connect();
const db = client.db(process.env.DB_NAME);

export default new Proxy(
    {},
    {
        get(_, property: string): Collection<Document> {
            return db.collection(property);
        },
    },
) as Record<string, Collection<Document>>;
