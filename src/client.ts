import { Client, IntentsBitField } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

const client = new Client({
    intents: IntentsBitField.Flags.GuildMessages | IntentsBitField.Flags.Guilds | IntentsBitField.Flags.MessageContent,
});

await client.login(process.env.TOKEN);
await new Promise((r) => client.once("ready", () => r(null)));

export default client;
