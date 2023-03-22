import { ButtonStyle, Colors, ComponentType, Events, Interaction, TextInputStyle } from "discord.js";
import client from "./client.js";
import db from "./db.js";
import settings from "./settings.js";

let last: Date | null = null;
export let next: Date | null = null;
export let answer: RegExp | null = null;

export function set_next(date: Date) {
    db.trivia_event_loop.findOneAndUpdate({}, { $set: { date } }, { upsert: true });
    last = next;
    last?.setSeconds(last.getSeconds() + settings.window);
    next = date;
}

export async function schedule() {
    const date = new Date();
    date.setMinutes(date.getMinutes() + Math.random() * (settings.max_delay - settings.min_delay) + settings.min_delay);
    set_next(date);
    return settings;
}

const waiting = new Map<string, number>();

setInterval(async () => {
    if (next && new Date() >= next) {
        schedule();

        const channel = await client.channels.fetch(settings.channel);
        if (!channel || !("send" in channel) || !("guild" in channel) || !channel.guild) return;

        const docs = await db.trivia_questions.find({ used: { $exists: false } }).toArray();

        if (docs.length === 0) {
            const alert = await client.channels.fetch(process.env.ALERT);
            if ("send" in alert) await alert.send(`${process.env.ALERT_PING} The trivia question bank is empty!`);
            set_next(null);
            return;
        }

        const doc = docs[Math.floor(Math.random() * docs.length)];

        const post = await channel.send({
            embeds: [
                {
                    title: "Trivia Question!",
                    description: `${doc.question}\n\n(Window ends <t:${Math.floor(
                        new Date().getTime() / 1000 + settings.window,
                    )}:R>)`,
                    color: 0xd9e9f9,
                    image: doc.image && { url: doc.image },
                },
            ],
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.Button,
                            label: "Answer",
                            style: ButtonStyle.Secondary,
                            customId: doc._id.toString(),
                        },
                    ],
                },
            ],
        });

        const rule = await channel.guild.autoModerationRules.fetch(settings.rule);
        await rule.edit({ enabled: true, triggerMetadata: { keywordFilter: doc.answers } }).catch(() => null);

        const answered = new Set<string>();
        let diminish = 1;

        async function listen(interaction: Interaction) {
            if (!("customId" in interaction)) return;
            if (interaction.customId !== doc._id.toString()) return;

            if (interaction.isButton())
                if (waiting.has(interaction.user.id) && waiting.get(interaction.user.id) > new Date().getTime())
                    await interaction.reply({ content: "Please wait 10 seconds between answers!", ephemeral: true });
                else
                    await interaction.showModal({
                        customId: doc._id.toString(),
                        title: "Answer Trivia Question",
                        components: [
                            {
                                type: ComponentType.ActionRow,
                                components: [
                                    {
                                        type: ComponentType.TextInput,
                                        style: TextInputStyle.Short,
                                        customId: "answer",
                                        label: "Answer",
                                        placeholder: `You have ${Math.floor(
                                            settings.window - (new Date().getTime() - post.createdTimestamp) / 1000,
                                        )} second(s) to answer.`,
                                    },
                                ],
                            },
                        ],
                    });
            else if (interaction.isModalSubmit()) {
                const input = interaction.fields.getTextInputValue("answer");

                if (doc.answers.some((answer: string) => answer.toLowerCase() === input.toLowerCase())) {
                    const { roles } = interaction.member;

                    if (answered.has(interaction.user.id)) {
                        await interaction.reply({
                            embeds: [
                                {
                                    title: "Correct!",
                                    description: "Congratulations; that was correct!",
                                    color: Colors.Green,
                                    footer: {
                                        text: "You have already answered correctly, so you will not receive any points for this answer.",
                                    },
                                },
                            ],
                            ephemeral: true,
                        });

                        return;
                    }

                    answered.add(interaction.user.id);

                    if (
                        Array.isArray(roles)
                            ? roles.some((x) => settings.forbidden.includes(x))
                            : roles.cache.hasAny(...settings.forbidden)
                    ) {
                        await interaction.reply({
                            embeds: [
                                {
                                    title: "Correct!",
                                    description: "Congratulations; that was correct!",
                                    color: Colors.Green,
                                    footer: {
                                        text: "You are not eligible to participate due to your staff position, so you will not receive any points.",
                                    },
                                },
                            ],
                            ephemeral: true,
                        });

                        return;
                    }

                    const score = Math.round(
                        (((new Date().getTime() - post.createdTimestamp) / 1000 / settings.window) *
                            (settings.final_reward - settings.initial_reward) +
                            settings.initial_reward) *
                            diminish,
                    );

                    await db.scores.findOneAndUpdate(
                        { user: interaction.user.id },
                        { $inc: { score } },
                        { upsert: true },
                    );

                    await db.trivia_questions.findOneAndUpdate({ _id: doc._id }, { $inc: { answer_count: 1 } });

                    diminish *= 1 - settings.diminish / 100;

                    await interaction.reply({
                        embeds: [
                            {
                                title: "Correct!",
                                description: "Congratulations; that was correct!",
                                color: Colors.Green,
                                fields:
                                    doc.answers.length > 1
                                        ? [
                                              {
                                                  name: "All Answers",
                                                  value: doc.answers.map((x: string) => `- ${x}`).join("\n"),
                                              },
                                          ]
                                        : [],
                                footer: { text: `You received ${score} point(${score === 1 ? "" : "s"}).` },
                            },
                        ],
                        ephemeral: true,
                    });
                } else {
                    waiting.set(interaction.user.id, new Date().getTime() + 10000);
                    await interaction.reply({
                        embeds: [
                            {
                                title: "Wrong Answer",
                                description: "Sorry, but that isn't correct. Try again!",
                                color: Colors.Red,
                            },
                        ],
                        components: [
                            {
                                type: ComponentType.ActionRow,
                                components: [
                                    {
                                        type: ComponentType.Button,
                                        label: "Try Again",
                                        style: ButtonStyle.Secondary,
                                        customId: doc._id.toString(),
                                    },
                                ],
                            },
                        ],
                        ephemeral: true,
                    });
                }
            }
        }

        client.on(Events.InteractionCreate, listen);

        setTimeout(async () => {
            client.removeListener(Events.InteractionCreate, listen);

            const rule = await channel.guild.autoModerationRules.fetch(settings.rule);
            await rule.edit({ enabled: false });

            await post.edit({
                embeds: [
                    {
                        ...post.embeds[0].toJSON(),
                        description: doc.question,
                        fields: [
                            doc.answers.length === 1
                                ? { name: "Answer", value: doc.answers[0] }
                                : { name: "Answers", value: doc.answers.map((x: string) => `- ${x}`).join("\n") },
                            ...(doc.explanation ? [{ name: "Explanation", value: doc.explanation }] : []),
                        ],
                    },
                ],
                components: [],
            });

            await post.reply({
                embeds: [
                    {
                        title: "Trivia Answer",
                        description: doc.question,
                        color: 0xd9e9f9,
                        fields: [
                            doc.answers.length === 1
                                ? { name: "Answer", value: doc.answers[0] }
                                : { name: "Answers", value: doc.answers.map((x: string) => `- ${x}`).join("\n") },
                            ...(doc.explanation ? [{ name: "Explanation", value: doc.explanation }] : []),
                        ],
                    },
                ],
            });
        }, settings.window * 1000);

        await db.trivia_questions.findOneAndUpdate(
            { _id: doc._id },
            { $set: { used: true, post: post.id, posted: post.createdTimestamp, answer_count: 0 } },
        );
    }
}, 1000);
