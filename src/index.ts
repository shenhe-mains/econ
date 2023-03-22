import client from "./client.js";
import logger from "./logger.js";
import "./commands.js";
import { Colors, Events, User } from "discord.js";
import db from "./db.js";
import _ from "lodash";
import { next, schedule, set_next } from "./trivia.js";
import settings from "./settings.js";

process.on("uncaughtException", (error) => logger.error(error));

client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isCommand()) {
        let key = interaction.commandName;

        if (interaction.isChatInputCommand()) {
            const subgroup = interaction.options.getSubcommandGroup(false);
            const subcommand = interaction.options.getSubcommand(false);

            if (subgroup) key += `/${subgroup}`;
            if (subcommand) key += `/${subcommand}`;

            let question: string, answers: string[], image: string, explanation: string, user: User, delta: number;

            switch (key) {
                case "trivia/add":
                    question = interaction.options.getString("question", true);
                    answers = interaction.options.getString("answer", true).split(/\s+\/\s+/);
                    image = interaction.options.getAttachment("image", false)?.url;
                    explanation = interaction.options.getString("explanation", false);

                    await db.trivia_questions.insertOne({ question, answers, image, explanation });

                    await interaction.reply({
                        embeds: [
                            {
                                title: "Added trivia question",
                                color: Colors.Green,
                                fields: [
                                    { name: "Question", value: question },
                                    { name: "Answer", value: answers.join(" / ") },
                                ],
                                image: image && { url: image },
                            },
                        ],
                    });

                    logger.info(
                        `${interaction.user.tag} (${
                            interaction.user.id
                        }) added a trivia question:\nQ: ${question}\nA: ${answers.join(" / ")}`,
                    );

                    break;
                case "trivia/delete":
                    question = interaction.options.getString("question");
                    const { deletedCount } = await db.trivia_questions.deleteMany({ question });

                    await interaction.reply(`Deleted ${deletedCount}.`);

                    logger.info(
                        `${interaction.user.tag} (${interaction.user.id}) deleted trivia question:\nQ: ${question}`,
                    );

                    break;
                case "trivia/start-loop":
                    schedule();
                    await interaction.reply("Started loop.");
                    logger.info(`${interaction.user.tag} started trivia loop.`);
                    break;
                case "trivia/stop-loop":
                    set_next(null);
                    await interaction.reply("Stopped loop.");
                    logger.info(`${interaction.user.tag} stopped trivia loop.`);
                    break;
                case "trivia/delay":
                    const delay = interaction.options.getNumber("delay");

                    if (delay === null) {
                        if (!next) await interaction.reply("There is no next update; the loop is currently stopped.");
                        else
                            await interaction.reply(
                                `Next update: <t:${Math.floor(next.getTime() / 1000)}:R> (<t:${Math.floor(
                                    next.getTime() / 1000,
                                )}:F>)`,
                            );
                        break;
                    }

                    const date = new Date();
                    date.setMinutes(date.getMinutes() + delay);
                    set_next(date);
                    await interaction.reply(`Set delay to ${delay}m.`);
                    logger.info(`${interaction.user.tag} updated the delay to ${delay}.`);
                    break;
                case "trivia/trend":
                    const stats: number[] = (
                        await db.trivia_questions
                            .find({ used: true })
                            .sort({ posted: "descending" })
                            .limit(10)
                            .toArray()
                    ).map((x) => x.answer_count);

                    await interaction.reply(
                        `Last ${stats.length} average: \`${
                            Math.round((stats.reduce((x, y) => x + y) / stats.length) * 100) / 100
                        }\` (values: ${stats.map((x) => `\`${x}\``).join(", ")})`,
                    );

                    break;
                case "score":
                    user = interaction.options.getUser("user") ?? interaction.user;
                    const entry = await db.scores.findOne({ user: user.id });
                    const score = entry?.score ?? 0;

                    await interaction.reply({
                        embeds: [
                            {
                                title: `${user.tag}'s Score`,
                                description: `${
                                    user.id === interaction.user.id ? "You have" : `${user} has`
                                } ${score} point${score === 1 ? "" : "s"}.`,
                                color: 0xd9e9f9,
                            },
                        ],
                    });

                    break;
                case "leaderboard":
                    const page = (interaction.options.getInteger("page") ?? 1) - 1;

                    await interaction.reply({
                        embeds: [
                            {
                                title: "Leaderboard",
                                description: (
                                    await db.scores
                                        .find()
                                        .sort({ score: "descending" })
                                        .skip(page * 20)
                                        .limit(20)
                                        .toArray()
                                )
                                    .map((entry, index) => `${index + 1}. <@${entry.user}> - \`${entry.score}\``)
                                    .join("\n"),
                                color: 0xd9e9f9,
                                footer: {
                                    text: `Total points achieved: ${
                                        (
                                            await db.scores
                                                .aggregate([{ $group: { _id: "", total: { $sum: "$score" } } }])
                                                .toArray()
                                        )[0].total
                                    }`,
                                },
                            },
                        ],
                    });

                    break;
                case "add-score":
                    user = interaction.options.getUser("user");
                    delta = interaction.options.getInteger("delta");

                    if (delta === 0) {
                        await interaction.reply({ content: "That does nothing.", ephemeral: true });
                        return;
                    }

                    const value = await db.scores.findOneAndUpdate(
                        { user: user.id },
                        { $inc: { score: delta } },
                        { upsert: true },
                    );

                    await interaction.reply(
                        `${delta > 0 ? "Gave" : "Took"} ${delta} point${delta === 1 ? "" : "s"} ${
                            delta > 0 ? "to" : "from"
                        } ${user}, and they now have ${(value.value.score ?? 0) + delta} points.`,
                    );

                    break;
            }
        } else
            switch (key) {
            }
    }
});

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (message.channel.id !== settings.channel) return;
    if (!next) return;

    const date = new Date(next);
    date.setSeconds(
        date.getSeconds() - Math.random() * (settings.max_reduction - settings.min_reduction) - settings.min_reduction,
    );

    set_next(date);
});

const doc = await db.trivia_event_loop.findOne();
if (doc?.date) set_next(doc.date);

logger.info("Started.");
