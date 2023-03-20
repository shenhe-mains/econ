import { Message } from "discord.js";
import _ from "lodash";
import client from "./client.js";
import db from "./db.js";

console.log("Input channel ID.");

process.stdin.on("data", async (data) => {
    const id = data.toString("utf-8").trim();
    const channel = await client.channels.fetch(id);
    if (!("messages" in channel)) throw "Invalid channel.";

    let last: Message | null = null;

    while (true) {
        let any: boolean = false;

        for (const message of (await channel.messages.fetch({ before: last?.id })).values()) {
            const match = message.content.match(/^\**Question:\s*\**\s*([\s\S]+?)\n+> \**Answer\**:\s*\**\s*(.+)/);

            if (match && message.attachments.size <= 1) {
                let [, question, answer] = match;
                const answers = answer.split(/\s+\/\s+/);

                await db.trivia_questions.insertOne({ question, image: message.attachments?.[0]?.url, answers });
            } else {
                console.log(message.content);
            }

            last = message;
            any = true;
        }

        if (!any) break;
    }

    console.log("done.");
});
