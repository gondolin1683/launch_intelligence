import { copyFile } from "node:fs/promises";

await copyFile("data/trackedAccounts.json", "aws/weekly-ingestion/trackedAccounts.json");
console.log("Synced data/trackedAccounts.json to aws/weekly-ingestion/trackedAccounts.json");
