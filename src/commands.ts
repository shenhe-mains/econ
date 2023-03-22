import { ApplicationCommandOptionType, ApplicationCommandType, ChannelType } from "discord.js";
import client from "./client.js";

await client.application.commands.set([
    {
        type: ApplicationCommandType.ChatInput,
        name: "trivia",
        description: "manage trivia",
        dmPermission: false,
        default_member_permissions: "0",
        options: [
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "add",
                description: "add a trivia question",
                options: [
                    {
                        type: ApplicationCommandOptionType.String,
                        name: "question",
                        description: "the question",
                        required: true,
                    },
                    {
                        type: ApplicationCommandOptionType.String,
                        name: "answer",
                        description: "the answer as a ' / '-separated list of answers",
                        required: true,
                    },
                    {
                        type: ApplicationCommandOptionType.Attachment,
                        name: "image",
                        description: "attach an image to this question",
                    },
                    {
                        type: ApplicationCommandOptionType.String,
                        name: "explanation",
                        description: "explanation to be revealed with the answer",
                    },
                ],
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "delete",
                description: "delete a trivia question",
                options: [
                    {
                        type: ApplicationCommandOptionType.String,
                        name: "question",
                        description: "the question",
                        required: true,
                    },
                ],
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "start-loop",
                description: "start the trivia event loop",
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "stop-loop",
                description: "stop the trivia event loop",
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "delay",
                description: "get/set the delay until the next trivia instance",
                options: [
                    {
                        type: ApplicationCommandOptionType.Number,
                        name: "delay",
                        description: "delay (minutes) (set to 0 to post instantly)",
                        min_value: 0,
                    },
                ],
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "trend",
                description: "view the current trend of the number of answers being submitted",
            },
        ],
    },
    {
        type: ApplicationCommandType.ChatInput,
        name: "score",
        description: "view your / a member's event score",
        dmPermission: false,
        options: [{ type: ApplicationCommandOptionType.User, name: "user", description: "the user to view" }],
    },
    {
        type: ApplicationCommandType.ChatInput,
        name: "leaderboard",
        description: "view the event leaderboard",
        dmPermission: false,
        options: [
            { type: ApplicationCommandOptionType.Integer, name: "page", description: "the page to view", minValue: 1 },
        ],
    },
    {
        type: ApplicationCommandType.ChatInput,
        name: "add-score",
        description: "alter a user's score",
        dmPermission: false,
        default_member_permissions: "0",
        options: [
            {
                type: ApplicationCommandOptionType.User,
                name: "user",
                description: "the user to modify",
                required: true,
            },
            {
                type: ApplicationCommandOptionType.Integer,
                name: "delta",
                description: "the # of points to add (can be negative)",
                required: true,
            },
        ],
    },
]);
